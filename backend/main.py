"""Task Flow API.

T11: MariaDB 저장 기반 /api/tasks 조회(검색·필터)·등록·수정·삭제. 명세는 API-SPEC.md를 따른다.
DB 단계이므로 API를 재시작해도 데이터가 유지된다. 테이블은 python -m backend.init_db로 만든다.
"""

from collections.abc import Iterator
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import TaskRecord
from backend.schemas import Priority, Status, Task, TaskCreate, TaskUpdate

app = FastAPI(title="Task Flow API")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# 개발 단계(T08~T11): 정적 서버(5500)의 화면이 API(8000)를 호출할 수 있도록 허용한다.
# 최종 배포(T14)는 Nginx가 같은 주소의 /api로 프록시하므로 CORS가 필요 없다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


# DB에 접속할 수 없으면 원인을 알 수 없는 500 대신 503으로 알린다. 접속 정보는 응답에 넣지 않는다.
@app.exception_handler(OperationalError)
def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def utc_now() -> datetime:
    # DB의 DATETIME에는 시간대가 없으므로 UTC 기준 값을 초 단위로 저장한다.
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def to_task(record: TaskRecord) -> Task:
    return Task(
        id=record.id,
        title=record.title,
        description=record.description,
        status=record.status,
        priority=record.priority,
        due_date=record.due_date.isoformat() if record.due_date else None,
        created_at=record.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


# API의 YYYY-MM-DD 문자열을 DB의 date 값으로 바꾼다.
def to_db_values(values: dict) -> dict:
    if values.get("due_date") is not None:
        values = {**values, "due_date": date.fromisoformat(values["due_date"])}
    return values


def find_record(db: Session, task_id: int) -> TaskRecord:
    record = db.get(TaskRecord, task_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return record


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    status: Status | None = None,
    priority: Priority | None = None,
    db: Session = Depends(get_db),
) -> list[Task]:
    query = select(TaskRecord).order_by(TaskRecord.id)
    keyword = (q or "").strip()
    if keyword:
        # 대소문자 무시는 DB 정렬 규칙(utf8mb4_unicode_ci)이 처리한다. %, _는 글자 그대로 검색한다.
        query = query.where(TaskRecord.title.contains(keyword, autoescape=True))
    if status is not None:
        query = query.where(TaskRecord.status == status)
    if priority is not None:
        query = query.where(TaskRecord.priority == priority)
    return [to_task(record) for record in db.scalars(query)]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
    record = TaskRecord(**to_db_values(payload.model_dump()), created_at=utc_now())
    db.add(record)
    db.commit()
    db.refresh(record)
    return to_task(record)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    record = find_record(db, task_id)
    for name, value in to_db_values(payload.changes()).items():
        setattr(record, name, value)
    db.commit()
    db.refresh(record)
    return to_task(record)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> Response:
    db.delete(find_record(db, task_id))
    db.commit()
    return Response(status_code=204)


# 개발 편의: 화면 파일(frontend/)도 같은 포트(8000)에서 내보내 주소 하나로 접속한다. (ngrok 등)
# API 경로를 먼저 등록했으므로 /api 요청은 위의 엔드포인트가 처리한다. 반드시 맨 마지막에 둔다.
# 최종 배포(T14)에서는 Web 서버의 Nginx가 화면 파일을 내보내고 /api만 App 서버로 프록시한다.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
