# Task Flow API 명세
PRD.md의 요구사항을 API 계약으로 정리한다. 구현 순서는 PLAN.md를 따른다.
| 엔드포인트 | 구현 작업 |
|---|---|
| GET /api/health | T05 |
| GET, POST /api/tasks | T06 |
| PATCH, DELETE /api/tasks/{id}, 목록 필터 | T07 |

## 공통
- 기본 주소: `http://127.0.0.1:8000` (개발), 모든 경로는 `/api`로 시작한다.
- 요청·응답 본문은 JSON(UTF-8)이다. DELETE 성공 응답만 본문이 없다.
- 인증은 없다. (PRD: 로그인 없는 단일 사용자)
- 저장 방식은 단계별로 메모리(T06~T07) → MariaDB(T11)로 바뀌지만 이 계약은 유지한다.

## Task 객체
| 필드 | 타입 | 규칙 | 기본값 |
|---|---|---|---|
| id | integer | 서버가 발급하는 고유 번호. 수정·삭제는 이 값으로 처리한다. | 서버 발급 |
| title | string | 앞뒤 공백 제거 후 1~100자 | 필수 |
| description | string | 최대 2000자 | `""` |
| status | string | `TODO`, `DOING`, `DONE` | `TODO` |
| priority | string | `HIGH`, `NORMAL`, `LOW` | `NORMAL` |
| due_date | string \| null | `YYYY-MM-DD` 형식의 실제 날짜, 미지정은 `null` | `null` |
| created_at | string | 서버 생성 시각, ISO 8601 UTC (예: `2026-10-13T06:30:00Z`) | 서버 발급 |

- 글자 수는 유니코드 문자 기준이다.
- `id`, `created_at`은 클라이언트가 보내거나 바꿀 수 없다.
- 지연 여부는 사용자의 로컬 날짜 기준이므로 서버가 계산하지 않고 프런트엔드가 표시한다.

```json
{
  "id": 1,
  "title": "보고서 작성",
  "description": "",
  "status": "TODO",
  "priority": "NORMAL",
  "due_date": "2026-10-20",
  "created_at": "2026-10-13T06:30:00Z"
}
```

## GET /api/health
서버 동작 확인용이다.
- 200: `{"status": "ok"}`

## GET /api/tasks
할 일 목록을 등록 순서(id 오름차순)로 반환한다. 쿼리 조건은 모두 선택이며 함께 쓰면 AND로 적용한다.
| 쿼리 | 규칙 |
|---|---|
| q | 제목에 포함된 글자 검색, 대소문자 무시. 앞뒤 공백 제거 후 빈 값이면 조건 없음 |
| status | `TODO`, `DOING`, `DONE` 중 하나 |
| priority | `HIGH`, `NORMAL`, `LOW` 중 하나 |

- 200: Task 배열 (결과가 없으면 `[]`)
- 422: status 또는 priority 값이 허용 범위 밖

## POST /api/tasks
할 일을 등록한다.
```json
{ "title": "보고서 작성", "description": "", "priority": "HIGH", "due_date": "2026-10-20" }
```
- `title`만 필수다. 나머지는 생략하면 기본값을 쓴다. `status`도 보낼 수 있으며 생략하면 `TODO`다.
- 201: 생성된 Task
- 422: 제목 누락·빈 제목·100자 초과, 설명 2000자 초과, 허용되지 않은 status·priority, 잘못된 날짜, 정의되지 않은 필드(`id`, `created_at` 포함)

## PATCH /api/tasks/{id}
보낸 필드만 수정한다. 보내지 않은 필드는 그대로 유지한다.
```json
{ "status": "DONE", "due_date": null }
```
- 수정 가능 필드: title, description, status, priority, due_date
- `due_date`만 `null`을 보내 마감일을 지울 수 있다. 다른 필드의 `null`은 422다.
- 200: 수정된 Task
- 404: 해당 id 없음
- 422: POST와 같은 검증 위반

## DELETE /api/tasks/{id}
할 일을 삭제한다. 삭제 전 확인은 프런트엔드가 담당한다.
- 204: 삭제 성공, 본문 없음
- 404: 해당 id 없음

## 오류 응답
| 코드 | 본문 |
|---|---|
| 404 | `{"detail": "Task not found"}` |
| 422 | FastAPI 기본 검증 오류 형식 `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` |
