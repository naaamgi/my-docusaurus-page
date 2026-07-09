---
sidebar_position: 19
title: 권한 검증 / IDOR
description: 웹 진단 - IDOR, 수직/수평 권한, Mass Assignment, Forced Browsing, HTTP Method 우회 점검 절차와 판정 기준
keywords: [권한, Authorization, IDOR, BOLA, 수직권한, 수평권한, Mass Assignment, Forced Browsing, OWASP A01]
draft: false
---

# 권한 검증 / IDOR
> 인증된 사용자가 **자신의 권한 범위 밖** 자원/기능에 접근할 수 있는지 점검.
> OWASP 2021부터 Top 10 1위인 카테고리로, 단일 결함만으로 다른 사용자/관리자 데이터 노출·변조가 가능.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A01:2025 - Broken Access Control (2021부터 1위 유지) / KISA 권한 관리 |
| **CWE** | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) (IDOR), [CWE-285](https://cwe.mitre.org/data/definitions/285.html) (Improper Authorization), [CWE-269](https://cwe.mitre.org/data/definitions/269.html) (Privilege Management), [CWE-915](https://cwe.mitre.org/data/definitions/915.html) (Mass Assignment) |
| **영향도** | 🔴 매우 높음 (다른 사용자/관리자 데이터 노출·변조) |
| **점검 난이도** | 하 (단순 ID 변조) / 중 (Mass Assignment·Forced Browsing·HTTP Method 우회) |
| **예상 점검 시간** | 2시간 ~ 1일 (API 진단은 엔드포인트 수에 비례) |

---

## 점검 목적

인증은 통과했지만 **권한 검증** 이 누락된 지점에서, 사용자가 다른 사용자의 데이터에 접근하거나 관리자 기능을 호출할 수 있는지 확인한다. 권한 결함은 단일 결함만으로도 **개인정보 대량 유출 / 관리자 권한 도용** 으로 직결되며, 실무 진단에서 가장 자주 발견되고 임팩트가 큰 카테고리.

> 인증 자체는 `authentication.md`, JWT 권한 변조는 `jwt-attacks.md`(Priority 2), CORS 권한 우회는 `cors.md`(Priority 2) 에서 다룸.

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **IDOR (수평 권한)** | 본인 데이터 ID를 다른 사용자 ID로 변경해서 접근 |
| **수직 권한 상승** | 일반 사용자가 관리자 기능에 직접 접근 |
| **Forced Browsing** | 추측 가능한 URL 직접 접근 (`/admin`, `/.git/config`, 백업 파일) |
| **Mass Assignment** | 요청 body에 권한 필드 추가 (`role=admin`, `is_admin=true`) |
| **HTTP Method 우회** | GET/POST 만 권한 체크, PUT/DELETE/PATCH 누락 |
| **클라이언트 측 권한 체크만** | JS에서만 hide, 서버는 누구나 응답 |

---

## 진단 절차

### Step 1. 두 계정 준비
권한 점검은 **여러 계정의 응답 비교** 가 핵심:

- 일반 사용자 A, 일반 사용자 B (같은 권한, 다른 데이터)
- 관리자 계정 (수직 권한 점검용)
- 가능하면 권한 등급별 계정 (게스트, 일반, 매니저, 관리자)

> 점검 시작 전에 사전 협의된 다중 계정을 확보하지 못하면 권한 점검의 깊이가 크게 제한됨.

### Step 2. 인증된 모든 요청 매핑

각 계정으로 모든 기능을 사용하면서 Burp 시퀀스 기록. 어떤 식별자(userId, orderId, fileId 등) 가 어디(URL 경로/쿼리/body/헤더/쿠키) 에 들어가는지 정리.

### Step 3. IDOR 시도
A 계정 요청의 식별자를 B 의 것으로 변조 → 응답 확인 (케이스 1~4).

### Step 4. 수직 권한 점검

관리자 계정으로 접근한 기능을 일반 계정 세션 쿠키로 직접 호출 (케이스 5).

### Step 5. Forced Browsing

추측 가능한 경로 + 디렉토리 brute로 숨겨진 엔드포인트 발견 (케이스 6).

### Step 6. Mass Assignment 시도

회원가입/프로필 수정/객체 생성 요청 body에 권한 관련 필드 주입 (케이스 7).

### Step 7. HTTP Method 변조

권한 체크가 누락된 메서드(PUT/DELETE/PATCH/OPTIONS) 시도 (케이스 8).

---

## 페이로드 / 테스트 케이스

### 케이스 1: 숫자 ID IDOR

**언제 쓰는지**: ID가 숫자형이고 순차적으로 증가하는 패턴이 보일 때. 가장 흔하고 즉시 시도해야 하는 케이스.

```
A 계정 요청:
GET /api/orders/1042 HTTP/1.1
Cookie: SESSION=A_session

→ 다음 시도:
GET /api/orders/1041
GET /api/orders/1043
GET /api/orders/100
```

**판정**: A 가 소유하지 않은 ID 의 응답이 정상 200으로 다른 사용자 데이터를 반환하면 취약. Burp Intruder 로 ID 범위 brute → 가입자 전체 데이터 추출 시나리오까지 입증 가능.

### 케이스 2: UUID / 예측 불가능한 ID 도 IDOR

**언제 쓰는지**: ID 가 UUID v4 처럼 추측 불가능해도, 응답 어딘가에서 다른 사용자 UUID 가 노출되는 경우(공개 프로필, 친구/팔로워 목록, 댓글 작성자) 그 UUID 로 시도.

```
1. /api/users/<MY_UUID>/posts 정상 호출
2. 게시글 응답에서 다른 사용자 UUID 발견:
   {"author": {"id": "550e8400-e29b-41d4-a716-446655440000", "name": "홍길동"}}
3. 그 UUID 로 시도:
   GET /api/users/550e8400-e29b-41d4-a716-446655440000/private-data
```

**판정**: UUID 라도 응답이 정상 데이터를 반환하면 IDOR. **"UUID = 안전하다는 인식이 잘못됨"** 을 입증하는 게 핵심.

### 케이스 3: URL 경로의 ID 변조
**언제 쓰는지**: `/api/users/{id}/...` 같은 RESTful 패턴. API 진단 시 우선순위 최상위.

```
GET /api/users/A_ID/profile      → A 의 프로필 (정상)
GET /api/users/B_ID/profile      → B 의 프로필이 노출되면 취약

GET /api/users/A_ID/orders       → A 의 주문 목록
GET /api/users/B_ID/orders       → B 의 주문 목록 노출 시 취약

GET /api/files/<file_id>         → 파일 다운로드 - 다른 사용자 파일 접근 시 취약
DELETE /api/posts/<post_id>      → 다른 사용자 글 삭제 가능 시 Critical
```

**판정**: 각 메서드(GET/POST/PUT/DELETE) 별로 모두 시도. 일부는 GET만 막혀있고 DELETE 는 누구나 가능한 경우 자주 발견.

### 케이스 4: 헤더 / 쿠키의 사용자 식별자 변조

**언제 쓰는지**: 인증 토큰 외에 별도 사용자 식별 헤더/쿠키가 있는 경우. 백엔드가 그 값을 그대로 신뢰하는 잘못된 패턴.

```http
GET /api/profile HTTP/1.1
Cookie: SESSION=A_session; userId=A_ID    ← userId 를 B_ID 로 변조
X-User-Id: A_ID                            ← 이 헤더를 B_ID 로 변조
```

**판정**: 변조한 식별자에 해당하는 다른 사용자 데이터가 응답되면 취약. 인증 토큰만 검증하고 사용자 식별은 별도 헤더에 의존하는 잘못된 흐름.

### 케이스 5: 수직 권한 상승 — 관리자 기능 일반 계정으로 호출

**언제 쓰는지**: 관리자 계정으로 사용 가능한 기능을 일반 계정 세션으로 직접 호출.

```http
# 일반 계정 세션 쿠키로 관리자 엔드포인트 호출
GET /admin/users HTTP/1.1
Cookie: SESSION=normal_user_session

GET /api/admin/users
POST /api/admin/users/delete
GET /api/internal/dump
GET /api/admin/audit-log
```

**판정**: 일반 계정 세션으로 응답이 정상 200 + 관리자 데이터 반환 시 Critical. 라우트 단위 권한 체크가 누락됨.

#### 기능별 권한 체크 편차 비교

같은 관리자성 기능이라도 어떤 API는 role을 확인하고, 어떤 API는 로그인 여부만 확인하는 식의 편차가 자주 나온다. 관리자 계정으로 기능을 한 번 수행해 요청을 확보한 뒤, 일반 사용자 세션으로 그대로 재전송한다.

```http
POST /api/notice/write HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded
Cookie: SESSION=<NORMAL_USER_SESSION>

type=notice&title=normal-user-test&content=created-by-normal-user
```

비교 대상도 같이 잡는다.

```http
POST /api/material/write HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<NORMAL_USER_SESSION>
```

**판정:** 공지 작성처럼 관리자 기능으로 보이는 API는 일반 사용자 세션에서 성공하고, 유사한 다른 관리자 API는 `권한이 없습니다` / 403 으로 막히면 라우트별 권한 검증 누락이 확실해진다. UI에서 버튼이 숨겨져 있는지는 판정 근거가 아니고, 서버 응답과 후속 목록 반영 여부로 판단한다.

### 케이스 6: Forced Browsing

**언제 쓰는지**: 사용자에게 노출되지 않은 숨겨진 엔드포인트/리소스 발견 목적.

**추측 가능한 경로:**

```
/admin
/admin.html
/dashboard
/manage
/internal
/api/v1/internal
/api/admin
/.git/config
/.env
/backup.zip
/backup.sql
/db_backup_2024.tar.gz
/old/
/test/
```

**robots.txt / sitemap.xml 단서:**

```
GET /robots.txt          → Disallow 항목이 숨겨진 경로 단서
GET /sitemap.xml         → 미공개 페이지 발견 가능
```

**JS 번들 분석:**

```bash
# JS 파일에서 API 엔드포인트 grep
curl https://<TARGET>/static/js/main.<hash>.js | grep -oE '"/api/[^"]+"'
```

**디렉토리 brute:**

```bash
gobuster dir -u https://<TARGET>/ -w /usr/share/wordlists/dirb/common.txt -x php,html,bak,zip
ffuf -u https://<TARGET>/FUZZ -w common.txt
```

**판정**: 위 방법으로 발견한 경로가 인증 없이 접근되거나, 일반 권한으로 접근되어 관리자 정보가 노출되면 취약.

### 케이스 7: Mass Assignment
**언제 쓰는지**: 회원가입 / 프로필 수정 / 객체 생성/수정 요청에서 클라이언트가 보내는 필드를 백엔드가 그대로 모델에 매핑하는 경우.

**시나리오 7-1 — 회원가입 시 권한 필드 주입:**

```http
POST /api/signup HTTP/1.1
Content-Type: application/json

{
  "userid": "newuser",
  "password": "Pass123!",
  "email": "test@example.com",
  "role": "admin",                ← 정상 가입 화면에는 없는 필드
  "is_admin": true,
  "permissions": ["admin:*"]
}
```

**판정**: 가입 후 해당 계정으로 로그인 시 관리자 권한이 부여되어 있으면 Critical. 백엔드가 ORM 의 mass assign(`User.create(req.body)`, `Model.objects.create(**data)`) 을 무방비로 사용한 경우.

**시나리오 7-2 — 프로필 수정 시 소유자/권한 변경:**

```http
PUT /api/profile HTTP/1.1
Content-Type: application/json
Cookie: SESSION=normal_user

{
  "name": "새이름",
  "email": "new@example.com",
  "userId": 1,                    ← 다른 사용자로 변경 시도
  "role": "admin",                ← 권한 상승 시도
  "balance": 999999               ← 잔액 변경 시도
}
```

**판정**: 응답 또는 후속 요청에서 변경된 필드가 적용되어 있으면 취약. 수정 가능한 필드(name, email) 만 화이트리스트로 처리하지 않은 경우.

### 케이스 8: HTTP Method 우회

**언제 쓰는지**: 권한 체크가 GET/POST 만 적용되고 다른 메서드에서 누락되는 케이스.

```
GET    /api/admin/users      → 401 Unauthorized
POST   /api/admin/users      → 401
PUT    /api/admin/users      → 200 ?       ← 누락된 메서드
DELETE /api/admin/users      → 200 ?
PATCH  /api/admin/users      → 200 ?
OPTIONS /api/admin/users     → CORS 응답에서 다른 메서드 정보 노출
```

**`X-HTTP-Method-Override` 헤더 활용** (일부 프레임워크에서 동작):

```http
POST /api/admin/users HTTP/1.1
X-HTTP-Method-Override: PUT     ← 차단된 PUT 을 POST 로 위장해서 우회
```

**판정**: 차단된 메서드 외에 다른 메서드가 응답하면 권한 체크가 메서드별로 일관되지 않음 = 취약.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 다른 사용자 ID 로 변조 시 **다른 사용자 데이터** 가 응답됨 (조회/변조/삭제)
- [ ] 일반 계정 세션으로 **관리자 기능** 호출 성공
- [ ] Mass Assignment 로 **권한 필드 (`role`, `is_admin`)** 변경 가능
- [ ] HTTP Method 변조 (PUT/DELETE/PATCH) 로 인증 누락 우회
- [ ] Forced Browsing 으로 인증 없이 / 일반 권한으로 **숨겨진 관리자 엔드포인트** 접근
- [ ] 클라이언트 측에서만 권한 체크 (JS hide), 서버는 누구나 응답

**오탐 주의:**

- [ ] 공개 정보 (타인 닉네임, 공개 프로필 일부) 는 의도된 노출일 수 있음 — **점검 전 정책 확인 필요**
- [ ] 응답이 200이지만 실제 데이터는 빈 배열/null — 권한 검증은 통과한 것으로 봄
- [ ] OPTIONS 응답으로 다른 메서드가 노출되는 건 정상 동작 (CORS preflight) — 실제 호출 결과로 판정

---

## 참고자료

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
- [OWASP API Security Top 10 - API1: Broken Object Level Authorization (BOLA)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP API Security Top 10 - API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [PortSwigger - Access control vulnerabilities](https://portswigger.net/web-security/access-control)
- [PortSwigger - Mass assignment](https://portswigger.net/web-security/api-testing/server-side-parameter-pollution#mass-assignment)
- [HackTricks - IDOR](https://book.hacktricks.xyz/pentesting-web/idor)
