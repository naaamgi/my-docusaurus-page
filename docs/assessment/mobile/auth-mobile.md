---
sidebar_position: 17
title: 인증·세션 관리
description: 모바일 앱의 로그인, MFA, OAuth·OIDC, access·refresh token, 기기 세션, 로그아웃과 민감 동작 재인증을 생명주기대로 확인하는 실무 노트
keywords: [Authentication, Session, MFA, JWT, OAuth, OIDC, PKCE, Refresh Token Rotation, Logout, Passkey, MASVS-AUTH]
toc_max_heading_level: 3
draft: false
---

> 사용자가 로그인한 순간부터 access·refresh token이 만료·갱신·폐기될 때까지 추적한다. 앱 화면의 로그인 상태와 API 서버의 인증·인가 상태를 분리하는 것이 핵심이다.

## 사용 시점

- 로그인, 회원가입, 비밀번호 재설정, MFA·소셜 로그인이 있을 때
- access·refresh token, cookie, device session을 사용할 때
- 자동 로그인과 “모든 기기에서 로그아웃” 기능을 확인할 때
- 민감 거래 전에 PIN·비밀번호·생체 재인증을 요구할 때
- 클라이언트 응답 조작으로 화면 상태가 달라질 때

토큰 저장 매체는 [Android 데이터 저장](./data-storage-android.md)과 [iOS 데이터 저장](./data-storage-ios.md), 생체·PIN으로 앱 로컬 화면을 여는 흐름은 [로컬·생체 인증](./local-auth-bypass.md)에서 상세히 다룬다.

## 분석 기준

| 기준 | 기록할 내용 |
| :--- | :--- |
| 계정 | 비밀번호·MFA·SSO 유형, 일반·관리 권한 테스트 계정 |
| 인증 요청 | endpoint, client ID, redirect URI, credential 전달 위치 |
| Token | access·refresh·ID token·cookie, JWT·opaque 구분 |
| 수명 | 발급·만료·idle·absolute timeout, clock 기준 |
| 갱신 | rotation, reuse detection, grace·동시 요청 처리 |
| 폐기 | logout, 비밀번호 변경, 계정 잠금, 기기 제거 |
| API | audience, scope·role, 401·403, server authorization |
| 기기 | device ID·key binding, 앱 재설치·백업·복원 영향 |
| 로컬 상태 | 저장 위치, Keychain·Keystore, biometric gate |

토큰 수명에는 모든 서비스에 적용할 하나의 정답이 없다. 데이터 민감도, access token 탈취 대응, refresh token 보호, 재인증 정책을 함께 평가한다.

## 인증 유형

| 유형 | 중심 질문 | 실무 판단 |
| :--- | :--- | :--- |
| Password | server가 자격증명·rate limit을 검증하는가 | 저장·전송·복구 흐름 포함 |
| MFA·Step-up | enrollment·disable·recovery도 보호되는가 | OTP 화면 존재만으로 충분하지 않음 |
| OAuth·OIDC | code+PKCE, redirect, state·nonce가 연결되는가 | 브라우저·callback 전체 추적 |
| Passkey | server challenge와 RP·credential 검증이 정확한가 | 단말 성공 UI와 server 인증 분리 |
| Access Token | 만료·audience·scope를 resource server가 검사하는가 | JWT claim은 관찰 단서 |
| Refresh Token | rotation·sender constraint·폐기가 있는가 | 장기 세션의 핵심 자격증명 |
| Local Auth | server session이 아니라 local key·화면을 여는가 | 별도 문서에서 CryptoObject 연결 확인 |

## 진단 절차

#### Step 1. 상태도

로그아웃, 1차 인증, MFA 대기, 로그인, access 만료, refresh, logout, password change 상태를 그린다. 각 전환의 request와 token 변화를 기록한다.

#### Step 2. 기준 세션

테스트 계정 A로 정상 로그인하고 access·refresh token, cookie, device identifier를 마스킹해 구분한다. 앱이 자동 refresh하기 전 요청도 확보한다.

#### Step 3. 서버 경계

token 없음, 잘린 token, 다른 audience·계정 token, 만료 token으로 읽기 전용 API 한 건을 비교한다. 클라이언트 UI보다 API의 401·403과 response body를 우선한다.

#### Step 4. 생명주기

refresh, logout, password change, 기기 세션 제거를 한 번씩 수행하고 이전 token을 다시 사용한다. 정상 정책과 문구를 확인한 뒤 판정한다.

#### Step 5. 인증 분기

MFA, account recovery, OAuth callback, passkey assertion의 누락·재사용·순서 변경을 테스트 계정으로 확인한다. brute force나 대량 요청은 기본 절차로 사용하지 않는다.

