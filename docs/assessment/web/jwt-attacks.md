---
sidebar_position: 17
title: JWT Attacks
description: JWT 서명과 클레임 검증, 토큰 목적, 키 선택 로직을 실제 진단 순서로 확인하는 실무 노트
keywords: [JWT, JSON Web Token, JWS, alg none, HS256, RS256, kid injection, JWK Injection, Algorithm Confusion, jwt_tool]
draft: false
toc_max_heading_level: 3
---

## 점검 목적

서버가 JWT의 서명, 발급자, 대상 서비스, 만료 시간과 토큰 용도를 모두 검증하는지 확인한다. 헤더와 페이로드는 보통 암호화가 아닌 Base64URL 인코딩이므로 누구나 읽고 바꿀 수 있다. 안전성은 서버가 변경을 탐지하고 올바른 키·규칙으로 거절하는 데 달려 있다.

여기서는 주로 점(`.`) 세 부분으로 된 서명 토큰(JWS)을 다룬다. 점 다섯 부분인 암호화 토큰(JWE)은 구조와 점검 항목이 다르다. 로그인·MFA 흐름은 [인증](./authentication.md), 쿠키와 로그아웃 수명은 [세션 관리](./session-management.md), 토큰이 유효한 상태에서의 권한 문제는 [권한 검증 / IDOR](./authorization-idor.md)에서 이어서 확인한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 서명 검증 누락 | 바꾼 페이로드나 `alg:none` 토큰을 허용함 | 변경된 보안 클레임이 실제 권한에 반영되는지 확인 |
| 약한 대칭키 | HS256 계열 서명 키가 짧거나 예측 가능함 | 오프라인 사전 확인 후 재서명으로 검증 |
| 알고리즘 혼동 | 비대칭 공개키를 HMAC 키처럼 사용하는 등 검증 방식이 섞임 | 서버가 허용 알고리즘을 고정하는지 확인 |
| 키 선택 헤더 신뢰 | `kid`, `jwk`, `jku`, `x5u`가 검증 키를 공격자 쪽으로 바꿈 | 키 출처와 식별자가 서버 설정에 묶여 있는지 확인 |
| 클레임 검증 누락 | `exp`, `nbf`, `iss`, `aud`가 없거나 검사되지 않음 | 유효한 교차 환경 토큰과 만료 토큰으로 확인 |
| 토큰 목적 혼동 | ID Token, Access Token, Refresh Token을 서로 바꿔 받음 | 각 API가 예상한 토큰 종류만 허용하는지 확인 |
| 민감 정보 포함 | 서명된 페이로드를 암호화된 데이터로 오해함 | 토큰 소유자에게 보여도 되는 정보인지 구분 |

## 진단 절차

#### Step 1. 토큰 종류와 사용 위치 기록

- 테스트 계정으로 로그인해 Access Token, ID Token, Refresh Token을 구분해서 저장한다.
- `Authorization: Bearer`, 쿠키, URL 파라미터 중 어디에 전달되는지 확인한다.
- `/me` 같은 읽기 전용 요청으로 정상 토큰, 토큰 없음, 임의 문자열의 응답을 기준선으로 남긴다.
- 같은 발급자가 개발·운영 또는 여러 클라이언트에 토큰을 발급하는지도 확인한다.

#### Step 2. 구조와 인코딩 확인

- 점 세 부분이면 일반적인 JWS Compact 형식, 다섯 부분이면 JWE Compact 형식일 수 있다.
- 헤더에서 `alg`, `kid`, `jwk`, `jku`, `x5u`, `typ`을 확인한다.
- 페이로드에서 `sub`, `role`, `scope`, `iss`, `aud`, `exp`, `nbf`, `iat`, `jti`를 확인한다.
- 실제 운영 토큰을 공개 웹 디코더에 붙여 넣지 않고 Burp나 로컬 도구에서 확인한다.

#### Step 3. 서명 검증부터 확인

