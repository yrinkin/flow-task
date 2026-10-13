# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  기록(2026-10-13): 변경 파일 frontend/index.html, styles.css, app.js(신규).
  서버 실행 후 curl로 세 파일 200 응답 확인, node --check 문법 확인.
  가짜 DOM에서 app.js 실행: 두 항목 등록, 빈 제목·공백 제목·101자 거절, 100자 허용, HTML 글자 표시 통과.
  사용자 브라우저 확인(2026-10-13): 두 항목 등록, 빈 제목 거절, 새로고침 시 초기화 정상. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  기록(2026-10-13): 변경 파일 frontend/app.js(저장·복원), index.html(저장소 경고 영역), styles.css(경고·비활성 스타일).
  가짜 DOM·localStorage에서 app.js 실행: 새로고침 후 유지, 손상값 6종(JSON 깨짐·배열 아님·필드 누락·빈 제목·중복 id·null) 덮어쓰지 않음+경고+등록 잠금,
  저장 실패 시 항목 되돌림, 저장소 접근 불가 시 잠금, HTML 글자 표시 통과. T01 기능(빈 제목·101자 거절, 100자 허용) 유지 확인.
  사용자 브라우저 확인(2026-10-13): 새로고침 후 유지, 손상값 경고·덮어쓰기 방지 정상. 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  기록(2026-10-13): 변경 파일 frontend/app.js(상태·제목 수정·삭제 확인), index.html(목록 오류 영역), styles.css(항목 행·수정 폼·DONE 스타일).
  범위: 제목만 수정한다(설명은 T04). status 없는 T02 저장값은 TODO로 읽고, 불러오기만으로는 저장값을 바꾸지 않는다.
  가짜 DOM·localStorage에서 app.js 실행 22개 통과: 기본 TODO, 선택 항목만 상태 변경, 같은 제목 중 id 기준 수정·삭제,
  수정 시 빈 제목·101자 거절, 수정 취소·Esc, 삭제 취소 시 유지, 새로고침 후 유지, 저장 실패 시 되돌림, T01·T02 기능 유지.
  사용자 브라우저 확인(2026-10-13): 상태 변경, 수정, 삭제 취소·확인 정상. 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  기록(2026-10-13): 변경 파일 frontend/app.js(설명·우선순위·마감일·검색·필터·지연), index.html(입력·필터 영역), styles.css(배지·지연·수정 폼).
  이전 단계 저장값의 없는 필드는 기본값(설명 "", NORMAL, null)으로 읽고, 형식이 틀린 값은 손상으로 보고 잠근다. 검색·필터는 저장하지 않는다.
  가짜 DOM·localStorage에서 app.js 실행 40개 통과: 기본값·필드 7개, 설명 2000자 허용·2001자 거절, 잘못된 날짜 거절,
  어제 마감 TODO 지연 표시(DONE·오늘·내일·마감 없음은 지연 아님), 검색+상태+우선순위 AND, 필터 중 같은 제목 항목 id 기준 수정·삭제·삭제 취소,
  새로고침 후 유지, 저장 실패 시 변경 없음, T01~T03 기능 유지.
  사용자 브라우저 확인(2026-10-13): 첫 확인은 브라우저가 이전 app.js 캐시(304)를 사용해 실패. 강력 새로고침 후 필터 중 수정·삭제, 어제 마감 TODO 지연 표시, 검색·필터 AND 정상. 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  기록(2026-10-13): 변경 파일 API-SPEC.md(T05~T07 API 계약), backend/__init__.py, backend/main.py, requirements.txt(신규).
  준비: python3 -m venv .venv, .venv/bin/python -m pip install -r requirements.txt (fastapi 0.143.0, uvicorn[standard] 0.54.0, Python 3.14.4).
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  curl -i http://127.0.0.1:8000/api/health → 200, {"status":"ok"}. 없는 경로 404, /docs 200. .venv·__pycache__는 Git 제외 확인.
  사용자 확인(2026-10-13): /api/health 응답 정상. 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  기록(2026-10-13): 변경 파일 backend/main.py(메모리 저장소·GET·POST), backend/schemas.py(신규, 입력 검증). 검색·필터 쿼리는 T07.
  curl 확인: 빈 목록 200 [], 제목만 POST 201(공백 제거·기본값), 전체 필드 POST 201, GET 목록 일치.
  422 16종 통과: 제목 누락·빈 값·공백·101자·null·숫자, 설명 2001자·null, 잘못된 status·priority, 날짜 형식·없는 날짜·ISO 주차, id·created_at 전송, JSON 깨짐.
  경계값 201: 제목 100자, 설명 2000자, due_date null, 2028-02-29. 거절된 요청은 id를 소비하지 않음. API 재시작 후 목록 []·id 1부터(메모리 단계 정상).
  /docs 기본 예시가 due_date "string"으로 422가 되어 스키마에 올바른 예시(examples) 추가. 검증 규칙은 변경 없음.
  사용자 /docs 확인(2026-10-13): due_date "string" 요청 422, 기본 예시 POST 201 후 GET 조회 정상. 남은 오류 없음.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  기록(2026-10-13): 변경 파일 backend/main.py(PATCH·DELETE·GET 필터), backend/schemas.py(TaskUpdate: 부분 수정, due_date만 null 허용).
  HTTP 요청 점검 38개 통과: PATCH 미전달 필드 유지(id·created_at 포함), due_date null로 지움, 빈 본문 변경 없음, 다른 항목 변경 없음,
  없는 id 404, 검증 위반·null·id/created_at 변경 시도 422(데이터 변경 없음). GET q(대소문자 무시)+status+priority AND, 잘못된 값 422.
  DELETE 204·본문 없음, 다시 삭제·없는 id 404, 삭제 후 id 재사용 없음. T06 POST 검증 유지.
  사용자 /docs 확인(2026-10-13): PATCH 미전달 필드 유지, 없는 id 404, DELETE 204, 필터 정상. 남은 오류 없음.
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  기록(2026-10-13): 변경 파일 frontend/app.js(localStorage → fetch, 서버 목록 기준·필터는 서버 쿼리), index.html·styles.css(API 오류 배너·다시 시도),
  backend/main.py(CORS: 127.0.0.1:5500, localhost:5500만 허용). 이전 localStorage 데이터는 이전·삭제하지 않음(PRD).
  curl preflight: 5500 출처 200·허용 헤더, 다른 출처 400.
  가짜 DOM + 실제 API(fetch) 21개 통과: 화면 등록 → 서버 저장, 화면 목록 = curl 목록(전체·필터), 상태·수정·삭제 PATCH/DELETE 반영,
  필터 중 id 기준 수정·삭제, 삭제 취소 유지, 이미 삭제된 항목 404 안내, 서버 422 메시지 표시, 지연 표시 유지, HTML 글자 표시,
  API 연결 불가·5초 시간 초과 시 오류 배너, 복구 후 [다시 시도].
  사용자 브라우저 확인(2026-10-13): 화면과 curl 목록 일치, API 서버 중지 시 오류 표시 정상. 남은 오류 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  기록(2026-10-13): MariaDB 11.8.6(설치·실행 중, 127.0.0.1:3306). 변경 파일 .env.example(신규, 가짜 값), .env(Git 제외, 권한 600, 무작위 비밀번호).
  사용자 실행(sudo mariadb): DB task_flow(utf8mb4_unicode_ci), 사용자 task_flow_app@localhost·@127.0.0.1,
  권한 task_flow.*에 SELECT·INSERT·UPDATE·DELETE·CREATE·ALTER·INDEX(DROP 없음). 비밀번호는 .env에서 읽어 명령 기록에 남기지 않음.
  접속 확인(.env 값, TCP 127.0.0.1): SELECT 1 → 1, CURRENT_USER task_flow_app, DATABASE task_flow, 테이블 0개.
  권한 확인: mysql.user 조회 거부(1142), DROP 거부(1142), 틀린 비밀번호 거부(1045).
  권한 확인용으로 만든 빈 테이블 _perm_check가 DROP 권한이 없어 남음 → 사용자가 sudo로 삭제, 테이블 0개 확인.
  오류: .env가 .env.example 내용(DB_PASSWORD=change-me)으로 바뀌어 접속 거부(1045). 사용자가 비밀번호를 새로 정해 .env와 DB 사용자에 반영.
  재확인(16:12): .env 권한 600, SELECT 1 → 1, CURRENT_USER task_flow_app, DATABASE task_flow, 테이블 0개. 남은 오류 없음.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  기록(2026-10-13): 변경 파일 backend/database.py(.env 읽기·엔진), models.py(tasks 테이블), init_db.py(신규), requirements.txt(SQLAlchemy 2.1.4, PyMySQL 1.2.3, python-dotenv 1.2.4).
  실행: .venv/bin/python -m backend.init_db → "tasks: 생성함", 다시 실행 → "tasks: 이미 있음(변경 없음)"(삭제·초기화 없음).
  SQL 확인(task_flow_app): SHOW TABLES → tasks, InnoDB·utf8mb4_unicode_ci, 행 0개. DESCRIBE: id int AUTO_INCREMENT PK, title varchar(100), description varchar(2000) 기본 '',
  status enum(TODO,DOING,DONE) 기본 TODO, priority enum(HIGH,NORMAL,LOW) 기본 NORMAL, due_date date NULL, created_at datetime(UTC, API가 입력).
  환경변수 없을 때 "DB 접속 환경변수가 없습니다" 오류 안내 확인. sql_mode STRICT_TRANS_TABLES(잘못된 값 거절). API(main.py)는 아직 메모리 저장(T11에서 교체).
  사용자 확인(2026-10-13): init_db 실행과 tasks 테이블 구조 정상. 남은 오류 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  기록(2026-10-13): 변경 파일 backend/main.py(메모리 → SQLAlchemy 세션, 요청마다 DB 세션), API-SPEC.md(503 추가). API 계약·프런트엔드 변경 없음.
  실행 중인 8000 서버(--reload)가 DB 모드로 전환됨. T07 API 점검 39개, T08 화면 점검 21개를 DB 대상으로 재실행해 모두 통과.
  SQL 조회 결과와 API 목록 일치(id·title·status·priority·due_date·created_at). 새 프로세스(8001)에서 같은 목록, 등록 후 종료·재시작해도 유지.
  한글·이모지 저장, q의 %·_는 글자 그대로 검색, 대소문자 무시. DB 접속 불가(DB_PORT=3999)일 때 GET·POST 503, 로그·응답에 접속 정보 없음.
  사용자 8000 API 재시작(16:23) 전후로 점검용 4개 행 유지 확인. 점검용 행 삭제 후 샘플 8개를 API로 재등록(PRD: 단계 간 자동 이전 없음), SQL 조회 일치.
  사용자 브라우저 확인(2026-10-13): 샘플 표시·지연 표시(어제·5일 전 마감 미완료), 수정 후 API 재시작해도 유지. 남은 오류 없음.
  추가 변경(2026-10-13, 사용자 요청, 개발 편의): FastAPI(8000)가 frontend/ 화면 파일도 함께 제공하고 app.js API 주소를 상대 경로 "/api"로 변경.
  이유: ngrok으로 주소 하나만 공개하면 화면(5500)과 API(8000)가 나뉘어 동작하지 않음. T14에서는 Nginx가 화면을 제공하고 /api만 App 서버로 프록시한다.
  확인: 127.0.0.1:8000과 ngrok 주소에서 /·app.js·/api/health·/api/tasks 200, 화면 목록 = 서버 목록, frontend/ 밖 파일(.env 등) 접근 6종 404. 5500 정적 서버는 더 이상 사용하지 않음.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
T11 이후 접속: http://127.0.0.1:8000 (화면·API·/docs 통합, 5500 정적 서버 사용 안 함)
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.