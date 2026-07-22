---
sidebar_position: 27
title: CORS 잘못된 설정
description: 웹 진단 - CORS Origin 반사·null·allowlist 우회, credentials·preflight, 브라우저 PoC 점검 절차와 판정 기준
keywords: [CORS, Cross-Origin Resource Sharing, Access-Control-Allow-Origin, Allow-Credentials, null Origin, Origin Reflection, OWASP A02]
draft: false
toc_max_heading_level: 3
---

> 다른 사이트의 JavaScript가 대상 API를 호출하고, 브라우저에서 응답 내용까지 읽을 수 있는지 확인한다.

## 점검 목적

API가 허용한 Origin, credentials 사용 여부, 실제 응답 내용을 함께 확인한다. CORS는 브라우저가 다른 Origin의 JavaScript에 응답을 공개할지 결정하는 정책이다. Header가 느슨해 보여도 인증 쿠키가 전송되지 않거나 응답이 공개 데이터뿐이면 영향은 달라진다.

이 문서의 주 대상은 **응답 읽기**다. 다른 사이트가 변경 요청만 보낼 수 있고 응답은 읽지 못하면 [CSRF](./csrf.md)에서 이어간다. JavaScript가 `Authorization: Bearer`를 직접 붙이는 구조는 외부 페이지가 사용자의 토큰을 자동으로 가져오지 못하므로 쿠키 인증과 구분한다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **임의 Origin 허용** | 요청의 `Origin`을 그대로 허용함 | 외부 PoC에서 민감 응답을 읽으면 취약 |
| **`null` 허용** | 출처가 불투명한 sandbox·data 문서를 신뢰함 | 실제 `null` Origin PoC에서 응답을 읽으면 취약 |
| **Origin 비교 오류** | host 앞뒤 문자열이나 잘못된 정규식으로 검사함 | 브라우저가 만들 수 있는 외부 Origin이 허용되면 취약 |
| **신뢰 Origin 침해** | 허용된 서브도메인에 XSS·takeover가 있음 | 그 Origin에서 인증 응답을 읽을 수 있으면 결합 취약점 |
| **와일드카드 공개** | `Access-Control-Allow-Origin: *` 사용 | 인증 없는 민감 응답을 읽을 수 있을 때 문제 |

---

## 진단 절차

#### Step 1. 진입점 식별

로그인 상태에서 개인정보·설정·주문처럼 비공개 데이터를 반환하는 API를 고른다. 공개 정적 파일과 공개 API는 먼저 제외한다.

정상 응답과 다음 Header를 기록한다.

```http
Access-Control-Allow-Origin: ...
Access-Control-Allow-Credentials: ...
Access-Control-Expose-Headers: ...
Vary: Origin
```

`Access-Control-Allow-Origin`이 요청의 `Origin`에 따라 달라지면 allowlist 검증 방식을 확인한다.

#### Step 2. Origin을 하나씩 바꿔 비교

Origin은 scheme, host, port로 구성되며 path는 포함하지 않는다. 통제 가능한 테스트 Origin을 사용한다.

```http
GET /api/me HTTP/1.1
Host: api.target.example
Origin: https://<CONTROLLED_HOST>
Cookie: SESSION=<TEST_SESSION>
```

다음 값을 순서대로 비교한다.

- 정상 허용 Origin
- 통제 가능한 외부 Origin
- 허용 host를 앞·뒤에 포함한 외부 Origin
- scheme 또는 port가 다른 Origin
- `Origin: null`

#### Step 3. 인증정보 전송 조건 확인

`Access-Control-Allow-Credentials: true`가 있어도 쿠키가 자동으로 전송된다고 단정하지 않는다.

- PoC의 `fetch`에 `credentials: 'include'`가 있는지
- 인증 쿠키의 Domain·Path·SameSite·Secure
- 요청이 cross-site인지 same-site의 다른 Origin인지
- 브라우저의 서드파티 쿠키 차단 정책
- API가 실제로 쿠키 세션을 인증에 사용하는지

#### Step 4. preflight와 실제 요청 구분

`GET`, `HEAD`, 단순 `POST`는 preflight 없이 전송될 수 있다. `PUT`, `DELETE`, JSON·사용자 정의 Header 요청은 보통 먼저 `OPTIONS`를 보낸다.

