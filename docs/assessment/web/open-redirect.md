---
sidebar_position: 26
title: Open Redirect
description: 웹 진단 - Open Redirect 탐지, URL 파싱·allowlist 우회, 로그인 후 이동, OAuth redirect_uri 점검 절차와 판정 기준
keywords: [Open Redirect, URL Redirection, Unvalidated Redirect, Phishing, OAuth, redirect_uri, SSO, Token Theft, OWASP A01]
draft: false
toc_max_heading_level: 3
---

> 신뢰할 수 있는 서비스 주소를 열었는데 사용자 입력에 따라 전혀 다른 외부 사이트로 이동할 수 있는지 확인한다.

## 점검 목적

로그인 전후 이동, 외부 연동, 공유 링크처럼 redirect 목적지가 요청값으로 결정되는 흐름을 찾는다. 입력값이 서버의 `Location` Header, HTML meta refresh, JavaScript 이동 코드에 들어갈 때 실제 브라우저가 허용되지 않은 외부 host로 이동하는지 확인한다.

단독 영향은 주로 신뢰받는 도메인을 이용한 링크 위장이다. OAuth·SSO, 비밀번호 재설정, 서버 측 URL 요청과 연결되면 인증 코드나 민감한 값이 전달되는지 별도로 확인한다. 서버가 URL을 직접 요청하면 [SSRF](./ssrf.md), Header 줄바꿈이 가능하면 HTTP Response Splitting 범위로 분리한다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **서버 응답 이동** | `3xx Location` 값이 사용자 입력으로 결정됨 | 브라우저가 허용되지 않은 외부 host로 이동하면 취약 |
| **로그인 후 이동** | `next`, `returnTo` 값으로 로그인·로그아웃 뒤 이동함 | 외부 목적지가 허용되면 취약 |
| **브라우저 코드 이동** | meta refresh나 JavaScript가 입력 URL을 사용함 | 최종 주소가 외부 host이면 client-side open redirect |
| **연동 콜백 이동** | OAuth·SSO·결제 callback 주소를 요청에서 받음 | 등록된 목적지 밖으로 코드·값이 전달되면 영향 상승 |

---

## 진단 절차

#### Step 1. 진입점 식별

Burp에서 `3xx` 응답과 이동 관련 파라미터를 찾는다.

```text
?returnTo=    ?return=     ?next=        ?redirect=    ?redirect_uri=
?url=         ?dest=       ?destination= ?continue=    ?callback=
?goto=        ?target=     ?rurl=        ?forward=     ?path=
```

다음 흐름을 우선 확인한다.

- 로그인·로그아웃·가입 완료 후 원래 페이지로 돌아가기
- 비밀번호 재설정·이메일 인증 완료 후 이동
- 외부 결제·본인인증·SSO 연동
- 링크 추적·다운로드·광고·파트너 이동
- OAuth 요청의 `redirect_uri`

#### Step 2. 정상 이동 기준선 저장

내부 경로로 정상 이동하는 요청과 응답을 저장한다.

```http
GET /login?next=/account HTTP/1.1
Host: target.example
```

응답의 `Location`, meta refresh, JavaScript 변수 중 어느 값이 실제 이동을 결정하는지 확인한다.

#### Step 3. 소유한 외부 주소로 교체

테스트용으로 직접 통제하고 로그를 확인할 수 있는 host를 사용한다.

```http
GET /login?next=https://<CONTROLLED_HOST>/redirect-check HTTP/1.1
Host: target.example
```

`Location` Header만 보지 말고 브라우저로 열어 최종 주소창의 scheme·host·port를 확인한다. 중간 경고 페이지에서 사용자가 다시 눌러야 하는 경우도 구분한다.

#### Step 4. URL 해석 차이 확인

기본 외부 URL이 차단되면 한 요소씩 바꾼다.

1. `https://`와 `//` 비교
2. 허용 host 앞뒤의 `@`, 점, 하위 도메인 비교
3. URL 인코딩과 이중 디코딩 비교
4. 백슬래시·제어문자 정규화 비교
5. 내부 redirect endpoint를 거치는 연쇄 이동 확인

서버가 허용한 문자열이 아니라 브라우저가 최종적으로 해석한 `hostname`을 기준으로 판정한다.

