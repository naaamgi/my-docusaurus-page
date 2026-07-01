---
sidebar_position: 17
title: 인증 (Authentication)
description: 웹 진단 - 사용자 열거, 무차별 대입, 비밀번호 정책, 재설정 플로우, MFA 우회, 인증 우회 점검 절차와 보고서 양식
keywords: [인증, Authentication, Brute Force, 사용자열거, Username Enumeration, MFA, OTP, 비밀번호 재설정, OWASP A07]
draft: false
---

# 인증 (Authentication)

> 로그인·가입·비밀번호 변경/재설정·MFA 등 **인증 메커니즘 자체** 가 무차별 대입·우회·취약 정책으로부터 보호되는지 점검.
> 단일 결함도 관리자 계정 탈취로 이어질 수 있어 점검 항목 다수가 Critical/High 로 분류됨.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A07:2025 - Identification and Authentication Failures / KISA 인증 |
| **CWE** | [CWE-287](https://cwe.mitre.org/data/definitions/287.html) (Improper Authentication), [CWE-307](https://cwe.mitre.org/data/definitions/307.html) (Excessive Authentication Attempts), [CWE-521](https://cwe.mitre.org/data/definitions/521.html) (Weak Password), [CWE-640](https://cwe.mitre.org/data/definitions/640.html) (Weak Password Recovery) |
| **영향도** | 🔴 매우 높음 (브루트포스 성공·MFA 우회·관리자 계정 탈취) / 🟡 (사용자 열거만 가능) |
| **점검 난이도** | 하 (기본 정책 점검) / 상 (MFA 우회·재설정 흐름 분석) |
| **예상 점검 시간** | 2시간 ~ 1일 (인증 흐름 자체가 점검 항목 다수) |

---

## 점검 목적

가입 → 로그인 → MFA → 비밀번호 변경/재설정 → 로그아웃 으로 이어지는 **인증 흐름 전체** 가 안전하게 설계·구현되어 있는지 확인한다. 시도 횟수 제한·응답 일관성·토큰 엔트로피·MFA 강제 등 한 부분만 누락되어도 계정 탈취로 직결된다.

> 세션 관리(쿠키 속성, 세션 고정, 로그아웃 무효화), JWT 공격, 권한 검증(IDOR/수직권한)은 별도 페이지에서 다룸. 이 페이지는 **인증 자체** 에 집중.

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **사용자 열거 (Username Enumeration)** | 가입/로그인/비밀번호 찾기의 응답 차이로 계정 존재 확인 |
| **기본 자격증명 (Default Credentials)** | admin/admin, manager/manager 등 |
| **무차별 대입 (Brute Force)** | 로그인 / OTP / 재설정 토큰 시도 횟수 제한 미흡 |
| **약한 비밀번호 정책** | 짧거나 단순한 비밀번호 가입/변경 가능 |
| **비밀번호 변경 결함** | 현재 비밀번호 미검증 / 다른 사용자 비밀번호 변경 |
| **비밀번호 재설정 결함** | 토큰 추측 가능 / Referer 누출 / Host header 변조 / 만료 없음 |
| **MFA 우회** | 2단계 건너뛰기 / OTP 무차별 / 응답 변조 |
| **인증 우회 (Authentication Bypass)** | 인증 필요 페이지 직접 접근 / 클라이언트 검증만 적용 |

---

## 진단 절차

### Step 1. 인증 흐름 매핑

가입 → 로그인 → MFA → 인증된 페이지 → 비밀번호 변경 → 로그아웃 → 비밀번호 찾기 의 전체 요청·응답을 Burp 시퀀스로 기록. 어떤 토큰/쿠키가 어디서 생성되어 어디서 검증되는지 파악.

### Step 2. 기본 자격증명 / 비밀번호 정책 확인

- 관리자/공통 계정의 기본 자격증명 시도 (admin/admin, root/root 등)
- 가입/변경 시 약한 비밀번호 (`1234`, `password`, 본인 ID 와 동일) 통과되는지

### Step 3. 사용자 열거 점검

존재하는 계정과 무작위 계정의 응답을 비교 — **메시지 / 상태코드 / 응답 시간 / Set-Cookie / 응답 길이** 모두 비교.

대상 화면:
- 로그인 폼
- 회원가입 (이미 존재하는 ID 가입 시도)
- 비밀번호 찾기 (해당 ID 로 메일 발송 안내)

### Step 4. 무차별 대입 점검

Burp Intruder로 다음 시도, **시도 횟수 제한 / 계정 잠금 / IP 차단 / CAPTCHA** 동작 확인:

- 로그인 비밀번호 무차별
- OTP 6자리 무차별 (가장 자주 발견)
- 비밀번호 재설정 토큰 무차별 (토큰이 짧을 때)

### Step 5. 비밀번호 변경 / 재설정 흐름 점검

- 변경: 현재 비밀번호 미검증 여부, 다른 사용자 ID 파라미터 조작
- 재설정: 토큰 엔트로피, 만료/일회성, Referer 누출, Host header 변조

### Step 6. MFA 우회 점검

- 1단계만 통과 후 인증된 페이지 직접 호출 (2단계 건너뛰기)
- OTP 시도 횟수 제한 (Burp Intruder)
- MFA 검증 응답의 `success: true/false` 변조

### Step 7. 인증 우회

인증 필요 페이지를 로그인 없이 직접 호출 — 서버 측 검증 누락 / 클라이언트 JS 검증만 적용된 케이스.

---

## 페이로드 / 테스트 케이스

### 케이스 1: 사용자 열거 (Username Enumeration)

**언제 쓰는지**: 어떤 인증 폼이든 첫 점검 항목. 열거가 가능하면 무차별 대입의 효율이 크게 올라가 위험도가 동반 상승.

**비교 시나리오:**

```
1) 존재하는 계정 (admin) + 틀린 비밀번호로 로그인
2) 존재하지 않는 계정 (nonexistent_user_xxx) + 임의 비밀번호로 로그인
```

**판정** (다음 중 하나라도 해당):

- 메시지 차이 — "비밀번호가 틀렸습니다" vs "존재하지 않는 사용자입니다"
- 응답 시간 차이 — 존재하는 계정은 비밀번호 해시 검증으로 100ms+ 지연, 미존재는 즉시 응답
- 상태코드 차이 — 401 vs 404
- Set-Cookie 차이 — 한쪽만 세션 쿠키 발급
- 회원가입에서 "이미 사용 중인 ID" 안내 그대로 노출
- 비밀번호 찾기에서 "존재하지 않는 ID" 메시지 노출

> 응답 시간 차이는 네트워크 변동 가능성이 있으므로 **20회 이상 반복** 후 평균/분산으로 판단. Burp Intruder + 타이밍 측정.

### 케이스 2: 기본 자격증명 (Default Credentials)

**언제 쓰는지**: 점검 시작 시 항상 시도. 어드민 페이지/관리자 계정에서 자주 발견.

```
admin / admin
admin / admin1234
admin / password
manager / manager
root / root
test / test1234
guest / guest
<회사명> / <회사명>123
<회사명> / <회사명>1!
```

**판정**: 위 조합 중 하나라도 로그인 성공하면 즉시 Critical (특히 admin 계정).

### 케이스 3: 로그인 무차별 대입

**언제 쓰는지**: 케이스 1에서 사용자 열거가 가능하거나, 알려진 계정(`admin`)이 있을 때.

**Burp Intruder 설정:**

```
1. 로그인 요청을 Intruder 로 전송
2. password 파라미터에 §payload§ 마커 설정
3. 페이로드: 자주 쓰이는 비밀번호 사전 (rockyou top 1000, 한국 대표 비밀번호 목록)
4. 100회 이상 시도하면서 다음 확인:
   - 응답 코드/길이 변화 (성공 식별)
   - 시도 횟수 제한 (n번 이후 차단되는가)
   - 계정 잠금 (n번 실패 시 일정 시간 잠금)
   - IP 차단 (다른 계정으로 시도해도 차단)
   - CAPTCHA 등장
```

**판정**:

- 시도 횟수 제한이 전혀 없거나 매우 느슨함 (50회 이상 가능) → 취약
- IP 차단 / 계정 잠금 / CAPTCHA 모두 미적용 → 취약
- 잠금이 있어도 X-Forwarded-For 헤더 변조로 우회 가능 → 취약
- 비밀번호 시도와 OTP 시도가 **동일 카운터**가 아님 (각각 따로 카운트) → 취약

### 케이스 4: 약한 비밀번호 정책

**언제 쓰는지**: 회원가입 / 비밀번호 변경 / 비밀번호 재설정 시점 모두에서.

**시도 비밀번호:**

```
1234
1234567
password
qwer1234
asdf1234
<userid>           # 본인 ID 와 동일
<userid>1234
P@ssw0rd           # 정책상 통과되지만 흔함
2026!              # 연도 + 특수문자
```

**판정**: 위 중 하나라도 가입/변경 통과되면 비밀번호 정책 미흡. NIST SP 800-63B 기준으로는 최소 8자(권장 12자 이상) + 흔한 비밀번호 사전 차단이 권고.

> 한국 환경은 KISA "비밀번호 선택 및 이용 안내서" 기준이 자주 쓰이므로 보고서에는 두 기준 모두 인용 가능.

### 케이스 5: 비밀번호 변경 결함

**언제 쓰는지**: 로그인 후 마이페이지 → 비밀번호 변경 흐름에서.

**시나리오 5-1 — 현재 비밀번호 미검증:**

```http
POST /api/profile/password HTTP/1.1
Cookie: SESSION=victim_session

{"new_password": "NewPass123!"}     ← 현재 비밀번호 필드 자체를 빼고 요청
```

**판정**: 응답이 정상 200이고 실제 비밀번호가 변경되면 취약. 세션 탈취만으로 영구 계정 탈취가 가능 (피해자가 비밀번호 변경해도 공격자가 다시 변경 가능).

**시나리오 5-2 — 다른 사용자 비밀번호 변경 (IDOR 결합):**

```http
POST /api/users/<OTHER_USER_ID>/password HTTP/1.1
Cookie: SESSION=attacker_session

{"new_password": "Pwned123!"}
```

**판정**: 다른 사용자 비밀번호가 변경되면 Critical. 권한 페이지(`authorization-idor.md`)와 함께 분류.

### 케이스 6: 비밀번호 재설정 토큰 결함

**언제 쓰는지**: "비밀번호를 잊으셨나요?" 흐름에서.

**6-1) 토큰 엔트로피 분석** — 본인 계정으로 여러 번 재설정 요청을 보낸 뒤 메일로 받은 토큰들을 비교:

