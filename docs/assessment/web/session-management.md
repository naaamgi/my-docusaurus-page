---
sidebar_position: 18
title: 세션 관리 (Session Management)
description: 웹 진단 - 세션 ID 발급/유지/무효화, 쿠키 속성, 세션 고정, 로그아웃, Remember Me 점검 절차와 보고서 양식
keywords: [세션, Session, Cookie, HttpOnly, Secure, SameSite, 세션 고정, Session Fixation, Remember Me, OWASP A07]
draft: false
---

# 세션 관리 (Session Management)

> 세션 ID 의 **발급 → 전송 → 유지 → 무효화** 흐름 전체가 안전하게 처리되는지 점검.
> 쿠키 속성 한 가지만 누락되어도 XSS·CSRF·세션 탈취로 직결되며, 실무 진단에서 자주 발견되는 결함 카테고리.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A07:2025 - Identification and Authentication Failures (인증 카테고리에 포함) / KISA 인증 |
| **CWE** | [CWE-384](https://cwe.mitre.org/data/definitions/384.html) (Session Fixation), [CWE-613](https://cwe.mitre.org/data/definitions/613.html) (Insufficient Session Expiration), [CWE-1004](https://cwe.mitre.org/data/definitions/1004.html) (Sensitive Cookie Without HttpOnly), [CWE-614](https://cwe.mitre.org/data/definitions/614.html) (Sensitive Cookie Without Secure) |
| **영향도** | 🔴 높음 (세션 탈취 시 즉시 계정 도용) / 🟡 (속성 일부 미흡, 다른 결함과 결합 시 위험) |
| **점검 난이도** | 하 (쿠키 속성·로그아웃 점검) / 중 (세션 고정·엔트로피 분석) |
| **예상 점검 시간** | 1시간 ~ 4시간 |

---

## 점검 목적

세션 ID 가 충분한 엔트로피로 발급되는지, 안전한 채널·속성으로 전송되는지, **로그인 시 재발급되고 로그아웃 시 즉시 폐기되는지**, Remember Me 같은 영속 토큰이 적절히 관리되는지 확인한다. 단일 결함도 XSS·CSRF·피싱과 결합되면 즉시 계정 탈취로 이어진다.

> 이 페이지는 **세션 자체** 에 집중. 인증(로그인 흐름) 은 `authentication.md`, JWT 는 `jwt-attacks.md`(Priority 2), CSRF 는 `csrf.md` 에서 다룸.

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **쿠키 속성 미흡** | HttpOnly / Secure / SameSite / Domain · Path 미설정 |
| **세션 ID 자체 결함** | 엔트로피 부족 / 예측 가능한 패턴 |
| **세션 ID URL 노출** | `?sessionid=` 같이 쿠키가 아닌 URL 로 전달 |
| **세션 고정 (Session Fixation)** | 로그인 전후 세션 ID 동일 — 공격자가 미리 발급한 ID로 피해자가 로그인 |
| **세션 만료/무효화 결함** | 로그아웃 후에도 서버 측 세션 유효 / 비활동·절대 타임아웃 없음 |
| **Remember Me / 영속 토큰** | 토큰 약함 / 로그아웃 시 무효화 안 됨 / 동일 토큰 재사용 가능 |

---

## 진단 절차

### Step 1. 세션 발급 위치 확인

로그인 응답의 `Set-Cookie` 헤더와 응답 본문을 확인. 쿠키 이름은 보통 스택을 식별하는 단서가 됨:

| 쿠키 이름 | 스택 |
| :--- | :--- |
| `PHPSESSID` | PHP |
| `JSESSIONID` | Java (Tomcat/Spring) |
| `ASP.NET_SessionId` | ASP.NET |
| `connect.sid` | Node.js (Express) |
| `sessionid` | Django |
| `session` | Flask (서명된 클라이언트 측 세션) |

### Step 2. 쿠키 속성 점검

`Set-Cookie` 헤더에서 다음 속성이 **인증 쿠키** 에 모두 적용되었는지:

```
Set-Cookie: SESSION=abc123; Path=/; Domain=example.com; HttpOnly; Secure; SameSite=Lax
```

| 속성 | 목적 | 누락 시 위험 |
| :--- | :--- | :--- |
| `HttpOnly` | JS의 `document.cookie` 접근 차단 | XSS로 즉시 세션 탈취 |
| `Secure` | HTTPS 에서만 전송 | HTTP 요청 시 평문 노출 (MITM) |
| `SameSite=Lax/Strict` | 크로스사이트 자동 전송 차단 | CSRF 노출 |
| `Domain` 적절성 | 와일드카드(`.example.com`) 시 서브도메인까지 공유 | 서브도메인 takeover 시 영향 확대 |
| `Path` 적절성 | 보통 `/` 이지만 의도 확인 | 좁히면 XSS 영향 축소 |
| `Expires`/`Max-Age` | 미설정 시 브라우저 종료까지(세션 쿠키) | 인증 쿠키에 너무 긴 만료 설정은 위험 |

### Step 3. 세션 ID 엔트로피 분석

동일 계정으로 10~20회 반복 로그인 → 발급된 세션 ID 들을 비교:

- 길이 (16자 미만이면 의심, 권장 32자 이상)
- 순차 증가 / timestamp / 사용자 ID 포함 패턴
- Burp Sequencer 로 통계 분석 가능

### Step 4. 세션 고정 점검

가장 자주 발견되는 클래식 결함. 로그인 전후 세션 ID 비교 (케이스 4 참조).

### Step 5. 로그아웃 / 만료 점검

로그아웃 호출 후 동일 쿠키로 인증 페이지를 호출, 비활동/절대 타임아웃 동작 확인 (케이스 5·6).

### Step 6. Remember Me 영속 토큰 점검

"로그인 유지" 체크 후 발급되는 별도 토큰의 엔트로피·로그아웃 무효화·재사용 가능성 점검 (케이스 7).

---

## 페이로드 / 테스트 케이스

### 케이스 1: 쿠키 속성 점검

**언제 쓰는지**: 어떤 점검이든 가장 먼저 확인해야 하는 항목. 응답 헤더만 보면 됨.

**확인 방법:**

```http
HTTP/1.1 200 OK
Set-Cookie: SESSION=abc123def456; Path=/; HttpOnly        ← Secure / SameSite 누락
Set-Cookie: REMEMBER_ME=xyz789; Domain=.example.com       ← HttpOnly · Secure · SameSite 모두 누락
```

**판정**:

- 인증 관련 쿠키(SESSION, REMEMBER_ME 등) 에 `HttpOnly`, `Secure`, `SameSite` 중 하나라도 누락 → 취약
- `Domain` 이 와일드카드(`.example.com`) 인데 서브도메인 일부가 신뢰할 수 없는 환경 → 추가 위험 분류
- 인증 쿠키에 `Max-Age` 가 1년 같이 너무 길면 별도 권고

> 비인증 쿠키(다국어 설정, 테마 등) 는 HttpOnly·Secure 가 필수 아님. **인증 쿠키만** 점검 대상.

### 케이스 2: 세션 ID 엔트로피 / 예측 가능성

**언제 쓰는지**: 자체 구현된 세션 메커니즘이 의심될 때 (커스텀 토큰 형식, 짧은 길이).

**예측 가능 패턴 예시:**

```
session_1234, session_1235, session_1236             ← 순차 증가 → Critical
1715789432.user1, 1715789433.user1                   ← timestamp + userid → 추측 가능
md5(userid+secret)                                   ← MD5 + 약한 secret → crack 가능
ABCDEF (6자)                                         ← 무차별 가능
```

**판정**:

- 길이 16자 미만이거나 패턴이 보이면 취약
- Burp Sequencer 로 100개 이상 샘플 수집 후 entropy 점수가 낮으면 취약
- 권장: 표준 프레임워크 세션(`session_start()` PHP, `express-session` Node, Spring Session 등) 사용

### 케이스 3: 세션 ID URL 노출

**언제 쓰는지**: URL에 세션 식별자가 보일 때 (`?JSESSIONID=...`, `?PHPSESSID=...`, `?sid=...`).

**리스크:**

- 외부 자원 호출 시 **Referer 헤더로 노출** (외부 폰트, 광고, 애널리틱스, 외부 이미지)
- 브라우저 히스토리 / 서버 액세스 로그에 평문 저장
- 공유 가능 (사용자가 URL 복사해서 공유 시 세션 자체가 공유됨)

**판정**: 인증 후 어떤 페이지든 URL에 세션 ID 가 보이면 취약. PHP 의 경우 `php.ini` 의 `session.use_only_cookies = 0` (default 1) 일 때 발생 가능.

### 케이스 4: 세션 고정 (Session Fixation)

**언제 쓰는지**: 모든 인증 진단에서 필수 점검.

**시나리오:**

```
1. 비로그인 상태로 메인 페이지 접근
   → 응답: Set-Cookie: SESSION=ABC123 (anonymous 세션)

2. 동일 브라우저로 로그인 성공
   → 로그인 후 응답의 Set-Cookie 확인
```

**판정**:

- **로그인 후에도 동일 SESSION=ABC123 이 유지됨** → 취약 (세션 고정 가능)
- 로그인 후 새 SESSION=XYZ789 가 발급됨 → 안전

**공격 시나리오**: 공격자가 본인 브라우저에서 anonymous 세션 ID(`ABC123`) 를 받은 뒤, 피해자에게 `https://target/?session=ABC123` 형태로 유도(또는 XSS로 쿠키 주입). 피해자가 그 세션으로 로그인하면 공격자도 동일 세션으로 인증된 상태가 됨.

### 케이스 5: 로그아웃 후 세션 유효성

**언제 쓰는지**: 모든 인증 진단의 필수 점검. 의외로 자주 발견됨.

**시나리오:**

```
1. 정상 로그인 → SESSION=ABC123 획득
2. /api/profile 호출 → 200 OK (정상)
3. /logout 호출
4. 동일 SESSION=ABC123 으로 /api/profile 다시 호출
```

**판정**:

- 4번 응답이 정상 200 → 취약 (서버 측 세션이 폐기되지 않음, 단순 쿠키만 만료시킴)
- 4번 응답이 401/302 (로그인 페이지로) → 안전

**추가 점검**: 다른 디바이스/브라우저의 동일 사용자 세션도 한꺼번에 무효화되는지 (예: A 브라우저에서 로그아웃 → B 브라우저 세션도 무효 — 정책에 따라 다르지만 보안 관점에서는 권장).

### 케이스 6: 세션 비활동 타임아웃 / 절대 만료

**언제 쓰는지**: 실무에서는 단기 점검 시 자주 생략되지만, 점검 항목으로는 포함.

**비활동 타임아웃:**

```
1. 로그인 후 30분~24시간 방치
2. 동일 쿠키로 인증 페이지 호출
   - 정상 응답 → 비활동 타임아웃 미적용 (취약)
   - 권장: 30분 내외 (민감 서비스는 15분)
```

**절대 만료(Absolute timeout):**

```
세션이 활동 중이라도 일정 시간(예: 24시간) 후 강제 만료되는지
- 미적용이면 취약 (탈취된 세션이 영구 유효)
```

**판정**: 둘 중 하나라도 미적용이면 권고 사항으로 보고. 금융권은 KISA 가이드에 따라 더 짧은 타임아웃 요구.

### 케이스 7: Remember Me / 영속 토큰 결함

**언제 쓰는지**: "로그인 유지" 체크박스가 있는 사이트.

**점검 항목:**

```
1. 토큰 엔트로피 — 동일 계정에서 여러 번 발급된 토큰 비교 (케이스 2 와 동일 기준)
2. 토큰 형식 — 단순 hash(userid+secret) 패턴이면 취약
3. 로그아웃 시 서버 측에서 토큰 무효화하는지
   - 로그아웃 후 REMEMBER_ME 쿠키만 들고 다시 호출 시 자동 로그인되면 취약
4. 동일 토큰 재사용 가능 여부 (rotating vs static)
   - 매 사용 시 새 토큰 발급 + 이전 토큰 무효화 (rotating) 가 권장
```

**판정**:

- 토큰이 추측 가능 → 취약
- 로그아웃 후에도 토큰으로 자동 로그인 가능 → 취약
- 토큰이 한 번 발급되면 만료까지 무한 재사용 → 권고 사항

### 그 외 — 짧게 언급만 (실무 비중 낮음)

- **ASP.NET ViewState 변조** — `EnableViewStateMac=false` 환경 한정. 발견되면 Critical 이지만 모던 환경에서는 거의 차단됨
- **Cookie Jar Overflow / Cookie Tossing** — 매우 한정적, CTF 영역
- **Cross-subdomain cookie sharing 심화** — 도메인 속성 점검(케이스 1) 으로 충분

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 인증 쿠키에 **`HttpOnly` / `Secure` / `SameSite` 중 하나 이상 누락**
- [ ] 세션 ID 길이가 16자 미만이거나 **예측 가능한 패턴** (timestamp, 순차)
- [ ] 세션 ID 가 **URL 파라미터** 로 전달됨 (`?sessionid=...`)
- [ ] **로그인 후에도 세션 ID 가 변경되지 않음** (세션 고정 가능)
- [ ] **로그아웃 후 동일 쿠키로 인증된 페이지 접근 가능**
- [ ] 비활동/절대 타임아웃 미적용
- [ ] Remember Me 토큰이 추측 가능 / 로그아웃 시 무효화 안 됨

**오탐 주의:**

- [ ] 비인증 쿠키(다국어, 테마 설정 등) 는 HttpOnly·Secure 가 필수 아님
- [ ] HTTP 만 서비스하는 환경(개발/내부망) 에서는 `Secure` 가 의도적으로 빠질 수 있음 — 단, 운영 점검에서는 HTTPS + Secure 를 기준으로 함

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [세션 고정] 로그인 전후 세션 ID 동일

1. 로그아웃 상태로 `<TARGET>` 메인 페이지 접근, 응답에서 anonymous 세션 쿠키 확인
2. 동일 브라우저(쿠키 유지) 로 정상 로그인 시도
3. 로그인 후 응답의 Set-Cookie 비교 — 세션 ID 가 변경되지 않음을 확인

**요청 1 (메인 페이지 접근):**

```http
GET / HTTP/1.1
Host: <TARGET>
```

**응답 1:**

```http
HTTP/1.1 200 OK
Set-Cookie: SESSION=ABC123DEF456; Path=/; HttpOnly
```

**요청 2 (로그인):**

```http
POST /login HTTP/1.1
Host: <TARGET>
Cookie: SESSION=ABC123DEF456
Content-Type: application/x-www-form-urlencoded

userid=admin&password=Admin123!
```

**응답 2 — 취약 발현 증거:**

```http
HTTP/1.1 302 Found
Location: /dashboard
Set-Cookie: SESSION=ABC123DEF456; Path=/; HttpOnly       ← 동일 ID 유지 (세션 재발급 안 됨)
```

**확인 사항:**
- 로그인 전 발급된 세션 ID `ABC123DEF456` 가 로그인 후에도 그대로 유지됨
- 공격자가 사전에 자신의 세션 ID 를 피해자에게 주입(XSS/링크 등) 하면, 피해자가 로그인 후 공격자가 동일 세션으로 인증된 상태로 접근 가능
- 권장 동작: 로그인 성공 시 `session_regenerate_id(true)` 같은 함수로 새 세션 ID 발급 + 기존 세션 폐기

---

### PoC 2 — [로그아웃 후 세션 유효] 서버 측 세션 미폐기

1. 정상 로그인 → 인증 쿠키 `SESSION=XYZ789` 획득
2. `/api/profile` 정상 호출 확인
3. `/logout` 호출 (응답에서 쿠키 만료 확인)
4. 만료 처리된 동일 쿠키 값으로 `/api/profile` 다시 호출

**요청 (로그아웃 후 동일 쿠키로 호출):**

```http
GET /api/profile HTTP/1.1
Host: <TARGET>
Cookie: SESSION=XYZ789
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"userid":"admin","email":"admin@example.com","role":"administrator"}
```

**확인 사항:**
- 로그아웃 처리 후에도 동일 세션 쿠키로 인증된 데이터가 정상 응답됨
- 서버 측 세션 저장소에서 세션이 실제로 폐기되지 않음 (단순 클라이언트 쿠키만 만료)
- 세션 탈취가 발생한 경우 사용자가 로그아웃해도 공격자는 계속 세션 사용 가능

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 — 세션 탈취 시 사용자 데이터 전체 노출
- **무결성 (Integrity)**: 🔴 — 탈취 세션으로 임의 액션 수행 (CSRF 토큰까지 우회 가능)
- **가용성 (Availability)**: 🟢 — 직접적 영향 없음
- **추가 위협**:
  - **XSS + HttpOnly 미설정** = 즉시 세션 탈취
  - **세션 고정 + 피싱** = 계정 탈취
  - **로그아웃 미폐기 + 공용 PC** = 다음 사용자가 이전 세션 사용 가능
  - **Secure 미설정 + 공용 Wi-Fi** = MITM 으로 평문 노출

**비즈니스 임팩트:**
세션 결함은 단독 결함보다 **다른 결함과의 결합**에서 위험이 증폭된다. 특히 HttpOnly 미적용은 사이트의 모든 XSS 의 영향도를 한 단계 올리는 효과가 있어, XSS 가 1건이라도 있으면 사실상 모든 인증 사용자의 세션이 위협받는다. 실무 진단에서 인증 쿠키 속성 결함은 항상 보고 항목.

---

## 대응방안

### 개발자 관점 (필수)

1. **인증 쿠키에 모든 속성 적용**:
   ```
   Set-Cookie: SESSION=...; Path=/; HttpOnly; Secure; SameSite=Lax
   ```

2. **로그인 시 세션 ID 재발급 (Session Regeneration)** — 세션 고정 방어의 정답:
   - PHP: `session_regenerate_id(true)`
   - Express: `req.session.regenerate(...)`
   - Spring Security: 기본 활성 (`http.sessionManagement().sessionFixation().migrateSession()`)
   - Django: `login()` 함수가 자동 처리

3. **로그아웃 시 서버 측 세션 즉시 폐기** — 단순 쿠키 삭제만으론 부족:
   - PHP: `session_destroy()` + `setcookie(session_name(), '', time()-3600)`
   - Express: `req.session.destroy()`
   - Spring Security: `SecurityContextHolder.clearContext()` + 세션 무효화

4. **표준 프레임워크 세션 사용** — 세션 ID 직접 구현 금지. 검증된 라이브러리 사용.

5. **타임아웃 설정**:
   - 비활동 타임아웃 30분 (민감 서비스 15분)
   - 절대 타임아웃 8~24시간

6. **URL 에 세션 ID 노출 금지**:
   - PHP: `php.ini` 에 `session.use_only_cookies = 1` (default)
   - Java: `<session-config><tracking-mode>COOKIE</tracking-mode></session-config>` (web.xml)

7. **Remember Me** — 별도 영속 토큰으로 분리 + rotating + 로그아웃 시 무효화. Spring Security 의 `PersistentTokenBasedRememberMeServices` 같은 검증된 구현 사용.

### 운영자 관점

1. **HTTPS 강제 + HSTS**:
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
   ```

2. **HTTP → HTTPS 리다이렉트 강제** (`Secure` 쿠키가 HTTP 요청에 전송되지 않도록).

3. 가능하면 `SameSite=Strict` 환경 (외부 링크 인입이 적은 사이트).

### 안전 / 위험 코드 비교 (스택별)

**Express (Node.js):**

```javascript
// 위험 — 속성 누락
app.use(session({
    secret: 'secret',
    cookie: { maxAge: 86400000 }
}));

// 안전 — 모든 속성 적용 + 로그인 시 재발급
app.use(session({
    secret: process.env.SESSION_SECRET,
    name: 'SESSION',
    cookie: {
        httpOnly: true,
        secure: true,             // HTTPS 환경 (개발은 false)
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000    // 30분 비활동 타임아웃
    },
    rolling: true,                // 활동 시 만료 갱신
    resave: false,
    saveUninitialized: false
}));

// 로그인 핸들러 — 세션 재발급
req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
});

