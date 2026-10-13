"""Task Flow API.

T05: 서버 동작 확인용 /api/health만 제공한다. 명세는 API-SPEC.md를 따른다.
"""

from fastapi import FastAPI

app = FastAPI(title="Task Flow API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