#### Step 6. 클라이언트 우회

응답·로컬 flag를 바꿔 UI에 진입해도 실제 API가 거부되는지 확인한다. 화면 우회와 계정 인증 우회를 분리한다.

#### Step 7. 민감 동작

비밀번호 변경, 수취인 추가, 개인정보 열람 같은 기능이 오래된 로그인 상태만 신뢰하는지 확인한다. 테스트 계정의 preview·조회 기능부터 사용한다.

상황별 첫 확인은 다음과 같다.

| 단서 | 첫 확인 | 다음 행동 |
| :--- | :--- | :--- |
| JWT access token | `exp`, `aud`, `iss`, scope | 서버 만료·audience 재검증 |
| opaque token | 발급 시각과 API 결과 | 만료 전후 직접 재사용 |
| refresh token | 첫 refresh 전후 값 | 이전 token 1회 재사용 |
| logout 기능 | 이전 access·refresh 분리 | 정책상 폐기 범위 확인 |
| MFA 화면 | MFA 미완료 token·cookie | 보호 API 직접 호출 |
| OAuth browser | authorization request | PKCE·state·redirect 확인 |
| UI 로그인 우회 | 읽기 전용 보호 API | server 401·403 확인 |
| 생체 prompt | server 요청 유무 | local key·session 경계 확인 |

## 실습 노트

### Password·MFA

정상 실패 응답부터 비교한다. 존재하는 테스트 계정과 존재하지 않는 식별자의 status, body 구조, 응답 시간 차이를 기록하되 반복 enumeration은 하지 않는다.

#### 확인 흐름

1. 올바른 ID·잘못된 비밀번호 1회
2. 존재하지 않는 ID 1회
3. 정상 로그인 후 MFA 미완료 상태
4. OTP 한 번 성공 후 같은 값 재사용 1회
5. MFA enrollment·disable·recovery의 재인증 요구

MFA 대기 token으로 일반 보호 API가 열리면 2차 인증이 server에서 강제되지 않는 후보가 된다. OTP 길이만 보고 brute-force 가능성을 단정하지 않고 rate limit, lockout, 유효 시간, 시도 단위를 본다.

비밀번호 재설정은 사용자 식별, reset token 1회성·만료, 새 비밀번호 설정 뒤 기존 session 처리까지 이어서 확인한다.

### Access Token 생명주기

JWT는 서명을 검증하지 않고도 구조를 읽을 수 있지만, 디코딩한 claim을 진실로 보지 않는다.

```powershell
$parts = $env:TEST_JWT.Split('.')
$payload = $parts[1].Replace('-', '+').Replace('_', '/')
$payload = $payload.PadRight($payload.Length + ((4 - $payload.Length % 4) % 4), '=')
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
```

실제 token을 shell history나 문서에 직접 넣지 말고 세션 범위 환경 변수나 프록시 도구에서 처리한다.

#### 확인 항목

- `exp`, `iat`, `nbf`와 server clock 허용 범위
- `iss`, `aud`, `sub`, scope·role의 resource server 검증
- token이 URL query, log, analytics에 포함되는지
- 만료 token을 앱 자동 refresh와 분리해 직접 재사용한 결과
- 다른 API·환경에서 audience가 다른 token의 재사용 여부

Access token이 길다고 즉시 취약 판정하지 않는다. 탈취 가능성, token binding, refresh 구조, 민감 API 재인증을 함께 본다.

### Refresh·재사용

Public mobile client가 refresh token을 받는다면 최신 OAuth 보안 지침은 sender constraint 또는 refresh token rotation으로 replay를 탐지하도록 요구한다.

#### 제한된 재사용

1. refresh token `R1`로 새 token을 한 번 발급한다.
2. 응답의 refresh token이 `R2`로 바뀌는지 확인한다.
3. 이전 `R1`을 한 번만 다시 보낸다.
4. `R2`와 같은 token family가 어떻게 처리되는지 확인한다.

동시 refresh 요청을 정상 처리하기 위한 짧은 grace window가 있을 수 있다. 즉시 성공 한 번만으로 rotation 부재를 확정하지 않고 일정 시간 후와 token family 결과를 확인한다.

회전이 없다면 mTLS·DPoP·기기 key 같은 sender constraint가 있는지 본다. 앱 내부의 고정 문자열 `client_secret`은 public client를 confidential client로 만들지 않는다.

### Logout·기기 세션

Logout 의미를 먼저 구분한다.