#### Step 5. 연결되는 보안 흐름 확인

- 로그인·재설정 링크에서 외부 이동이 가능한지
- OAuth 등록 callback 내부에 open redirect가 있는지
- 인증 코드·토큰·민감한 query 또는 fragment가 외부로 전달되는지
- Authorization Code Flow에서 PKCE, client 인증, redirect URI 결합이 추가로 적용되는지
- 서버 측 HTTP client가 redirect를 따라가 SSRF로 이어지는지

인증 코드가 외부에 도착했다는 사실과 실제 토큰 교환 가능성을 분리한다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 할 테스트 |
| :--- | :--- |
| `next=/account` 같은 내부 경로 | `https://<CONTROLLED_HOST>/`와 `//<CONTROLLED_HOST>/` |
| 허용 도메인으로 시작해야 함 | `https://allowed.example@<CONTROLLED_HOST>/` |
| 허용 도메인을 포함하면 통과 | `https://<CONTROLLED_HOST>/?allowed.example` |
| URL 인코딩 후 이동 | `%2f%2f<CONTROLLED_HOST>`과 이중 인코딩 |
| meta refresh·JavaScript 이동 | 브라우저 주소창의 최종 host 확인 |
| OAuth `redirect_uri` | 등록 URI 변형과 등록 callback 내부 redirect 확인 |

---

## 페이로드 노트

### 1. 기본 외부 주소

**이럴 때 사용**: 이동 목적지가 `next`, `url`, `returnTo` 같은 요청값으로 전달된다.

**바꿀 값**

```text
?returnTo=https://<CONTROLLED_HOST>/redirect-check
?returnTo=http://<CONTROLLED_HOST>/redirect-check
?returnTo=//<CONTROLLED_HOST>/redirect-check
```

**확인할 것**: 브라우저가 통제 host로 실제 이동하고 접근 로그에 요청이 남는지 확인한다. `/error`, 내부 기본 페이지, 외부 이동 확인 화면으로 바뀌면 각각 다른 결과로 기록한다.

### 2. scheme과 슬래시 해석

**이럴 때 사용**: 완전한 `https://<CONTROLLED_HOST>`는 차단되지만 내부 경로나 `https` 문자열만 검사하는 것으로 보인다.

**바꿀 값**

```text
//<CONTROLLED_HOST>/redirect-check
/\<CONTROLLED_HOST>/redirect-check
\\<CONTROLLED_HOST>/redirect-check
%2f%2f<CONTROLLED_HOST>/redirect-check
%5c%5c<CONTROLLED_HOST>/redirect-check
```

**확인할 것**: 서버가 반환한 문자열과 브라우저 주소창의 최종 host를 함께 기록한다. 백슬래시와 인코딩은 서버·프레임워크·브라우저에 따라 해석이 달라 실제 이동 결과가 필요하다.

`javascript:`·`data:`는 외부 redirect 확인값과 목적이 다르다. 링크·meta refresh·JavaScript sink에서 실행되면 URL scheme 검증 또는 XSS 관점으로 별도 판정한다.

### 3. `@` 앞부분을 host로 오인하는지 확인

**이럴 때 사용**: 입력값이 `https://allowed.example`로 시작하는지만 검사하는 것으로 보인다. URL에서 `@` 앞은 사용자 정보이고 실제 host는 뒤쪽이다.

**바꿀 값**

```text
https://allowed.example@<CONTROLLED_HOST>/redirect-check
https://allowed.example:password@<CONTROLLED_HOST>/redirect-check
//allowed.example@<CONTROLLED_HOST>/redirect-check
```

**확인할 것**: 최종 `hostname`이 통제 host인지 확인한다. 응답에 문자열이 반영됐지만 URL 파서가 거부하거나 내부 host에 머물면 취약 확정이 아니다.

### 4. 허용 host 문자열 비교

**이럴 때 사용**: 허용 host 문자열이 URL의 시작·중간·끝에 있으면 통과하는 것으로 보인다.

**바꿀 값**

```text
https://allowed.example.<CONTROLLED_HOST>/
https://<CONTROLLED_HOST>/allowed.example
https://<CONTROLLED_HOST>/?next=allowed.example
https://<CONTROLLED_HOST>/#allowed.example
https://notallowed.example/
```

