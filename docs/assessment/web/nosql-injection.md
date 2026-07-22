---
sidebar_position: 22
title: NoSQL Injection
description: NoSQL 쿼리의 연산자 및 구문 주입을 확인하는 실무 진단 절차와 판정 기준
keywords: [NoSQL Injection, MongoDB, Operator Injection, Syntax Injection, $ne, $regex, $where, Authentication Bypass]
draft: false
---

## 점검 목적

서버가 문자열이나 숫자를 받아야 할 위치에 클라이언트가 만든 객체·연산자·쿼리 구문을 그대로 넣을 수 있는지 확인한다. 이 경우 로그인 조건이 달라지거나, 허용 범위를 벗어난 데이터가 조회될 수 있다.

NoSQL은 하나의 공통 쿼리 언어가 아니다. 아래 페이로드는 웹 진단에서 자주 만나는 **MongoDB 계열 쿼리 형식**을 중심으로 설명한다. 다른 제품은 오류 메시지와 서버 구현을 확인한 뒤 해당 제품의 문법으로 바꿔야 한다. SQL 문법이 의심되면 [SQL Injection](./sql-injection.md)을 별도로 확인한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 연산자 객체 주입 | 문자열 대신 `{"$ne":"x"}` 같은 객체가 쿼리 조건으로 해석됨 | 참·거짓 비교로 실제 조건이 달라지는지 확인 |
| 구문 주입 | 입력값이 문자열 결합으로 JavaScript식 또는 제품별 쿼리식에 들어감 | 따옴표 오류만으로 확정하지 않고 조건식 차이를 재현 |
| 입력 형태 변환 | `field[$ne]=x`가 서버 파서에서 중첩 객체로 변환됨 | JSON과 폼 요청을 각각 보내 취약한 처리 경로를 구분 |
| 블라인드 조건 확인 | 결과 내용 대신 로그인 성공·검색 건수 같은 차이로 조건을 판별함 | 통제된 값으로 최소한의 참·거짓 신호만 확인 |
| 파이프라인 주입 | 클라이언트가 집계 단계 배열이나 단계 이름까지 제어함 | 단순 `$match` 값 제어와 전체 단계 제어를 구분 |

## 진단 절차

#### Step 1. 정상 요청과 실패 기준 기록

- 로그인은 허가받은 테스트 계정의 정상 로그인과 틀린 비밀번호 요청을 각각 저장한다.
- 검색은 결과가 있는 값과 절대 일치하지 않을 값을 각각 저장한다.
- 상태 코드뿐 아니라 세션 발급, 사용자 식별자, 결과 건수, 본문 길이도 함께 비교한다.

#### Step 2. 입력 위치와 형식 확인

- 로그인, 검색·필터, 사용자 조회, 비밀번호 재설정 토큰 검증을 우선 확인한다.
- `application/json`, `application/x-www-form-urlencoded`, URL 쿼리처럼 실제로 지원하는 형식을 구분한다.
- JavaScript 요청 코드나 API 명세에서 문자열·객체·배열 중 원래 기대하는 자료형을 확인한다.
- `_id`나 `ObjectId`는 MongoDB의 단서일 수 있지만, 이것만으로 제품을 확정하지 않는다.

#### Step 3. 문자열을 객체로 바꿔 비교

- 한 번에 한 필드만 `{"$ne":"__NO_MATCH__"}` 같은 객체로 바꾼다.
- 같은 위치에 참이 되는 조건과 거짓이 되는 조건을 보내 응답 차이가 반복되는지 확인한다.
- 객체가 단순 문자열로 변환되거나 검증 단계에서 거절되면 그 결과도 기록한다.

#### Step 4. 파서와 쿼리 처리 경로 구분

- JSON 객체는 거절되지만 `field[$ne]=x`가 동작하면 폼·쿼리 파서의 중첩 객체 변환을 확인한다.
- `unknown operator` 같은 오류는 입력이 쿼리 계층에 도달했다는 단서일 뿐, 우회가 재현되지 않으면 취약으로 확정하지 않는다.
- 제품과 문법이 확인된 뒤에만 `$regex`, `$where` 같은 제품별 연산자를 사용한다.

#### Step 5. 제한된 영향 확인

- 로그인은 테스트 계정으로만 세션이 발급되는지 확인한다.
- 검색은 허용 범위를 벗어난 테스트 레코드 1건 또는 결과 건수 차이까지만 확인한다.
- 전체 계정 선택, 비밀번호·토큰 원문 추출, 대량 조회는 기본 검증에서 제외한다.

### 상황별 빠른 선택

