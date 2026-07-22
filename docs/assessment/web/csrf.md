---
sidebar_position: 18
title: CSRF
description: 웹 진단 - CSRF 토큰, Origin·Referer, SameSite, GET 상태 변경, JSON 요청 점검 절차와 판정 기준
keywords: [CSRF, XSRF, Cross-Site Request Forgery, SameSite, Anti-CSRF Token, Origin, Referer, OWASP A01]
draft: false
toc_max_heading_level: 3
---

> 로그인한 사용자가 다른 사이트를 열었을 때, 사용자 모르게 대상 서비스의 변경 요청이 실행되는지 확인한다.

## 점검 목적

공격자 페이지가 사용자의 브라우저를 이용해 프로필 변경, 게시글 작성, 설정 변경 같은 요청을 대신 보낼 수 있는지 확인한다.

CSRF가 성립하려면 보통 다음 세 조건이 모두 필요하다.

1. 브라우저가 세션 쿠키 같은 인증정보를 요청에 자동으로 넣는다.
2. 다른 사이트에서 대상 요청과 같은 형태를 만들 수 있다.
3. 서버가 CSRF 토큰이나 요청 출처를 제대로 확인하지 않는다.

Burp Repeater에서 쿠키를 직접 넣어 요청이 성공하는 것만으로는 CSRF가 아니다. 다른 사이트에서 PoC를 열었을 때 브라우저가 인증정보를 포함해 요청하고, 실제 상태가 바뀌어야 한다.

세션 쿠키 속성은 [세션 관리](./session-management.md), 공격자 Origin을 허용하는 문제는 [CORS](./cors.md)에서 이어간다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **방어 없는 변경 요청** | 세션 쿠키만 있으면 요청이 처리됨 | 다른 사이트의 form·링크로 실제 변경되면 취약 |
| **CSRF 토큰 검사 미흡** | 토큰 제거·빈 값·잘못된 값이 허용됨 | 공격자가 만들 수 있는 요청으로 우회가 재현되면 취약 |
| **요청 출처 검사 미흡** | `Origin`·`Referer`가 없거나 일부 문자열만 맞아도 허용됨 | 다른 사이트에서 만든 요청이 통과하면 취약 |
| **GET 상태 변경** | 링크를 여는 것만으로 데이터나 설정이 바뀜 | 로그인 쿠키가 포함된 외부 이동으로 변경되면 취약 |
| **SameSite 의존** | 별도 토큰 없이 쿠키의 `SameSite`에만 의존함 | 실제 브라우저에서 쿠키가 전송되는 조건이 있으면 취약 |
| **요청 형식 검사 편차** | JSON은 막지만 form·`text/plain`·Method Override는 허용함 | 다른 사이트가 만들 수 있는 형식으로 변경되면 취약 |

---

## 진단 절차

#### Step 1. 안전한 변경 기능 선택

로그인 후 서버 상태를 바꾸는 요청을 찾는다.

- 프로필 표시 이름·알림 설정 변경
- 테스트 게시글 작성·수정·삭제
- 배송지·연락처 변경
- 이메일·비밀번호·MFA 변경
- 관리자 공지·승인·사용자 상태 변경

먼저 되돌릴 수 있는 테스트 계정과 데이터로 확인한다. 이메일·비밀번호처럼 계정 접근에 영향을 주는 기능은 소유한 테스트 주소와 복구 수단이 있을 때만 사용한다.

#### Step 2. 브라우저가 인증정보를 자동으로 보내는지 확인

CSRF는 사용자가 값을 직접 넣지 않아도 브라우저가 인증정보를 붙이는 경우가 대상이다.

| 인증 방식 | 기본 판단 |
| :--- | :--- |
| 세션 쿠키 | 주요 점검 대상 |
| HTTP Basic 인증·클라이언트 인증서 | 브라우저가 자동 사용하면 점검 대상 |
| JavaScript가 직접 넣는 `Authorization: Bearer` 헤더 | 다른 사이트의 form이 헤더를 넣을 수 없어 일반적인 CSRF 대상이 아님 |

Bearer 토큰과 세션 쿠키를 함께 쓰는 서비스라면 어떤 값으로 인증되는지 쿠키를 제거해 비교한다.

#### Step 3. 현재 방어 확인

정상 변경 요청에서 다음 값을 찾는다.

- body 또는 Header의 CSRF 토큰: `csrf`, `_token`, `X-CSRF-Token`, `X-XSRF-TOKEN`
- `Origin`·`Referer`를 바꿨을 때 서버 응답 차이
- 인증 쿠키의 `SameSite=Strict`, `Lax`, `None`
- 중요 변경 시 현재 비밀번호나 MFA를 다시 요구하는지

#### Step 4. 방어를 한 번에 하나씩 변경

