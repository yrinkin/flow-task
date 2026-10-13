"use strict";

// T02: 브라우저 localStorage에 저장하고 새로고침 시 복원한다.
const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 true. 이때는 기존 저장값을 덮어쓰지 않는다.
let storageLocked = false;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const submitButton = form.querySelector("button[type='submit']");
const errorMessage = document.getElementById("form-error");
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

function isValidStoredTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    task.id !== "" &&
    typeof task.title === "string" &&
    task.title === task.title.trim() &&
    validateTitle(task.title) === "" &&
    typeof task.created_at === "string"
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

  return { ok: true, tasks: parsed, message: "" };
}

// 저장에 성공하면 true를 반환한다.
function saveTasks() {
  if (storageLocked) {
    return false;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    return false;
  }
}

function showError(message) {
  errorMessage.textContent = message;
  titleInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function lockStorage(message) {
  storageLocked = true;
  storageError.textContent = message;
  storageError.hidden = false;
  titleInput.disabled = true;
  submitButton.disabled = true;
}

function renderTasks() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
    item.textContent = task.title;
    taskList.appendChild(item);
  }

  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;
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

  tasks.push({
    id: createId(),
    title,
    created_at: new Date().toISOString(),
  });

  if (!saveTasks()) {
    tasks.pop();
    showError("저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.");
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