| 관찰한 상황 | 먼저 확인할 항목 |
| :--- | :--- |
| JSON 로그인 API | 비밀번호 문자열을 `$ne` 객체로 바꾼 참·거짓 요청 |
| URL 또는 폼 로그인 | `password[$ne]`가 중첩 객체로 변환되는지 |
| 검색·필터 API | 존재하지 않는 값과 `$ne` 조건의 결과 건수 차이 |
| 따옴표에서만 오류 발생 | 유효한 참·거짓 구문 쌍으로 구문 주입 여부 확인 |
| 필터 배열을 그대로 받음 | 값 제어인지 전체 파이프라인 단계 제어인지 구분 |

## 페이로드 노트

### 1. 검색 조건의 객체 해석 확인

**언제 사용하는가**: 로그인보다 영향이 낮은 검색·필터 API에서 JSON 객체가 쿼리 연산자로 해석되는지 먼저 확인할 때 사용한다.

```json
{"category":"__NO_MATCH__"}
```

```json
{"category":{"$ne":"__NO_MATCH__"}}
```

두 번째 요청에서 결과가 달라져도 API가 원래 고급 필터 연산자를 허용하는 기능일 수 있다. 현재 사용자가 볼 수 없는 레코드까지 반환되는지, 서버가 허용한 연산자 목록이 있는지를 함께 확인한다.

### 2. 테스트 계정 로그인 조건 확인

**언제 사용하는가**: MongoDB 계열 쿼리가 의심되고, 로그인 본문이 JSON 객체인 경우 사용한다. 계정은 진단용으로 허가받은 값을 고정한다.

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"username":"<TEST_USER>","password":"__INVALID__"}
```

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"username":"<TEST_USER>","password":{"$ne":"__INVALID__"}}
```

두 번째 요청으로 테스트 계정 세션이 발급되면 연산자 객체가 비밀번호 일치 조건을 바꾼 것이다. `200 OK`만 보지 말고 응답의 사용자 식별자와 실제 인증 상태를 확인한다.

### 3. URL·폼 파서의 중첩 객체 변환 확인