preflight 응답만 허용된 것인지, 실제 요청과 실제 응답에도 필요한 CORS Header가 있는지 분리한다. CORS는 CSRF 방어가 아니므로 서버는 preflight 여부와 관계없이 인증·권한 검사를 해야 한다.

#### Step 5. 다른 Origin의 브라우저 PoC 실행

다른 Origin에서 실제 `fetch`를 실행하고 다음을 확인한다.

1. 요청이 전송됐는지
2. 세션 쿠키가 포함됐는지
3. 브라우저 console에 CORS 오류가 있는지
4. JavaScript가 응답 본문을 읽었는지
5. 읽힌 내용에 비공개 데이터가 있는지

Repeater에서 임의 `Origin`과 쿠키를 직접 넣어 성공한 것만으로는 브라우저 악용을 확정하지 않는다.

### 상황별 빠른 선택

| 현재 응답 | 먼저 할 테스트 |
| :--- | :--- |
| 요청 Origin이 그대로 ACAO에 반사됨 | 외부 Origin + credentials 브라우저 PoC |
| `ACAO: null` | sandbox iframe에서 `Origin: null` PoC |
| 특정 서브도메인만 허용 | scheme·port·앞뒤 host 비교와 허용 Origin의 XSS·takeover |
| `ACAO: *` | credentials 없이 읽히는 응답이 공개 데이터인지 확인 |
| `ACAO: *` + `ACAC: true` | 브라우저가 credentialed 응답 공개를 차단하는지 확인 |
| `OPTIONS`만 CORS Header 존재 | 실제 요청·응답 Header와 본문 읽기 여부 확인 |
| 토큰 인증 API | 외부 페이지가 사용자 토큰을 자동으로 보낼 수 있는지 먼저 확인 |

---

## 페이로드 노트

### 1. 임의 Origin 반사

**이럴 때 사용**: 요청에 넣은 Origin이 `Access-Control-Allow-Origin`에 그대로 반환된다.

**바꿀 값**

```http
GET /api/me HTTP/1.1
Host: api.target.example
Origin: https://<CONTROLLED_HOST>
Cookie: SESSION=<TEST_SESSION>
```

응답 예시:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://<CONTROLLED_HOST>
Access-Control-Allow-Credentials: true
Content-Type: application/json

{"id": 42, "displayName": "test-user"}
```

**확인할 것**: Header 조합은 취약 후보일 뿐이다. 외부 PoC에서 테스트 세션 쿠키가 포함되고 JavaScript가 비공개 응답을 읽을 때 취약으로 확정한다.

```html
<script>
fetch('https://api.target.example/api/me', {credentials: 'include'})
  .then(response => response.text())
  .then(text => document.querySelector('pre').textContent = text)
  .catch(error => document.querySelector('pre').textContent = String(error));
</script>
<pre>waiting</pre>
```

PoC는 응답을 화면에 표시하는 정도로 제한한다. 외부 전송 코드는 기본 예시에 넣지 않는다.

### 2. Origin allowlist 비교 오류

**이럴 때 사용**: 정상 허용 Origin만 반사되며 서버가 문자열·정규식으로 allowlist를 검사하는 것으로 보인다.

**바꿀 값**: Origin에는 path가 들어가지 않는다. 브라우저가 만들 수 있는 scheme·host·port 조합만 사용한다.

```text
Origin: https://target.example
Origin: https://target.example.<CONTROLLED_DOMAIN>
Origin: https://eviltarget.example
Origin: https://targetxexample
Origin: http://target.example
Origin: https://target.example:444
```

| 변형 | 확인 의도 |
| :--- | :--- |
| 허용 host 뒤에 통제 domain 추가 | `startsWith` 검사 |
| 허용 문자열로 끝나는 별도 domain | 단순 `endsWith` 검사 |
| 점을 다른 문자로 변경 | 정규식 `.` escape 누락 |
| HTTP로 변경 | scheme 구분 누락과 신뢰 Origin의 평문 노출 |
| port 변경 | origin의 port 구분 누락 |

**확인할 것**: 변형 Origin이 ACAO에 허용돼도 실제 브라우저 PoC에서 쿠키와 민감 응답 읽기를 다시 확인한다. 의도한 모든 하위 도메인을 허용하는 정책이라면 해당 Origin을 공격자가 실제로 통제할 수 있는지가 핵심이다.

### 3. `null` Origin 허용

**이럴 때 사용**: 임의 외부 Origin은 거부하지만 `Origin: null` 요청에는 CORS Header를 반환한다.

**바꿀 값**

```http
GET /api/me HTTP/1.1
Host: api.target.example
Origin: null
Cookie: SESSION=<TEST_SESSION>
```

후보 응답:

```http
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