```
abc123              ← 6자리, 무차별 가능 → 취약
1715789432          ← timestamp 기반 → 추측 가능
abcd-1234           ← 짧음
3f9a2b1c8e7d4f5a... ← 32자+ 랜덤 → 안전
```

**6-2) 만료 / 일회성 검증:**

- 발급 후 24시간/48시간 지나도 사용 가능 → 취약 (15분~1시간 권장)
- 한 번 사용한 토큰을 다시 사용 가능 → 취약
- 새 토큰 발급해도 이전 토큰 무효화 안 됨 → 취약

**6-3) Referer 누출** — 재설정 페이지(`/reset?token=XXX`)에 외부 리소스(애널리틱스, 외부 폰트, 광고) 가 로드되면 그 외부 서버에 Referer 헤더로 토큰 전송됨.

**판정**: 위 중 하나라도 해당하면 재설정 토큰 결함.

### 케이스 7: Host Header Injection → 비밀번호 재설정 메일 변조

**언제 쓰는지**: 비밀번호 찾기 요청 시 메일에 포함되는 재설정 링크가 `Host` 헤더 기반으로 생성되는 경우.

```http
POST /api/password/reset HTTP/1.1
Host: attacker.com               ← Host 변조
Content-Type: application/json

{"email": "victim@example.com"}
```

