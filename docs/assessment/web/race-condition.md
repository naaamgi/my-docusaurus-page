---
sidebar_position: 32
title: Race Condition
description: 웹 진단 - Race Condition 점검 절차, Burp Turbo Intruder Single Packet Attack, 결제/쿠폰/포인트 시나리오, PoC
keywords: [Race Condition, TOCTOU, Concurrency, Turbo Intruder, Single Packet Attack, Burp Repeater, Idempotency, OWASP A06]
draft: false
---

## 점검 목적

두 요청이 같은 상태를 거의 동시에 읽고 변경할 때, 한 번만 허용되어야 하는 동작이 중복 처리되거나 정상 순서를 벗어나는지 확인한다. 경쟁 상태(Race Condition)는 응답 코드보다 최종 상태가 핵심이다. 테스트 계정과 되돌릴 수 있는 데이터로 낮은 동시성부터 확인한다.

- 동시성이 없어도 발생하는 순서·가격·상태 검증 문제는 [비즈니스 로직](./business-logic.md)에서 다룬다.
- 비밀번호 재설정과 MFA 자체의 검증 문제는 [인증](./authentication.md)에서 다룬다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 사용 횟수 초과 | 쿠폰·투표·응모·일회용 토큰이 두 번 이상 처리됨 | 동일 요청 두 개부터 시작 |
| 잔액·수량 불일치 | 포인트·재고·좌석보다 많은 처리가 성공함 | 최종 잔액과 처리 이력을 함께 확인 |
| 중복 생성 | 이메일·닉네임·슬러그처럼 유일해야 하는 값이 중복 생성됨 | 테스트용 식별자와 생성 결과를 비교 |
| 상태 전이 충돌 | 결제·취소·환불처럼 서로 다른 요청이 잘못된 순서로 함께 처리됨 | 두 endpoint의 전제 상태를 먼저 정리 |
| 숨은 중간 상태 | 처리 중 잠깐 나타나는 상태에서만 다른 동작이 가능함 | 응답 편차와 후속 동작으로 중간 상태 추정 |

---

## 진단 절차

#### Step 1. 후보 기능과 불변 조건 정리

동시에 처리되어도 반드시 지켜져야 하는 조건을 한 문장으로 적는다.

```text
쿠폰 한 장은 주문 한 건에만 적용된다.
포인트는 현재 잔액보다 많이 차감되지 않는다.
좌석 한 개는 사용자 한 명만 점유한다.
재설정 토큰은 한 번 성공하면 즉시 무효가 된다.
같은 이메일의 활성 계정은 하나만 존재한다.
```

#### Step 2. 순차 요청으로 기준선 저장

동일 요청을 한 번 보내 정상 결과와 최종 상태를 저장한다. 데이터를 초기화한 뒤 같은 요청을 두 번 순서대로 보내 중복 방어가 있는지도 확인한다.

| 저장할 값 | 예시 |
| :--- | :--- |
| 요청 전 상태 | 잔액, 쿠폰 사용 여부, 좌석 소유자, 토큰 상태 |
| 첫 응답 | 상태 코드, 본문의 처리 ID와 메시지 |
| 두 번째 순차 응답 | 중복·잔액 부족·이미 사용됨 오류 |
| 요청 후 상태 | 실제 처리 건수와 최종 잔액 |

순차 요청부터 모두 성공하면 일반 비즈니스 로직 문제일 수 있다. 동시성 때문에 결과가 달라지는지 분리한다.

#### Step 3. 경쟁 구간 추정

서버가 `상태 확인 → 처리 → 사용 완료 표시` 순서로 동작하는 지점을 찾는다. 하나의 API 주소(endpoint)인지, 서로 다른 두 주소가 같은 상태를 바꾸는지도 구분한다.

```text
쿠폰 유효성 확인 → 주문 생성 → 쿠폰 사용 처리
잔액 확인 → 결제 생성 → 잔액 차감
결제 완료 확인 → 환불 생성 → 주문 상태 변경
토큰 유효성 확인 → 비밀번호 변경 → 토큰 무효화
```

#### Step 4. 두 요청으로 병렬 비교

Burp Repeater에서 요청 두 개를 같은 그룹에 넣고 `Send group in parallel`로 보낸다.

```text
1. 기준 요청을 Repeater 탭 두 개로 복제
2. 같은 그룹에 추가
3. 요청 전 테스트 데이터를 초기화
4. Send group in parallel 실행
5. 두 응답과 후속 상태 조회 결과 비교
```

HTTP/1에서는 Burp가 마지막 바이트 동기화(last-byte synchronization)를 사용하고, HTTP/2에서는 단일 패킷 방식(single-packet attack)을 사용한다. 메뉴에서 별도 공격 이름을 고르는 것이 아니라 병렬 전송을 선택하면 프로토콜에 맞는 방식이 적용된다.

#### Step 5. 관찰값에 따라 요청 수 조정

두 요청에서 편차가 없으면 네트워크 지연인지 서버 내부 처리인지 구분한다. 되돌릴 수 있는 테스트 데이터에서만 `2 → 3 → 5`처럼 조금씩 늘린다. 결제·메시지 발송·재고·외부 연동 기능은 요청 수를 임의로 늘리지 않는다.

