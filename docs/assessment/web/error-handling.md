---
sidebar_position: 31
title: 예외 처리 미흡 (Improper Error Handling)
description: 웹 진단 - 예외 처리 결함으로 인한 보안 검증 우회 (fail-open), 정보 노출, 사용자 열거, 트랜잭션/락 누락 점검
keywords: [Error Handling, Exception Handling, Fail-Open, Mishandling Exceptional Conditions, Information Leakage, User Enumeration, OWASP A10]
draft: false
---

# 예외 처리 미흡 (Improper Error Handling / Mishandling of Exceptional Conditions)

> 예외 발생 시 애플리케이션이 **보안 검증을 건너뛰거나 (fail-open) / 정보를 노출하거나 / 일관성 없는 응답** 으로 인해 발생하는 결함.
> OWASP 2025 신규 카테고리로, 단독보다 다른 결함의 우회 / 정보 단서를 제공하는 패턴이 핵심.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A10:2025 - Mishandling of Exceptional Conditions (2025 신규) / KISA 예외 처리 |
| **CWE** | [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html), [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html), [CWE-754: Improper Check for Unusual or Exceptional Conditions](https://cwe.mitre.org/data/definitions/754.html), [CWE-396: Declaration of Catch for Generic Exception](https://cwe.mitre.org/data/definitions/396.html) |
| **영향도** | 🟡 (정보 노출 / 사용자 열거) / 🔴 (Fail-open 으로 인증·권한·결제 우회) |
| **점검 난이도** | 중 (예외 유도 + 응답 차이 비교) |
| **예상 점검 시간** | 1 ~ 3시간 |

---

## 점검 목적

비정상 입력 / 동시 요청 / 외부 의존성 실패 등 **예외 상황에서 애플리케이션이 안전한 동작** 을 하는지 확인한다. 정상 흐름은 잘 동작해도, 예외 발생 시 인증/권한/결제 검증이 우회되거나 (fail-open), 내부 정보가 노출되거나, 응답 차이로 사용자 열거가 가능한 결함이 자주 발견된다.

> **다른 페이지와 영역 분리**
> - 에러 메시지의 스택트레이스 / 디버그 모드 노출 → `information-disclosure.md` 케이스 4 (정보 자체 노출 중심)
> - 에러 페이지의 SQL 흔적 → `sql-injection.md`
> - 사용자 열거의 응답 차이 일반 → `authentication.md`
> - 본 페이지는 **예외 처리 로직 자체** 의 결함 + 보안 검증 우회 관점

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **Fail-open (예외 시 통과)** | 인증/권한/결제 검증 중 예외 발생 → 거부 대신 통과 |
| **Catch-all + Swallow** | `catch (Exception e) {}` 빈 처리로 예외 무시 → 후속 흐름 비정상 진행 |
| **예외 시 트랜잭션 / 락 누락** | 예외로 트랜잭션 롤백 안 됨, 락 해제 안 됨 → 데이터 불일치 |
| **일관성 없는 에러 응답** | 사용자 열거 (`존재하지 않는 ID` vs `비밀번호 오류`), 응답 시간 차이 |
| **에러 메시지 정보 노출** | 스택트레이스, SQL 쿼리, 파일 경로, 내부 IP |
| **외부 의존성 실패 시 동작** | DB / 캐시 / 외부 API 실패 시 동작 미정의 → 우회 가능 |
| **검증 순서 결함** | 권한 검증 후 비싼 처리 → 예외 시 부분 적용 |

---

## 진단 절차

### Step 1. 예외 유도 페이로드 매핑

각 입력 포인트에 다음을 차례로 시도해 예외 응답 수집:

```
- 타입 미스매치 (숫자 자리에 문자열 / 객체)
- 범위 초과 (Integer.MAX_VALUE, 음수, 매우 긴 문자열, 0)
- null / 빈 문자열 / 누락된 필드
- 특수문자 / 유니코드 / 제어 문자
- 매우 큰 페이로드 (10MB JSON)
- 중복 키 / 배열 형식 변조
- 동시 요청 (race window 유발)
- 외부 의존성 실패 모사 (가짜 토큰 / 만료된 키 / 잘못된 endpoint)
```

### Step 2. 응답 분석

```
- HTTP 상태 코드 (200 / 400 / 401 / 403 / 500 등)
- 응답 본문 (에러 메시지, 스택트레이스, JSON 구조)
- 응답 시간 차이
- 후속 상태 변화 (DB / 세션 / 잔액)
```

### Step 3. Fail-open 우회 시도

보안 검증이 예외로 우회되는지 입증 (케이스 1).

### Step 4. 정보 노출 / 사용자 열거 확인

응답 차이로 정보 추론 가능한지 확인 (케이스 4, 5).

---

## 페이로드 / 테스트 케이스

### 케이스 1: Fail-open — 예외 시 보안 검증 우회 (가장 임팩트 큼)

**언제 쓰는지**: 인증 / 권한 / 결제 / 서명 검증 흐름. 검증 중 예외가 발생하면 거부가 아닌 통과되는 결함.

**위험 패턴:**

```python
# 위험 — 예외 발생 시 인증 우회
def is_admin(token):
    try:
        payload = jwt.decode(token, key, algorithms=["HS256"])
        return payload.get("role") == "admin"
    except:
        return True              # ← 예외 시 통과 (인증 우회)

# 위험 — Optional unwrap 누락
def check_permission(user_id, resource_id):
    try:
        resource = Resource.get(resource_id)
        return resource.owner_id == user_id
    except DoesNotExist:
        return True              # ← 자원 없으면 통과 (IDOR)
```

**시도 시나리오:**

```
1. JWT 토큰 변조 (잘못된 서명) → 예외 발생 → 통과되면 fail-open
2. 권한 검증 쿼리에 잘못된 ID → DB 에러 → 통과되면 fail-open
3. 외부 인증 서버 응답 지연 / 실패 → timeout 예외 → 통과되면 fail-open
4. 결제 검증 API 실패 → 주문 확정 진행되면 fail-open
```

**페이로드 예시:**

```http
# JWT 검증 우회 — 잘못된 서명으로 예외 유발
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.INVALID_SIGNATURE

# 권한 검증 우회 — 존재하지 않는 ID
GET /api/orders/99999999999999999999

# 외부 API timeout 유발 — 매우 큰 본문
POST /api/payment
{"items": [...10MB...]}
```

**판정**: 예외 응답 대신 정상 처리되거나, 인증/권한이 통과되면 fail-open 결함. **단일 결함으로 인증 우회 + 권한 우회 가능** → Critical.

### 케이스 2: Catch-all + Swallow — 예외 무시로 후속 흐름 비정상 진행

**언제 쓰는지**: 다단계 처리에서 중간 단계가 실패해도 마지막 단계까지 진행되는 흐름.

**위험 패턴:**

```javascript
// 위험 — 결제 실패해도 주문 확정
async function checkout(req, res) {
    try {
        await chargePayment(req.body.amount);
    } catch (e) {
        // 결제 실패 무시
    }
    await Order.create({ status: 'CONFIRMED' });   // 결제 실패해도 주문 확정
    res.json({ ok: true });
}

// 위험 — 권한 변경 실패해도 성공 응답
try {
    await user.assignRole(req.body.role);
} catch (e) {
    logger.warn(e);
}
return res.json({ status: 'updated' });
```

**시도:**

```
- 결제 API 의 amount 를 매우 크게 → 결제 실패 유발 → 주문은 확정되는지
- 외부 검증 API 실패 시 후속 처리 진행 여부
- 트랜잭션 도중 예외 유발 → 일부 적용된 상태 잔존
```

**판정**: 예외 발생 후에도 주문 / 권한 변경 / 상태 전이가 적용되면 결함. 비즈니스 로직 결함 (`business-logic.md`) 과 결합되어 직접 금전 손실 가능.

### 케이스 3: 예외 시 트랜잭션 / 락 누락

**언제 쓰는지**: 다단계 DB 처리. 중간 예외로 트랜잭션 미롤백 / 락 미해제.

**위험 패턴:**

```python
# 위험 — try/except 가 트랜잭션 밖
def transfer(from_id, to_id, amount):
    try:
        deduct_balance(from_id, amount)        # 1단계
        add_balance(to_id, amount)             # 2단계 — 여기서 예외 시?
        log_transaction(...)                    # 3단계
    except Exception as e:
        return error()                          # 1단계만 적용된 상태 잔존 = 잔액 손실
```

**시도:**

```
- 송금 요청에서 수취 계정을 존재하지 않는 ID 로 → 2단계 실패 유발
- 결제 도중 외부 의존성 실패 모사
- 동시 요청으로 락 충돌 유발 → 한 요청 예외 시 락 미해제로 데드락
```

**판정**: 예외 후 DB 상태가 비즈니스 로직과 불일치 (잔액 차감만 적용 / 권한 부여만 적용 등) 면 결함.

### 케이스 4: 일관성 없는 에러 응답 — 사용자 열거 / 정보 추론

**언제 쓰는지**: 로그인 / 비밀번호 재설정 / 가입 / 이메일 인증 흐름.

**위험 패턴 — 사용자 열거:**

```
[로그인]
- 존재하는 ID + 틀린 비밀번호 → "비밀번호가 틀렸습니다"
- 존재하지 않는 ID            → "존재하지 않는 사용자입니다"
→ 응답 차이로 ID 존재 여부 enumeration

[비밀번호 재설정]
- 존재하는 이메일 → "재설정 메일을 보냈습니다" (200)
- 없는 이메일     → "등록되지 않은 이메일입니다" (404)
→ 가입 이메일 목록 enumeration

[응답 시간 차이]
- 존재하는 ID → bcrypt 검증으로 200ms 응답
- 없는 ID     → 즉시 50ms 응답 (DB 조회 후 즉시 종료)
→ 시간 기반 enumeration
```

**시도:**

```python
# 자동화 enumeration
for email in candidates:
    r = requests.post('/api/auth/reset', json={'email': email})
    if r.json().get('message') == '재설정 메일을 보냈습니다':
        print(f"가입: {email}")
```

**판정**: 응답 메시지 / 상태 코드 / 응답 시간이 사용자 존재 여부에 따라 달라지면 결함. `authentication.md` 와 일부 겹침 — 본 페이지는 예외 처리 일관성 관점.

### 케이스 5: 에러 메시지 정보 노출

**언제 쓰는지**: 예외 유도 페이로드 후 응답 본문 분석.

**위험 패턴:**

```json
[Django debug=True]
{"error": "OperationalError: no such table: users",
 "traceback": ["/app/views.py:42 in get_user\n  return User.objects.get(...)"],
 "request_data": {...}}

[Spring Boot Whitelabel]
"trace": "org.springframework.dao.DataIntegrityViolationException: ..."

[Express stack trace]
"stack": "Error: ECONNREFUSED 10.0.0.5:5432\n    at TCPConnectWrap..."

[PHP]
"Warning: file_get_contents(/etc/passwd): failed to open stream..."

[일반 — 내부 정보 노출]
{"error": "Failed to connect to mysql://app:Pa$$w0rd@db.internal:3306/app"}
{"error": "Invalid AWS credentials: AKIA..."}
{"error": "Internal user ID 99988 not found"}
```

**판정**: 응답에 스택트레이스 / SQL 쿼리 / 자격증명 / 내부 경로 / 내부 IP 노출 시 결함. `information-disclosure.md` 와 일부 겹침 — 본 페이지는 **예외 유도로 노출** 되는 케이스 중심.

### 케이스 6: 외부 의존성 실패 시 동작 미정의

**언제 쓰는지**: 외부 API / 결제 PG / SSO IdP / 메일 서버 등에 의존하는 흐름.

**시나리오:**

```
1. 외부 인증 서버 timeout → 인증 결과 미정의 → 통과 / 거부 어느 쪽?
2. 결제 PG 응답 누락 → 주문 상태 미정의
3. SMS 인증 서버 실패 → 인증 단계 건너뛰기 가능?
4. 메일 서버 실패 → 비밀번호 재설정 토큰이 메일은 안 가지만 DB 엔는 저장? (다른 사용자가 토큰 알아내면 우회)
```

**시도:**

```
- 외부 의존성 URL 을 사설망 / 존재하지 않는 IP 로 변조 (점검 환경에서만)
- Burp 의 응답 변조로 외부 응답 시뮬레이션
- 매우 큰 본문 / 지연으로 timeout 유발
```

**판정**: 외부 실패 시 인증 / 결제가 통과되거나, 부분 적용 / 토큰 노출이 발생하면 결함.

### 케이스 7: 검증 순서 결함

**언제 쓰는지**: 비싼 처리 (이메일 전송, 외부 API 호출, 파일 처리) 가 권한 검증보다 먼저 실행되는 흐름.

**위험 패턴:**

```python
# 위험 — 파일 업로드를 권한 검증 전에 처리
def upload(request):
    save_file_to_disk(request.FILES['file'])     # 1. 파일 저장 (비싸고 위험)
    if not request.user.has_permission('upload'):
        return forbidden()                        # 2. 권한 검증 (너무 늦음)
    register_file(...)
```

**시나리오:**

```
- 권한 없는 사용자가 큰 파일 업로드 → 디스크 채움 (DoS)
- 권한 없는 사용자가 이메일 전송 트리거 → 스팸 / 비용 발생
- 권한 검증 실패해도 외부 API 호출 / 결제 시도는 발생
```

**판정**: 권한 거부 응답이 와도 부수 효과 (파일 저장 / 이메일 전송 / 외부 API 호출) 가 발생하면 결함.

### 그 외 — 한 줄 언급만

- **로그 미흡** — 보안 관련 이벤트 (실패한 로그인, 권한 거부, 위조 시도) 가 로깅 안 됨 → 사고 추적 어려움
- **로그 과다 / 민감 정보 로깅** — 비밀번호 / 토큰 / 카드 번호가 평문 로그에 → 로그 노출 시 자격증명 유출
- **모니터링 / 알람 누락** — 이상 패턴이 알람으로 안 옴 → 사고 인지 지연

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 인증 / 권한 / 결제 검증 중 예외 발생 시 fail-open (통과) 동작
- [ ] 다단계 처리 중간 예외 후에도 최종 상태 (주문 확정 / 권한 변경) 적용
- [ ] 예외 발생 시 트랜잭션 미롤백 / 락 미해제로 DB 상태 불일치
- [ ] 응답 메시지 / 시간 차이로 사용자 / 토큰 / 자원 존재 여부 enumeration
- [ ] 예외 응답에 스택트레이스 / SQL 쿼리 / 자격증명 / 내부 IP 노출
- [ ] 외부 의존성 실패 시 인증 / 결제 / 권한 우회
- [ ] 권한 검증 전에 비싼 처리 (파일 저장 / 이메일 / 외부 API) 실행

**오탐 주의:**

- [ ] 의도된 동작 (외부 PG 실패 시 자동 재시도, 부드러운 실패 메시지) 일 수 있음 — 정책 확인
- [ ] 응답 시간 차이는 bcrypt 등 정상 처리 시간일 수 있음 — 측정 다회 + 통계
- [ ] 디버그 모드는 개발 환경 의도 — 운영 환경에서만 결함

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Error Handling] JWT 서명 검증 예외 시 Fail-open 으로 인증 우회

