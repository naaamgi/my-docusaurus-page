---
sidebar_position: 17.1
title: OAuth 2.0 / OIDC
description: 웹 진단 - OAuth 2.0 / OpenID Connect 인가 플로우의 redirect_uri, state, PKCE, 토큰 전달, 계정 연동을 실제 진단 순서로 확인하는 실무 노트
keywords: [OAuth, OAuth2, OpenID Connect, OIDC, redirect_uri, state, CSRF, PKCE, authorization code, access token, scope, account takeover, provider confusion, OWASP A07]
draft: false
toc_max_heading_level: 3
---

> 로그인 위임 플로우에서 서버가 `redirect_uri`, `state`, `code`, scope, 발급자를 제대로 고정·검증하는지 확인한다.

## 점검 목적

OAuth 2.0 / OIDC는 사용자의 자격증명을 직접 받지 않고 외부 Identity Provider(IdP)에 인증을 위임하는 구조다. 안전성은 Client(점검 대상 애플리케이션)와 Authorization Server가 **어디로 응답을 돌려보낼지(`redirect_uri`)**, **요청과 콜백을 누가 묶는지(`state`, PKCE)**, **발급된 토큰을 누구에게 허용하는지**를 각각 고정·검증하는 데 달려 있다.

토큰 자체의 서명·클레임 조작은 [JWT Attacks](./jwt-attacks.md)에서 다룬다. 이 페이지는 **인가 플로우(authorization flow)** 가 핵심이다. 콜백이 임의 외부 주소로 돌아가는 문제는 [Open Redirect](./open-redirect.md), 요청 위조 방어 공백은 [CSRF](./csrf.md), IdP metadata/JWKS를 서버가 외부에서 가져오는 경로는 [SSRF](./ssrf.md), 로그인 성공 이후의 세션·로그아웃 수명은 [세션 관리](./session-management.md), 발급된 토큰이 유효한 상태의 권한 문제는 [권한 검증 / IDOR](./authorization-idor.md)에서 이어서 확인한다.

### 운영 안전 원칙

- 플로우 점검은 **본인 소유 테스트 계정 2개**로 진행한다. 실제 사용자 계정 탈취는 재현하지 않고, 두 테스트 계정 사이에서 경계가 무너지는지로 입증한다.
- `redirect_uri` 유출 확인은 **사전 승인된 Collaborator/OAST 도메인**으로만 보낸다. 실제 제3자 서버로 `code`·토큰을 흘리지 않는다.
- 공용 IdP(Google, Kakao 등)의 운영 플로우에 자동화된 대량 요청을 보내지 않는다. 점검 대상은 **애플리케이션의 OAuth 구현**이다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| redirect_uri 검증 미흡 | 등록된 값과 다른 콜백 주소를 허용함 | `code`·토큰이 통제된 주소로 전달되는지 확인 |
| state 누락 / 미검증 | 요청과 콜백을 묶는 `state`가 없거나 검사되지 않음 | 공격자 `code`를 피해자 세션에 주입(로그인 CSRF) 가능한지 확인 |
| PKCE 미적용 / 우회 | `code_challenge`·`code_verifier` 바인딩이 없거나 검증되지 않음 | 탈취한 `code`를 임의 `verifier`로 교환할 수 있는지 확인 |
| authorization code 재사용 | 한 번 쓴 `code`가 다시 교환됨 | 동일 `code`로 토큰이 두 번 이상 발급되는지 확인 |
| scope 상승 | Client가 요청 scope를 재확인하지 않음 | 토큰에 승인 범위를 넘는 scope가 붙는지 확인 |
| 토큰 전달 유출 | Implicit/fragment, Referer, 로그로 토큰이 샘 | access token이 URL·Referer·로그에 남는지 확인 |
| 계정 연동 혼동 | 소셜 로그인 연결이 이메일만으로 묶임 | 미검증 이메일이나 provider 교차로 계정이 연결되는지 확인 |
| provider confusion | Client가 어느 IdP가 발급했는지 고정하지 않음 | 다른 IdP·endpoint의 토큰을 받아들이는지 확인 |

## 진단 절차

#### Step 1. 플로우와 파라미터 기록

