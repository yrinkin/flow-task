"""Task Flow API.

T07: 메모리 저장 기반 /api/tasks 조회(검색·필터)·등록·수정·삭제. 명세는 API-SPEC.md를 따른다.
메모리 단계이므로 API를 재시작하면 데이터가 사라진다.
"""

from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, HTTPException, Response

from backend.schemas import Priority, Status, Task, TaskCreate, TaskUpdate

app = FastAPI(title="Task Flow API")

# 메모리 저장소. 요청은 스레드풀에서 동시에 처리될 수 있으므로 Lock으로 보호한다.
tasks: list[Task] = []
next_id = 1
store_lock = Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def find_index(task_id: int) -> int:
    for index, task in enumerate(tasks):
        if task.id == task_id:
            return index
    raise HTTPException(status_code=404, detail="Task not found")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(q: str | None = None, status: Status | None = None, priority: Priority | None = None) -> list[Task]:
    keyword = (q or "").strip().casefold()
    with store_lock:
        return [
            task
            for task in tasks
            if (keyword == "" or keyword in task.title.casefold())
            and (status is None or task.status == status)
            and (priority is None or task.priority == priority)
        ]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate) -> Task:
    global next_id
    with store_lock:
        task = Task(id=next_id, created_at=utc_now(), **payload.model_dump())
        tasks.append(task)
        next_id += 1
    return task


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    with store_lock:
        index = find_index(task_id)
        task = tasks[index].model_copy(update=payload.changes())
        tasks[index] = task
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int) -> Response:
    with store_lock:
        del tasks[find_index(task_id)]
    return Response(status_code=204)
