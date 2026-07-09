---
sidebar_position: 31
title: 예외 처리 미흡
description: 웹 진단 - 예외 처리 결함으로 인한 보안 검증 우회 (fail-open), 정보 노출, 사용자 열거, 트랜잭션/락 누락 점검
keywords: [Error Handling, Exception Handling, Fail-Open, Mishandling Exceptional Conditions, Information Leakage, User Enumeration, OWASP A10]
draft: false
---

# 예외 처리 미흡
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

### 케이스 1: Fail-open — 예외 시 보안 검증 우회
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

## 참고자료

- [OWASP Top 10 2025 - A10: Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/)
- [OWASP Cheat Sheet - Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [OWASP - Improper Error Handling](https://owasp.org/www-community/Improper_Error_Handling)
- [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html)
- [PortSwigger - Information disclosure (error messages)](https://portswigger.net/web-security/information-disclosure)
- [OWASP - Fail securely](https://owasp.org/www-community/Fail_securely)