정상 요청을 기준으로 다음 순서로 비교한다.

1. CSRF 토큰 필드 전체 제거
2. 빈 값과 임의 값 사용
3. 다른 테스트 계정에서 발급된 토큰 사용
4. `Origin`·`Referer` 제거 또는 다른 사이트 값 사용
5. 같은 기능의 GET·form·다른 Content-Type 확인

응답 코드만 보지 말고 후속 조회에서 값이 실제로 바뀌었는지 확인한다.

#### Step 5. 다른 사이트에서 브라우저 PoC 실행

PoC 파일은 대상 서비스와 다른 Origin에서 연다. 예를 들어 대상이 `https://target.example`이면 `http://127.0.0.1:8000`처럼 scheme·host·port 중 하나가 다른 위치를 사용한다.

브라우저 개발자 도구나 Burp에서 다음을 확인한다.

- 요청이 실제 전송됐는지
- 인증 쿠키가 포함됐는지
- CORS preflight에서 중단되지 않았는지
- 응답 코드와 관계없이 서버 상태가 바뀌었는지

### 상황별 빠른 선택

| 현재 요청 | 먼저 할 테스트 |
| :--- | :--- |
| form 형식의 `POST` + CSRF 토큰 없음 | 다른 Origin에서 자동 제출 form 실행 |
| CSRF 토큰이 있음 | 필드 제거·빈 값·임의 값 순서로 비교 |
| `Origin`·`Referer`만 확인 | 헤더가 없거나 다른 사이트일 때 차단되는지 확인 |
| GET 요청으로 데이터 변경 | 외부 페이지의 top-level 이동으로 실행 |
| 인증 쿠키가 `SameSite=None` | 외부 form 요청에 쿠키가 포함되는지 확인 |
| 인증 쿠키가 `SameSite=Lax` | 상태 변경 GET·Method Override·최근 발급 쿠키 조건 확인 |
| JSON `PUT`·`DELETE` | preflight 여부를 확인하고 form으로 보낼 대체 요청 탐색 |
| 로그인 요청 | 공격자 테스트 계정으로 피해자 브라우저가 로그인되는지 확인 |

---

## 페이로드 노트

### 1. 토큰 없는 form 요청

**이럴 때 사용**: 변경 요청이 `POST` form 형식이고 CSRF 토큰이나 출처 검사가 보이지 않는다.

**바꿀 값**: 테스트 계정에서 되돌릴 수 있는 값만 사용한다.

```html
<!doctype html>
<html lang="ko">
<body>
  <form id="csrf" action="https://target.example/api/profile" method="POST">
    <input type="hidden" name="displayName" value="csrf-test">
  </form>
  <script>document.getElementById('csrf').submit();</script>
</body>
</html>
```

**확인할 것**: 로그인된 브라우저로 외부 페이지를 열었을 때 세션 쿠키가 포함되고, 표시 이름이 실제로 `csrf-test`로 바뀌는지 확인한다.

브라우저가 쿠키를 보내지 않았거나 서버가 요청을 차단했다면 이 PoC로는 취약하지 않다.

### 2. CSRF 토큰 제거·변조

**이럴 때 사용**: 정상 요청에 `csrf`, `_token`, `X-CSRF-Token` 같은 값이 있다.

**바꿀 값**

| 순서 | 요청 | 확인 의도 |
| :--- | :--- | :--- |
| 1 | 토큰 필드 전체 제거 | 토큰이 없을 때 검사를 건너뛰는지 |
| 2 | 토큰을 빈 값으로 전송 | 값 존재 여부만 보는지 |
| 3 | 임의 문자열로 변경 | 발급된 값인지 검증하는지 |
| 4 | 사용자 A 세션 + 사용자 B 토큰 | 토큰이 사용자 세션과 연결되는지 |

**확인할 것**: 요청 성공 메시지보다 값이 실제 변경됐는지 확인한다.

다른 사용자 토큰이 통과한다는 사실만으로 공격이 완성되지는 않는다. 공격자가 자신의 토큰을 읽어 피해자 요청에 넣을 수 있는지, 또는 토큰이 고정·공개되어 있는지까지 확인한다. 토큰을 피해자 브라우저에 전달할 방법이 없다면 방어 약점 후보로 기록한다.

### 3. `Origin`·`Referer` 검사

**이럴 때 사용**: CSRF 토큰은 없고 서버가 요청 출처 Header만 확인하는 것으로 보인다.

**바꿀 값**

```http
Origin: https://attacker.example
Referer: https://attacker.example/poc.html
```

다음 응답을 비교한다.

1. 정상 `Origin`·`Referer`
2. `Origin` 제거
3. `Referer` 제거
4. 두 Header 모두 제거
5. 다른 사이트 값 사용
6. `https://target.example.attacker.example`처럼 대상 문자열을 포함한 외부 host 사용

