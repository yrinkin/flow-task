"""요청·응답 스키마와 입력 검증. 규칙은 API-SPEC.md를 따른다."""

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

TITLE_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 2000

Status = Literal["TODO", "DOING", "DONE"]
Priority = Literal["HIGH", "NORMAL", "LOW"]

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_title(value: str) -> str:
    title = value.strip()
    if len(title) == 0:
        raise ValueError("제목을 입력하세요.")
    if len(title) > TITLE_MAX_LENGTH:
        raise ValueError(f"제목은 {TITLE_MAX_LENGTH}자 이하로 입력하세요.")
    return title


def validate_description(value: str) -> str:
    if len(value) > DESCRIPTION_MAX_LENGTH:
        raise ValueError(f"설명은 {DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요.")
    return value


# YYYY-MM-DD 형식이면서 실제 존재하는 날짜만 허용한다. 미지정은 None이다.
def validate_due_date(value: str | None) -> str | None:
    if value is None:
        return None
    if not DATE_PATTERN.match(value):
        raise ValueError("마감일은 YYYY-MM-DD 형식이어야 합니다.")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("존재하지 않는 날짜입니다.") from None
    return value


class TaskCreate(BaseModel):
    # 정의되지 않은 필드(id, created_at 포함)는 422로 거절한다.
    # examples는 /docs의 기본 요청 예시로 쓰인다.
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "title": "보고서 작성",
                    "description": "",
                    "status": "TODO",
                    "priority": "NORMAL",
                    "due_date": "2026-10-20",
                }
            ]
        },
    )

    title: str
    description: str = ""
    status: Status = "TODO"
    priority: Priority = "NORMAL"
    due_date: str | None = None

    _check_title = field_validator("title")(validate_title)
    _check_description = field_validator("description")(validate_description)
    _check_due_date = field_validator("due_date")(validate_due_date)


class TaskUpdate(BaseModel):
    """PATCH 요청. 보낸 필드만 수정하며 보내지 않은 필드는 유지한다."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"examples": [{"status": "DONE"}]},
    )

    title: str | None = None
    description: str | None = None
    status: Status | None = None
    priority: Priority | None = None
    due_date: str | None = None

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str | None) -> str | None:
        return None if value is None else validate_title(value)

    @field_validator("description")
    @classmethod
    def _check_description(cls, value: str | None) -> str | None:
        return None if value is None else validate_description(value)

    _check_due_date = field_validator("due_date")(validate_due_date)

    # due_date만 null로 지울 수 있다. 다른 필드에 null을 보내면 422로 거절한다.
    @model_validator(mode="after")
    def _reject_null(self) -> "TaskUpdate":
        for name in self.model_fields_set - {"due_date"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name}에는 null을 보낼 수 없습니다.")
        return self

    def changes(self) -> dict:
        return self.model_dump(include=self.model_fields_set)


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: str