1. `<TARGET>` 의 JWT 검증 미들웨어가 예외 발생 시 거부가 아닌 통과 동작
2. 잘못된 서명을 가진 토큰 전송 → 정상 응답
3. 페이로드의 `user_id` 변조로 임의 사용자 권한 획득

**요청 — 변조된 서명:**

```http
GET /api/admin/users HTTP/1.1
Host: <TARGET>
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.WRONG_SIGNATURE
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "users": [
    {"id": 1, "username": "admin", "email": "admin@target.com"},
    ...
  ]
}
```

**확인 사항:**
- JWT 의 서명 부분 (`WRONG_SIGNATURE`) 이 검증 실패해야 하지만, 백엔드 미들웨어가 예외 발생 시 fail-open 으로 통과
- 페이로드의 `role: admin` 을 신뢰하고 관리자 API 응답
- 코드 패턴 추정: `try: jwt.decode(...); except: pass` 또는 catch-all 후 인증 결과 미설정
- 안전 패턴: 예외 발생 시 **명시적으로 401 거부**, `try: ... except: return unauthorized()`

---

### PoC 2 — [Error Handling] 비밀번호 재설정 응답 차이로 가입 이메일 enumeration

1. `<TARGET>` 의 비밀번호 재설정 API 가 이메일 존재 여부에 따라 다른 응답
2. 후보 이메일 목록으로 자동화 → 가입 이메일 추출