**확인할 것**: sandboxed iframe 같은 실제 불투명 Origin에서 `fetch`를 실행해 쿠키 포함과 본문 읽기를 확인한다. 브라우저의 서드파티 쿠키 정책 때문에 Header가 있어도 인증 쿠키가 빠질 수 있다.

`null`은 sandbox iframe, `data:` 문서, 일부 로컬 파일 등 여러 출처를 한 값으로 묶는다. 서비스가 의도적으로 사용하는 특수 흐름인지도 함께 확인한다.

### 4. `Access-Control-Allow-Origin: *`

**이럴 때 사용**: API가 모든 Origin에 응답을 공개한다.

**확인할 것**

| 요청 조건 | 브라우저 판단 |
| :--- | :--- |
| credentials 없이 공개 데이터 요청 | 일반적으로 정상 |
| credentials 없이 비공개 데이터 반환 | 인증·권한 누락과 CORS 노출 확인 |
| `credentials: 'include'` + `ACAO: *` | 브라우저가 응답을 JavaScript에 공개하지 않음 |
| 외부 JavaScript가 직접 Bearer token 추가 | 공격자가 그 사용자 토큰을 얻을 수 있는지 별도 확인 |

`ACAO: *`와 `Access-Control-Allow-Credentials: true`가 같이 보여도 브라우저는 credentialed 응답을 읽게 해주지 않는다. 요청에 쿠키가 전송됐는지와 응답 공개 여부는 별개이므로 Network와 Console을 함께 본다.

와일드카드 자체를 취약점으로 보고하지 않는다. 인증 없이 민감 데이터가 반환되면 [인가 / IDOR](./authorization-idor.md) 등 실제 인증·권한 문제를 함께 확인한다.

### 5. preflight 확인

**이럴 때 사용**: 외부 요청이 `PUT`, `DELETE`, JSON Content-Type, `Authorization` 같은 Header를 사용한다.

```http
OPTIONS /api/profile HTTP/1.1
Host: api.target.example
Origin: https://<CONTROLLED_HOST>
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, authorization
```