- 페이로드 한 값을 바꾸고 원래 서명을 그대로 둔 토큰을 보낸다.
- 거절되면 빈 서명과 `alg:none`을 별도로 확인한다.
- `200` 상태 코드만 보지 말고 응답 사용자, 유효 scope, 보호 API 결과를 비교한다.

#### Step 4. 클레임과 토큰 목적 확인

- 실제로 만료된 토큰이 있으면 갱신 없이 Access Token으로 계속 처리되는지 확인한다.
- 다른 클라이언트 또는 허가된 다른 환경의 정상 서명 토큰으로 `iss`와 `aud` 경계를 확인한다.
- ID Token을 API Access Token 위치에 넣고, Refresh Token을 일반 API에 넣어 목적 혼동을 확인한다.
- 변조한 `iat`만으로 판정하지 않는다. `iat`는 발급 시각이며 그 자체가 만료 조건은 아니다.

#### Step 5. 알고리즘과 키 선택 경로 확인

- HS 계열이면 프로젝트 관련 소규모 사전으로 키 강도를 오프라인에서 확인한다.
- RS·ES 계열이면 공개 JWKS가 있는지 확인하되, 공개키 공개 자체는 정상으로 본다.
- `kid`, `jwk`, `jku`가 있을 때만 해당 키 선택 경로를 점검한다.
- 라이브러리와 키 형식 근거 없이 모든 헤더 우회를 무작위로 보내지 않는다.

#### Step 6. 제한된 영향 확인

- 먼저 테스트 계정의 표시용 클레임이나 읽기 전용 `/me` 응답으로 검증 실패를 입증한다.
- 서명 위조가 확인되면 두 개의 소유 테스트 계정 사이에서 `sub` 경계를 확인한다.
- 관리자 클레임은 읽기 전용 권한 확인까지만 진행하고 변경·삭제 기능은 기본 검증에서 제외한다.

### 상황별 빠른 선택

| 현재 상황 | 첫 확인 |
| :--- | :--- |
| 일반적인 점 세 부분 토큰 | 페이로드 변경 후 기존 서명을 그대로 사용 |
| `alg`가 HS256 | 프로젝트 관련 작은 사전으로 오프라인 키 확인 |
| `alg`가 RS256이고 JWKS가 공개됨 | 허용 알고리즘 고정과 RS/HS 혼동 조건 확인 |
| 헤더에 `jwk`가 있음 | 토큰에 넣은 임의 공개키를 신뢰하는지 확인 |
| 헤더에 `jku`·`x5u`가 있음 | 허용 호스트와 리다이렉트 처리 확인 |
| 헤더에 `kid`가 있음 | 존재하지 않는 키 ID에 대한 조회 방식 확인 |
| OIDC 로그인 사용 | ID Token과 Access Token의 수신 위치 교차 확인 |
| 만료 토큰이 통과함 | 자동 갱신인지 기존 토큰 직접 수락인지 구분 |

## 페이로드 노트

### 1. 로컬에서 헤더와 페이로드 확인

**이럴 때 사용**: 토큰의 알고리즘과 주요 클레임을 처음 확인할 때 사용한다.

```bash
python3 jwt_tool.py '<TOKEN>'
```

수동으로 확인할 때는 Base64가 아니라 **Base64URL**이며 패딩이 생략될 수 있다는 점을 주의한다.

```python
import base64
import json

token = "<TOKEN>"
for part in token.split(".")[:2]:
    part += "=" * (-len(part) % 4)
    print(json.loads(base64.urlsafe_b64decode(part)))
```

JWT 페이로드가 읽히는 것은 정상이다. 서명은 내용을 숨기는 기능이 아니라 변경 여부를 확인하는 기능이다.

### 2. 원래 서명을 둔 채 클레임 변경

**이럴 때 사용**: 서버가 서명을 아예 검증하지 않고 단순히 `decode`만 하는지 가장 먼저 확인할 때 사용한다.

```json
{
  "sub": "<OWN_TEST_USER>",
  "display_name": "jwt-signature-test",
  "role": "user"
}
```

