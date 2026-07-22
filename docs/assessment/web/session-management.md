---
sidebar_position: 15
title: 세션 관리
description: 웹 진단 - 세션 ID 발급·갱신·무효화, 쿠키 범위, 세션 고정, 로그아웃, Remember Me 점검 절차와 판정 기준
keywords: [세션, Session, Cookie, HttpOnly, Secure, SameSite, __Host, 세션 고정, Session Fixation, Remember Me, OWASP A07]
draft: false
toc_max_heading_level: 3
---

> 세션 ID가 로그인 전후에 적절히 갱신되고, 안전한 범위로 전달되며, 로그아웃·만료·계정 보안 이벤트에서 서버 측 무효화되는지 확인한다.

## 점검 목적

세션 ID의 **발급 → 전달 → 권한 상승 시 rotation → 만료·폐기** 흐름을 확인한다. 쿠키 속성만 나열하지 않고 이전 토큰이 실제로 재사용되는지까지 검증한다.

로그인·MFA 흐름은 [인증](./authentication.md), JWT 위조는 [JWT 공격](./jwt-attacks.md), SameSite 우회와 요청 위조는 [CSRF](./csrf.md)에서 이어간다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **세션 ID 생성 결함** | 값이 짧거나 구조화되어 있고 사용자·시간·순번 정보가 보임 | 다른 유효 세션 추측 가능성이나 민감 정보 포함이 재현되면 취약 |
| **전달·저장 범위 미흡** | 인증 토큰이 URL·본문·넓은 Domain 쿠키·브라우저 저장소에 노출됨 | 로그·Referer·서브도메인 주입·XSS 등 현실적인 탈취 경로가 있으면 취약 |
| **세션 고정 / Rotation 누락** | 로그인·MFA·권한 상승 뒤에도 공격자가 아는 세션이 유지됨 | 이전 ID로 보호 API 접근이 가능하면 취약 |
| **무효화·만료 결함** | 로그아웃·비밀번호 변경·기기 폐기 후에도 기존 세션이 살아 있음 | 서버 측 폐기가 되지 않아 이전 토큰 재사용이 가능하면 취약 |
| **영속 세션 결함** | Remember Me 토큰이 정적이거나 일반 세션과 폐기 흐름이 분리됨 | 로그아웃·보안 이벤트 뒤 재인증 세션을 만들 수 있으면 취약 |
| **쿠키 해석 차이** | 같은 이름의 쿠키를 앞단·백엔드·프레임워크가 다르게 선택함 | 공격자 지정 쿠키가 인증 세션으로 채택되면 취약 |

---

## 진단 절차

#### Step 1. 세션 식별값 매핑

비로그인·로그인·MFA 완료 응답에서 `Set-Cookie`, 응답 본문, URL을 비교한다. 인증 상태를 결정하는 값과 CSRF·기기 식별용 값을 구분하고, 브라우저 저장소와 모바일 API 토큰도 함께 기록한다.

#### Step 2. 쿠키 속성과 범위 확인

운영 HTTPS 환경의 인증 쿠키를 기준으로 확인한다.

```http
Set-Cookie: __Host-SESSION=<VALUE>; Path=/; Secure; HttpOnly; SameSite=Lax
```

| 항목 | 확인할 것 |
| :--- | :--- |
| `Secure` | HTTPS에서만 인증 쿠키가 전송되는지 |
| `HttpOnly` | JavaScript에서 인증 쿠키 값을 읽을 수 없는지 |
| `SameSite` | 서비스 흐름에 맞게 `Lax` 또는 `Strict`가 명시됐는지. `None`이면 `Secure`가 함께 있는지 |
| `Domain` | 서브도메인 공유가 필요하지 않으면 생략해 host-only로 제한했는지 |
| `Path` | 의도한 경로로 제한됐는지. 브라우저 보안 경계로 간주하지 않음 |
| Prefix | 가능하면 `__Host-`를 사용하고 `Secure`, `Path=/`, `Domain` 생략 조건을 지키는지 |
| `Max-Age` / `Expires` | 일반 세션과 로그인 유지 토큰의 수명이 서비스 정책에 맞는지 |