#### Step 6. 최종 상태로 재현 확정

응답이 둘 다 `200`이어도 실제 변경이 한 번이면 취약으로 확정하지 않는다. 반대로 하나가 오류여도 처리 이력이 두 건이면 경쟁 상태일 수 있다.

- 성공 처리 ID가 둘 이상 생성됐는지
- 잔액·수량·소유자가 불변 조건을 벗어났는지
- 감사 로그·이력 API에 변경이 몇 건 남았는지
- 데이터를 초기화해 같은 결과가 반복되는지
- 불필요한 요청을 제거해 두 요청만으로도 재현되는지

### 상황별 빠른 선택

| 현재 기능 | 첫 병렬 테스트 |
| :--- | :--- |
| 쿠폰·투표·응모 | 같은 값의 동일 요청 두 개 |
| 포인트·잔액 차감 | 합계가 보유량을 넘는 동일 금액 요청 두 개 |
| 회원가입·닉네임 | 통제하는 동일 식별자로 생성 요청 두 개 |
| 비밀번호 재설정 | 같은 토큰으로 서로 다른 새 비밀번호 요청 두 개 |
| 주문 취소·환불 | 취소와 환불처럼 충돌하는 두 endpoint |
| 장바구니·결제 | 장바구니 변경과 주문 확정을 동시에 전송 |

---

## 페이로드 노트

### 1. 1회 사용 값의 중복 처리

**이럴 때 사용**: 쿠폰·응모권·투표·추천 코드처럼 사용 횟수가 제한된다.

```http
POST /api/orders/TEST-ORDER/coupon HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<TEST_SESSION>
Content-Type: application/json

{"couponCode":"TEST-ONCE"}
```

**확인할 것**: 같은 요청 두 개를 병렬로 보내고 주문 할인 내역과 쿠폰 사용 이력을 조회한다. 응답 두 개가 성공해도 할인 적용이 한 번이면 후보에 머문다.

### 2. 잔액·포인트 동시 차감

**이럴 때 사용**: 두 요청의 합계가 테스트 계정의 보유량을 넘도록 만들 수 있다.

```http
POST /api/test-wallet/use HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<TEST_SESSION>
Content-Type: application/json

{"amount":600}
```

예를 들어 테스트 잔액이 1,000이면 600 차감 요청 두 개를 병렬로 보낸다. 실제 결제 대신 취소·복원 가능한 테스트 포인트를 우선 사용한다.

**확인할 것**: 요청 전후 잔액, 성공 처리 ID 수, 사용 이력을 비교한다. 잔액이 음수가 아니더라도 1,200만큼의 서비스가 제공되고 1,000만 차감됐다면 불변 조건이 깨진 것이다.

### 3. 유일해야 하는 값의 중복 생성

**이럴 때 사용**: 이메일·닉네임·슬러그·초대 코드가 한 개만 존재해야 한다. 실제 사용자의 식별자 대신 통제하는 고유 값을 사용한다.

```http
POST /api/signup HTTP/1.1
Host: <TARGET>
Content-Type: application/json

{"email":"race-<RANDOM>@example.test","password":"<TEST_PASSWORD>"}
```

**확인할 것**: 계정 ID가 둘 이상 생성됐는지, 로그인·복구·보너스가 어느 계정에 연결되는지 확인한다. 동일한 성공 메시지만으로 중복 생성을 단정하지 않는다.

### 4. 서로 다른 endpoint의 상태 전이 충돌

**이럴 때 사용**: 주문 확정과 장바구니 변경, 결제와 취소, 승인과 철회처럼 서로 다른 요청이 같은 객체를 변경한다.

```text
요청 A: POST /api/orders/TEST-ORDER/confirm
요청 B: PATCH /api/carts/TEST-CART/items

요청 A: POST /api/orders/TEST-ORDER/cancel
요청 B: POST /api/orders/TEST-ORDER/refund
```

먼저 A→B와 B→A를 순차 실행해 정상 상태 전이를 저장한다. 데이터를 초기화한 뒤 A와 B를 병렬로 보내 순차 실행에서는 나오지 않던 최종 상태가 생기는지 확인한다.

**확인할 것**: 응답 순서보다 주문 금액·품목·결제·환불 상태가 서로 일치하는지 본다.

### 5. 일회용 인증 토큰

**이럴 때 사용**: 비밀번호 재설정·이메일 인증·MFA 복구 토큰이 성공 후 즉시 무효화되어야 한다.

```text
요청 A: 같은 토큰 + 새 비밀번호 A
요청 B: 같은 토큰 + 새 비밀번호 B
```

**확인할 것**: 두 요청의 성공 메시지보다 최종 비밀번호, 토큰 재사용 여부, 세션 무효화 상태를 확인한다. 두 요청 모두 처리되어 결과가 마지막 요청에 따라 달라진다면 일회용 정책이 원자적으로 적용되지 않은 것이다.

### 6. `Idempotency-Key` 확인

