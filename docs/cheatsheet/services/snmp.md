---
sidebar_position: 5
---

# SNMP - 161/162

## 기본 정보

**포트**: 161 (UDP)

SNMP(Simple Network Management Protocol)는 네트워크 장비를 모니터링하고 관리하는 프로토콜입니다.

## snmpwalk

```bash
# 기본 스캔 (v1, community string: public)
snmpwalk -c public -v1 <RHOST>

# 전체 MIB 트리 조회 (v2c)
snmpwalk -v2c -c public <RHOST> .1

# 특정 OID 조회
snmpwalk -v2c -c public <RHOST> 1.3.6.1.2.1.4.34.1.3

# nsExtendObjects 확인 (RCE 가능)
snmpwalk -v2c -c public <RHOST> nsExtendObjects
```

## 주요 OID

```bash
# 사용자 계정 (Windows)
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.25

# 실행 중인 프로세스
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.4.2.1.2

# 호스트 이름
snmpwalk -c public -v1 <RHOST> .1.3.6.1.2.1.1.5

# 도메인 이름 (Windows)
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.3.1.1

# 공유 (Windows)
snmpwalk -c public -v1 <RHOST> 1.3.6.1.4.1.77.1.2.27

# TCP 로컬 포트
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.6.13.1.3

# 설치된 소프트웨어
snmpwalk -c public -v1 <RHOST> 1.3.6.1.2.1.25.6.3.1.2
```

## Nmap

```bash
# SNMP 스캔
sudo nmap -sU -p161 <RHOST>

# SNMP 정보 수집
sudo nmap -sU -p161 --script snmp-info <RHOST>

# SNMP 브루트포스
sudo nmap -sU -p161 --script snmp-brute <RHOST>

# SNMP 모든 스크립트
sudo nmap -sU -p161 --script snmp-* <RHOST>
```

## onesixtyone

```bash
# Community string 브루트포스
onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <RHOST>
```

## snmp-check

```bash
# SNMP 열거
snmp-check <RHOST>
snmp-check <RHOST> -c public
```

## 일반적인 Community Strings

```bash
public
private
manager
cisco
admin
```

## 참고

- SNMP v1/v2c는 암호화되지 않음 (community string 평문 전송)
- SNMP v3는 인증 및 암호화 지원
- nsExtendObjects를 통한 RCE 가능
- Community string 브루트포스 시도
