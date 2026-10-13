"use strict";

// T08: 저장을 FastAPI 호출로 처리한다. 목록의 기준은 서버이며, 변경 후에는 서버 목록을 다시 불러온다.
// 수정과 삭제는 화면 순번이 아닌 id 기준으로 처리한다. 지연 여부는 로컬 날짜 기준으로 화면에서 계산한다.
// 이전 단계의 localStorage(task-flow-v1) 데이터는 이전하지 않으며 지우지도 않는다. (PRD: 자동 데이터 이전 없음)

// 개발 단계 API 주소. 최종 배포(T14)에서는 Nginx 프록시를 거치는 "/api"로 바꾼다.
const API_BASE = "http://127.0.0.1:8000/api";
const REQUEST_TIMEOUT_MS = 5000;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STATUS_LABELS = {
  TODO: "할 일",
  DOING: "진행 중",
  DONE: "완료",
};
const PRIORITY_LABELS = {
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};
const PRIORITIES = Object.keys(PRIORITY_LABELS);
const CONNECTION_FAILED_MESSAGE = "API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.";

// 서버에서 받은 현재 필터 조건의 목록
let tasks = [];
// 마지막 목록 요청 번호. 늦게 도착한 이전 요청의 응답은 무시한다.
let loadSequence = 0;
let searchTimer = null;
// 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;
// 수정 모드에 들어갈 때만 수정 입력란으로 포커스를 옮긴다. (검색 입력 중 포커스 이동 방지)
let focusEditOnRender = false;
// 검색·필터 조건은 저장하지 않는 화면 상태이며, 서버 목록 조회 쿼리로 보낸다.
const filters = { search: "", status: "", priority: "" };

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const descriptionInput = document.getElementById("task-description");
const submitButton = form.querySelector("button[type='submit']");
const errorMessage = document.getElementById("form-error");
const listError = document.getElementById("list-error");
const apiError = document.getElementById("api-error");
const apiErrorMessage = document.getElementById("api-error-message");
const retryButton = document.getElementById("api-retry");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function charLength(text) {
  return Array.from(text).length;
}

// 로컬 달력 기준 오늘 날짜를 YYYY-MM-DD로 반환한다.
function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// 공백 제거 후 1~100자인지 검사한다. 문제가 없으면 빈 문자열을 반환한다.
function validateTitle(title) {
  const length = charLength(title);
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return "";
}

function validateDescription(description) {
  const length = charLength(description);
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return "";
}

// YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 검사한다.
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateDueDate(dueDate) {
  if (dueDate === null || isValidDate(dueDate)) {
    return "";
  }
  return "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.";
}

// 입력값을 검사해 { error, values } 형태로 반환한다. 마감일 빈 값은 null이다.
function readTaskFields({ title, description, priority, dueDate }) {
  const values = {
    title: title.trim(),
    description,
    priority,
    due_date: dueDate === "" ? null : dueDate,
  };
  const error =
    validateTitle(values.title) ||
    validateDescription(values.description) ||
    (PRIORITIES.includes(values.priority) ? "" : "우선순위를 선택하세요.") ||
    validateDueDate(values.due_date);
  return { error, values };
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 422 응답의 detail 배열에서 사용자에게 보여 줄 문구를 만든다.
function validationMessage(data) {
  if (!data || !Array.isArray(data.detail)) {
    return "입력값이 올바르지 않습니다.";
  }
  return data.detail.map((item) => String(item.msg).replace(/^Value error, /, "")).join(" ");
}

// API를 호출하고 JSON 본문을 반환한다. 204는 null을 반환한다. 실패하면 ApiError를 던진다.
async function request(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(0, CONNECTION_FAILED_MESSAGE);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return null;
  }
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  if (response.ok) {
    return data;
  }
  if (response.status === 404) {
    throw new ApiError(404, "항목을 찾을 수 없습니다. 이미 삭제되었을 수 있어 목록을 새로 불러옵니다.");
  }
  if (response.status === 422) {
    throw new ApiError(422, validationMessage(data));
  }
  throw new ApiError(response.status, `서버 오류가 발생했습니다. (HTTP ${response.status})`);
}