`HttpOnly`는 쿠키 읽기를 막지만 XSS가 인증 요청을 보내는 것까지 막지는 않는다. `SameSite` 역시 CSRF 방어의 보조 수단이므로 토큰·Origin 검증은 [CSRF](./csrf.md)에서 별도로 확인한다.

#### Step 3. 발급값 분석

커스텀 형식, 짧은 값, 구조화된 값이 보이면 여러 세션을 발급해 비교한다.

- 순차값·timestamp·사용자 ID·이메일 포함 여부
- 같은 조건에서 중복 발급되는지
- 인코딩을 해제했을 때 예측 가능한 원문이 나오는지
- Burp Sequencer 분석에서 유의미한 편향이 나타나는지

문자열 길이만으로 판정하지 않는다. 인코딩 방식에 따라 같은 엔트로피도 길이가 달라진다.

#### Step 4. 세션 수명주기 비교

비로그인 세션 `S0`를 확보한 뒤 로그인하여 `S1`, MFA·권한 상승 후 `S2`를 기록한다. 각 단계에서 이전 세션으로 보호 API를 다시 호출한다.

| 전환 | 기대 동작 |
| :--- | :--- |
| 비로그인 → 로그인 | 새 세션 ID 발급, `S0`으로 인증 접근 불가 |
| 1차 인증 → MFA 완료 | 권한이 상승한다면 rotation 또는 동등한 서버 측 상태 전환 |
| 일반 권한 → 관리자 권한 | 기존 ID 고정으로 인한 세션 고정 위험이 없도록 rotation |

#### Step 5. 만료와 폐기 확인

로그아웃 전 보호 요청을 Repeater에 저장하고 로그아웃 후 같은 쿠키로 재전송한다. 비밀번호 변경·재설정, MFA 변경, 계정 비활성화, 모든 기기 로그아웃 기능도 서비스 정책에 따라 같은 방식으로 확인한다.

Idle timeout, absolute timeout, renewal timeout은 서버에서 강제되어야 한다. 고정된 권장 시간으로 판정하지 말고 서비스 민감도와 명시된 정책에 맞는지 확인한다.

#### Step 6. 영속·다중 세션 확인

로그인 유지 토큰을 일반 세션과 분리해 발급·사용·폐기 흐름을 확인한다. 동시 로그인 목록이나 기기별 로그아웃 기능이 있으면 특정 세션만 정확히 폐기되는지도 검증한다.

---

## 페이로드 노트

### 1. 쿠키 속성·범위

```http
HTTP/1.1 200 OK
Set-Cookie: SESSION=<VALUE>; Path=/; HttpOnly
Set-Cookie: REMEMBER_ME=<VALUE>; Domain=.example.com; Max-Age=2592000
```

인증 쿠키별로 속성을 따로 기록한다. `Secure`가 없는 운영 HTTPS 인증 쿠키는 HTTP 전송 가능성을 확인하고, 넓은 `Domain`은 실제로 신뢰도가 낮은 서브도메인이 쿠키를 설정할 수 있는지까지 연결한다.

`__Host-SESSION`을 사용하는 경우 다음 조건을 함께 확인한다.

```http
Set-Cookie: __Host-SESSION=<VALUE>; Secure; Path=/; HttpOnly; SameSite=Lax
```

- `Domain` 속성 없음
- `Path=/`
- `Secure` 포함

Prefix가 없다는 사실만으로 취약 판정하지 않는다.

### 2. 세션 ID 값·전달 경로

```text
session_10421
session_10422
1715789432.user01
```