**언제 사용하는가**: JSON 객체는 차단되지만 URL 쿼리나 폼 요청을 받는 경우 사용한다.

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=<TEST_USER>&password%5B%24ne%5D=__INVALID__
```

디코딩하면 `password[$ne]=__INVALID__`이다. Express를 포함한 일부 프레임워크는 설정에 따라 대괄호 표기를 중첩 객체로 바꾼다. Express의 모든 요청이 기본적으로 이렇게 처리된다고 가정하지 말고, 사용 중인 쿼리 파서와 `urlencoded`의 `extended` 설정을 확인한다.

### 4. 정규식의 참·거짓 신호 확인

**언제 사용하는가**: `$ne`가 차단되거나, 응답에 데이터가 직접 보이지 않아도 조건 결과가 달라지는지 확인할 때 사용한다.

```json
{"username":"<TEST_USER>","displayName":{"$regex":"^Test"}}
```

```json
{"username":"<TEST_USER>","displayName":{"$regex":"^__NO_MATCH__"}}
```

알고 있는 테스트 데이터로 두 요청의 차이만 확인한다. 비밀번호나 토큰을 한 글자씩 끝까지 추출하는 자동화는 기본 검증에 포함하지 않는다. 복잡하거나 반복이 많은 정규식은 데이터베이스 부하를 유발할 수 있으므로 피한다.

### 5. 문자열 결합 구문의 조건식 확인

**언제 사용하는가**: 따옴표에서 오류가 나고, 서버가 입력을 JavaScript식 또는 제품별 문자열 쿼리에 이어 붙이는 정황이 있을 때 사용한다.

```text
<KNOWN_VALUE>' && '1'=='1
<KNOWN_VALUE>' && '1'=='2
```

참 조건은 정상 요청과 같고 거짓 조건만 결과가 사라지는 패턴이 반복되면 입력이 쿼리 구문으로 해석된 것이다. 따옴표 하나로 500 오류가 발생한 사실만으로는 구문 주입을 확정하지 않는다. 이 예시는 MongoDB의 JavaScript식 문자열 결합이 확인된 문맥에서만 사용한다.

### 6. `$where` 평가 여부 확인

**언제 사용하는가**: 요청 객체의 최상위 쿼리 조건을 제어할 수 있고, MongoDB의 서버 측 JavaScript 기능을 사용한다는 근거가 있을 때만 사용한다.

```json
{"username":"<TEST_USER>","$where":"function(){ return true; }"}
```

```json
{"username":"<TEST_USER>","$where":"function(){ return false; }"}
```

두 요청의 차이가 반복되면 `$where` 표현식이 평가되는지 추가 확인한다. `$where`는 중첩 필드 안에 넣는 연산자가 아니며, 그 자체가 운영체제 명령 실행을 뜻하지 않는다. MongoDB 8.0부터 `$where`, `$function`, `$accumulator` 같은 서버 측 JavaScript 기능은 폐기 예정(deprecated) 상태다.

응답 차이가 없는 환경에서 시간 지연 검증이 꼭 필요하다면 먼저 여러 차례 기준 시간을 측정하고 스코프를 확인한다. 기본 페이로드에는 긴 지연이나 반복 호출을 넣지 않는다.

### 7. 집계 파이프라인 제어 범위 확인

**언제 사용하는가**: 클라이언트가 `pipeline` 배열이나 집계 단계 객체를 직접 보내는 API에서 사용한다.

```json
{
  "pipeline": [
    {"$match":{"ownerId":"<TEST_OWNER_ID>"}},
    {"$limit":1}
  ]
}
```

`filter` 객체가 서버에서 고정된 `$match` 단계의 값으로만 들어가는 경우, 그 안에 `$lookup`이나 `$out`을 중첩해도 새 집계 단계가 되지 않는다. 전체 단계 배열을 제어할 수 있다는 사실을 먼저 확인하고, 영향 검증은 테스트 컬렉션과 읽기 범위 안에서 제한한다.

### 8. 자동화 도구는 수동 재현 뒤 사용

**언제 사용하는가**: 수동 요청으로 취약한 입력 위치와 참·거짓 판정 기준을 확정한 뒤, 허가된 범위를 반복 점검할 때 사용한다.

```bash
python nosqlmap.py
```

NoSQLMap이나 Burp Intruder 결과는 도구 출력만으로 판정하지 않는다. 동일한 요청을 수동으로 다시 보내 세션, 데이터 범위, 응답 차이를 확인한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| JSON 객체가 자료형 오류로 거절됨 | URL·폼 요청에서 중첩 객체 변환 확인 | 해당 JSON 경로는 방어됨 |
| 객체가 `[object Object]` 같은 문자열로 처리됨 | 정상·거짓 조건과 응답 비교 | 쿼리 연산자로 해석되지 않으면 취약 아님 |
| `unknown operator` 오류가 발생함 | 허용 연산자와 참·거짓 조건 비교 | 쿼리 계층 도달 단서, 오류만으로 확정 불가 |
| 상태 코드는 모두 `200`임 | 세션 쿠키, 사용자 ID, 결과 건수 비교 | 상태 코드만으로 인증 우회 판정 금지 |
| `$ne`는 차단되고 `$regex`는 허용됨 | 테스트 데이터의 단순 접두어 두 개 비교 | 블라인드 조건 신호가 있으면 후보 |
| `$` 문자가 차단됨 | 실제 디코딩 경로에 맞춘 URL 인코딩 확인 | 관찰한 파서 경로만 제한적으로 검증 |
| 필터 연산자가 제품 기능으로 제공됨 | 사용자·조직 경계를 넘는 데이터가 나오는지 확인 | 허용 범위 안이면 취약 아님 |
| 응답 시간이 한 번만 느려짐 | 정상 요청을 여러 번 반복해 기준선 비교 | 단발성 지연은 근거 부족 |

## 취약 판정

### 확정

- 테스트 계정의 틀린 비밀번호를 연산자 객체로 바꿨을 때 해당 계정 세션이 발급된다.
- 참·거짓 연산자 또는 구문 쌍에 따라 서버 쿼리 결과가 반복해서 달라지고, 사용자가 볼 수 없는 테스트 데이터가 반환된다.
- 클라이언트가 전체 집계 단계를 제어하여 원래 허용되지 않은 컬렉션이나 사용자 범위의 데이터를 읽거나 변경할 수 있다.

### 후보

- 객체가 서버까지 전달되지만 문자열로 변환되거나 무시된다.
- 따옴표, `$` 키, 알 수 없는 연산자에서 오류만 발생한다.
- 정규식 조건의 응답 차이가 없거나 네트워크 상태에 따라 결과가 달라진다.
- 고급 필터 문법이 명시된 기능이며 결과도 현재 사용자의 권한 범위에 머문다.

### 영향 상승

- 다른 사용자 또는 조직의 데이터가 조회된다.
- 인증 우회 뒤 발급된 세션으로 보호 기능을 사용할 수 있다.
- 읽기뿐 아니라 테스트 데이터의 변경이 재현된다.
- 제한된 참·거짓 신호만으로도 민감 필드의 존재 여부를 구분할 수 있다.

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Testing for NoSQL Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection)
- [PortSwigger Web Security Academy - NoSQL injection](https://portswigger.net/web-security/nosql-injection)
- [MongoDB - Query and Projection Operators](https://www.mongodb.com/docs/manual/reference/operator/query/)
- [MongoDB - `$where` query operator](https://www.mongodb.com/docs/manual/reference/operator/query/where/)
- [Express - `express.urlencoded()`](https://expressjs.com/en/5x/api.html#express.urlencoded)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - NoSQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/NoSQL%20Injection)
- [HackTricks - NoSQL Injection](https://book.hacktricks.wiki/en/pentesting-web/nosql-injection.html)
- [NoSQLMap](https://github.com/codingo/NoSQLMap)