**판정**: 피해자에게 발송된 메일의 재설정 링크가 `https://attacker.com/reset?token=...` 형태로 변조되어 발송되면 취약. 피해자가 클릭하면 토큰이 공격자에게 전송 → 피해자 계정 탈취.

### 케이스 8: MFA 우회

**시나리오 8-1 — 2단계 건너뛰기:**

```
1. 정상적으로 ID/비밀번호 로그인 (1단계만 통과)
2. 응답에서 받은 임시 세션 쿠키로 MFA 페이지가 아닌 다른 인증 필요 페이지 직접 호출
   GET /api/profile HTTP/1.1
   Cookie: SESSION=stage1_session
```

**판정**: 인증된 데이터가 응답되면 MFA가 강제되지 않음 = 취약.

**시나리오 8-2 — OTP 무차별** (실무에서 가장 자주 발견):

```
6자리 숫자 OTP를 Burp Intruder로 000000~999999 시도
시도 횟수 제한 / 잠금 / OTP 만료(보통 30초~5분) 동작 확인
```

**판정**: 1000회 이상 시도해도 차단 없이 통과되면 취약. 6자리는 5분 안에 100만회 시도가 이론적으로 가능하므로 시도 횟수 제한이 필수.

**시나리오 8-3 — 응답 변조:**