순차성이나 사용자 정보가 보이면 별도 계정과 시간대에서도 패턴이 유지되는지 확인한다. 디코딩 가능한 값은 식별 정보 노출과 추측 가능성을 분리해 판정한다.

정상 요청에서 쿠키를 제거하고 같은 값을 다른 위치에 넣어 비교한다.

```http
GET /account?sessionid=<SESSION_VALUE> HTTP/1.1
Host: target.example
```

```http
POST /api/account HTTP/1.1
Content-Type: application/x-www-form-urlencoded

sessionid=<SESSION_VALUE>
```

쿠키 기반 서비스가 URL·본문의 세션 ID도 받아들이면 로그, 히스토리, Referer 노출과 세션 고정 가능성을 확인한다.

### 3. 세션 고정과 rotation

1. 비로그인 상태에서 `S0`를 발급받는다.
2. 같은 브라우저로 로그인하고 `S1`을 기록한다.
3. `S0`로 보호 API를 호출한다.
4. MFA나 역할 상승이 있으면 전후 세션을 같은 방식으로 비교한다.

```http
GET /api/me HTTP/1.1
Cookie: SESSION=<S0>
```

값이 그대로라는 사실만 보지 말고, 공격자가 알던 `S0`가 로그인 후 인증 세션으로 바뀌는지를 확인한다. 프레임워크가 내부 상태만 교체하는 경우도 있어 보호 요청 재현이 필요하다.

### 4. 로그아웃·보안 이벤트 무효화

```text
1. SESSION=S1으로 /api/me 요청 저장
2. 브라우저에서 로그아웃
3. 저장한 요청을 SESSION=S1 그대로 재전송
4. 401, 403, 로그인 리다이렉트 또는 비인증 응답인지 확인
```

브라우저 쿠키가 삭제됐어도 서버의 `S1`이 살아 있으면 취약하다. 다음 이벤트는 기능과 정책이 있을 때 같은 방법으로 확인한다.

- 비밀번호 변경·재설정
- MFA factor 변경
- 계정 잠금·비활성화
- 모든 기기 로그아웃
- 기기 목록에서 특정 세션 폐기

일반 로그아웃이 다른 기기의 정상 세션까지 모두 끊어야 하는 것은 아니다. 해당 기능이 약속하는 범위와 실제 폐기 범위를 맞춰 판정한다.

### 5. Idle·absolute·renewal timeout

| 구분 | 확인 방법 |
| :--- | :--- |
| Idle | 요청 없이 정책 시간 경과 후 기존 세션 재사용 |
| Absolute | 중간에 활동해도 최초 로그인 기준 만료되는지 확인 |
| Renewal | 활동 중 새 ID가 발급될 때 이전 ID가 폐기되는지 확인 |

클라이언트 타이머가 로그인 화면으로 이동시키는 것만으로는 충분하지 않다. 저장해 둔 인증 요청을 서버에 직접 보내 만료를 확인한다. 짧은 진단에서 정책 시간까지 기다리지 못했다면 설정·응답 근거만 기록하고 보류한다.

### 6. Remember Me / 영속 토큰

1. 같은 계정에서 토큰을 두 번 발급해 값과 만료를 비교한다.
2. 일반 세션을 제거하고 영속 토큰만 새 브라우저에 넣어 동작을 확인한다.
3. 자동 로그인 후 토큰이 rotation되는지, 이전 값이 다시 동작하는지 확인한다.
4. 로그아웃·비밀번호 변경·모든 기기 로그아웃 후 기존 토큰을 재사용한다.

사용자 ID·이메일이 평문으로 들어가거나, 토큰이 예측 가능하거나, 폐기 후 다시 인증을 만들 수 있으면 취약하다. 만료 전 정적 재사용만 확인된 경우에는 서비스 정책과 기기 폐기 기능을 함께 보고 판정한다.

### 7. 중복 쿠키 / Cookie Tossing

낮은 신뢰도의 서브도메인이 상위 도메인 쿠키를 설정할 수 있거나 같은 이름의 쿠키가 여러 경로에서 보이면 확인한다.