페이로드를 다시 Base64URL 인코딩하되 세 번째 구간은 원래 서명 그대로 둔다. 변경한 `display_name`이 `/me` 등에 반영되면 서버가 토큰 내용을 신뢰하는 경로를 확인한다. 이후 테스트 계정 범위에서 `sub`나 `role`이 실제 인가에 사용되는지 제한적으로 확인한다.

### 3. 서명 없는 `alg:none` 확인

**이럴 때 사용**: 변경된 페이로드가 서명 오류로 거절된 뒤, 서버가 unsecured JWT를 별도로 허용하는지 확인할 때 사용한다.

```json
{"alg":"none","typ":"JWT"}
```

```text
<BASE64URL_HEADER>.<BASE64URL_PAYLOAD>.
```

마지막 점은 남기고 서명 구간만 비운다. 명시적인 허용 알고리즘 목록으로 거절된다면 대소문자 변형을 계속 나열할 필요는 없다. 토큰이 통과해도 변경한 클레임이 서버 보안 동작에 사용되는지 확인해야 영향이 확정된다.

### 4. 만료·발급자·대상·토큰 목적 확인

**이럴 때 사용**: 서명 검증은 정상인데 다른 서비스나 용도의 정상 서명 토큰이 섞일 가능성이 있을 때 사용한다.

| 확인 항목 | 사용할 토큰 | 확인할 것 |
| :--- | :--- | :--- |
| `exp` | 실제로 만료된 Access Token | 새 토큰 발급 없이 기존 토큰 자체가 수락되는지 |
| `nbf` | 아직 유효 시각이 오지 않은 정상 발급 토큰 | 허용 오차를 넘어서도 수락되는지 |
| `iss` | 허가된 다른 발급 환경의 정상 토큰 | 현재 서비스가 신뢰하지 않는 발급자를 받는지 |
| `aud` | 같은 발급자의 다른 클라이언트용 토큰 | 현재 API가 자신을 대상으로 하지 않은 토큰을 받는지 |
| 토큰 종류 | ID Token 또는 Refresh Token | 일반 API의 Bearer 토큰으로 처리되는지 |

만료 요청 뒤 응답에 새 Access Token이 발급되거나 브라우저가 별도 refresh 요청을 보냈다면 자동 갱신 흐름일 수 있다. 기존 만료 토큰을 단독으로 다시 보내 구분한다.

### 5. 약한 HMAC 키 확인

**이럴 때 사용**: `alg`가 HS256·HS384·HS512이고, 짧은 기본값이나 프로젝트명 기반 키를 썼을 정황이 있을 때 사용한다.

```bash
hashcat -a 0 -m 16500 '<TOKEN>' project-jwt-secrets.txt
hashcat -m 16500 '<TOKEN>' --show
```

기본 점검은 제품명, 프로젝트명, 예제 설정값을 모은 작은 사전부터 시작한다. 대규모 무차별 대입을 기본 절차로 두지 않는다. 키를 찾았다면 테스트 계정의 표시용 클레임을 바꿔 재서명하고 서버가 수락하는지 확인한다. 사전에서 키가 나오지 않았다는 사실만으로 강한 키라고 결론 내릴 수 없다.

### 6. RS/HS 알고리즘 혼동 확인

**이럴 때 사용**: 원본이 RS256 같은 비대칭 알고리즘이고, 서버가 HS 계열도 함께 허용하며 같은 키 선택 함수에 전달할 정황이 있을 때 사용한다.

```text
정상 RS256: 비밀키로 서명 → 공개키로 검증
혼동 시도: HS256으로 변경 → 같은 공개키 바이트를 HMAC 키로 사용해 서명
```

공개키는 `/.well-known/jwks.json` 또는 OIDC metadata의 `jwks_uri`에서 정상적으로 공개될 수 있다. 취약점은 공개 여부가 아니라 서버가 토큰 헤더의 알고리즘을 따라 그 공개키를 HMAC 비밀키처럼 쓰는 것이다. PEM 줄바꿈과 인코딩을 포함해 서버가 사용하는 정확한 키 바이트가 맞아야 하므로, 도구 결과만으로 판정하지 않는다.