**요청 - 케이스 A (존재하는 이메일):**

```http
POST /api/auth/password/reset HTTP/1.1
Content-Type: application/json

{"email": "admin@target.com"}

HTTP/1.1 200 OK
{"message": "재설정 메일을 보냈습니다", "expires_in": 3600}
```

**요청 - 케이스 B (존재하지 않는 이메일):**

```http
POST /api/auth/password/reset HTTP/1.1
Content-Type: application/json

{"email": "nonexistent@target.com"}

HTTP/1.1 404 Not Found
{"error": "등록되지 않은 이메일입니다"}
```

**자동화 enumeration:**

```python
import requests

candidates = open("emails_wordlist.txt").read().splitlines()
found = []
for email in candidates:
    r = requests.post("https://<TARGET>/api/auth/password/reset",
                      json={"email": email})
    if r.status_code == 200:
        found.append(email)
        print(f"[+] 가입: {email}")
```

**확인 사항:**
- 이메일 존재 여부에 따라 응답 코드 (200 vs 404) 와 메시지가 다름 → 응답 차이로 가입 여부 enumeration
- 다수 이메일 후보로 자동화 시 가입자 이메일 목록 추출 → 피싱 캠페인 / 자격증명 stuffing 대상 확보
- 개인정보보호법상 가입 정보는 보호 대상
- 안전 패턴: 이메일 존재 여부와 무관하게 **동일한 응답** ("입력하신 이메일이 등록되어 있다면 재설정 메일을 보냈습니다" + 200 OK), 응답 시간도 일정하게

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🟡 (정보 노출 / enumeration) / 🔴 (fail-open + 스택트레이스 결합)
- **무결성 (Integrity)**: 🔴 (fail-open 으로 인증/권한/결제 우회 시)
- **가용성 (Availability)**: 🟡 (트랜잭션 / 락 누락으로 인한 데이터 불일치)
- **추가 위협**:
  - **Fail-open** — 단일 결함으로 인증 + 권한 + 결제 다층 방어 무력화
  - **사용자 / 자원 enumeration** — 피싱 / credential stuffing 의 1차 단서
  - **트랜잭션 불일치** — 직접 금전 손실 (잔액 차감만 적용, 권한 부여만 적용)
  - **스택트레이스 / 자격증명 노출** — 다른 결함 점검의 단서, 후속 침투