- 로그인 시작부터 콜백까지 전 요청을 Burp로 기록한다. `response_type`(`code` / `token`), `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `nonce` 값을 표로 남긴다.
- `response_type=code`이면 Authorization Code Grant, `token`이면 Implicit Flow다. Implicit은 access token을 URL fragment로 돌려주므로 전달 유출부터 본다.
- 콜백 이후 Client가 `code`를 토큰으로 바꾸는 서버 측 교환 요청(`/token`)이 있는지, 프런트에서 직접 처리하는지 구분한다.

#### Step 2. redirect_uri 검증 방식 확인

- 등록된 `redirect_uri`를 baseline으로 두고, 값만 바꿔 Authorization Server가 어떤 기준으로 매칭하는지 흔든다.
- 완전 일치만 허용하는지, prefix·substring·도메인 단위로 느슨하게 보는지 응답(리다이렉트 허용/오류)으로 판단한다.
- 느슨하면 `code`·토큰이 통제된 주소로 넘어갈 수 있으므로 다음 단계로 좁힌다.

#### Step 3. state / PKCE 바인딩 확인

- `state`를 제거하거나 고정값으로 바꿔 콜백이 그대로 수락되는지 본다. 수락되면 로그인 CSRF 후보다.
- `code_challenge`가 보이면 교환 단계에서 `code_verifier`가 실제로 검증되는지, 임의 `verifier`로도 교환되는지 확인한다.

#### Step 4. code 수명과 재사용 확인

- 정상 콜백의 `code`를 **승인 범위에서 1회만** 다시 교환해 두 번째 발급이 거절되는지 확인한다.
- `code` 만료 시간이 과도하게 길거나, 재사용 시 기존 토큰이 폐기되지 않는지 본다.

#### Step 5. 토큰 수신 위치와 scope 확인

- 발급된 access token이 어디에 쓰이는지(쿠키, `Authorization: Bearer`) 기록하고, 승인한 scope와 실제 토큰 scope를 비교한다.
- 토큰이 URL·fragment·Referer·접근 로그에 남는지 확인한다.

#### Step 6. 제한된 영향 확인

- 먼저 읽기 전용 `/me`·프로필 응답으로 플로우 약점이 실제 세션/권한에 반영되는지 입증한다.
- 계정 연동·탈취 가능성은 **본인 소유 테스트 계정 2개** 사이에서만 경계 붕괴로 확인하고, 변경·삭제 기능은 기본 검증에서 제외한다.

### 상황별 빠른 선택

| 현재 상황 | 첫 확인 |
| :--- | :--- |
| `response_type=code` 일반 플로우 | `redirect_uri` 완전 일치 여부부터 |
| `response_type=token` (Implicit) | fragment 토큰이 Referer·히스토리로 새는지 |
| `state` 파라미터가 안 보임 | 콜백에 공격자 `code`를 주입하는 로그인 CSRF |
| `code_challenge`가 있음 | 교환 시 `code_verifier` 실제 검증 여부 |
| 소셜 로그인 "연결하기" 기능 | 이메일만으로 계정이 묶이는지 |
| 여러 IdP를 지원함 | Client가 발급 IdP를 고정하는지 (provider confusion) |

## 페이로드 노트

### 1. redirect_uri 완전 일치 여부 확인

**이럴 때 사용**: 인가 요청의 `redirect_uri`를 Authorization Server가 어떤 기준으로 검증하는지 처음 확인할 때.

등록된 콜백이 다음이라고 가정한다.

```text
https://<TARGET>/oauth/callback
```

한 번에 하나씩 변형해 허용/거절을 기록한다.

```text
https://<TARGET>/oauth/callback/../evil
https://<TARGET>.<COLLAB>.oastify.com/oauth/callback
https://<TARGET>/oauth/callback.<COLLAB>.oastify.com
https://<COLLAB>.oastify.com/oauth/callback
https://<TARGET>@<COLLAB>.oastify.com/
```

**확인할 것**: Authorization Server가 변형된 주소로 리다이렉트를 허용하면 `code`·토큰 유출 경로가 열린다. `@` 앞뒤 host 해석, 경로 `../` 정규화, subdomain 접미사 허용이 대표적인 완화 지점이다. 등록 외 주소가 모두 거절되면 완전 일치로 본다.

### 2. redirect_uri 느슨한 매칭 분기

**이럴 때 사용**: Step 2에서 등록값 "근처" 주소가 허용될 때 어떤 매칭 규칙인지 좁힌다.

```text
# prefix 매칭 추정
https://<TARGET>/oauth/callback.<COLLAB>.oastify.com

# 경로 추가 허용 추정
https://<TARGET>/oauth/callback/anything

# 하위 경로 traversal
https://<TARGET>/oauth/callback/../../<PATH>