```http
# OTP 검증 요청
POST /api/mfa/verify HTTP/1.1
{"otp": "000000"}

# 정상 응답 (실패)
HTTP/1.1 200 OK
{"success": false}

# Burp로 응답을 변조
HTTP/1.1 200 OK
{"success": true}             ← 클라이언트가 이걸 받으면 인증된 것으로 처리
```

**판정**: 변조된 응답으로 인증된 페이지에 접근 가능하면, 백엔드가 응답에 의존하는 잘못된 흐름. 드물지만 SPA + 잘못된 토큰 발급 흐름에서 발견됨.

### 케이스 9: 인증 우회 (Authentication Bypass)

**언제 쓰는지**: 추측 가능한 인증 필요 경로 직접 접근 / JS만 권한 체크하는 케이스.

```
GET /admin                         (로그인 없이)
GET /admin/users
GET /api/admin/users               (API 직접 호출)
GET /dashboard.html                (정적 HTML이 인증 체크 안 함)
```

**판정**: 로그인 없이 또는 일반 사용자 권한으로 위 경로의 응답이 정상 데이터를 반환하면 취약. JS에서 `if (!isAdmin) redirect()` 만 하고 서버는 누구나 응답하는 케이스가 자주 발견됨.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 로그인/가입/비밀번호 찾기 응답에 **사용자 존재 여부 차이** (메시지/상태코드/시간) 가 노출됨
- [ ] **기본 자격증명** (admin/admin 등) 으로 로그인 가능
- [ ] 로그인 / OTP / 재설정 토큰에 **시도 횟수 제한·계정 잠금·CAPTCHA 모두 미적용**
- [ ] **약한 비밀번호** (`1234`, 본인 ID 등) 가입/변경 가능
- [ ] **현재 비밀번호 미검증**으로 비밀번호 변경 가능
- [ ] 재설정 토큰이 **추측 가능 / 만료 없음 / 일회성 아님 / Referer 노출**
- [ ] **Host Header Injection**으로 재설정 링크 변조 가능
- [ ] **MFA 건너뛰기 / OTP 무차별 / 응답 변조**로 MFA 우회 가능
- [ ] 인증 필요 페이지가 로그인 없이 / 일반 권한으로 응답

**오탐 주의:**

- [ ] 응답 시간 차이는 네트워크 변동 가능성 — 20회 이상 반복 후 통계로 판단
- [ ] CAPTCHA가 나오기 전 일정 횟수는 허용되는 게 정상 동작 (단, 횟수가 50+ 이면 부족)

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [사용자 열거] 로그인 응답 메시지 차이

1. `<TARGET>/login` 에 존재하는 ID(`admin`) + 임의 비밀번호로 로그인 시도
2. 동일 위치에 존재하지 않는 ID(`nonexistent_xxx`) + 임의 비밀번호로 로그인 시도
3. 두 응답 비교

