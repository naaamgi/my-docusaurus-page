---
sidebar_position: 11
title: 정보 노출
description: 웹 진단 - 백업 파일, .git, 에러 메시지, 디렉토리 리스팅, 주석 노출, 메타데이터 등 정보 노출 점검
keywords: [Information Disclosure, 정보노출, .git, backup, debug, error message, directory listing, OWASP A02]
draft: false
---

## 점검 목적

웹 응답·정적 파일·API·오류·다운로드 문서에서 의도하지 않은 사용자 정보, 소스, 설정, 자격증명과 내부 구조가 노출되는지 확인한다. 파일이나 경로의 존재만으로 판정하지 않고, 실제 내용의 민감도와 현재 사용 가능성을 구분한다.

- JavaScript bundle과 source map의 분석 절차는 [JavaScript 분석](./javascript-analysis.md)에서 다룬다.
- 오류 처리 방식 자체는 [예외 처리 미흡](./error-handling.md)에서 다룬다.
- 제품 배너·캐시·보안 헤더는 [보안 헤더 점검](./security-headers.md)에서 다룬다.
- 다른 사용자 객체의 과도한 응답은 [권한 검증 / IDOR](./authorization-idor.md)도 함께 확인한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 공개 단서 | `robots.txt`, 주석, 배너, 경로명이 구조를 보여줌 | 단독 노출과 후속 접근을 분리 |
| 소스·백업 | VCS, 임시 파일, 압축본이 원본 내용을 반환함 | 대표 파일로 확인 후 민감 내용 분류 |
| 설정·자격증명 | 환경·DB·API 설정값이 응답됨 | 키 종류, 범위, 현재 유효성 확인 |
| 오류·디버그 | stack trace, 경로, query, 내부 서비스명이 노출됨 | 같은 입력의 정상 응답과 비교 |
| API 과다 응답 | UI에서 쓰지 않는 개인정보·내부 필드가 포함됨 | 본인 정보와 타인 정보 접근을 구분 |
| 파일 목록·메타데이터 | 디렉터리 목록이나 문서 속성이 노출됨 | 실제 민감 파일·개인정보 존재 확인 |
| 운영 endpoint | health·metrics·API 문서가 내부 상태를 보여줌 | endpoint 존재보다 반환 내용과 인증 확인 |

---

## 진단 절차

#### Step 1. 정상 응답과 404 기준선 저장

메인 HTML, 로그인 후 화면, JSON API, 정적 파일, 존재하지 않는 경로의 상태 코드·길이·제목을 저장한다. 이후 후보가 `200`이어도 같은 custom 404 본문이면 파일 노출로 보지 않는다.

```bash
curl -sS -D - https://<TARGET>/ -o home.body
curl -sS -D - https://<TARGET>/not-found-<RANDOM> -o not-found.body
```

#### Step 2. 이미 공개된 단서부터 확인

낮은 요청 수로 표준 공개 파일과 HTML·응답 Header를 확인한다.

```text
/robots.txt
/sitemap.xml
/.well-known/security.txt
HTML 주석
응답에 연결된 JavaScript·source map
다운로드 링크와 파일명
```

`robots.txt`, sitemap, OIDC discovery, API 문서는 원래 공개될 수 있다. 내용에서 새 경로·내부 host·민감 필드를 찾았을 때 다음 단계로 이동한다.

#### Step 3. 발견한 파일명에만 백업 패턴 적용

실제 HTML·오류·JS·디렉터리 목록에서 찾은 파일명을 기준으로 변형한다.

```text
index.php → index.php.bak, index.php.old, index.php~
config.yml → config.yml.bak, config.old.yml
app.js → app.js.map
release.zip → release-old.zip
```

처음부터 확장자 조합을 대량으로 돌리기보다 관찰한 기술과 파일명에 맞춘다. 자동 탐색 도구는 승인된 요청량 안에서 보조로 사용한다.

#### Step 4. 안전한 오류 비교

정상 요청에서 필드 하나만 잘못된 타입·빈 값·존재하지 않는 테스트 ID로 바꾼다.

```text
숫자 ID → 문자열 한 개
필수 필드 → 빈 값 또는 누락
존재하는 테스트 ID → 존재하지 않는 임의 ID
정상 Method → 같은 endpoint의 지원하지 않는 Method
```

stack trace, 파일 경로, query, 내부 host, framework debug 페이지가 추가되는지 본다. 긴 문자열·큰 수·복잡한 payload로 가용성에 영향을 주는 오류는 기본 절차에서 피한다.

#### Step 5. API 원문과 UI·JS 사용 필드 비교