**확인할 것**: 서버는 전체 origin을 정확히 비교해야 한다. Header가 없거나 외부 host인데도 변경이 허용되면 실제 브라우저에서 같은 요청을 만들 수 있는지 확인한다.

Repeater에서 Header를 삭제해 성공한 것만으로는 확정하지 않는다. 브라우저가 해당 요청에서 Header를 실제로 생략하거나 `null`로 보내는 조건이 있어야 한다.

### 4. GET 요청으로 상태 변경

**이럴 때 사용**: 링크를 열거나 페이지를 조회했는데 삭제·승인·설정 변경이 발생한다.

```http
GET /api/notifications/disable HTTP/1.1
Host: target.example
```

`SameSite=Lax` 쿠키는 외부 사이트에서 발생한 **top-level GET 이동**에 포함될 수 있다. 따라서 이미지 요청보다 페이지 이동으로 먼저 확인한다.

```html
<script>
location.href = 'https://target.example/api/notifications/disable';
</script>
```

**확인할 것**: 브라우저 주소가 대상 URL로 이동하면서 인증 쿠키가 포함되고, 알림 설정이 실제로 꺼지는지 확인한다.

`<img src>`는 백그라운드 하위 리소스 요청이므로 `SameSite=Lax` 쿠키가 보통 포함되지 않는다. 인증 쿠키가 `SameSite=None`이거나 별도 우회 조건이 있을 때만 유효하다.

### 5. `SameSite` 쿠키 확인

**이럴 때 사용**: 별도 CSRF 토큰이 없고 인증 쿠키의 `SameSite`에 의존한다.

| 쿠키 설정 | 외부 사이트 요청에서 기본 동작 | 다음 확인 |
| :--- | :--- | :--- |
| `SameSite=Strict` | cross-site 요청에 쿠키를 보내지 않음 | 신뢰 낮은 같은 site 서브도메인이나 내부 redirect가 있는지 |
| `SameSite=Lax` | top-level GET 이동에는 쿠키를 보낼 수 있음 | 상태 변경 GET·GET Method Override |
| 속성 생략 | 브라우저별 기본값 차이가 있음 | 실제 지원 브라우저에서 form POST 확인 |
| `SameSite=None; Secure` | cross-site 요청에도 쿠키를 보냄 | CSRF 토큰·Origin 검사가 별도로 있는지 |

일부 브라우저는 `SameSite`가 생략된 새 쿠키에 한해 발급 직후 약 2분 동안 top-level POST에도 쿠키를 보낼 수 있다. 명시적인 `SameSite=Lax`와 같은 동작으로 보지 말고 실제 브라우저에서 확인한다.

**확인할 것**: 속성만 보고 취약 판정하지 않는다. 외부 PoC 요청에 인증 쿠키가 포함되고 상태가 변경되는지까지 확인한다.

### 6. JSON 요청을 form 형식으로 바꾸기

**이럴 때 사용**: 정상 요청은 JSON이지만 서버가 Content-Type을 엄격하게 제한하지 않는 것으로 보인다.

브라우저 form은 `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` 요청을 만들 수 있다. 같은 endpoint가 이 형식도 받아들이는지 먼저 Repeater에서 확인한다.

```html
<form action="https://target.example/api/profile" method="POST" enctype="text/plain">
  <input name='{"displayName":"csrf-test","ignore":"' value='x"}'>
</form>
<script>document.forms[0].submit();</script>
```

**확인할 것**: 서버가 `text/plain` 본문을 JSON처럼 처리하고 실제 값이 바뀌는지 확인한다. JSON만 허용하고 다른 형식을 거부하면 일반 form 기반 CSRF는 어렵다.

### 7. `PUT`·`DELETE`와 preflight

**이럴 때 사용**: 변경 요청이 `PUT`, `PATCH`, `DELETE`이거나 JavaScript에서 JSON Header를 넣어야 한다.

```html
<script>
fetch('https://target.example/api/profile', {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  credentials: 'include',
  body: JSON.stringify({displayName: 'csrf-test'})
});
</script>
```

이 요청은 보통 실제 요청 전에 CORS preflight를 보낸다. 대상 서버가 공격자 Origin을 허용하지 않으면 브라우저가 본 요청을 보내지 않는다.

**확인할 것**: Burp에서 `OPTIONS` 이후 실제 `PUT` 요청이 전송됐는지, 쿠키가 포함됐는지, 상태가 변경됐는지 확인한다. Repeater에서 `PUT`이 성공한 것만으로는 CSRF가 아니다.

preflight에서 막히면 다음 대체 경로를 확인한다.

- 같은 기능을 처리하는 form `POST`
- `_method=PUT` 같은 Method Override 파라미터
- GET으로 처리되는 변경 요청
- 서버가 허용하는 다른 Content-Type

