---
sidebar_position: 5
---

# snmpwalk - 161/162

SNMP (Simple Network Management Protocol) 정보 수집 도구입니다.

## 기본 정보

- **포트**: 161/UDP (Agent), 162/UDP (Trap)
- **버전**: SNMPv1, SNMPv2c, SNMPv3
- **Community String**: public (기본 읽기), private (기본 쓰기)

## 기본 사용법

```bash
# 기본 (SNMPv1)
snmpwalk -c public -v1 <RHOST>

# SNMPv2c
snmpwalk -v2c -c public <RHOST>

# 전체 MIB 트리
snmpwalk -v2c -c public <RHOST> .1
```

## OID (Object Identifier)

### 시스템 정보

```bash
# 시스템 설명
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.1.1

# 시스템 이름
snmpwalk -c public -v1 <RHOST> .1.3.6.1.2.1.1.5

# 시스템 위치
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.1.6

# 시스템 연락처
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.1.4

# 시스템 가동 시간
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.1.3
```

### 네트워크 정보

```bash
# IP 주소
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.4.20.1.1

# 라우팅 테이블
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.4.21.1.1

# ARP 테이블
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.4.22.1.2

# 인터페이스
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.2.2.1.2

# TCP 연결
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.6.13.1.3
```

### 프로세스 및 서비스

```bash
# 실행 중인 프로세스
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.4.2.1.2

# 프로세스 경로
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.4.2.1.4

# 프로세스 파라미터
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.4.2.1.5

# 설치된 소프트웨어
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.6.3.1.2
```

### Windows 정보

```bash
# 사용자 목록
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.25

# 공유 폴더
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.27

# 도메인 이름
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.4.1

# 로컬 사용자 이름
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.3.1.1
```

### 확장 객체

```bash
# nsExtendObjects
snmpwalk -v2c -c public <RHOST> nsExtendObjects

# 특정 OID
snmpwalk -v2c -c public <RHOST> 1.3.6.1.4.1.8072.1.3.2
```

## Community String Brute Force

```bash
# onesixtyone
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <RHOST>

# hydra
hydra -P /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <RHOST> snmp
```

## SNMPv3

```bash
# 사용자 열거
snmpwalk -v3 -l authNoPriv -u <USERNAME> -a SHA -A <PASSWORD> <RHOST>

# 인증 + 암호화
snmpwalk -v3 -l authPriv -u <USERNAME> -a SHA -A <AUTH_PASSWORD> -x AES -X <PRIV_PASSWORD> <RHOST>
```

## snmp-check

```bash
# 자동화된 SNMP 열거
snmp-check <RHOST>
snmp-check -c public <RHOST>
```

## Nmap

```bash
# SNMP 정보 수집
nmap -sU -p 161 --script snmp-info <RHOST>

# SNMP 프로세스
nmap -sU -p 161 --script snmp-processes <RHOST>

# SNMP Windows 사용자
nmap -sU -p 161 --script snmp-win32-users <RHOST>

# SNMP 인터페이스
nmap -sU -p 161 --script snmp-interfaces <RHOST>

# 모든 SNMP 스크립트
nmap -sU -p 161 --script snmp-* <RHOST>
```

## Metasploit

```bash
use auxiliary/scanner/snmp/snmp_enum
set RHOSTS <RHOST>
set COMMUNITY public
run

# SNMP 로그인
use auxiliary/scanner/snmp/snmp_login
set RHOSTS <RHOST>
set PASS_FILE /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt
run
```

## 주요 MIB OID

| OID | 정보 |
|-----|------|
| 1.3.6.1.2.1.1.1 | 시스템 설명 |
| 1.3.6.1.2.1.1.5 | 호스트 이름 |
| 1.3.6.1.2.1.1.6 | 위치 |
| 1.3.6.1.2.1.2.2.1.2 | 인터페이스 |
| 1.3.6.1.2.1.4.20.1.1 | IP 주소 |
| 1.3.6.1.2.1.25.1.6.0 | 프로세스 수 |
| 1.3.6.1.2.1.25.4.2.1.2 | 프로세스 목록 |
| 1.3.6.1.2.1.25.6.3.1.2 | 소프트웨어 |
| 1.3.6.1.4.1.77.1.2.25 | Windows 사용자 |

## 취약점

### 기본 Community String

```bash
# public/private 테스트
snmpwalk -c public -v1 <RHOST>
snmpwalk -c private -v1 <RHOST>
```

### 정보 유출

- 시스템 정보 (OS, 버전, 호스트명)
- 네트워크 정보 (IP, 라우팅 테이블)
- 사용자 목록
- 프로세스 및 서비스
- 설치된 소프트웨어

### RCE (Remote Code Execution)

SNMPv1/v2c에서 write community가 있으면:
```bash
# NET-SNMP extend
snmpset -m +NET-SNMP-EXTEND-MIB -v2c -c private <RHOST> 'nsExtendStatus."command"' = createAndGo 'nsExtendCommand."command"' = /bin/echo 'nsExtendArgs."command"' = 'hello world'
```

## 참고

- 기본 Community String (public/private) 사용 시 취약
- UDP 프로토콜이므로 스캔이 느릴 수 있음
- SNMPv3는 인증 및 암호화 지원
- 방화벽에서 차단 권장
- Community String을 강력하게 설정