UI에 표시되는 값과 실제 JSON 필드를 나란히 놓는다. [JavaScript 분석](./javascript-analysis.md)에서 프런트엔드가 참조하는 필드도 확인한다.

```text
개인정보·금융정보
password·hash·token·secret
내부 사용자·조직 ID
권한·관리 상태
debug·query·원본 payload
삭제되었거나 마스킹 전의 값
```

UI에서 쓰지 않는다는 이유만으로 모두 민감한 것은 아니다. 업무상 필요한 응답인지와 호출 계정의 권한을 함께 본다.

#### Step 6. 노출 내용과 접근 범위 확인

대표 값 하나로 다음을 기록한다.

- 로그인 없이 접근 가능한지
- 일반 사용자와 관리자 응답이 다른지
- 본인 정보인지 다른 사용자·조직 정보인지
- 값이 마스킹·만료·폐기됐는지
- 설정·키가 공개 식별자인지 비공개 credential인지
- 후속 검증이 필요하면 최소 권한의 요청으로 확인 가능한지

### 상황별 빠른 선택

| 현재 상황 | 먼저 확인할 것 |
| :--- | :--- |
| HTML·JS에 파일명이 보임 | 해당 파일의 백업 확장자와 source map |
| 후보 경로가 모두 `200` | custom 404와 body hash·길이 비교 |
| API가 필드를 많이 반환 | UI·JS 사용 여부와 필드 민감도 |
| 오류마다 메시지가 다름 | 타입·존재 여부·권한 오류를 한 항목씩 비교 |
| `Index of`가 보임 | 목록의 실제 민감 파일 한 개 확인 |
| health·metrics가 열림 | 내부 host·환경값·credential 포함 여부 |
| 문서·이미지를 다운로드함 | EXIF·작성자·내부 경로 메타데이터 |
| 키처럼 보이는 문자열 발견 | 공급자, 키 유형, 마스킹·만료·권한 범위 |

---

## 페이로드 노트

### 1. 공개 메타파일과 HTML 주석

**이럴 때 사용**: 가장 먼저 낮은 요청 수로 숨은 경로와 개발 단서를 찾는다.

```bash
curl -sS https://<TARGET>/robots.txt
curl -sS https://<TARGET>/sitemap.xml
curl -sS https://<TARGET>/.well-known/security.txt
curl -sS https://<TARGET>/ | rg '<!--|TODO|internal|debug'
```

**확인할 것**: `Disallow`, 주석, sitemap URL은 단서다. 경로가 있다는 사실만으로 취약하지 않으며, 직접 접근했을 때 인증 없이 민감 내용이나 기능이 노출되는지 별도로 확인한다.

### 2. 환경·설정 파일

**이럴 때 사용**: 오류·JS·문서·디렉터리 목록에서 환경명이나 설정 파일명을 찾았다.

기술 단서에 맞는 소수 후보만 선택한다.

```
[공통]
/.env
/.env.production
/config.json
/config.yml

[Java]
/WEB-INF/classes/application.properties
/WEB-INF/classes/application.yml

[ASP.NET]
/web.config
/web.config.bak

[PHP]
/config.php
/wp-config.php
```

**확인할 것**: `200`이면 custom 404와 비교하고 내용 형식을 본다. DB URL·비공개 API credential·서명 키가 실제 값으로 포함됐는지, 샘플·placeholder·마스킹 값인지 구분한다.

### 3. 백업·임시 파일과 VCS

**이럴 때 사용**: 실제 파일명·배포 archive·저장소 흔적을 발견했다.

**탐색 대상:**

```
[파일별 백업 패턴]
<filename>.bak       <filename>~       <filename>.old
<filename>.orig      <filename>.save   <filename>.swp

[배포·백업 이름을 발견한 경우]
release.zip           release-old.zip
site.tar.gz           site-backup.tar.gz

[VCS 대표 파일]
/.git/HEAD            /.git/config
/.svn/entries         /.svn/wc.db
```

대표 파일은 GET 본문으로 확인한다. `curl -I`의 HEAD 응답이 GET과 다를 수 있다.

```bash
curl -sS -D - https://<TARGET>/.git/HEAD
curl -sS -D - https://<TARGET>/index.php.bak
```

**확인할 것**: VCS 메타데이터 한두 개로 노출 범위를 판단하고, 기본 절차에서 전체 저장소를 복원하지 않는다. 소스·설정·DB 백업의 실제 내용과 접근 범위가 확인될 때 취약으로 확정한다.

### 4. 오류 메시지와 디버그 화면

**이럴 때 사용**: 정상 요청의 필드 하나를 바꿨을 때 일반 오류보다 자세한 내용이 반환된다.

```text
GET /nonexistent-<RANDOM>
GET /api/users/not-a-number
POST /api/order  {"quantity":null}
```

