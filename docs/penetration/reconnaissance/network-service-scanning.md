---
sidebar_position: 2
title: Network Service Scanning
---

# 네트워크 서비스 스캐닝

## 개요

**목적**: 열린 포트에서 실행 중인 서비스의 종류와 버전을 파악

포트 스캔으로 열린 포트를 찾았다면, 다음 단계는 해당 포트에서 실행 중인 **서비스 식별**입니다. 서비스의 이름과 버전을 알아야 관련 취약점을 찾고 적절한 공격 기법을 적용할 수 있습니다.

## 서비스 스캐닝 기법

### Banner Grabbing
서비스가 연결 시 반환하는 배너 정보를 확인

### Service Fingerprinting
서비스 응답 패턴을 분석하여 서비스 식별

### Enumeration
서비스의 상세 정보를 수집 (사용자, 공유 폴더, 설정 등)

---

## 서비스 식별 방법

### Nmap 서비스 버전 스캔

**기본 명령어:**
```bash
nmap -p <port> -sV <target>

# 예시: 웹 서버 식별
nmap -p 80,443 -sV 192.168.1.10

# 기본 스크립트 + 버전 스캔
nmap -p 22,80,445 -sV -sC 192.168.1.10
```

**주요 플래그:**
- `-sV`: 서비스 버전 탐지
- `-sC`: 기본 NSE 스크립트 실행
- `--version-intensity <0-9>`: 탐지 강도 (기본값: 7)

**출력 예시:**
```
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 8.2p1 Ubuntu 4ubuntu0.5
80/tcp  open  http     Apache httpd 2.4.41
445/tcp open  smb      Samba smbd 4.13.17
```

### Netcat으로 Banner Grabbing

수동으로 서비스에 연결하여 배너 확인:

```bash
# 기본 연결
nc <target> <port>

# HTTP 서버 배너 확인
nc 192.168.1.10 80
HEAD / HTTP/1.0

# 응답 예시:
# HTTP/1.1 200 OK
# Server: Apache/2.4.41 (Ubuntu)
```

**다른 서비스 예시:**
```bash
# FTP (포트 21)
nc 192.168.1.10 21
# 220 (vsFTPd 3.0.3)

# SSH (포트 22)
nc 192.168.1.10 22
# SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5

# SMTP (포트 25)
nc 192.168.1.10 25
# 220 mail.example.com ESMTP Postfix
```

### 서비스별 클라이언트 도구

각 서비스의 전용 클라이언트로 연결하여 상세 정보 확인:

**FTP (포트 21):**
```bash
ftp 192.168.1.10
# 익명 로그인 시도
Name: anonymous
Password: (아무거나)
```

**SSH (포트 22):**
```bash
ssh 192.168.1.10
# 지원하는 인증 방법 확인
ssh -v 192.168.1.10
```

**MySQL (포트 3306):**
```bash
mysql -h 192.168.1.10 -u root -p
# 버전 확인
SELECT VERSION();
```

**SMB (포트 445):**
```bash
# CrackMapExec
nxc smb 192.168.1.10

# Enum4linux
enum4linux -a 192.168.1.10

# Smbclient
smbclient -L //192.168.1.10 -N
```

**HTTP/HTTPS (포트 80/443):**
```bash
# cURL로 헤더 확인
curl -I http://192.168.1.10

# 응답:
# Server: nginx/1.18.0
# X-Powered-By: PHP/7.4.3
```

---

## Nmap NSE 스크립트 활용

**NSE (Nmap Scripting Engine)**: 서비스별 상세 정보 수집 및 취약점 스캔

### 스크립트 위치
```bash
/usr/share/nmap/scripts/
```

### 기본 사용법

```bash
# 특정 스크립트 실행
nmap -p <port> --script <script-name> <target>

# 카테고리별 실행
nmap -p <port> --script "vuln" <target>

# 여러 스크립트 실행
nmap -p <port> --script "ssh-*" <target>
```

### 주요 NSE 스크립트 예시