**요청 (존재하는 계정):**

```http
POST /login HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

userid=admin&password=wrongpw
```

**응답:**

```http
HTTP/1.1 200 OK
{"error":"비밀번호가 일치하지 않습니다."}
```

**요청 (미존재 계정):**

```http
POST /login HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

userid=nonexistent_xxx&password=wrongpw
```

**응답:**

```http
HTTP/1.1 200 OK
{"error":"존재하지 않는 사용자입니다."}
```

**확인 사항:**
- 두 응답 메시지가 다름 → 사용자 존재 여부가 식별 가능
- 이를 활용해 가입자 ID 사전(`admin`, `manager`, `test`, ...) 으로 유효 계정 목록 수집 가능 (별첨 Burp Intruder 결과)

---

### PoC 2 — [MFA 우회] OTP 무차별 (시도 횟수 제한 미적용)

1. `<TARGET>/login` 에 정상 로그인 (1단계 통과 후 OTP 입력 화면 도달)
2. OTP 검증 엔드포인트로 6자리 숫자를 1000회 이상 무차별 시도
3. 차단 없이 정확한 OTP 발견 시 인증 통과

**요청 (Burp Intruder, 6자리 숫자 페이로드):**

```http
POST /api/mfa/verify HTTP/1.1
Host: <TARGET>
Cookie: STAGE1_SESSION=abcd1234
Content-Type: application/json

{"otp":"§000000§"}
```

**응답 (1000회 시도 후에도 차단 없음):**

```http
HTTP/1.1 200 OK
{"success":false}
```

**요청 (정확한 OTP 시도):**

```http
{"otp":"483921"}
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Set-Cookie: SESSION=fully_authenticated_session; HttpOnly
{"success":true,"redirect":"/dashboard"}
```

**확인 사항:**
- OTP 시도 횟수 제한 / 만료 / 잠금 모두 미적용 — 1000회 이상 시도해도 차단되지 않음
- 6자리 OTP 는 이론상 5분 안에 100만회 시도가 가능하므로 사실상 무방비
- 정확한 OTP 발견 시 정상 세션 쿠키 발급되어 인증된 모든 기능에 접근 가능

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 — 계정 탈취 시 사용자 개인정보 노출. 관리자 탈취 시 전사용자 정보 노출.
- **무결성 (Integrity)**: 🔴 — 탈취된 계정으로 데이터 변조, 권한 부여, 결제 등 임의 액션 수행.
- **가용성 (Availability)**: 🟡 — 계정 잠금 정책 악용 시 정상 사용자 대규모 잠금 (DoS).
- **추가 위협**:
  - **관리자 계정 탈취** → 시스템 전체 침해
  - **사용자 열거 → 외부 유출 자격증명 재사용 (Credential Stuffing)** 으로 대량 계정 탈취

**비즈니스 임팩트:**
인증 결함은 보고서에서 항상 우선순위 최상위로 다뤄진다. 단일 사용자 열거조차 외부 유출된 자격증명과 결합되면 대규모 계정 탈취로 이어지며, 관리자 계정 탈취는 사실상 시스템 전체 침해와 동일하게 평가된다. 기본 자격증명·MFA 우회 발견 시 무조건 Critical.

---

## 대응방안

### 개발자 관점 (필수)

1. **응답 일관성** — 사용자 열거 방지:
   - 모든 인증 실패 응답은 단일 메시지 (`"아이디 또는 비밀번호가 일치하지 않습니다"`)
   - 미존재 계정도 비밀번호 해시 검증과 동일한 시간 소요시키기 (dummy bcrypt 호출)
   - 회원가입 중복 체크는 응답 메시지 대신 메일 인증 흐름으로 (이미 가입된 메일이면 "이미 가입된 계정으로 안내 메일을 보냈습니다")