마지막 값은 허용 host가 `allowed.example`일 때 단순 suffix 비교가 `notallowed.example`까지 허용하는지 확인하는 예시다.

**확인할 것**: 문자열이 아니라 파싱된 `hostname`이 정확히 허용됐는지 확인한다. `host === allowed.example` 또는 의도한 하위 도메인만 `host.endsWith('.allowed.example')`로 검사하는 구현은 단순 suffix 검사와 다르다.

### 5. 인코딩과 중복 디코딩

**이럴 때 사용**: 입력값을 한 번 디코딩하면 차단되지만 redirect 직전에 다시 디코딩되거나 정규화되는 것으로 보인다.

**바꿀 값**

```text
%2f%2f<CONTROLLED_HOST>/redirect-check
%252f%252f<CONTROLLED_HOST>/redirect-check
%5c%5c<CONTROLLED_HOST>/redirect-check
https%3a%2f%2f<CONTROLLED_HOST>%2fredirect-check
```

**확인할 것**: 요청 수신, 애플리케이션 검증, `Location` 생성, 브라우저 이동 중 어느 단계에서 몇 번 디코딩됐는지 비교한다. 최종 외부 이동이 없으면 인코딩 문자열이 통과했다는 사실만으로 취약 판정하지 않는다.

IDN·Punycode 동음이의 도메인은 사용자를 속이는 문제와 관련 있지만, allowlist 우회는 실제 URL parser가 만든 ASCII `hostname` 비교가 잘못됐을 때만 성립한다. 외형이 비슷하다는 이유만으로 open redirect 우회로 보지 않는다.

### 6. OAuth `redirect_uri`

**이럴 때 사용**: OAuth·OIDC 로그인 요청에 `client_id`와 `redirect_uri`가 포함된다.

**바꿀 값**: 정상 등록 callback을 기준으로 한 요소씩 변경한다.

```text
정상: https://app.target.example/callback

https://app.target.example/callback/extra
https://app.target.example/callback?next=https://<CONTROLLED_HOST>/
https://app.target.example@<CONTROLLED_HOST>/callback
https://app.target.example.<CONTROLLED_HOST>/callback
https://<CONTROLLED_HOST>/?next=https://app.target.example/callback
```

Authorization Server는 사전 등록된 redirect URI와 정확한 문자열 비교를 해야 한다. 네이티브 앱의 localhost callback port는 예외적으로 달라질 수 있다.

**확인할 것**

1. 변조 URI가 인증 시작 단계에서 거부되는지
2. 테스트 계정 인증 후 code·token이 어느 주소로 전달되는지
3. 등록된 client callback 자체에 외부 redirect가 있는지
4. Authorization Code Flow에서 PKCE·client 인증·redirect URI 결합이 적용되는지

code가 통제 host에 도착하면 유출 경로는 확인된 것이다. 그러나 그것만으로 계정 탈취를 확정하지 않는다. 테스트 계정의 code를 실제로 교환하려면 PKCE verifier, client 인증, code와 redirect URI의 결합 조건까지 충족되는지 확인한다.

### 7. 허용된 내부 redirect 연쇄

**이럴 때 사용**: 외부 URL은 차단하지만 허용된 callback이나 내부 페이지에 별도 open redirect가 있다.

```text
https://app.target.example/redirect?next=https://<CONTROLLED_HOST>/
```

OAuth, SSO, URL allowlist가 위 내부 주소까지는 허용하고 이후 redirect를 따라가는지 확인한다. 원래 요청의 query나 fragment가 외부 목적지에 다시 붙는지도 브라우저에서 확인한다.

**확인할 것**: 첫 redirect와 최종 redirect를 모두 기록한다. 내부 endpoint가 단독으로 외부 이동하는지, 보안 흐름의 code·token·민감한 값까지 함께 전달되는지를 분리한다.

### 8. 브라우저 코드와 다른 취약점 경계

