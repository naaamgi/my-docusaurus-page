---
sidebar_position: 1
title: Nmap & Service Scanning
---

# Nmap & Service Scanning

## Overview

**Nmap (Network Mapper)**: 호스트 탐지, 포트 스캔, 서비스 식별, 운영체제 탐지 등을 수행하는 핵심 정보 수집 도구
- **목적**: 열린 포트(공격 진입점)를 식별하고, 실행 중인 서비스 종류와 버전을 파악하여 취약점 공격(Exploit)을 위한 사전 정보 수집

---

## 1. Host Discovery

방화벽 우회 및 살아있는(Live) 호스트 식별을 위한 Ping 스캔
```bash
# 기본 Ping 스캔 (ICMP) 및 ARP 스캔(로컬망)
nmap -sn 192.168.1.0/24
nmap -PR 192.168.1.0/24

# Host 탐지 방화벽 우회 (Ping 생략) - 실무 권장
nmap -Pn 192.168.1.10

# TCP SYN / ACK / UDP Ping
nmap -PS 192.168.1.10
nmap -PA 192.168.1.10
nmap -PU 192.168.1.10
```

---

## 2. Port Scanning

### 기본 스캔 유형
```bash
# TCP SYN 스캔 (Stealth Scan) - root 권한 필요, 빠르고 은밀함 (실무 권장)
sudo nmap -sS <target>

# TCP Connect 스캔 - 완전한 Handshake (로그에 남음)
nmap -sT <target>

# UDP 스캔 - 느림, DNS/SNMP 등 확인용
sudo nmap -sU --top-ports 100 <target>
```

### 포트 지정
```bash
nmap -p 80,443 <target>         # 특정 포트 지정
nmap -p 1-1000 <target>         # 범위 지정
nmap -p- <target>               # 전체 포트(1-65535) 스캔
nmap --top-ports 100 <target>   # 상위 N개 포트 스캔
```

---

## 3. Service & OS Detection

열린 포트에서 동작 중인 데몬의 배너 및 버전을 식별하여 공격 벡터 파악
```bash
# 서비스 및 버전 스캔
nmap -sV <target>

# 강도 높은 버전 탐지 (0~9)
nmap -sV --version-intensity 9 <target>

# OS 운영체제 탐지
sudo nmap -O <target>

# 공격적인 통합 스캔 (OS, 버전, 기본 스크립트, Traceroute)
sudo nmap -A <target>
```

---

## 4. Nmap Scripting Engine (NSE)

Nmap 내장 스크립트(`/usr/share/nmap/scripts/`)를 이용한 취약점 스캔 및 자동 정보 수집
```bash
# 기본(Default) 범주 스크립트 및 버전 스캔 통합 실행
nmap -sC -sV <target>

# 특정 카테고리 또는 스크립트 지정
nmap --script vuln <target>
nmap --script "http-*" <target>
nmap --script smb-enum-shares,smb-os-discovery <target>

# 로컬 환경 내 스크립트 검색 방법
ls -lh /usr/share/nmap/scripts/ | grep ssh
nmap --script-help "smb*"
```

---

## 5. Advanced Techniques

### 방화벽 우회 (Firewall Evasion) 및 성능 최적화
```bash
# 패킷 단편화 및 MTU 설정
sudo nmap -f <target>
sudo nmap --mtu 24 <target>

# Decoy (미끼) IP 스푸핑 
sudo nmap -D RND:10 <target>
sudo nmap -D 192.168.1.5,192.168.1.6,ME <target>

# 패킷 전송 속도 최적화 (T4 권장, 최소 패킷 속도 보장)
nmap -T4 --min-rate 1000 <target>
```

### 실전 빠른 스캔 워크플로우
```bash
# 1. 대상 전체 포트 빠른 식별 (포트만 찾기)
sudo nmap -p- --min-rate 10000 -Pn -n -T4 <target> -oG initial_ports.txt

# 2. 식별된 포트 대상으로 정밀 스캔 (버전/스크립트)
sudo nmap -p 22,80,443 -sC -sV -Pn <target> -oA detailed_scan
```

### 결과 저장 (Output Formats)
```bash
# Normal(텍스트), XML, Grepable 형식 모두 저장
nmap -p- <target> -oA scan_results

# Grepable 파일 파싱 예시 (열린 포트만 추출)
cat scan_results.gnmap | grep "open" | cut -d " " -f 2
```