관찰할 내용:

```
stack trace와 소스 파일 경로
DB table·column·query 일부
내부 host·port·service 이름
framework·package·class 이름
환경 변수·요청 Header·token 값
debugger·console 접근 링크
```

**확인할 것**: stack trace와 경로만 있으면 기술 단서로 분류한다. debugger 화면이 보여도 console이 잠겨 있거나 별도 PIN이 필요할 수 있다. 실제 console 실행 권한과 단순 오류 정보 노출을 같은 취약점으로 보지 않는다.

### 5. 디렉터리 목록과 정적 저장소

**이럴 때 사용**: 응답에 `Index of`, 파일 목록, storage container 목록이 보이거나 업로드 URL의 상위 경로가 열린다.

**확인:**

```bash
curl -sS https://<TARGET>/uploads/
curl -sS https://<TARGET>/files/
```

**탐지 신호:**

```html
<title>Index of /uploads</title>      ← Apache / Nginx 디렉토리 인덱스
또는
[DIR] backup/                          ← 파일 / 디렉토리 목록 평문 노출
```

**확인할 것**: 목록 자체보다 다른 사용자 파일, 백업, 로그, 설정처럼 원래 공개되지 않아야 할 항목 한 개를 확인한다. 정적 이미지·공개 배포 파일만 나열되면 정책과 민감도를 별도로 판단한다.

### 6. JavaScript bundle과 Source map

**이럴 때 사용**: HTML과 Network에서 실제 로드되는 JS·chunk·map을 발견했다. 자세한 분석 절차는 [JavaScript 분석](./javascript-analysis.md)을 따른다.

정보 노출 관점에서는 다음을 구분한다.

```text
원본 파일명·디렉터리만 노출
내부 API·환경명·기능 route 노출
공개용 API key·DSN 노출
비공개 credential·token·개인정보 노출
```

**확인할 것**: source map 접근 자체나 API 경로 문자열만으로 취약을 확정하지 않는다. `sourcesContent`에 추가 원본이 포함됐는지, 발견한 값이 실제 비밀값인지 확인한다.

### 7. API의 과도한 정보 반환

**이럴 때 사용**: 화면에는 일부 정보만 보이지만 JSON 응답에 더 많은 필드가 포함된다.

```http
GET /api/users/me HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<TEST_SESSION>

HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 42,
  "email": "test-user@example.test",
  "passwordHash": "<HASH>",
  "internalCustomerId": "INT-10042",
  "debug": {"service": "member-api"}
}
```

UI가 쓰지 않는 필드라는 이유만으로 모두 취약한 것은 아니다. 다음을 우선 확인한다.

```text
password·hash·reset token·access token
다른 사용자·조직의 개인정보
결제·신용·정산 정보
관리자 전용 상태와 내부 메모
query·환경값·원본 외부 연동 payload
```

`password`처럼 복호화 가능한 원문이 응답되면 그 값 자체의 노출로 판단한다. 이 응답만으로 저장 방식까지 단정하지 않고, 본인 API와 다른 사용자 API의 접근 범위를 분리한다.

**확인할 것**: 테스트 계정의 대표 필드 한두 개로 내용과 접근 범위를 기록한다. 전체 사용자 목록이나 대량 데이터를 수집하지 않는다.

### 8. 문서·이미지 메타데이터

**이럴 때 사용**: 사용자·직원이 만든 이미지, PDF, Office 파일을 외부에서 다운로드할 수 있다.

**확인:**

```bash
# 이미지 EXIF
exiftool downloaded_image.jpg

# PDF / Office
pdfinfo document.pdf
exiftool document.docx
```

**확인할 것**: GPS, 작성자 계정, 내부 경로, 조직명, 소프트웨어 버전이 실제로 포함되는지 확인한다. 공개 문서의 의도된 작성자 표시와 비공개 개인정보를 구분한다.

### 9. 운영·모니터링·API 문서 endpoint

**이럴 때 사용**: 응답 Header·오류·JS에서 framework나 관리 base path 단서를 찾았다.

```
[Spring Boot Actuator]
/actuator/health
/actuator/info
/actuator/env
/actuator/mappings

[운영 상태]
/health
/metrics

[API 문서]
/swagger-ui/
/api-docs
/graphql
```

Spring Boot Actuator의 base path와 외부 노출 endpoint는 설정으로 달라질 수 있다. health·metrics·Swagger·GraphQL 접근 자체는 운영 목적일 수 있다.

**확인할 것**: 내부 host·service 이름·환경값·상세 route·개인정보·비공개 credential이 인증 없이 반환되는지 본다. heapdump 같은 큰 진단 파일은 기본 절차에서 내려받지 않고 접근 가능 여부와 응답 Header까지만 확인한다.