**비즈니스 임팩트:**
예외 처리 결함은 정상 흐름 점검에서는 잘 안 보이지만, 다양한 예외 유도 페이로드로 점검하면 자주 발견됨. 특히 fail-open 패턴은 단일 결함으로 다층 보안 검증을 동시에 무력화하므로 OWASP 2025 에서 신규 카테고리로 추가된 배경.

---

## 대응방안

### 개발자 관점 (필수)

1. **Fail-secure (Default Deny) 패턴** — 예외 시 항상 거부, 통과는 명시적 성공만:

   ```python
   # 위험
   def is_admin(token):
       try:
           return jwt.decode(token, key).get("role") == "admin"
       except:
           return True              # fail-open

   # 안전
   def is_admin(token):
       try:
           payload = jwt.decode(token, key, algorithms=["HS256"])
       except Exception:
           return False             # fail-secure
       return payload.get("role") == "admin"
   ```

2. **Catch-all 금지, 구체 예외 명시** — `except Exception:` / `catch (Exception e)` 남용 금지:

   ```python
   # 위험
   try:
       process()
   except:
       pass

   # 안전 — 구체 예외만 잡고, 나머지는 상위로 전파
   try:
       process()
   except KnownBusinessError as e:
       handle(e)
   # 다른 예외는 자동으로 상위 핸들러로 전파 → 500 응답 + 로깅
   ```