function buildListQuery() {
  const params = new URLSearchParams();
  if (filters.search.trim() !== "") {
    params.set("q", filters.search.trim());
  }
  if (filters.status !== "") {
    params.set("status", filters.status);
  }
  if (filters.priority !== "") {
    params.set("priority", filters.priority);
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

function showApiError(message) {
  apiErrorMessage.textContent = message;
  apiError.hidden = false;
}

function hideApiError() {
  apiError.hidden = true;
  apiErrorMessage.textContent = "";
}

// 현재 필터 조건으로 서버 목록을 불러와 화면에 반영한다. 성공하면 true를 반환한다.
async function loadTasks() {
  const sequence = ++loadSequence;
  try {
    const data = await request(`/tasks${buildListQuery()}`);
    if (sequence !== loadSequence) {
      return true;
    }
    tasks = data;
    hideApiError();
    renderTasks();
    return true;
  } catch (error) {
    if (sequence === loadSequence) {
      showApiError(error.message);
    }
    return false;
  }
}

// 변경 요청이 실패했을 때 오류를 알린다. 연결 실패는 상단 배너, 그 외는 목록 오류로 보여 준다.
function reportActionError(error) {
  if (error.status === 0) {
    showApiError(error.message);
  } else {
    showListError(error.message);
  }
  if (error.status === 404) {
    editingId = null;
    loadTasks();
  }
}

function isOverdue(task, today) {
  return task.due_date !== null && task.due_date < today && task.status !== "DONE";
}

function showError(message) {
  errorMessage.textContent = message;
  titleInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function showListError(message) {
  listError.textContent = message;
}

async function changeStatus(id, status) {
  try {
    await request(`/tasks/${id}`, { method: "PATCH", body: { status } });
    showListError("");
  } catch (error) {
    reportActionError(error);
  }
  // 실패한 경우에도 서버 목록으로 다시 그려 선택 상자를 실제 값으로 되돌린다.
  if (!(await loadTasks())) {
    renderTasks();
  }
}

async function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 항목을 삭제할까요?`)) {
    return;
  }
  try {
    await request(`/tasks/${id}`, { method: "DELETE" });
  } catch (error) {
    reportActionError(error);
    return;
  }
  if (editingId === id) {
    editingId = null;
  }
  showListError("");
  await loadTasks();
}

function createButton(label, onClick, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.addEventListener("click", onClick);
  return button;
}

function createSelect(labels, value, ariaLabel, className) {
  const select = document.createElement("select");
  select.className = className;
  select.setAttribute("aria-label", ariaLabel);
  for (const [optionValue, label] of Object.entries(labels)) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

// 사용자 입력(제목·설명)은 HTML로 해석하지 않고 textContent로만 표시한다.
function createViewRow(task, overdue) {
  const row = document.createElement("div");
  row.className = "task-row";

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.appendChild(createBadge(`우선순위 ${PRIORITY_LABELS[task.priority]}`, `priority-${task.priority}`));
  if (task.due_date !== null) {
    meta.appendChild(createBadge(`마감 ${task.due_date}`, "due-date"));
  }
  if (overdue) {
    meta.appendChild(createBadge("지연", "overdue-badge"));
  }

  main.append(title, meta);
  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.appendChild(description);
  }

  const controls = document.createElement("div");
  controls.className = "task-controls";

  const statusSelect = createSelect(STATUS_LABELS, task.status, "상태", "status-select");
  statusSelect.addEventListener("change", () => changeStatus(task.id, statusSelect.value));

  const editButton = createButton("수정", () => {
    editingId = task.id;
    focusEditOnRender = true;
    showListError("");
    renderTasks();
  });
  const deleteButton = createButton("삭제", () => deleteTask(task.id), "danger");

  controls.append(statusSelect, editButton, deleteButton);
  row.append(main, controls);
  return row;
}

function createEditForm(task) {
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  editForm.noValidate = true;

  const titleField = document.createElement("input");
  titleField.type = "text";
  titleField.className = "edit-title";
  titleField.value = task.title;
  titleField.autocomplete = "off";
  titleField.setAttribute("aria-label", "제목 수정");

  const priorityField = createSelect(PRIORITY_LABELS, task.priority, "우선순위 수정", "edit-priority");

  const dueDateField = document.createElement("input");
  dueDateField.type = "date";
  dueDateField.className = "edit-due-date";
  dueDateField.value = task.due_date ?? "";
  dueDateField.setAttribute("aria-label", "마감일 수정");

  const descriptionField = document.createElement("textarea");
  descriptionField.className = "edit-description";
  descriptionField.rows = 3;
  descriptionField.value = task.description;
  descriptionField.placeholder = "설명 (선택, 최대 2000자)";
  descriptionField.setAttribute("aria-label", "설명 수정");

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const cancel = () => {
    editingId = null;
    renderTasks();
  };

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "저장";

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { error: message, values } = readTaskFields({
      title: titleField.value,
      description: descriptionField.value,
      priority: priorityField.value,
      dueDate: dueDateField.value,
    });
    if (message) {
      error.textContent = message;
      return;
    }
    saveButton.disabled = true;
    try {
      await request(`/tasks/${task.id}`, { method: "PATCH", body: values });
    } catch (requestError) {
      saveButton.disabled = false;
      if (requestError.status === 404) {
        reportActionError(requestError);
      } else {
        error.textContent = requestError.message;
      }
      return;
    }
    editingId = null;
    showListError("");
    await loadTasks();
  });
  editForm.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancel();
    }
  });

  const titleRow = document.createElement("div");
  titleRow.className = "edit-form-row";
  titleRow.append(titleField, saveButton, createButton("취소", cancel));

  const detailRow = document.createElement("div");
  detailRow.className = "edit-form-row";
  detailRow.append(priorityField, dueDateField);

  editForm.append(titleRow, detailRow, descriptionField);

  const wrapper = document.createElement("div");
  wrapper.append(editForm, error);
  return { element: wrapper, input: titleField };
}

function renderTasks() {
  taskList.replaceChildren();
  let editInput = null;
  const today = todayLocal();
  for (const task of tasks) {
    const overdue = isOverdue(task, today);
    const item = document.createElement("li");
    item.dataset.id = task.id;
    item.dataset.status = task.status;
    if (overdue) {
      item.className = "overdue";
    }

    if (task.id === editingId) {
      const editForm = createEditForm(task);
      item.appendChild(editForm.element);
      editInput = editForm.input;
    } else {
      item.appendChild(createViewRow(task, overdue));
    }
    taskList.appendChild(item);
  }

  const filtered = filters.search.trim() !== "" || filters.status !== "" || filters.priority !== "";
  taskCount.textContent = filtered ? `(검색 결과 ${tasks.length})` : `(${tasks.length})`;
  emptyMessage.textContent = filtered ? "조건에 맞는 할 일이 없습니다." : "등록된 할 일이 없습니다.";
  emptyMessage.hidden = tasks.length > 0;
  if (editInput && focusEditOnRender) {
    editInput.focus();
  }
  focusEditOnRender = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) {
    return;
  }

  const { error, values } = readTaskFields({
    title: titleInput.value,
    description: descriptionInput.value,
    priority: priorityInput.value,
    dueDate: dueDateInput.value,
  });
  if (error) {
    showError(error);
    titleInput.focus();
    return;
  }

  // 응답 전 중복 등록을 막는다.
  submitButton.disabled = true;
  try {
    await request("/tasks", { method: "POST", body: values });
  } catch (requestError) {
    if (requestError.status === 0) {
      showError("");
      showApiError(requestError.message);
    } else {
      showError(requestError.message);
    }
    return;
  } finally {
    submitButton.disabled = false;
  }

  showError("");
  form.reset();
  titleInput.focus();
  await loadTasks();
});

// 검색어는 입력이 잠시 멈춘 뒤 요청해 글자마다 요청하지 않는다.
searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 250);
});
statusFilter.addEventListener("change", () => {
  filters.status = statusFilter.value;
  loadTasks();
});
priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  loadTasks();
});
retryButton.addEventListener("click", () => {
  loadTasks();
});

renderTasks();
loadTasks();