### 7. `jwk`와 `jku` 키 주입 확인

**이럴 때 사용**: 서버가 JOSE 헤더의 임베드 키 또는 키 URL을 실제로 처리하는 경우 사용한다.

```json
{
  "alg": "RS256",
  "kid": "assessment-key",
  "jwk": {
    "kty": "RSA",
    "kid": "assessment-key",
    "e": "AQAB",
    "n": "<CONTROLLED_PUBLIC_KEY_N>"
  }
}
```

```json
{
  "alg": "RS256",
  "kid": "assessment-key",
  "jku": "https://<CONTROLLED_HOST>/jwks.json"
}
```

통제한 개인키로 토큰을 서명하고 일치하는 공개키를 넣는다. 서버가 사전에 등록한 발급자·JWKS가 아닌 공격자 지정 키로 서명을 검증하면 취약하다. `jku` 요청만 발생하고 최종 토큰은 거절된다면 JWT 위조가 아니라 SSRF 또는 불필요한 외부 키 조회 후보일 수 있으므로 [SSRF](./ssrf.md) 기준으로 분리한다.

### 8. `kid` 키 조회 방식 확인

**이럴 때 사용**: 헤더에 `kid`가 있고 서버가 여러 검증 키 중 하나를 선택하는 경우 사용한다.

```json
{"alg":"HS256","kid":"__missing_assessment_key__","typ":"JWT"}
```

먼저 존재하지 않는 ID로 `unknown key`, 파일 경로, 데이터베이스 오류가 노출되는지 확인한다. 다음 조건이 확인된 경우에만 문맥별 입력 검증을 이어간다.

| 관찰된 구현 | 제한적 다음 확인 |
| :--- | :--- |
| `kid`를 파일명으로 사용 | `../` 정규화와 고정 키 디렉터리 이탈 여부 |
| 데이터베이스에서 키 조회 | 따옴표 한 개의 오류 차이 후 [SQL Injection](./sql-injection.md) 절차 적용 |
| 외부 KMS·JWKS에서 조회 | 허용된 키 ID와 발급자 바인딩 확인 |

`../../../../dev/null`은 Linux 파일 기반 HMAC 키 로딩과 빈 키 허용이 동시에 있어야 하는 조건부 사례다. `kid`가 있다는 이유만으로 경로 순회를 반복하지 않는다.

### 9. 페이로드 정보와 전달 위치 확인

**이럴 때 사용**: 토큰 안에 개인정보나 내부 정보가 보이거나 URL로 전달되는 경우 사용한다.

```json
{
  "sub": "user-1042",
  "scope": "profile:read",
  "exp": 1893456000
}
```

본인 식별자와 권한 범위처럼 토큰 처리에 필요한 정보가 보이는 것만으로는 취약하지 않다. 비밀번호, API 키, 전체 주민등록번호처럼 토큰 소유자에게도 불필요한 비밀이 포함되거나 URL·로그·Referer를 통해 예상 밖의 대상에게 전달될 때 정보 노출로 판단한다. 기밀성이 필요하면 JWE나 별도 서버 저장 방식을 검토해야 한다.

### 10. 도구는 수동 기준을 만든 뒤 사용

```bash
python3 jwt_tool.py '<TOKEN>' -M at
```