3. **트랜잭션 / 락은 `with` / `try-finally` / `@Transactional` 로 자동 해제**:

   ```python
   # 위험 — 예외 시 트랜잭션 미롤백
   def transfer():
       db.begin()
       deduct(...)
       add(...)
       db.commit()

   # 안전 — context manager
   def transfer():
       with db.transaction():       # 예외 발생 시 자동 rollback
           deduct(...)
           add(...)
   ```

   ```java
   // Spring
   @Transactional(rollbackFor = Exception.class)     // 모든 예외에서 rollback
   public void transfer() { ... }
   ```

4. **일관된 에러 응답** — 사용자 열거 가능한 응답 차이 제거:

   ```python
   # 위험
   if not user_exists: return 404
   if not check_password: return 401

   # 안전 — 동일 응답 + 동일 응답 시간
   if not user_exists or not check_password:
       time.sleep(random_jitter())   # 또는 dummy bcrypt 호출로 시간 정렬
       return generic_error()
   ```

5. **운영 환경 에러 응답 표준화** — 사용자에겐 일반 메시지, 상세는 서버 로그에만:

   ```python
   @app.errorhandler(Exception)
   def handle(e):
       error_id = uuid.uuid4()
       app.logger.exception(f"Error {error_id}: {e}")
       return jsonify({
           "error": "내부 오류가 발생했습니다",
           "error_id": str(error_id)
       }), 500
   ```

6. **검증 순서 — 권한 / 입력 검증을 비싼 처리 전에**:

   ```python
   # 안전
   def upload(request):
       if not request.user.has_permission('upload'):
           return forbidden()        # 1. 권한 검증 먼저
       if not is_valid_file(request.FILES['file']):
           return bad_request()      # 2. 입력 검증
       save_file(...)                 # 3. 비싼 처리 (검증 후)
   ```