**이럴 때 사용**: 결제·주문 생성 API가 중복 요청 방지용 멱등성 키(Idempotency Key)를 받는다. 멱등성은 같은 요청을 반복해도 결과가 한 번만 적용되도록 하는 성질이다.

```http
Idempotency-Key: race-<RANDOM>
```

| 조합 | 확인 의도 |
| :--- | :--- |
| 같은 요청 + 같은 키 | 한 번만 처리되고 같은 결과가 재사용되는지 |
| 같은 요청 + 다른 키 | 비즈니스의 1회 제한이 키에만 의존하는지 |
| 다른 본문 + 같은 키 | 충돌 오류가 나고 기존 결과가 유지되는지 |

키가 없을 때 중복 생성된다는 사실만으로 항상 취약한 것은 아니다. API 계약상 키가 필수인지, 브라우저·앱이 정상적으로 키를 보내는지 함께 확인한다.

### 7. 좁은 경쟁 구간 정밀 동기화

**이럴 때 사용**: Repeater의 두 요청에서 의심 편차가 있었지만 재현이 불안정하고, 대상이 HTTP/2를 지원한다.

Turbo Intruder의 단일 패킷 방식은 HTTP/2에서 사용한다. 먼저 요청 두 개로 시작하고, 테스트 데이터가 안전할 때만 수를 조금 늘린다.

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=1,
        engine=Engine.BURP2
    )

    for i in range(2):
        engine.queue(target.req, gate='race1')

    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

HTTP/1 대상은 Repeater 병렬 전송의 마지막 바이트 동기화를 우선 사용한다. 결과 테이블의 상태 코드·길이는 후보 선별용이며, 최종 판정은 후속 상태 조회로 한다.

---

## 우회 매트릭스

| 관찰된 증상 | 다음 시도 | 확인할 것 |
| :--- | :--- | :--- |
| 순차 요청도 둘 다 성공 | 동시성 없이 재검증 | 일반 로직 결함과 분리 |
| 병렬 응답은 둘 다 성공, 상태 변경은 한 번 | 처리 ID와 이력 조회 | 성공 응답만 잘못 반환하는지 |
| 두 요청의 도착 시간이 크게 다름 | HTTP 버전 확인 후 Repeater 병렬 전송 | HTTP/1 last-byte, HTTP/2 single-packet 구분 |
| 단일 endpoint에서 편차가 없음 | 같은 상태를 바꾸는 다른 endpoint 탐색 | 취소·환불·확정 등 상태 전이 |
| 매번 결과가 달라짐 | 데이터 초기화 후 소수 반복 | 서버 내부 지연과 실제 충돌 구분 |
| 같은 멱등성 키는 안전함 | 다른 키 두 개로 동일 행위 비교 | 비즈니스 제한이 키에만 의존하는지 |
| rate limit이 먼저 동작함 | 요청 수를 늘리지 않고 테스트 조건 검토 | 제한 우회와 race를 섞지 않음 |

---

## 취약 판정 기준

### 취약 확정

- 순차 실행에서는 지켜지던 1회 제한이 병렬 실행에서 두 번 이상 실제 적용된다.
- 잔액·재고·좌석·쿠폰 사용 이력이 정의한 불변 조건을 벗어난다.
- 같은 유일 식별자로 서로 다른 객체가 둘 이상 생성된다.
- 충돌하는 상태 전이가 함께 처리되어 정상 순서에서는 만들 수 없는 상태가 남는다.
- 일회용 인증 토큰으로 서로 다른 변경이 둘 이상 처리된다.

### 후보 / 보류

- 응답 두 개가 성공했지만 실제 상태 변경은 한 번만 확인된다.
- 처리 결과가 불안정하지만 테스트 데이터 초기화와 반복 재현이 되지 않는다.
- 같은 키에서는 한 번만 처리되지만 다른 멱등성 키의 정책은 확인하지 못했다.
- rate limit·비동기 queue·캐시 때문에 응답 편차가 생긴 것으로 보인다.

### 영향 상승 조건

- 실제 결제·환불·포인트·재고 수량에 불일치가 생긴다.
- 다른 사용자의 좌석·주문·계정 상태에 영향을 준다.
- 인증 토큰 중복 사용이 계정 탈취나 보안 설정 변경으로 이어진다.
- 최소 두 요청만으로 안정적으로 반복 재현된다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP - Race Conditions](https://owasp.org/www-community/pages/vulnerabilities/race_conditions)
- [PortSwigger Web Security Academy - Race conditions](https://portswigger.net/web-security/race-conditions)
- [PortSwigger Burp Documentation - Sending grouped HTTP requests](https://portswigger.net/burp/documentation/desktop/tools/repeater/send-group)
- [Stripe Engineering - Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)

### 커뮤니티 참고 / 도구

- [PortSwigger Research - Smashing the state machine](https://portswigger.net/research/smashing-the-state-machine)
- [Turbo Intruder](https://github.com/PortSwigger/turbo-intruder)
- [HackTricks - Race Condition](https://book.hacktricks.xyz/pentesting-web/race-condition)