`jwt_tool`, Burp JWT Editor, Hashcat은 반복 작업에 유용하다. 먼저 정상·실패 응답과 토큰 용도를 수동으로 구분한 뒤 사용하고, 스캔 결과는 변경한 클레임과 보호 API 동작으로 재현한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| 페이로드 변경 시 `invalid signature` | 정상 서명 토큰으로 클레임·목적 검증 진행 | 기본 서명 검증은 동작함 |
| `alg:none`이 명시적으로 거절됨 | HS 키 또는 키 선택 헤더 등 실제 구성에 맞춰 진행 | `none` 변형 반복 불필요 |
| `/me`에 바꾼 값이 보이나 보호 API는 거절됨 | 표시용 decode와 인가용 verify 경로 구분 | 보안 영향은 아직 후보 |
| 만료 토큰 요청이 성공함 | 새 토큰 발급·refresh 요청 유무 확인 | 자동 갱신일 수 있음 |
| JWKS가 인터넷에 공개됨 | `iss`, `aud`, `kid`, 알고리즘 바인딩 확인 | 공개키 공개는 정상 |
| 통제한 `jku`로 서버 요청만 도착함 | 서명 수락 여부와 SSRF 영향을 분리 | JWT 위조는 미확정 |
| 존재하지 않는 `kid`에서 500 발생 | 키 조회 오류와 정상 실패 응답 비교 | 오류만으로 인젝션 확정 불가 |
| HMAC 사전에서 키를 찾지 못함 | 구성 노출과 키 길이 정책 확인 | 안전성 확정 불가 |
| 로그아웃 뒤 Access Token이 잠시 동작함 | 남은 `exp`와 Refresh Token 폐기 확인 | 짧은 stateless 수명은 설계일 수 있음 |
| 응답이 `200`이지만 로그인 HTML이 반환됨 | 실제 사용자·API JSON·쿠키 변화 확인 | 인증 성공으로 판정 금지 |

## 취약 판정

### 확정

- 원래 서명과 맞지 않는 변경 토큰 또는 `alg:none` 토큰의 보안 클레임이 서버 인가에 사용된다.
- 복구한 HMAC 키로 재서명한 테스트 토큰이 정상 검증된다.
- RS/HS 혼동 또는 `jwk`·`jku`·`kid` 조작으로 서버가 공격자 지정 키를 사용한다.
- 만료된 Access Token이 갱신 없이 계속 수락되거나, 잘못된 `iss`·`aud`의 정상 토큰이 현재 API에서 수락된다.
- ID Token이나 Refresh Token이 일반 API의 Access Token으로 동작한다.

### 후보 또는 보류

- JWT 헤더와 페이로드가 디코딩된다.
- 공개 JWKS 또는 공개키를 내려준다.
- 잘못된 `kid`, `jku`, 타입에서 오류만 발생한다.
- 변경한 표시용 클레임은 보이지만 보호 기능의 권한은 달라지지 않는다.
- 소규모 사전에서 HMAC 키를 찾지 못했다.
- 로그아웃한 짧은 수명의 Access Token이 `exp`까지 유효하지만 Refresh Token은 폐기된다.

### 영향 상승

- 다른 테스트 사용자의 `sub`로 읽기 전용 계정 접근이 재현된다.
- 관리자 또는 높은 scope가 적용되어 보호 API가 열리지만 변경 작업은 하지 않아도 확인 가능하다.
- 다른 조직·환경·클라이언트 토큰을 운영 API가 받아들인다.
- 장기 Refresh Token을 재사용해 새로운 Access Token을 계속 발급할 수 있다.
- JWT가 URL, 로그, 분석 도구를 통해 제3자에게 노출되고 민감한 비밀까지 포함한다.

## 참고자료

### 공식 및 테스트 가이드

- [RFC 7519 - JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 7515 - JSON Web Signature](https://datatracker.ietf.org/doc/html/rfc7515)
- [RFC 8725 - JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP JSON Web Token Cheat Sheet for Java](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [PortSwigger Web Security Academy - JWT attacks](https://portswigger.net/web-security/jwt)

### 커뮤니티 참고 / 도구

- [jwt_tool](https://github.com/ticarpi/jwt_tool)
- [PayloadsAllTheThings - JSON Web Token](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/JSON%20Web%20Token)
- [HackTricks - JWT vulnerabilities](https://book.hacktricks.wiki/en/pentesting-web/hacking-jwt-json-web-tokens.html)