**SSH 서비스:**
```bash
# 지원하는 인증 방법 확인
nmap -p 22 --script ssh-auth-methods 192.168.1.10

# 약한 키 탐지
nmap -p 22 --script ssh-hostkey 192.168.1.10
```

**HTTP/HTTPS 서비스:**
```bash
# 디렉토리 열거
nmap -p 80 --script http-enum 192.168.1.10

# HTTP 메소드 확인
nmap -p 80 --script http-methods 192.168.1.10

# WordPress 정보 수집
nmap -p 80 --script http-wordpress-enum 192.168.1.10
```

**SMB 서비스:**
```bash
# SMB 버전 및 OS 확인
nmap -p 445 --script smb-os-discovery 192.168.1.10

# SMB 취약점 스캔
nmap -p 445 --script smb-vuln* 192.168.1.10

# 공유 폴더 열거
nmap -p 445 --script smb-enum-shares 192.168.1.10
```

**MySQL 서비스:**
```bash
# MySQL 정보 수집
nmap -p 3306 --script mysql-info 192.168.1.10

# 빈 비밀번호 확인
nmap -p 3306 --script mysql-empty-password 192.168.1.10
```

### NSE 스크립트 검색

```bash
# 로컬에서 스크립트 검색
ls /usr/share/nmap/scripts/ | grep ssh
ls /usr/share/nmap/scripts/ | grep http

# Nmap 내장 검색
nmap --script-help "ssh*"

# 온라인 검색
# https://nmap.org/nsedoc/
```

### 커스텀 스크립트 추가

GitHub 등에서 추가 NSE 스크립트를 다운로드하여 사용:

```bash
# 1. 스크립트 다운로드
cd /usr/share/nmap/scripts/
sudo wget https://raw.githubusercontent.com/.../custom-script.nse

# 2. 데이터베이스 업데이트
sudo nmap --script-updatedb

# 3. 사용
nmap -p 80 --script custom-script 192.168.1.10
```

---

## 실전 워크플로우

### 단계별 서비스 스캐닝

```bash
# 1. 포트 스캔으로 열린 포트 확인
nmap -p- --min-rate 1000 192.168.1.10

# 2. 서비스 버전 스캔
nmap -p 22,80,445 -sV 192.168.1.10

# 3. NSE 스크립트로 상세 정보 수집
nmap -p 22,80,445 -sC 192.168.1.10

# 4. 서비스별 전용 도구 사용
enum4linux -a 192.168.1.10  # SMB
whatweb http://192.168.1.10  # HTTP
```

### 정보 수집 결과 기록

발견한 정보를 체계적으로 정리:

```markdown
## 192.168.1.10 서비스 정보

### SSH (22/tcp)
- 버전: OpenSSH 8.2p1 Ubuntu
- 인증 방법: password, publickey
- 배너: SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5

### HTTP (80/tcp)
- 웹 서버: Apache/2.4.41
- 백엔드: PHP/7.4.3
- CMS: WordPress 5.8

### SMB (445/tcp)
- Samba 4.13.17
- 공유 폴더: Public (읽기 가능)
- 운영체제: Ubuntu 20.04
```

---

## 주요 명령어 요약

```bash
# Nmap 서비스 스캔
nmap -p <port> -sV -sC <target>

# Netcat Banner Grabbing
nc <target> <port>

# NSE 스크립트
nmap -p <port> --script <script> <target>

# 서비스별 클라이언트
ftp <target>
ssh <target>
mysql -h <target> -u root -p
nxc smb <target>
enum4linux -a <target>

# NSE 스크립트 검색
ls /usr/share/nmap/scripts/ | grep <service>
nmap --script-help "<service>*"
```

## 다음 단계

서비스 식별이 완료되면:
1. **취약점 진단**: 발견된 서비스 버전의 알려진 취약점 검색
2. **공격 벡터 분석**: 각 서비스별 가능한 공격 기법 파악
3. **우선순위 결정**: 가장 취약하거나 중요한 서비스부터 공격
