"""DB 테이블 정의. 필드 규칙은 API-SPEC.md의 Task 객체를 따른다."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base
from backend.schemas import DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH


class TaskRecord(Base):
    __tablename__ = "tasks"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(TITLE_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(String(DESCRIPTION_MAX_LENGTH), nullable=False, server_default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"), nullable=False, server_default="TODO"
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"), nullable=False, server_default="NORMAL"
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # UTC 시각을 저장한다. DB 서버 시간대에 영향받지 않도록 값은 API가 넣는다.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