```http
GET /api/me HTTP/1.1
Cookie: SESSION=<ATTACKER_VALUE>; SESSION=<VALID_VALUE>
```

순서를 바꿔 앞단, 애플리케이션, 세션 저장소가 어느 값을 사용하는지 비교한다. 공격자 제어 쿠키가 인증 세션으로 채택되거나 세션 고정으로 이어질 때 취약으로 판정한다. 단순히 중복 쿠키가 허용된다는 사실만으로는 부족하다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 인증 쿠키가 host-only가 아님 | 낮은 신뢰도의 서브도메인에서 같은 이름의 상위 Domain 쿠키 설정 |
| `SameSite=Lax` | top-level GET, 새로 발급된 쿠키, 동일 site의 다른 origin 등 CSRF 조건 확인 |
| 쿠키를 지워도 인증 유지 | Authorization 헤더·본문·브라우저 저장소의 다른 토큰 확인 |
| 로그인 전후 쿠키 값이 같음 | 로그인 전 ID를 별도 브라우저에서 재사용해 실제 고정 여부 확인 |
| 로그아웃 시 쿠키만 만료됨 | 로그아웃 전 저장한 요청에 이전 쿠키를 직접 삽입 |
| 새 세션 발급 시 이전 값도 동작 | renewal 경쟁 구간인지 지속 유효인지 시간차를 두고 확인 |
| URL 세션 ID를 제거하면 실패 | 쿠키·본문·경로 파라미터 등 대체 전달 위치 확인 |
| Remember Me가 장기 유지됨 | 로그아웃·비밀번호 변경·기기 폐기 후 이전 값 재사용 |
| 같은 이름의 쿠키가 여러 개 보임 | 순서·Domain·Path를 바꿔 파서 선택 차이 확인 |

---

## 취약 판정 기준

### 취약

- [ ] 세션 ID의 예측 가능한 패턴과 다른 유효 세션 추측 가능성이 재현됨
- [ ] 세션 ID에 사용자 식별 정보나 민감 정보가 포함됨
- [ ] URL·본문으로 전달된 세션 ID가 인증에 사용되어 노출 또는 고정 가능
- [ ] 공격자가 알고 있는 로그인 전 세션이 로그인·권한 상승 후 인증 세션으로 유지됨
- [ ] 로그아웃 또는 명시적 세션 폐기 후 이전 세션으로 보호 기능 접근 가능
- [ ] 영속 토큰이 예측 가능하거나 로그아웃·폐기 후에도 새 인증 세션 발급 가능
- [ ] 중복 쿠키 해석 차이로 공격자 지정 세션을 사용하게 만들 수 있음
- [ ] 운영 HTTPS 인증 쿠키에 `Secure`가 없어 비암호화 채널로 전송 가능

### 후보 / 보류

- [ ] `HttpOnly`·`SameSite` 누락은 영향 경로와 서비스의 다른 통제를 추가 확인
- [ ] 넓은 `Domain`이 설정됐지만 공격자가 제어할 수 있는 서브도메인은 확인되지 않음
- [ ] 로그인 전후 ID가 같지만 이전 값의 별도 재사용이 확인되지 않음
- [ ] timeout 정책 또는 실제 서버 만료 시점을 진단 시간 내 확인하지 못함
- [ ] `__Host-` prefix가 없지만 쿠키 주입이나 범위 확장 가능성은 확인되지 않음

비인증 쿠키와 인증 쿠키를 구분한다. 테마·언어 설정 쿠키에 인증 쿠키와 같은 속성을 일괄 요구하지 않는다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Testing Guide - Session Management](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/)
- [MDN - Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [PortSwigger - Bypassing SameSite cookie restrictions](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
- [PortSwigger - Other authentication mechanisms](https://portswigger.net/web-security/authentication/other-mechanisms)