- meta refresh·`location.href`가 외부 host로 이동하면 client-side open redirect로 판정한다.
- `javascript:`·`data:` scheme이 실행되면 URL scheme 검증 또는 XSS 가능성을 별도로 확인한다.
- 서버가 redirect를 따라 외부·내부 URL을 요청하면 [SSRF](./ssrf.md)에서 이어간다.
- `%0d%0a`로 새 Header를 삽입할 수 있으면 HTTP Response Splitting으로 분리한다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 완전한 외부 URL은 차단 | `//host`, 인코딩된 슬래시, 백슬래시 해석 |
| 허용 URL로 시작해야 함 | `allowed.example@controlled-host`의 최종 hostname |
| 허용 문자열을 포함하면 통과 | 통제 host의 path·query·fragment에 허용 문자열 배치 |
| 허용 도메인 suffix를 확인 | `notallowed.example`과 실제 하위 도메인 경계 비교 |
| 한 번 인코딩하면 차단 | 이중 인코딩과 redirect 직전 디코딩 횟수 |
| `Location`은 외부인데 이동하지 않음 | 브라우저 파싱 오류·경고 페이지·후속 JavaScript 확인 |
| 내부 경로만 허용 | `//host`와 허용된 내부 open redirect 연쇄 |
| 서버 redirect는 안전 | meta refresh·JavaScript가 같은 입력을 다시 사용하는지 |
| OAuth 외부 URI는 거부 | 등록 callback의 path·query 허용 범위와 내부 redirect |
| OAuth code가 외부에 도착 | PKCE·client 인증·redirect URI 결합 후 교환 가능성 |
| query는 전달되지 않음 | fragment가 후속 redirect에 다시 붙는지 브라우저 확인 |

---

## 취약 판정 기준

### 취약

- [ ] 사용자 입력으로 브라우저를 허용되지 않은 외부 host로 이동시킬 수 있음
- [ ] `@`, protocol-relative URL, 인코딩·정규화 차이로 allowlist를 우회할 수 있음
- [ ] 로그인·로그아웃·재설정 흐름 이후 외부 host로 자동 이동함
- [ ] meta refresh·JavaScript가 사용자 입력을 사용해 외부 host로 이동함
- [ ] OAuth Authorization Server가 등록되지 않은 redirect URI로 code·token을 전달함
- [ ] 허용된 callback 내부의 open redirect를 통해 code·token이 외부로 이어짐

### 후보 / 보류

- [ ] 외부 URL이 `Location`에 반영되지만 브라우저의 최종 외부 이동은 확인되지 않음
- [ ] 외부 이동 전에 목적지가 명확히 표시되고 사용자의 추가 확인이 필요함
- [ ] 정책상 허용된 결제·SSO·파트너 host로만 이동함
- [ ] 인코딩 문자열은 통과하지만 최종 URL은 내부 host로 정규화됨
- [ ] OAuth 변조 URI가 `invalid_redirect_uri`로 거부됨
- [ ] OAuth code는 외부에 도착했지만 PKCE·client 인증 때문에 교환 가능성은 확인되지 않음

### 영향 상승 조건

- [ ] 로그인·재설정·보안 알림처럼 사용자가 신뢰하기 쉬운 링크에서 발생함
- [ ] 외부 이동 주소에 이메일·토큰·인증 코드 등 민감한 값이 포함됨
- [ ] OAuth 테스트 계정의 code를 필요한 검증값과 함께 실제 토큰으로 교환할 수 있음
- [ ] SSRF allowlist나 다른 URL 기반 보안 검사를 우회하는 연쇄에 사용됨

의도된 외부 연동은 허용 대상과 사용자 안내 방식을 확인한다. `Location` 문자열, 서버 응답 코드, 최종 브라우저 주소를 함께 남겨야 파서 차이로 인한 오판을 줄일 수 있다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Cheat Sheet - Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [OWASP - Open Redirect](https://owasp.org/www-community/attacks/open_redirect)
- [PortSwigger - Open redirection](https://portswigger.net/kb/issues/00500100_open-redirection-reflected)
- [PortSwigger - OAuth 2.0 authentication vulnerabilities](https://portswigger.net/web-security/oauth)
- [PortSwigger - URL validation bypass cheat sheet](https://portswigger.net/web-security/ssrf/url-validation-bypass-cheat-sheet)
- [MDN - URL API](https://developer.mozilla.org/docs/Web/API/URL)
- [RFC 8252 - OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://datatracker.ietf.org/doc/html/rfc9700)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - Open Redirect](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Open%20Redirect)
- [HackTricks - Open Redirect](https://hacktricks.wiki/en/pentesting-web/open-redirect.html)