// 로그아웃 핸들러 — 서버 측 세션 폐기
req.session.destroy((err) => {
    res.clearCookie('SESSION');
    res.redirect('/');
});
```

**Flask (Python):**

```python
# 안전 — config 에서 모든 속성 적용
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
    SESSION_REFRESH_EACH_REQUEST=True,
)

# 로그인 시 세션 재발급 (Flask-Login 사용 시 자동)
from flask import session
session.clear()
session['user_id'] = user.id
session.permanent = True
```

**Spring Boot (`application.yml`):**

```yaml
server:
  servlet:
    session:
      timeout: 30m
      cookie:
        http-only: true
        secure: true
        same-site: lax
      tracking-modes: COOKIE
```

**PHP:**

```php
// 안전 — 세션 시작 전에 cookie 옵션 설정
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
ini_set('session.use_only_cookies', 1);
session_start();

// 로그인 시 세션 재발급
if (login_succeeded($_POST['userid'], $_POST['password'])) {
    session_regenerate_id(true);     // 기존 세션 폐기 + 새 ID 발급
    $_SESSION['user_id'] = $user_id;
}

// 로그아웃 시 서버 측 세션 폐기
session_unset();
session_destroy();
setcookie(session_name(), '', time() - 3600, '/');
```

---

## 참고자료

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Testing Guide - Session Management](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/)
- [PortSwigger - Session vulnerabilities](https://portswigger.net/web-security/authentication)
- [MDN - Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN - SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