# 개발/로컬 허용 추정
http://localhost/oauth/callback
http://127.0.0.1:1/
```

**확인할 것**: 어떤 변형이 통과하는지로 규칙을 분류한다. 열린 리다이렉트가 Client 쪽 `redirect_uri`에 있으면 `code`가 2차로 외부에 넘어갈 수 있으므로 [Open Redirect](./open-redirect.md) 기준과 묶어 판정한다.

### 3. state 누락 / 로그인 CSRF 확인

**이럴 때 사용**: 인가 요청에 `state`가 없거나 콜백에서 검증되지 않을 때.

```text
# 공격자 테스트 계정으로 정상 플로우 진행 후 콜백 URL 확보
GET /oauth/callback?code=<ATTACKER_CODE> HTTP/1.1
Host: <TARGET>
```

피해자 역할의 **본인 소유 두 번째 테스트 계정** 브라우저에서 위 콜백을 열었을 때, 로그인 세션이 공격자 계정에 묶이는지 확인한다.

**확인할 것**: 피해자 세션이 공격자 계정으로 연결되면 로그인 CSRF다. `state`가 세션에 바인딩되어 콜백에서 대조되면 이 시도는 거절된다. `state`가 단순 echo-back만 되는 경우도 미검증으로 본다.

### 4. PKCE 검증 확인

**이럴 때 사용**: 인가 요청에 `code_challenge`·`code_challenge_method`가 있고 토큰 교환에서 `code_verifier`를 보낼 때.

```http
POST /oauth/token HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<CODE>&redirect_uri=https://<TARGET>/oauth/callback&client_id=<CLIENT_ID>&code_verifier=<WRONG_VERIFIER>
```

**확인할 것**: 원래 `code_challenge`와 맞지 않는 `code_verifier`로 교환이 성공하면 PKCE 바인딩이 검증되지 않는 것이다. `code_verifier`를 아예 생략해도 교환되는지 함께 본다. challenge가 `plain`으로 다운그레이드되는지도 확인한다.

### 5. authorization code 재사용 확인

**이럴 때 사용**: 정상 콜백에서 받은 `code`를 토큰으로 교환한 직후.

```http
POST /oauth/token HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<USED_CODE>&redirect_uri=https://<TARGET>/oauth/callback&client_id=<CLIENT_ID>
```

**확인할 것**: 이미 사용한 `code`로 두 번째 토큰이 발급되면 재사용 취약이다. RFC 6749는 `code`를 1회용으로 요구하며, 재사용 감지 시 관련 토큰을 폐기하는 것이 권고다. 재사용은 **1회만** 시도해 증거를 남긴다.

### 6. Implicit / fragment 토큰 전달 유출

**이럴 때 사용**: `response_type=token`이거나 토큰이 URL fragment로 돌아올 때.

```text
https://<TARGET>/oauth/callback#access_token=<TOKEN>&token_type=Bearer
```

**확인할 것**: 콜백 페이지가 외부 리소스를 로드하거나 외부로 이동하면 fragment가 Referer·브라우저 히스토리·써드파티 스크립트에 노출될 수 있다. 토큰이 쿼리스트링(`?access_token=`)으로 전달되면 접근 로그·Referer 유출 위험이 더 크다. 토큰 값 자체는 보고서에 전체로 남기지 않는다.

### 7. scope 상승 확인

**이럴 때 사용**: 인가 요청의 `scope`를 조작할 수 있고 Client가 재확인하지 않을 정황이 있을 때.

```text
# 승인 화면에서 동의한 범위를 넘는 scope 요청
scope=openid profile email admin
scope=openid profile email offline_access
```

**확인할 것**: 발급된 토큰의 scope가 실제 사용자가 동의한 범위를 넘으면 상승 후보다. 단, Authorization Server가 scope를 축소(down-scope)하면 요청만으로는 상승이 아니다. 토큰 scope와 보호 API 동작으로 재현한다.

### 8. 계정 연동 / provider confusion 확인

**이럴 때 사용**: 소셜 로그인 연결 기능이 있거나 여러 IdP를 지원할 때.

```text
# 두 테스트 계정의 이메일을 동일하게 맞춘 뒤 연동 시도
IdP A: test+assess@<COLLAB>  (미검증 이메일)
Client 로컬 계정: test+assess@<COLLAB>
```

**확인할 것**: Client가 **미검증 이메일**이나 provider만 다른 동일 이메일로 기존 계정에 자동 연결하면 계정 탈취 경로가 된다. 어느 IdP가 토큰을 발급했는지(`iss`) Client가 고정하지 않으면, 공격자가 통제하는 IdP·endpoint의 토큰을 받아들이는 provider confusion이 성립한다. 본인 소유 두 계정 사이에서만 경계 붕괴로 입증한다.

### 9. 도구는 수동 기준을 만든 뒤 사용

```text
Burp 확장: OAuthv2, EsPReSSO
```

자동 확장은 파라미터 식별과 반복 교환에 유용하다. 먼저 정상·실패 플로우와 `redirect_uri`·`state`·PKCE 검증 기준을 수동으로 확인한 뒤, 도구가 보고한 약점을 한 번의 재현으로 다시 검증한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| 등록 외 `redirect_uri`가 모두 거절됨 | `state`·PKCE·code 재사용으로 진행 | redirect 검증은 동작함 |
| subdomain·경로 변형만 허용됨 | 통제 주소로 `code` 전달 가능 여부 | 느슨한 매칭 후보 |
| `state` 없이 콜백이 수락됨 | 두 테스트 계정 로그인 CSRF 재현 | 요청-콜백 바인딩 공백 |
| 잘못된 `code_verifier`로 교환 성공 | PKCE 다운그레이드·생략 비교 | PKCE 미검증 |
| 사용한 `code` 재교환 성공 | 기존 토큰 폐기 여부 확인 | code 1회성 위반 |
| 토큰이 fragment/쿼리로 전달됨 | Referer·로그·히스토리 노출 경로 확인 | 전달 유출 후보 |
| 동의 범위 밖 scope가 토큰에 붙음 | down-scope 여부와 보호 API 확인 | scope 상승 후보 |
| 미검증 이메일로 기존 계정 연결됨 | provider·`iss` 고정 여부 확인 | 계정 연동 혼동 |
| `jku`/metadata만 외부로 요청됨 | 서명 수락과 SSRF 영향 분리 | [SSRF](./ssrf.md) 기준 분리 |

## 취약 판정

### 확정

- 등록되지 않은 `redirect_uri`로 `code` 또는 토큰이 통제된 주소로 전달된다.
- `state` 미검증으로 공격자 `code`가 피해자(테스트 계정) 세션에 주입되어 로그인 CSRF가 재현된다.
- 잘못되거나 생략된 `code_verifier`로 토큰 교환이 성공한다(PKCE 미검증).
- 이미 사용한 authorization code로 토큰이 다시 발급된다.
- 미검증 이메일 또는 provider 교차로 기존 계정에 자동 연결되어 다른 테스트 계정 접근이 재현된다.
- Client가 발급 IdP(`iss`)를 고정하지 않아 공격자 지정 IdP의 토큰을 수락한다.

### 후보 또는 보류

- `redirect_uri` 근처 변형이 허용되지만 실제 `code`·토큰 전달까지는 확인되지 않았다.
- `state`가 echo-back만 되고 세션 바인딩 여부는 미확인이다.
- access token이 fragment로 전달되지만 외부 유출 경로는 확인되지 않았다.
- 요청 scope는 늘어나지만 Authorization Server가 축소해 토큰에는 반영되지 않는다.
- 동일 이메일 자동 연결이 보이지만 해당 이메일이 검증된 경로다.

### 영향 상승

- 유출된 `code`·토큰으로 다른 테스트 사용자의 읽기 전용 리소스에 접근된다.
- 계정 연동 혼동으로 다른 테스트 계정의 로그인이 재현된다.
- 상승된 scope로 보호 API가 열린다(변경 작업 없이 확인).
- 동일 플로우 약점이 인증 전 요청이나 여러 Client에서 반복된다.

입력 플로우가 복잡해 보여도, 실제 영향은 "통제 주소로 자격 증명이 전달되는가"와 "다른 계정 경계가 무너지는가"로 수렴한다. 리다이렉트 허용 하나만으로 계정 탈취를 단정하지 않고, 토큰·세션 반영까지 재현해 판정한다.

## 참고자료

### 공식 및 테스트 가이드

- [RFC 6749 - The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 - Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 9700 - Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/rfc9700)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OWASP WSTG - Testing for OAuth Authorization](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/05-Testing_for_OAuth_Authorization_Server_and_Client_Weaknesses)
- [PortSwigger Web Security Academy - OAuth 2.0 authentication vulnerabilities](https://portswigger.net/web-security/oauth)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - OAuth](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/OAuth%20Misconfiguration)
- [HackTricks - OAuth to Account takeover](https://book.hacktricks.wiki/en/pentesting-web/oauth-to-account-takeover.html)
