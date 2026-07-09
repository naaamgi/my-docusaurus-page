---
sidebar_position: 4
title: NetBIOS (137/138/139)
---

# NetBIOS (137/138/139) 취약점 진단

## Overview

**NetBIOS (Network Basic Input/Output System)**: LAN 내에서 컴퓨터들이 통신하기 위해 사용되는 레거시 API 및 프로토콜

**주요 포트**:
- **137/UDP**: Name Service (이름 등록 및 해상도)
- **138/UDP**: Datagram Service (비연결형 통신)
- **139/TCP**: Session Service (연결형 통신, SMB over NetBIOS)

---

## 1. Reconnaissance

### 기본 호스트 및 네임 조회
```bash
# [nbtscan] 서브넷 내 NetBIOS 호스트 및 MAC 주소 스캔
nbtscan 192.168.1.0/24
nbtscan -v <target>

# [nmblookup] 특정 호스트의 NetBIOS 이름, 워크그룹, 마스터 브라우저 상태 조회
nmblookup -A <target>
nmblookup -M -- -
```

### Nmap 정보 수집
```bash
# 기본 포트 스캔 및 버전 확인
nmap -sV -p 137,139 <target>

# NetBIOS 특정 스크립트 실행
nmap -sU -p 137 --script nbstat <target>
nmap -p 139 --script nbstat,smb-os-discovery <target>
```

---

## 2. Exploitation

### Enum4linux를 이용한 시스템 열거
Null Session 취약점을 활용하여 대상 윈도우 시스템의 각종 정보 덤프
```bash
# 전체 정보 자동 수집 (OS, 사용자, 그룹, 공유 폴더, 패스워드 정책 등)
enum4linux -a <target>

# 특정 정보만 수집
enum4linux -U <target>  # 사용자 목록 열거
enum4linux -S <target>  # 공유 폴더 열거
enum4linux -G <target>  # 그룹 정보 열거
```

### rpcclient를 활용한 정밀 분석
인증 없이(Null Session) RPC 파이프에 연결하여 내부 정보 쿼리
```bash
# Null Session 연결
rpcclient -U "" -N <target>

# [연결 후] 세부 명령어 실행
rpcclient $> enumdomusers     # 도메인 사용자 열거
rpcclient $> enumdomgroups    # 도메인 그룹 열거
rpcclient $> queryuser <RID>  # 특정 사용자 상세 정보 쿼리
```

### 공유 폴더(SMB) 익명 접근
NetBIOS Session Service(139)를 통해 연결되는 공유 자원 탐색
```bash
# 익명(Null Session)으로 공유 목록 조회
smbclient -L //<target>/ -N

# 특정 공유 폴더 익명 접속 시도
smbclient //<target>/IPC$ -N
```

---

## 3. Advanced Techniques

### NetBIOS Name Suffix 코드 식별
`nmblookup` 결과에서 나타나는 Suffix 코드를 통한 대상 서버 역할 식별
- `<00> (U)`: 일반 Workstation Service
- `<03> (U)`: Messenger Service (일반 사용자)
- `<1B> (U)`: Domain Master Browser (PDC 역할)
- `<1C> (G)`: Domain Controllers (도메인 컨트롤러 그룹)
- `<1D> (U)`: Local Master Browser (서브넷 내 브라우저 선출)
- `<20> (U)`: File Server Service (파일 공유 서비스 활성화)
※ U(Unique)는 단일 호스트, G(Group)는 다중 호스트 의미

---

## 4. Post-Exploitation

### 주요 유출 정보 활용
Null Session 공격이나 NetBIOS 열거를 통해 수집한 정보는 다음 공격에 활용
- **사용자 목록**: 브루트포스(Brute-Force) 공격 및 패스워드 스프레이 대상 확보
- **OS/도메인 정보**: 타겟 네트워크의 도메인 컨트롤러 및 아키텍처 파악
- **공유 폴더**: IPC$ 이외에 읽기/쓰기 권한이 부여된 민감 데이터 폴더 탐색