| 기능 | 기대 범위 예시 |
| :--- | :--- |
| 현재 앱 logout | local token 삭제, refresh grant 폐기 |
| 현재 기기 logout | 해당 device session·refresh 폐기 |
| 모든 기기 logout | 계정의 다른 device session까지 폐기 |
| 비밀번호 변경 | 제품 정책에 따른 기존 session 재검토 |
| 계정 잠금·탈퇴 | 보호 API와 refresh 차단 |

Short-lived self-contained access token은 logout 직후까지 남은 수명 동안 유효하도록 설계될 수 있다. 문구·정책과 refresh 폐기, 민감 기능 위험을 확인하지 않고 자동 High로 판정하지 않는다.

#### 재사용 매트릭스

| 시점 | Access A | Refresh R | 확인할 것 |
| :--- | :--- | :--- | :--- |
| logout 전 | 성공 | 성공 | 기준선 |
| 현재 기기 logout 후 | 정책 확인 | 일반적으로 거부 기대 | 새 access 발급 차단 |
| 모든 기기 logout 후 | 정책 확인 | 모든 대상 device 거부 | 다른 단말 포함 |
| 비밀번호 변경 후 | 정책 확인 | 보안 정책·사용자 안내 | 탈취 대응 범위 |

### OAuth·OIDC

Native app은 authorization code flow와 PKCE를 사용하고 external user-agent를 사용하는 것이 기본 방향이다.

#### Authorization 요청

```text
response_type=code
client_id=mobile-client
redirect_uri=com.example.target:/oauth2redirect
code_challenge=BASE64URL_SHA256_VERIFIER
code_challenge_method=S256
state=TRANSACTION_RANDOM
nonce=OIDC_TRANSACTION_RANDOM
```

확인할 항목:

- redirect URI의 사전 등록값과 exact match
- 매 요청마다 새 `code_verifier`·`code_challenge`
- `S256` 사용과 token endpoint의 verifier 강제
- authorization request와 callback의 `state` 연결
- OIDC ID token의 issuer, audience, signature, nonce 검증
- implicit flow·URL fragment의 access token 사용 여부
- WebView가 아니라 system browser·인증 세션 사용 여부
- Custom Scheme collision과 App Links·Universal Links 적용

Callback URL과 scheme 검증은 [Deep Link·Intent](./deeplink-intent.md)에서 실제 link 처리와 함께 확인한다.

### Passkey·Federated

Android Credential Manager·iOS AuthenticationServices의 성공 UI만으로 server 인증 성공을 판단하지 않는다.

#### Passkey 확인

- server가 만든 예측 불가능한 challenge와 짧은 유효 시간
- challenge의 1회 사용과 계정·session 연결
- RP ID, origin, credential ID, signature 검증
- 등록 시 현재 사용자 재인증과 새 credential 표시
- credential 삭제·분실·계정 복구 흐름
- 다른 계정의 challenge·assertion 혼용 거부

동기화 passkey에서는 signature counter 동작이 구현마다 다를 수 있으므로 counter만으로 복제 탐지를 단정하지 않는다.

Federated ID token은 client에서 읽은 email만 신뢰하지 않고 server에서 issuer, audience, signature, nonce와 계정 연결 정책을 확인한다.

### 클라이언트 우회

로그인 응답이나 local flag를 바꾸는 목적은 server 경계를 찾는 것이다.

```javascript
Java.perform(() => {
  const AuthState = Java.use('com.example.target.AuthState');
  AuthState.isSignedIn.implementation = function () {
    console.log('isSignedIn observed and forced for UI test');
    return true;
  };
});
```

이 hook으로 화면이 열려도 보호 API가 401·403이면 계정 인증 우회가 아니다. local cache, 마스킹되지 않은 이전 사용자 정보, offline 기능이 노출되는지 별도로 본다.

앱이 JWT의 role claim만 디코딩해 메뉴를 숨기는 것도 UI 제어일 수 있다. 실제 권한은 server API 결과로 판단한다.

### 민감 동작 재인증

오래 유지되는 세션이 정상이어도 고위험 기능은 최근 인증(step-up)을 요구할 수 있다.

#### 대상 예시

- 비밀번호·MFA·복구 수단 변경
- 새 기기·수취인·결제 수단 등록
- 개인정보 전체 보기·내보내기
- 고액 결제·송금·계정 탈퇴

재인증은 단순 local boolean보다 server challenge나 인증 시각과 연결되어야 한다. 생체인증이 cryptographic key 사용을 승인하는 구조인지, 단지 화면만 여는 구조인지는 다음 문서에서 확인한다.

## 결과 판정

