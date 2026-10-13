"use strict";

// T04: localStorage에 저장하고, 설명·우선순위·마감일·검색·필터·지연 표시를 지원한다.
// 수정과 삭제는 화면 순번이 아닌 id 기준으로 처리한다.
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
const STATUS_LABELS = {
  TODO: "할 일",
  DOING: "진행 중",
  DONE: "완료",
};
const STATUSES = Object.keys(STATUS_LABELS);
const DEFAULT_STATUS = "TODO";
const PRIORITY_LABELS = {
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};
const PRIORITIES = Object.keys(PRIORITY_LABELS);
const DEFAULT_PRIORITY = "NORMAL";
const SAVE_FAILED_MESSAGE = "저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 true. 이때는 기존 저장값을 덮어쓰지 않는다.
let storageLocked = false;
// 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;
// 수정 모드에 들어갈 때만 수정 입력란으로 포커스를 옮긴다. (검색 입력 중 포커스 이동 방지)
let focusEditOnRender = false;
// 검색·필터 조건은 저장하지 않는 화면 상태다.
const filters = { search: "", status: "", priority: "" };

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const descriptionInput = document.getElementById("task-description");
const submitButton = form.querySelector("button[type='submit']");
const errorMessage = document.getElementById("form-error");
const listError = document.getElementById("list-error");
const storageError = document.getElementById("storage-error");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

// 이전 단계에서 저장한 항목에는 일부 필드가 없을 수 있다.
// 없는 필드는 허용하고 불러올 때 기본값으로 보며, 있는 필드는 형식을 검사한다.
function isValidStoredTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    task.id !== "" &&
    typeof task.title === "string" &&
    task.title === task.title.trim() &&
    validateTitle(task.title) === "" &&
    typeof task.created_at === "string" &&
    (!("status" in task) || STATUSES.includes(task.status)) &&
    (!("description" in task) ||
      (typeof task.description === "string" && validateDescription(task.description) === "")) &&
    (!("priority" in task) || PRIORITIES.includes(task.priority)) &&
    (!("due_date" in task) || validateDueDate(task.due_date) === "")
  );
}

function withDefaults(task) {
  return {
    ...task,
    description: task.description ?? "",
    status: task.status ?? DEFAULT_STATUS,
    priority: task.priority ?? DEFAULT_PRIORITY,
    due_date: task.due_date ?? null,
  };
}

// 저장값을 읽어 { ok, tasks, message } 형태로 반환한다.
function loadTasks() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { ok: false, tasks: [], message: "브라우저 저장소를 사용할 수 없어 목록을 불러오거나 저장할 수 없습니다." };
  }

  if (raw === null) {
    return { ok: true, tasks: [], message: "" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = undefined;
  }

  const ids = new Set();
  const valid =
    Array.isArray(parsed) &&
    parsed.every((task) => {
      if (!isValidStoredTask(task) || ids.has(task.id)) {
        return false;
      }
      ids.add(task.id);
      return true;
    });

  if (!valid) {
    return {
      ok: false,
      tasks: [],
      message: `저장된 데이터(${STORAGE_KEY})가 손상되어 불러오지 못했습니다. 기존 데이터를 보호하기 위해 등록을 막았습니다.`,
    };
  }

  return { ok: true, tasks: parsed.map(withDefaults), message: "" };
}

// 새 목록을 저장하고, 성공했을 때만 화면의 목록을 바꾼다.
function commitTasks(nextTasks) {
  if (storageLocked) {
    return false;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
  } catch (error) {
    return false;
  }
  tasks = nextTasks;
  return true;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.due_date < today && task.status !== "DONE";
}

function matchesFilters(task) {
  const keyword = filters.search.trim().toLowerCase();
  return (
    (keyword === "" || task.title.toLowerCase().includes(keyword)) &&
    (filters.status === "" || task.status === filters.status) &&
    (filters.priority === "" || task.priority === filters.priority)
  );
}

function showError(message) {
  errorMessage.textContent = message;
  titleInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function showListError(message) {
  listError.textContent = message;
}

function lockStorage(message) {
  storageLocked = true;
  storageError.textContent = message;
  storageError.hidden = false;
  for (const element of [titleInput, priorityInput, dueDateInput, descriptionInput, submitButton]) {
    element.disabled = true;
  }
}

function updateTask(id, changes) {
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, ...changes } : task));
  return commitTasks(nextTasks);
}

function changeStatus(id, status) {
  showListError(updateTask(id, { status }) ? "" : SAVE_FAILED_MESSAGE);
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 항목을 삭제할까요?`)) {
    return;
  }
  const nextTasks = tasks.filter((item) => item.id !== id);
  if (!commitTasks(nextTasks)) {
    showListError(SAVE_FAILED_MESSAGE);
    return;
  }
  if (editingId === id) {
    editingId = null;
  }
  showListError("");
  renderTasks();
}

function createButton(label, onClick, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.disabled = storageLocked;
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
  statusSelect.disabled = storageLocked;
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

  editForm.addEventListener("submit", (event) => {
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
    if (!updateTask(task.id, values)) {
      error.textContent = SAVE_FAILED_MESSAGE;
      return;
    }
    editingId = null;
    showListError("");
    renderTasks();
  });
  editForm.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancel();
    }
  });

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "저장";

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
  const visibleTasks = tasks.filter(matchesFilters);

  for (const task of visibleTasks) {
    const overdue = isOverdue(task, today);
    const item = document.createElement("li");
    item.dataset.id = task.id;
    item.dataset.status = task.status;
    if (overdue) {
      item.className = "overdue";
    }

    if (task.id === editingId && !storageLocked) {
      const editForm = createEditForm(task);
      item.appendChild(editForm.element);
      editInput = editForm.input;
    } else {
      item.appendChild(createViewRow(task, overdue));
    }
    taskList.appendChild(item);
  }

  const filtered = visibleTasks.length !== tasks.length;
  taskCount.textContent = filtered ? `(${visibleTasks.length} / 전체 ${tasks.length})` : `(${tasks.length})`;
  emptyMessage.textContent = tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visibleTasks.length > 0;
  if (editInput && focusEditOnRender) {
    editInput.focus();
  }
  focusEditOnRender = false;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (storageLocked) {
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

  const newTask = {
    id: createId(),
    ...values,
    status: DEFAULT_STATUS,
    created_at: new Date().toISOString(),
  };

  if (!commitTasks([...tasks, newTask])) {
    showError(SAVE_FAILED_MESSAGE);
    return;
  }

  showError("");
  form.reset();
  titleInput.focus();
  renderTasks();
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  renderTasks();
});
statusFilter.addEventListener("change", () => {
  filters.status = statusFilter.value;
  renderTasks();
});
priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  renderTasks();
});

const loaded = loadTasks();
tasks = loaded.tasks;
if (!loaded.ok) {
  lockStorage(loaded.message);
}
renderTasks();
