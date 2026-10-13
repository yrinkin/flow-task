"""tasks 테이블을 만든다. 실행: python -m backend.init_db

이미 있는 테이블은 건너뛰며, 기존 테이블이나 데이터를 삭제하거나 초기화하지 않는다.
"""

from sqlalchemy import inspect

from backend.database import Base, engine
from backend import models  # noqa: F401  (테이블 정의를 Base에 등록)


def main() -> None:
    existing = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine, checkfirst=True)
    for table in Base.metadata.sorted_tables:
        state = "이미 있음(변경 없음)" if table.name in existing else "생성함"
        print(f"{table.name}: {state}")


if __name__ == "__main__":
    main()
