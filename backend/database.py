"""MariaDB 연결 설정. 접속 정보는 프로젝트 루트의 .env(Git 제외)에서 읽는다."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# 이미 설정된 환경변수(예: 서버의 systemd 설정)가 있으면 .env보다 우선한다.
load_dotenv(PROJECT_ROOT / ".env", override=False)

REQUIRED_ENV = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


def _read_settings() -> dict[str, str]:
    missing = [name for name in REQUIRED_ENV if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"DB 접속 환경변수가 없습니다: {', '.join(missing)} (.env.example 참고)")
    return {name: os.environ[name] for name in REQUIRED_ENV}


def _build_url() -> URL:
    settings = _read_settings()
    # URL.create는 비밀번호의 특수문자를 안전하게 처리한다.
    return URL.create(
        "mysql+pymysql",
        username=settings["DB_USER"],
        password=settings["DB_PASSWORD"],
        host=settings["DB_HOST"],
        port=int(settings["DB_PORT"]),
        database=settings["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


# pool_pre_ping: DB 재시작 등으로 끊긴 연결을 사용 전에 확인해 다시 연결한다.
engine = create_engine(_build_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