**확인할 것**: `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, ACAO, ACAC를 확인한 뒤 실제 요청이 전송되는지 본다. preflight 성공만으로 민감 응답 노출이 확정되지는 않는다.

`Access-Control-Max-Age`는 preflight 결과의 캐시 시간이다. 값이 길다는 사실만으로 취약점이 아니다.

### 6. 허용된 Origin의 XSS·takeover 결합

**이럴 때 사용**: API가 특정 서브도메인 또는 여러 하위 도메인을 credentials와 함께 신뢰한다.

**바꿀 값**: 실제 허용되는 Origin 목록을 먼저 확인한다.

```text
https://app.target.example
https://dev.target.example
https://old.target.example
```

허용 Origin 자체에 XSS가 있거나 takeover가 가능한 경우에만 그 Origin에서 PoC를 실행한다. 정확히 `app.target.example`만 허용하는데 unrelated한 `dev.target.example`이 취약하다는 사실만으로는 CORS 우회가 아니다.

**확인할 것**: 허용된 Origin에서 테스트 API 응답을 읽을 수 있는지 화면에 표시해 확인한다. XSS·takeover와 CORS 신뢰 관계를 각각 증명하되 외부 전송은 기본 PoC에서 생략한다.

### 7. 응답 Header와 인접 기능

- JavaScript가 custom 응답 Header를 읽어야 한다면 `Access-Control-Expose-Headers`도 확인한다.
- Origin별로 ACAO를 동적으로 반환하면 `Vary: Origin`이 캐시 정확성에 필요할 수 있다. 누락만으로 사용자 데이터 유출을 확정하지 않고 실제 CDN cache key와 재현 결과를 확인한다.
- JSONP callback이 실행되면 CORS가 아닌 script 포함·callback injection 관점으로 분리한다.
- WebSocket은 handshake의 `Origin` 검증과 쿠키 전송을 별도로 확인한다.
- `postMessage`는 수신 코드의 `event.origin` 검증을 별도로 확인한다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 외부 Origin이 ACAO에 반사 | ACAC, 쿠키 전송, 브라우저 본문 읽기 |
| ACAC가 있지만 쿠키가 없음 | SameSite·Domain·서드파티 쿠키 정책 |
| 정상 서브도메인만 허용 | scheme·port·prefix·suffix 비교 |
| 모든 하위 도메인을 허용 | 실제 허용 Origin의 XSS·takeover 가능성 |
| `Origin: null` 허용 | sandbox iframe PoC와 인증 쿠키 전송 |
| `ACAO: *` | credentials 없이 읽히는 데이터의 공개 정책 |
| `ACAO: *` + ACAC | 브라우저 Console의 wildcard/credentials 차단 |
| preflight 성공 | 실제 요청·응답의 ACAO·ACAC와 본문 읽기 |
| preflight 실패 | simple GET·POST 요청은 별도로 가능한지 |
| Repeater에서는 민감 응답 | 외부 브라우저 PoC에서 같은 인증 상태가 되는지 |
| 본문은 읽히지만 Header는 안 보임 | `Access-Control-Expose-Headers`와 필요한 Header 이름 |
| `Vary: Origin` 없음 | 실제 CDN cache key와 다른 Origin 간 캐시 재현 |

---

## 취약 판정 기준

### 취약

- [ ] 통제 가능한 외부 Origin의 JavaScript가 테스트 세션의 비공개 응답을 읽을 수 있음
- [ ] `null` Origin PoC에서 인증 쿠키와 함께 민감 응답을 읽을 수 있음
- [ ] scheme·host·port 비교 오류로 공격자 통제 Origin이 allowlist를 우회함
- [ ] 허용된 Origin의 XSS·takeover와 결합해 인증 응답을 읽을 수 있음
- [ ] credentials 없이 접근 가능한 내부·비공개 데이터가 `ACAO: *`로 공개됨
- [ ] custom 응답 Header의 민감 값이 잘못된 `Access-Control-Expose-Headers` 정책으로 노출됨

### 후보 / 보류

- [ ] 외부 Origin과 ACAC가 반환되지만 브라우저에서 인증 쿠키가 전송되지 않음
- [ ] Repeater에서만 Origin 반사를 확인했고 실제 브라우저 PoC는 수행하지 못함
- [ ] 외부 JavaScript가 응답은 읽지만 공개 데이터만 반환됨
- [ ] `ACAO: *`와 ACAC가 함께 있으나 브라우저가 credentialed 응답을 차단함
- [ ] 허용된 서브도메인 범위가 넓지만 공격자가 통제할 수 있는 Origin은 확인되지 않음
- [ ] preflight만 성공하고 실제 요청 또는 응답 본문 읽기는 실패함
- [ ] `Vary: Origin`이 없지만 공유 캐시로 인한 교차 응답은 재현되지 않음

### 영향 상승 조건

- [ ] 계정·주문·결제·관리자 API의 민감 응답을 읽을 수 있음
- [ ] 같은 잘못된 정책이 여러 인증 API에 공통 적용됨
- [ ] 허용 Origin의 XSS·takeover가 현실적으로 재현됨
- [ ] 응답 Header의 토큰·다운로드 위치 등 추가 민감 값까지 읽을 수 있음

응답에 ACAO가 없으면 브라우저는 기본적으로 다른 Origin의 JavaScript에 본문을 공개하지 않는다. 공개 API의 `ACAO: *`는 정상일 수 있으며, CORS는 서버 측 인증·권한 검사를 대신하지 않는다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Testing Cross Origin Resource Sharing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/07-Testing_Cross_Origin_Resource_Sharing)
- [OWASP Cheat Sheet - HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [PortSwigger - Cross-origin resource sharing (CORS)](https://portswigger.net/web-security/cors)
- [PortSwigger - Access-Control-Allow-Origin](https://portswigger.net/web-security/cors/access-control-allow-origin)
- [PortSwigger - Exploiting CORS misconfigurations for Bitcoins and bounties](https://portswigger.net/research/exploiting-cors-misconfigurations-for-bitcoins-and-bounties)
- [MDN - Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [Fetch Standard - CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - CORS Misconfiguration](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/CORS%20Misconfiguration)
- [HackTricks - CORS Misconfigurations & Bypass](https://hacktricks.wiki/en/pentesting-web/cors-bypass.html)
