"""Task Flow API.

T06: 메모리 저장 기반 /api/tasks GET·POST. 명세는 API-SPEC.md를 따른다.
메모리 단계이므로 API를 재시작하면 데이터가 사라진다.
"""

from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI

from backend.schemas import Task, TaskCreate

app = FastAPI(title="Task Flow API")

# 메모리 저장소. 요청은 스레드풀에서 동시에 처리될 수 있으므로 Lock으로 보호한다.
tasks: list[Task] = []
next_id = 1
store_lock = Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks() -> list[Task]:
    with store_lock:
        return list(tasks)


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate) -> Task:
    global next_id
    with store_lock:
        task = Task(id=next_id, created_at=utc_now(), **payload.model_dump())
        tasks.append(task)
        next_id += 1
    return task