| 확인 결과 | 판정 방향 |
| :--- | :--- |
| JWT에 긴 `exp` 존재 | 정책·탈취 대응 확인 전 후보 |
| 만료 access token으로 보호 API 성공 | server 만료 검증 결함 확정 |
| logout 후 access token 잠시 성공 | 명시된 정책·남은 수명·refresh 폐기 확인 |
| logout 후 refresh로 새 access 발급 | session 폐기 결함 확인 |
| 이전 refresh token 지속 재사용 | rotation·sender constraint 부재 확인 |
| 한 번의 동시 refresh 성공 | grace window 확인 전 보류 |
| MFA 미완료 상태로 보호 API 성공 | server MFA 우회 확정 |
| UI flag 변경으로 화면만 진입 | local UI 우회, 계정 인증 미확정 |
| UI 우회 후 보호 API·offline 민감 데이터 접근 | 실제 영향 범위 확인 |
| OAuth PKCE 미사용 | public client의 code 탈취 조건 확인 |
| redirect URI 느슨·code 수신 재현 | OAuth callback 탈취 영향 확인 |
| 생체 prompt 우회·server API 정상 session | local gate 영향이며 server 인증 우회 아님 |

## 증적 항목

- 앱 hash, 버전, OS, 테스트 계정 역할
- 인증 상태도와 endpoint 목록
- token 종류·발급 시각·마스킹 식별자
- JWT claim과 server 응답의 차이
- refresh 전후 token family와 재사용 시각
- logout·비밀번호 변경·기기 제거 종류
- OAuth client ID, redirect URI, PKCE·state·nonce 존재
- MFA enrollment·recovery·step-up 상태
- 클라이언트 우회 전후 보호 API 결과
- 401·403·OAuth error와 request ID
- 확정·후보·보류와 제품 정책

## 트러블슈팅

#### 자동 Refresh 간섭

- 프록시에서 refresh endpoint를 구분하고 이전 access 요청을 수동 재전송한다.
- 앱 화면 결과가 아니라 해당 token을 넣은 API 응답을 본다.

#### JWT 시간 오차

- 단말 시간이 아니라 server의 `Date`와 token epoch를 비교한다.
- 허용 clock skew와 `nbf`·`exp` 경계를 구분한다.

#### Logout 범위 혼동

- 현재 앱, 현재 기기, 모든 기기 기능을 구분한다.
- access와 refresh를 각각 재사용한다.
- IdP logout과 대상 앱 local logout을 구분한다.

#### Refresh Rotation 오판

- 동시 요청 grace window와 retry 동작을 확인한다.
- token value만 아니라 이전 token 거부와 family 폐기를 본다.

#### OAuth Callback 누락

- system browser·custom tab·ASWebAuthenticationSession의 traffic을 포함한다.
- Deep Link handler와 cold·warm start를 확인한다.
- state·code·error callback을 각각 구분한다.

#### UI·API 결과 불일치

- local cache·offline mode·이전 사용자 데이터를 확인한다.
- API host·environment·account가 같은지 맞춘다.
- 화면 진입을 인증 성공으로 표현하지 않는다.

## 빠른 명령어 참조

본문과 같은 token 재사용 절차는 반복하지 않고 보조 확인만 모았다.

| 목적 | 방법 | 확인할 항목 |
| :--- | :--- | :--- |
| JWT 시간 | `Get-Date -UnixTimeSeconds <exp>` | UTC 만료 시각 |
| Android auth API 검색 | `rg -n 'Authorization|refresh_token|code_challenge|CredentialManager' jadx-output/sources` | token·PKCE·passkey 호출부 |
| iOS auth API 검색 | `rg -n 'ASWebAuthenticationSession|ASAuthorization|code_verifier|refresh_token' ios-source` | SSO·passkey·refresh 흐름 |
| 보호 API 기준선 | Burp Repeater | token 없음·정상·만료 응답 비교 |
| 기기 세션 | 앱 계정 보안 화면 | 현재·다른 기기 식별과 폐기 |

## 관련 문서

- [로컬·생체 인증](./local-auth-bypass.md)
- [Deep Link·Intent](./deeplink-intent.md)
- [Android 데이터 저장](./data-storage-android.md)
- [iOS 데이터 저장](./data-storage-ios.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)
- [Frida 후킹](./frida-scripts.md)

## 참고자료

#### 공식 표준·플랫폼 문서

- [RFC 9700 - OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- [RFC 8252 - OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 7636 - Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Android Developers - Credential Manager](https://developer.android.com/identity/credential-manager)
- [Android Developers - Passkeys](https://developer.android.com/identity/passkeys)

#### 점검 가이드

- [OWASP MASVS-AUTH](https://mas.owasp.org/checklists/MASVS-AUTH/)
- [OWASP API Security - Broken Authentication](https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