2. **시도 횟수 제한** — IP + 계정 단위 모두 적용:
   - 점진적 지연 (exponential backoff): 5회 실패 후 10초, 10회 후 1분, 20회 후 1시간
   - CAPTCHA 도입 (5회 실패 후)
   - 비밀번호와 OTP는 **각각 별도 카운터** 가 아니라 **통합 카운터**

3. **비밀번호 정책** — NIST SP 800-63B 기준:
   - 최소 8자 (권장 12자 이상)
   - 흔한 비밀번호 사전(`rockyou`, HIBP 등) 차단
   - 본인 정보(ID, 이메일, 이름) 와 다름
   - 주기적 강제 변경은 **권고하지 않음** (NIST는 폐지)

4. **비밀번호 저장** — bcrypt(cost 10+) / argon2id 사용. MD5/SHA-1/SHA-256 단독 사용 금지.

5. **비밀번호 변경** — 현재 비밀번호 검증 필수, 변경 후 다른 활성 세션 모두 무효화.

6. **재설정 토큰** — 충분한 엔트로피(`secrets.token_urlsafe(32)` 이상), 단기 만료(15분~1시간), 1회성, 사용 후 즉시 폐기.

7. **Host Header 검증** — 메일 본문의 절대 URL은 환경변수/설정 기반으로 생성, 절대 Host 헤더 사용 금지:

   ```python
   # 위험
   reset_url = f"https://{request.host}/reset?token={token}"
   # 안전
   reset_url = f"{settings.PUBLIC_BASE_URL}/reset?token={token}"
   ```

8. **MFA 강제** — 모든 인증된 액션에서 세션이 MFA 통과했는지 검증. 1단계 세션과 2단계 세션을 별도 토큰으로 구분.

9. **OTP 시도 제한** — 5회 실패 시 OTP 무효화 + 새로 발급. OTP 자체 만료 5분 이내.

### 운영자 관점

1. **WAF 룰** — 무차별 대입 패턴(동일 IP/계정에서 분당 100+ 요청) 탐지·차단.
2. **이상 징후 알람** — 로그인 실패 급증, 비정상 위치 로그인(geolocation), 관리자 계정 활동 알림.
3. **Credential Stuffing 모니터링** — HIBP API 등으로 유출된 자격증명 재사용 탐지.

### 안전 / 위험 코드 비교

**사용자 열거 방지 (Python):**

```python
# 위험 — 메시지가 다르고, 응답 시간도 다름
user = User.query.filter_by(userid=userid).first()
if not user:
    return jsonify({"error": "존재하지 않는 사용자"}), 404
if not bcrypt.check(password, user.password_hash):
    return jsonify({"error": "비밀번호 불일치"}), 401

# 안전 — 메시지 통일 + dummy bcrypt 로 시간 일관화
DUMMY_HASH = bcrypt.hash("dummy_for_timing")  # 앱 시작 시 1회 생성

user = User.query.filter_by(userid=userid).first()
target_hash = user.password_hash if user else DUMMY_HASH
ok = bcrypt.check(password, target_hash)
if not user or not ok:
    return jsonify({"error": "아이디 또는 비밀번호가 일치하지 않습니다"}), 401
```

**재설정 토큰 생성:**

```python
# 위험 — 추측 가능
import time
token = str(int(time.time()))             # timestamp
token = str(uuid.uuid1())                 # uuid1 은 MAC 주소 기반, 추측 가능

# 안전 — 충분한 엔트로피
import secrets
token = secrets.token_urlsafe(32)         # 256bit
```

**Host Header 검증 (Node.js):**

```javascript
// 위험
const resetUrl = `https://${req.headers.host}/reset?token=${token}`;

// 안전
const resetUrl = `${process.env.PUBLIC_BASE_URL}/reset?token=${token}`;
```

---

## 참고자료

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [NIST SP 800-63B - Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [PortSwigger - Authentication vulnerabilities](https://portswigger.net/web-security/authentication)
- [PortSwigger - Multi-factor authentication](https://portswigger.net/web-security/authentication/multi-factor)
- [HackTricks - Login Bypass](https://book.hacktricks.xyz/pentesting-web/login-bypass)