### 10. 도구 참고

- Burp Target·Logger에서 응답 검색과 파일명 후보를 먼저 수집한다.
- `ffuf`, `gobuster`, SecLists는 승인된 요청량과 관찰된 기술 범위 안에서 사용한다.
- GitTools는 VCS 노출을 확인한 뒤 복원 범위가 필요한 경우에만 참고한다.
- `exiftool`, `pdfinfo`는 다운로드한 대표 파일의 메타데이터 확인에 사용한다.
- scanner의 `200` 결과는 custom 404·인증 redirect·동일 본문 여부를 수동 검증한다.

---

## 우회 매트릭스

| 관찰된 증상 | 다음 시도 | 확인할 것 |
| :--- | :--- | :--- |
| 모든 후보가 `200` | 임의 404와 body hash·길이 비교 | custom 404 오탐 제거 |
| `HEAD`는 `200`, GET은 다름 | GET 본문과 Content-Type 확인 | 파일 존재 판정은 실제 응답 기준 |
| 후보가 `403` | 같은 디렉터리의 공개 파일·정상 링크 확인 | 존재 단서일 뿐 내용 노출은 아님 |
| 백업 확장자가 차단됨 | 관찰된 원래 파일명과 저장 규칙 재검토 | 무작위 확장자 증가는 피함 |
| 값이 `***`로 마스킹됨 | 원문이 다른 endpoint·오류에 나오는지 확인 | 마스킹 값만으로 credential 노출 아님 |
| source map은 열리지만 원본이 없음 | `sourcesContent`와 DevTools Authored 확인 | 파일 존재와 원본 포함 구분 |
| health·Swagger가 열림 | 반환 필드와 실행 가능한 기능 확인 | 공개 목적 endpoint일 수 있음 |
| CDN과 원본 응답이 다름 | Host·경로·인증 상태를 같은 조건으로 비교 | cache된 오래된 파일 가능성 |

---

## 취약 판정 기준

### 취약 확정

- 소스·설정·백업 파일의 실제 내용이 인증 없이 반환된다.
- 비공개 credential·token·서명 키가 원문으로 노출되고 현재 사용 가능한 범위가 확인된다.
- API가 호출 계정에 필요하지 않은 개인정보·인증정보·금융정보를 반환한다.
- 오류·debug·운영 endpoint가 query·환경값·내부 서비스 정보 같은 민감 내용을 반환한다.
- 디렉터리 목록이나 문서 메타데이터에서 원래 공개되지 않아야 할 사용자·조직 정보가 확인된다.
- 숨은 경로나 파일 단서가 실제 비인증 민감정보 접근으로 이어진다.

### 후보 / 보류

- `robots.txt`, sitemap, OIDC discovery, API 문서에 경로만 공개된다.
- stack trace에 framework·class·파일 경로만 있고 직접적인 민감값은 없다.
- source map·VCS 대표 파일이 열리지만 추가 원본이나 비밀값 노출 범위는 확인하지 못했다.
- health·metrics endpoint가 일반 상태와 비민감 수치만 반환한다.
- API key처럼 보이는 값이 공개 식별자·샘플·마스킹·만료 값이다.
- 디렉터리 목록에 의도적으로 공개된 정적 파일만 존재한다.

### 영향 상승 조건

- 노출된 값으로 운영 DB·cloud·내부 API 같은 비공개 자원 접근이 가능하다.
- 다른 사용자·조직의 개인정보나 인증정보가 반복적으로 노출된다.
- 소스·설정으로 인증 우회, IDOR, injection 등 다른 취약점이 구체적으로 재현된다.
- 백업 파일에 여러 사용자 데이터나 현재 운영 credential이 포함된다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Review Old Backup and Unreferenced Files](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information)
- [OWASP WSTG - Test File Extensions Handling for Sensitive Information](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/03-Test_File_Extensions_Handling_for_Sensitive_Information)
- [OWASP WSTG - Testing for Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure)
- [OWASP WSTG - Testing for Improper Error Handling](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/01-Testing_For_Improper_Error_Handling)
- [PortSwigger Web Security Academy - Information disclosure](https://portswigger.net/web-security/information-disclosure)
- [Spring Boot - Actuator REST API](https://docs.spring.io/spring-boot/api/rest/actuator/)

### 커뮤니티 참고 / 도구

- [GitTools](https://github.com/internetwache/GitTools)
- [SecLists - Web Content Discovery](https://github.com/danielmiessler/SecLists/tree/master/Discovery/Web-Content)
- [HackTricks - Information Disclosure](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web)
