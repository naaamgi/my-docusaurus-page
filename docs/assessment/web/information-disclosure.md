---
sidebar_position: 27
title: 정보 노출
description: 웹 진단 - 백업 파일, .git, 에러 메시지, 디렉토리 리스팅, 주석 노출, 메타데이터 등 정보 노출 점검
keywords: [Information Disclosure, 정보노출, .git, backup, debug, error message, directory listing, OWASP A02]
draft: false
---

# 정보 노출
> 의도하지 않게 노출되는 **소스 코드 / 설정 / 자격증명 / 내부 정보** 점검.
> 단독으론 Low ~ Medium 이지만, 노출된 정보 (DB 자격증명, API 키, 백업 파일) 가 직접 후속 공격으로 연결되면 즉시 Critical.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A02:2025 - Security Misconfiguration / KISA 보안 설정 |
| **CWE** | [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html), [CWE-538: File and Directory Information Exposure](https://cwe.mitre.org/data/definitions/538.html), [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html) |
| **영향도** | 🟡 (단순 정찰 정보) / 🔴 (자격증명 / 소스 / 백업 노출) |
| **점검 난이도** | 하 (curl + 디렉토리 brute) |
| **예상 점검 시간** | 30분 ~ 2시간 |

---

## 점검 목적

서버가 의도하지 않게 노출하는 정보 (백업 파일, .git, 환경 설정, 에러 스택트레이스, 디렉토리 리스팅, 주석, 메타데이터) 를 확인한다. 정보 노출 자체는 단독 결함보다 **후속 공격의 단서** 역할이 핵심이지만, **노출된 정보가 자격증명 / 소스 코드 / 백업 DB** 면 단일 결함으로 Critical 등급.

> **다른 페이지와 영역 분리**
> - 에러 페이지의 SQL 인젝션 흔적 → `sql-injection.md`
> - CORS 응답에서 정보 유출 → `cors.md`
> - JWT 페이로드의 정보 노출 → `jwt-attacks.md` (Priority 2)
> - 캐시 / Server 헤더 → `security-headers.md`
> - Forced Browsing 으로 관리자 페이지 접근 → `authorization-idor.md` 케이스 6 과 일부 겹침 (본 페이지는 **민감 파일 / 정보** 위주)

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **소스 / 백업 파일 노출** | `.git/`, `.svn/`, `.bak`, `.old`, `backup.zip`, `db.sql.gz` |
| **환경 설정 파일** | `.env`, `config.json`, `application.properties`, `web.config` |
| **에러 메시지 / 스택트레이스** | 디버그 모드 활성, 예외 처리 미흡 |
| **디렉토리 리스팅** | `Index of /...` 노출 |
| **HTML 주석 / JS 번들** | 주석에 자격증명 / 내부 URL / TODO, JS 에 API 키 |
| **메타데이터** | 업로드 이미지의 EXIF, PDF / Office 의 작성자 / 경로 |
| **API 응답의 과도한 정보** | DB 컬럼 전부 응답, debug 필드 포함 |
| **로그 / 모니터링 노출** | `/actuator/*`, `/api/health/debug`, Kibana / Grafana 공개 |
| **`robots.txt` / `sitemap.xml`** | 숨겨야 할 경로가 단서로 노출 |

---

## 진단 절차

### Step 1. 표준 경로 / 파일 탐색

가장 자주 발견되는 경로부터 curl + 디렉토리 brute 로 확인:

```bash
# 표준 파일
for p in /robots.txt /sitemap.xml /.env /.git/config /.svn/entries \
         /backup.zip /backup.sql /db.sql /db.sql.gz /dump.sql \
         /web.config /WEB-INF/web.xml /.htaccess \
         /config.json /config.yml /application.properties \
         /phpinfo.php /info.php /test.php /admin.php \
         /server-status /server-info; do
    code=$(curl -s -o /dev/null -w "%{http_code}" https://<TARGET>$p)
    [ "$code" != "404" ] && echo "$code  $p"
done

# 디렉토리 brute
ffuf -u https://<TARGET>/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,403
gobuster dir -u https://<TARGET>/ -w /usr/share/wordlists/dirb/common.txt -x bak,old,zip,sql,tar.gz
```

### Step 2. 파일 확장자 / 백업 패턴 탐색

발견된 파일들의 **백업 / 옛 버전 / 임시 파일** 확인:

```bash
# index.php 가 있다면 다음도 시도:
/index.php.bak  /index.php~  /index.php.old  /index.php.swp  /.index.php.swp
/index.php.save  /index.php.orig  /index.php_bak  /index.php.bk

# JS 번들 옆에 소스맵 (.map) 노출 여부
/static/js/main.<hash>.js.map
```

### Step 3. 에러 메시지 / 디버그 모드 유도

```
- 잘못된 입력으로 예외 유도 (큰 숫자, 빈 값, 부정 타입)
- /nonexistent 경로 접근 시 응답 (Whitelabel Error / Django debug / Flask debug)
- 디버그 엔드포인트 (/__debug__/, /debug/, /actuator/health 등)
```

### Step 4. 클라이언트 측 단서 수집

HTML 주석, JS 번들, 소스맵, 응답 본문의 과도한 필드 분석.

### Step 5. 메타데이터 / 다운로드 파일 분석

업로드 후 다운로드되는 이미지 / PDF / Office 파일의 메타데이터 점검.

---

## 페이로드 / 테스트 케이스

### 케이스 1: `.git` / `.svn` 노출
**언제 쓰는지**: 모든 사이트에서 첫 단계. `.git/` 폴더가 웹 루트에 노출되면 소스 전체 복원 가능 → Critical.

**확인:**

```bash
curl -I https://<TARGET>/.git/config
curl -I https://<TARGET>/.git/HEAD

# 200 응답이면 .git 도구로 전체 소스 복원
git clone https://github.com/internetwache/GitTools
GitTools/Dumper/gitdumper.sh https://<TARGET>/.git/ output/
GitTools/Extractor/extractor.sh output/ extracted/
```

**판정**: `.git/config` 가 200 으로 응답 + Git 메타데이터 다운로드 가능 → 소스 전체 복원 가능. 자격증명 / API 키 / 비즈니스 로직 노출로 Critical.

**유사 — `.svn`, `.hg`, `.bzr`:**

```
/.svn/entries
/.svn/wc.db
/.hg/store/00manifest.i
```

### 케이스 2: 환경 / 설정 파일 노출

**언제 쓰는지**: 백엔드 프레임워크별 표준 설정 파일.

**탐색 대상:**

```
[일반]
/.env                          ← Node.js / Python 환경 변수 (DB, API 키)
/.env.local /.env.production /.env.dev
/config.json /config.yml /config.yaml

[Java]
/WEB-INF/web.xml
/WEB-INF/classes/application.properties
/WEB-INF/classes/application.yml

[ASP.NET]
/web.config
/web.config.bak

[PHP]
/config.php /config.inc.php /database.php /db.php
/wp-config.php /wp-config.php.bak

[Apache / Nginx]
/.htaccess /.htpasswd
/nginx.conf
```

**판정**: 200 응답 + 내용에 DB 자격증명 / API 키 / SECRET_KEY 가 포함되면 Critical. `.env` 의 직접 노출은 ASGI / Express 의 정적 디렉토리 잘못 설정에서 자주 발견.

### 케이스 3: 백업 / 임시 파일 노출

**언제 쓰는지**: 운영 중 백업 / 임시 파일을 웹 루트에 두고 잊은 경우.

**탐색 대상:**

```
[전체 백업]
/backup.zip /backup.tar.gz /www.zip /site.zip /htdocs.zip
/backup_2024.zip /db_backup.sql /dump.sql.gz

[파일별 백업 패턴]
<filename>.bak       <filename>~       <filename>.old
<filename>.orig      <filename>.save   <filename>.swp
.<filename>.swp      .<filename>.swo

[에디터 임시]
.DS_Store
Thumbs.db
.idea/                ← JetBrains IDE 설정
.vscode/
```

**확인:**

```bash
# 발견된 파일들 옆에 백업 패턴 시도
for ext in bak old orig save zip tar.gz; do
    curl -I https://<TARGET>/index.php.$ext
done

# wordlist 활용
ffuf -u https://<TARGET>/FUZZ \
     -w SecLists/Discovery/Web-Content/raft-medium-files.txt \
     -e .bak,.old,.zip,.tar.gz,.sql -mc 200
```

**판정**: 200 응답 + 다운로드되는 파일이 소스 / DB 백업 / 자격증명 포함 → Critical.

### 케이스 4: 에러 메시지 / 디버그 모드 노출

**언제 쓰는지**: 잘못된 입력 / 존재하지 않는 경로 / 예외 유도로 응답 확인.

**유도 페이로드:**

```
GET /nonexistent_path                   ← 404 페이지가 스택트레이스 노출?
GET /api/users/<INJECT_ERROR>           ← 타입 캐스팅 에러
POST /api/order  {큰 숫자 / 음수 / null} ← 예외 유도
```

**탐지 대상 패턴:**

```
[Flask debug=True]
Werkzeug Debugger 페이지 + 인터랙티브 콘솔 → 즉시 RCE

[Django debug=True]
"You're seeing this error because you have DEBUG = True"
+ 환경 변수 / 설정 / 트레이스백 전체

[Spring Boot Whitelabel Error]
스택트레이스에 패키지 / 클래스명 / 라인 번호

[Express stack trace]
Error: ... at /app/src/...:123

[PHP errors / warnings]
Warning: include(/etc/passwd) [function.include]: ...
```

**판정**:
- Flask `debug=True` → Werkzeug 콘솔 노출 시 즉시 RCE (Critical)
- Django/Spring/Express 스택트레이스 → 정보 노출 (Medium, 단독)
- 예외 메시지에 SQL 쿼리 / 파일 경로 / 자격증명 노출 시 임팩트 상향

### 케이스 5: 디렉토리 리스팅

**언제 쓰는지**: 정적 자원 디렉토리 / 업로드 디렉토리 확인.

**확인:**

```bash
curl https://<TARGET>/uploads/
curl https://<TARGET>/static/
curl https://<TARGET>/backup/
curl https://<TARGET>/files/
```

**탐지 신호:**

```html
<title>Index of /uploads</title>      ← Apache / Nginx 디렉토리 인덱스
또는
[DIR] backup/                          ← 파일 / 디렉토리 목록 평문 노출
```

**판정**: 디렉토리 리스팅 활성 + 민감 파일 (다른 사용자 업로드, 백업, 설정) 노출 시 임팩트 상향.

### 케이스 6: HTML 주석 / JS 번들 / 소스맵

**언제 쓰는지**: 모든 응답 본문 / 정적 자산 확인.

**HTML 주석 점검:**

```bash
curl https://<TARGET>/ | grep -E '<!--.*?-->' 
```

**찾는 단서:**

```html
<!-- TODO: remove debug login -->
<!-- admin: admin / Pass123! -->
<!-- internal API: https://internal.target.com/api -->
<!-- DEV server: dev.target.com -->
```

**JS 번들 분석:**

```bash
# 메인 JS 다운로드 후 grep
curl https://<TARGET>/static/js/main.<hash>.js > main.js

# API 엔드포인트
grep -oE '"/api/[^"]+"' main.js | sort -u

# 자격증명 패턴
grep -E '(api_key|apikey|secret|token|password)' main.js
grep -E 'AKIA[0-9A-Z]{16}' main.js                    # AWS Access Key
grep -E 'AIza[0-9A-Za-z\\-_]{35}' main.js             # Google API key
```

**소스맵 노출:**

```bash
# JS 옆에 .map 파일 노출되면 원본 소스 코드 복원 가능
curl -I https://<TARGET>/static/js/main.<hash>.js.map
```

**판정**: 주석에 자격증명 / 내부 URL 노출 (Medium), JS 에 API 키 노출 (High), 소스맵으로 백엔드 로직 복원 (High).

### 케이스 7: API 응답의 과도한 정보 / Excessive Data Exposure

**언제 쓰는지**: API 응답 본문 분석. OWASP API Security Top 10 의 API3.

**시나리오:**

```http
GET /api/users/me HTTP/1.1

HTTP/1.1 200 OK
{
  "id": 42,
  "email": "victim@example.com",
  "password_hash": "$2a$10$...",        ← 응답에 비밀번호 해시 포함
  "internal_id": "INT-99988",
  "kakao_uid": "...",
  "is_admin": false,
  "credit_score": 720,                  ← 클라이언트가 안 쓰는 필드
  "debug": {"db_query_time": "12ms"},
  "raw_payload": {...}
}
```

**판정**: 클라이언트 UI 가 쓰지 않는 민감 필드 (비밀번호 해시, 내부 ID, 신용 정보) 가 응답에 포함되면 결함. 백엔드가 ORM 의 전체 필드를 자동 직렬화 (`User.serialize()`) 한 패턴.

#### 회원정보 API의 평문 비밀번호 노출

마이페이지 / 내 정보 API는 로그인한 본인만 보는 기능이라 과소평가되지만, 응답에 평문 비밀번호가 포함되면 별도 고위험 결함으로 본다.

```http
GET /api/member/me HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<USER_SESSION>

HTTP/1.1 200 OK
Content-Type: application/json

{
  "userId": "user01",
  "email": "user01@example.com",
  "role": "USER",
  "password": "PlainTextPassword123!"
}
```

**판정:** `password` 평문이 응답에 포함되면 서버가 비밀번호를 복호화 가능하게 저장하거나 평문 저장 중일 가능성이 높다. 해시(`password_hash`) 노출보다 더 심각하게 보고, 동일 비밀번호 재사용으로 다른 서비스 계정 탈취까지 이어질 수 있다.

### 케이스 8: 메타데이터 노출
**언제 쓰는지**: 사용자 / 직원이 업로드한 이미지, PDF, Office 파일 다운로드 시.

**확인:**

```bash
# 이미지 EXIF
exiftool downloaded_image.jpg

# 자주 노출되는 정보:
# - GPS 좌표
# - 카메라 / 휴대폰 모델
# - 작성자 / 사용자명
# - 소프트웨어 버전
# - 작성 / 수정 시간

# PDF / Office
pdfinfo document.pdf
exiftool document.docx
```

**판정**: 외부 노출 파일 (썸네일, 첨부, 공개 게시물 이미지) 에 GPS / 작성자 / 내부 경로 등이 포함되면 Medium ~ High (개인정보보호법 영역 진입).

### 케이스 9: 모니터링 / 디버그 엔드포인트 노출

**언제 쓰는지**: Spring Boot / Express 등의 표준 모니터링 엔드포인트.

**탐색 대상:**

```
[Spring Boot Actuator]
/actuator/health
/actuator/info
/actuator/env                ← 환경 변수 전체 (DB 자격증명 포함)
/actuator/heapdump           ← 메모리 덤프 (세션 / 토큰 포함)
/actuator/threaddump
/actuator/loggers
/actuator/beans
/actuator/configprops
/actuator/mappings

[Express / Node.js]
/__debug__/
/status /metrics

[Prometheus / Grafana]
/metrics
/api/v1/admin

[기타]
/swagger /swagger-ui /api-docs /v2/api-docs    ← API 문서 노출
/graphql                                        ← GraphQL Introspection
/.well-known/
```

**판정**: `/actuator/env` 인증 없이 접근 + DB 자격증명 노출 → Critical. `/actuator/heapdump` 다운로드 후 세션 / 토큰 추출 → Critical.

### 케이스 10: `robots.txt` / `sitemap.xml` / `.well-known/`

**언제 쓰는지**: 정찰 단계 표준.

```bash
curl https://<TARGET>/robots.txt
curl https://<TARGET>/sitemap.xml
curl https://<TARGET>/.well-known/security.txt
curl https://<TARGET>/.well-known/openid-configuration
```

**판정**: `robots.txt` 의 `Disallow:` 항목이 단서 (`/admin/`, `/internal/`, `/api/v1/legacy/`). 단독은 Low.

### 그 외 — 한 줄 언급만

- **HTTP 헤더 정보 노출** (`Server`, `X-Powered-By`) → `security-headers.md` 케이스 6
- **DNS / 인증서 정보** — CT 로그, 인증서 SAN 의 내부 도메인 노출 (`crt.sh`, Censys). 외부 정찰 영역
- **CDN / S3 버킷 노출** — 잘못 설정된 S3 버킷, CloudFront 키 노출. 클라우드 점검 영역
- **`.well-known/openid-configuration`** — OIDC 표준이라 정상이지만, 일부 환경에서 내부 엔드포인트 노출

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] `.git/config` / `.svn/entries` 등 VCS 메타데이터 노출
- [ ] `.env`, `config.json`, `application.properties` 등 설정 파일 노출
- [ ] `backup.zip`, `db.sql` 등 백업 파일 노출
- [ ] 에러 페이지에 스택트레이스 / SQL 쿼리 / 파일 경로 노출
- [ ] Django/Flask debug 모드 활성 (특히 Flask Werkzeug 콘솔 = 즉시 RCE)
- [ ] 디렉토리 리스팅 활성 + 민감 파일 노출
- [ ] HTML 주석에 자격증명 / 내부 URL 노출
- [ ] JS 번들 / 소스맵에 API 키 / 비밀키 노출
- [ ] API 응답에 비밀번호 해시 / 내부 ID / 신용 정보 등 과도한 필드
- [ ] 업로드 / 다운로드 파일에 EXIF GPS / 작성자 메타데이터
- [ ] `/actuator/env`, `/swagger`, `/graphql` 등 인증 없이 접근

**오탐 주의:**

- [ ] `robots.txt` 자체는 정상 (단, Disallow 항목이 단서)
- [ ] `/health` 엔드포인트의 단순 OK 응답은 정상 (단, 내부 상태 / 버전 노출 시 결함)
- [ ] `.well-known/openid-configuration` 은 OIDC 표준
- [ ] 의도적으로 공개된 API 문서 (Swagger 공식 공개) 는 정책상 정상

---

## 참고자료

- [OWASP Testing Guide - Information Gathering](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/)
- [OWASP - Information Exposure](https://owasp.org/www-community/Information_exposure)
- [PortSwigger - Information disclosure vulnerabilities](https://portswigger.net/web-security/information-disclosure)
- [HackTricks - Information Disclosure](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web)
- [GitTools - .git extraction](https://github.com/internetwache/GitTools)
- [Spring Boot Actuator - Production-ready Features](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [SecLists - Discovery wordlists](https://github.com/danielmiessler/SecLists/tree/master/Discovery/Web-Content)
