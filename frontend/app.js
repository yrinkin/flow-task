"use strict";

// T03: localStorage에 저장하고, 상태 변경·제목 수정·삭제 확인을 id 기준으로 처리한다.
const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";
const STATUS_LABELS = {
  TODO: "할 일",
  DOING: "진행 중",
  DONE: "완료",
};
const STATUSES = Object.keys(STATUS_LABELS);
const DEFAULT_STATUS = "TODO";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 true. 이때는 기존 저장값을 덮어쓰지 않는다.
let storageLocked = false;
// 제목을 수정 중인 항목의 id. 한 번에 하나만 수정한다.
let editingId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const submitButton = form.querySelector("button[type='submit']");
const errorMessage = document.getElementById("form-error");
const listError = document.getElementById("list-error");
const storageError = document.getElementById("storage-error");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 공백 제거 후 1~100자인지 검사한다. 문제가 없으면 빈 문자열을 반환한다.
function validateTitle(title) {
  const length = Array.from(title).length;
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return "";
}

// T02에서 저장한 항목에는 status가 없으므로, 없는 경우는 허용하고 불러올 때 TODO로 본다.
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
    (!("status" in task) || STATUSES.includes(task.status))
  );
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

  const loadedTasks = parsed.map((task) => ({ ...task, status: task.status ?? DEFAULT_STATUS }));
  return { ok: true, tasks: loadedTasks, message: "" };
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
  titleInput.disabled = true;
  submitButton.disabled = true;
}

const SAVE_FAILED_MESSAGE = "저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.";

function changeStatus(id, status) {
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, status } : task));
  showListError(commitTasks(nextTasks) ? "" : SAVE_FAILED_MESSAGE);
  renderTasks();
}

// 수정에 성공하면 빈 문자열, 실패하면 오류 문구를 반환한다.
function updateTitle(id, rawTitle) {
  const title = rawTitle.trim();
  const error = validateTitle(title);
  if (error) {
    return error;
  }
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, title } : task));
  if (!commitTasks(nextTasks)) {
    return SAVE_FAILED_MESSAGE;
  }
  editingId = null;
  showListError("");
  renderTasks();
  return "";
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

function createViewRow(task) {
  const row = document.createElement("div");
  row.className = "task-row";

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;

  const statusSelect = document.createElement("select");
  statusSelect.className = "status-select";
  statusSelect.setAttribute("aria-label", "상태");
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = STATUS_LABELS[status];
    statusSelect.appendChild(option);
  }
  statusSelect.value = task.status;
  statusSelect.disabled = storageLocked;
  statusSelect.addEventListener("change", () => changeStatus(task.id, statusSelect.value));

  const editButton = createButton("수정", () => {
    editingId = task.id;
    showListError("");
    renderTasks();
  });
  const deleteButton = createButton("삭제", () => deleteTask(task.id), "danger");

  row.append(title, statusSelect, editButton, deleteButton);
  return row;
}

function createEditForm(task) {
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  editForm.noValidate = true;

  const input = document.createElement("input");
  input.type = "text";
  input.value = task.title;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "제목 수정");

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const cancel = () => {
    editingId = null;
    renderTasks();
  };

  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = updateTitle(task.id, input.value);
    if (message) {
      error.textContent = message;
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancel();
    }
  });

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "저장";

  editForm.append(input, saveButton, createButton("취소", cancel));

  const wrapper = document.createElement("div");
  wrapper.append(editForm, error);
  return { element: wrapper, input };
}

function renderTasks() {
  taskList.replaceChildren();
  let editInput = null;

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    item.dataset.status = task.status;

    if (task.id === editingId && !storageLocked) {
      const editForm = createEditForm(task);
      item.appendChild(editForm.element);
      editInput = editForm.input;
    } else {
      item.appendChild(createViewRow(task));
    }
    taskList.appendChild(item);
  }

  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;
  if (editInput) {
    editInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (storageLocked) {
    return;
  }

  const title = titleInput.value.trim();
  const error = validateTitle(title);
  if (error) {
    showError(error);
    titleInput.focus();
    return;
  }

  const newTask = {
    id: createId(),
    title,
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

const loaded = loadTasks();
tasks = loaded.tasks;
if (!loaded.ok) {
  lockStorage(loaded.message);
}
renderTasks();