7. **외부 의존성 실패 시 명시적 동작 정의** — timeout / 재시도 / circuit breaker + 실패 시 거부:

   ```python
   try:
       result = external_payment.charge(amount, timeout=5)
   except (Timeout, ConnectionError):
       # 외부 실패 시 절대 주문 확정 금지
       return service_unavailable()
   if not result.success:
       return payment_failed()
   confirm_order()
   ```

### 운영자 관점

1. **운영 환경 디버그 비활성** — Flask `DEBUG=False`, Django `DEBUG=False`, Spring `server.error.include-stacktrace=never`, Express `NODE_ENV=production`.

2. **로깅 / 모니터링 표준화**:
   - 보안 이벤트 (실패 로그인, 권한 거부, JWT 위조 시도) 필수 로깅
   - 비밀번호 / 토큰 / 카드 번호는 로그에서 **마스킹**
   - 5xx 에러 / 예외 빈도 알람

3. **모든 예외에 대한 전역 핸들러** — 처리 안 된 예외도 표준화된 응답 + 로깅.

4. **에러 응답 모니터링** — 응답에 스택트레이스 / SQL / 자격증명 패턴 자동 탐지.

### 안전 / 위험 코드 비교

**Java (Spring) — 전역 예외 핸들러:**

```java
// 안전 — 전역 핸들러로 표준화
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handle(Exception e) {
        String errorId = UUID.randomUUID().toString();
        log.error("Error {}: ", errorId, e);
        return ResponseEntity.status(500).body(Map.of(
            "error", "내부 오류가 발생했습니다",
            "error_id", errorId
        ));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, String>> handleBusiness(BusinessException e) {
        return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
    }
}
```

**Node.js (Express) — fail-secure 미들웨어:**

```javascript
// 위험 — 예외 시 next() 호출 안 함 → 요청 행
app.use(async (req, res, next) => {
    try {
        req.user = jwt.verify(req.headers.authorization, secret);
        next();
    } catch {
        // 빈 catch — fail-open 가능
    }
});

// 안전 — 명시적 거부
app.use(async (req, res, next) => {
    try {
        req.user = jwt.verify(req.headers.authorization?.replace('Bearer ', ''),
                              secret, { algorithms: ['HS256'] });
        next();
    } catch (e) {
        return res.status(401).json({ error: 'invalid token' });
    }
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    const errorId = crypto.randomUUID();
    console.error(`Error ${errorId}:`, err);
    res.status(500).json({
        error: '내부 오류가 발생했습니다',
        error_id: errorId
    });
});
```

**Python (Flask) — 표준 에러 응답:**

```python
import uuid, time, secrets
import bcrypt

app = Flask(__name__)
app.config['DEBUG'] = False      # 운영 환경 필수

# 전역 핸들러
@app.errorhandler(Exception)
def handle_unexpected(e):
    error_id = uuid.uuid4()
    app.logger.exception(f"Error {error_id}")
    return jsonify({"error": "내부 오류", "error_id": str(error_id)}), 500

# 사용자 열거 방지 — 응답 시간 정렬
DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt())

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.find_by_email(data['email'])

    # 사용자 없어도 bcrypt 호출로 시간 정렬
    if user:
        valid = bcrypt.checkpw(data['password'].encode(), user.password_hash)
    else:
        bcrypt.checkpw(data['password'].encode(), DUMMY_HASH)
        valid = False

    if not valid:
        return jsonify({"error": "이메일 또는 비밀번호가 올바르지 않습니다"}), 401
    return jsonify({"token": sign(user)})

# 비밀번호 재설정 — 이메일 존재 여부와 무관하게 동일 응답
@app.route('/api/auth/password/reset', methods=['POST'])
def reset():
    email = request.get_json().get('email', '')
    user = User.find_by_email(email)
    if user:
        send_reset_email(user)
    # 존재 여부와 무관하게 동일 응답
    return jsonify({"message": "입력하신 이메일이 등록되어 있다면 재설정 메일을 보냈습니다"}), 200
```

---

## 참고자료

- [OWASP Top 10 2025 - A10: Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/)
- [OWASP Cheat Sheet - Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [OWASP - Improper Error Handling](https://owasp.org/www-community/Improper_Error_Handling)
- [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html)
- [PortSwigger - Information disclosure (error messages)](https://portswigger.net/web-security/information-disclosure)
- [OWASP - Fail securely](https://owasp.org/www-community/Fail_securely)