### 8. Login CSRF

**이럴 때 사용**: 로그인 요청에 CSRF 토큰이나 출처 검사가 없고, 로그인 성공 후 세션 쿠키가 발급된다.

공격자 소유의 테스트 계정 자격증명으로 자동 제출 form을 만든다. 피해자용 테스트 브라우저에서 PoC를 열어 공격자 테스트 계정으로 로그인되는지 확인한다.

**확인할 것**: 브라우저가 공격자 계정으로 바뀐 뒤 사용자가 입력한 검색 기록·개인정보·결제 정보 등이 공격자 계정에 저장될 수 있는지 확인한다. 단순히 계정이 바뀌는 현상만 확인됐다면 서비스 기능과 연결되는 영향을 별도로 판단한다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 토큰을 바꾸면 차단 | 토큰 필드 전체 제거·빈 값·다른 사용자 토큰 |
| `POST`에서만 토큰 검사 | 같은 기능의 GET·Method Override 요청 |
| 다른 사용자 토큰 허용 | 공격자가 토큰을 확보해 피해자 요청에 넣을 수 있는지 |
| `Origin`이 다르면 차단 | Header 없음·`null`·`Referer` fallback 처리 |
| `Referer`에 대상 문자열이 있으면 허용 | `target.example.attacker.example` 같은 외부 host |
| 쿠키가 `SameSite=Lax` | top-level GET 상태 변경·최근 발급 쿠키 조건 |
| 쿠키가 `SameSite=Strict` | 신뢰 낮은 같은 site 서브도메인·내부 client-side redirect |
| JSON 요청만 보임 | form·`text/plain`·Method Override 지원 여부 |
| `PUT`·`DELETE` 요청 | preflight 통과 여부와 같은 기능의 form `POST` |
| PoC 요청은 `200` | 후속 조회로 실제 상태 변경 확인 |
| PoC 요청에 쿠키가 없음 | SameSite 설정·요청 방식·top-level 이동 여부 확인 |

---

## 취약 판정 기준

### 취약

- [ ] 다른 Origin의 form 또는 링크로 요청했을 때 인증정보가 자동 포함되고 상태가 변경됨
- [ ] CSRF 토큰을 제거하거나 임의 값으로 바꿔도 외부 PoC에서 변경이 실행됨
- [ ] `Origin`·`Referer` 검사를 우회해 외부 PoC가 실행됨
- [ ] 상태 변경 GET이 외부 top-level 이동으로 실행됨
- [ ] JSON·Method 제한을 form 형식이나 Method Override로 바꿔 상태 변경에 성공함
- [ ] 공격자 테스트 계정으로 피해자 브라우저를 로그인시키고 현실적인 후속 영향이 확인됨

### 후보 / 보류

- [ ] CSRF 토큰은 없지만 `SameSite` 때문에 외부 요청에 인증 쿠키가 포함되지 않음
- [ ] `SameSite=None`이지만 CSRF 토큰이나 정확한 Origin 검사가 요청을 차단함
- [ ] 다른 사용자 토큰은 통과하지만 공격자가 토큰을 피해자 요청에 넣을 방법은 확인되지 않음
- [ ] Repeater에서 토큰·Header 제거 요청은 성공하지만 브라우저 PoC는 확인하지 못함
- [ ] 외부 요청은 전송됐지만 인증 쿠키가 없거나 실제 상태가 바뀌지 않음
- [ ] `OPTIONS` 응답만 허용되고 실제 `PUT`·`DELETE`는 전송되지 않음

### 영향 상승 조건

- [ ] 이메일·비밀번호·MFA·배송지·결제 정보처럼 중요한 설정을 변경할 수 있음
- [ ] 관리자 사용자를 대상으로 공지·승인·권한 변경 기능을 실행할 수 있음
- [ ] 현재 비밀번호나 추가 인증 없이 중요한 변경이 완료됨
- [ ] 하나의 PoC로 여러 중요 기능에 같은 방어 누락이 재현됨

조회만 하는 공개 요청이나 인증이 필요 없는 기능은 일반적인 CSRF 대상이 아니다. 단, 응답 내용을 공격자가 읽을 수 있는지는 CORS·정보 노출 관점에서 별도로 확인한다.

---

## 참고자료

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Testing Guide - CSRF](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/05-Testing_for_Cross_Site_Request_Forgery)
- [PortSwigger - Cross-site request forgery](https://portswigger.net/web-security/csrf)
- [PortSwigger - Bypassing CSRF token validation](https://portswigger.net/web-security/csrf/bypassing-token-validation)
- [PortSwigger - Bypassing SameSite cookie restrictions](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
- [MDN - Set-Cookie / SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
