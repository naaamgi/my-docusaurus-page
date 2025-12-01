---
sidebar_position: 1
title: Port Scanning
---

# 포트 스캐닝

## 개요

**목적**: 대상 시스템에서 열린 포트를 찾아 공격 가능한 진입점을 파악

포트 스캐닝은 모의해킹의 첫 번째 단계로, 대상 시스템에서 어떤 포트가 열려있고 어떤 서비스가 실행 중인지 파악합니다. 이를 통해 공격 벡터를 결정하고 다음 단계를 계획할 수 있습니다.

---

## 기본 스캔 유형

### ICMP (Ping) 스캔

호스트가 살아있는지 확인:

```bash
# 기본 ping
ping <target>

# 예시
ping 192.168.1.10

# 네트워크 전체 ping sweep
nmap -sn 192.168.1.0/24
```

### TCP Connect Scan

완전한 TCP 3-way handshake 수행:

```bash
# 기본 스캔 (Connect Scan)
nmap <target>

# 명시적 Connect Scan
nmap -sT <target>

# 예시
nmap -sT 192.168.1.10
```

**특징**:
- 권한 필요 없음
- 로그에 남기 쉬움
- 느림

### TCP SYN Scan (Stealth Scan)

반쯤만 연결하여 빠르고 은밀하게 스캔:

```bash
# SYN 스캔 (root 권한 필요)
sudo nmap -sS <target>

# 예시
sudo nmap -sS 192.168.1.10
```

**특징**:
- root 권한 필요
- 빠르고 효율적
- 일부 로그에 남지 않을 수 있음
- **실무 권장 방법**

**중요**: 최신 Nmap에서는 root 권한으로 실행 시 기본적으로 SYN 스캔 사용

### UDP Scan

UDP 포트 스캔:

```bash
# UDP 스캔
sudo nmap -sU <target>

# 주요 UDP 포트만 스캔
sudo nmap -sU --top-ports 100 <target>

# 예시
sudo nmap -sU -p 53,161,500 192.168.1.10
```

**특징**:
- 매우 느림
- DNS(53), SNMP(161), NTP(123) 등 확인 가능
- 타임아웃으로 인한 오탐 가능성

---

## 포트 및 대상 지정

### 포트 지정

```bash
# 특정 포트
nmap -p 80,443 <target>

# 포트 범위
nmap -p 1-1000 <target>

# 모든 포트 (1-65535)
nmap -p- <target>

# 상위 N개 포트
nmap --top-ports 100 <target>

# 열린 포트만 표시
nmap -p 80,443,8000-9000 --open <target>
```

### 대상 지정

```bash
# 단일 호스트
nmap 192.168.1.10

# 여러 호스트
nmap 192.168.1.10 192.168.1.20

# IP 범위
nmap 192.168.1.1-254

# 서브넷
nmap 192.168.1.0/24

# 파일에서 읽기
nmap -iL targets.txt
```

---

## 속도 및 성능 최적화

### 타이밍 템플릿

```bash
# T0: Paranoid (매우 느림, 은밀함)
nmap -T0 <target>

# T1: Sneaky (느림)
nmap -T1 <target>

# T2: Polite (약간 느림)
nmap -T2 <target>

# T3: Normal (기본값)
nmap -T3 <target>

# T4: Aggressive (빠름, 권장)
nmap -T4 <target>

# T5: Insane (매우 빠름, 부정확할 수 있음)
nmap -T5 <target>
```

**실무 권장**: `-T4` 사용 (빠르고 신뢰성 있음)

### 패킷 속도 제어

```bash
# 최소 패킷 전송 속도 (초당 패킷 수)
nmap --min-rate 1000 <target>

# 권장 조합 (빠른 스캔)
nmap -p- --min-rate 1000 -T4 <target>
```

### 병렬 스캔

```bash
# 동시에 스캔할 호스트 수
nmap --min-hostgroup 16 -iL targets.txt

# 호스트당 병렬 포트 스캔 수
nmap --min-parallelism 100 <target>
```

---

## 서비스 및 버전 탐지

### 서비스 버전 스캔

```bash
# 기본 버전 스캔
nmap -sV <target>

# 강도 높은 버전 스캔
nmap -sV --version-intensity 9 <target>

# 예시
nmap -p 22,80,443 -sV 192.168.1.10
```

**출력 예시**:
```
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 8.2p1 Ubuntu 4ubuntu0.5
80/tcp  open  http     Apache httpd 2.4.41
443/tcp open  ssl/http nginx 1.18.0
```

### 기본 NSE 스크립트

```bash
# 기본 스크립트 실행
nmap -sC <target>

# 서비스 스캔 + 스크립트
nmap -sV -sC <target>

# 약어
nmap -sC -sV <target>
# 또는
nmap -A <target>
```

---

## 호스트 탐지 우회

방화벽이나 필터가 있을 때 유용:

```bash
# Ping 체크 건너뛰기
nmap -Pn <target>

# DNS 역조회 비활성화
nmap -n <target>

# 권장 조합
sudo nmap -Pn -n --open -p- <target>
```

**플래그 설명**:
- `-Pn`: 호스트 살아있다고 가정하고 스캔
- `-n`: DNS 조회 안함 (속도 향상)
- `--open`: 열린 포트만 표시

---

## 결과 저장

### 모든 형식으로 저장

```bash
# Normal, Grepable, XML 한 번에
nmap -p- -oA scan_results <target>

# 결과 파일:
# - scan_results.nmap (Normal)
# - scan_results.gnmap (Grepable)
# - scan_results.xml (XML)
```

### 개별 형식

```bash
# Normal 형식 (사람이 읽기 좋음)
nmap -oN scan.txt <target>

# Grepable 형식 (파싱하기 좋음)
nmap -oG scan.gnmap <target>

# XML 형식 (다른 도구로 가져오기)
nmap -oX scan.xml <target>
```

### Grepable 형식 활용

```bash
# 열린 포트만 추출
cat scan.gnmap | grep "open" | cut -d " " -f 2 > open_hosts.txt

# 특정 포트가 열린 호스트 찾기
cat scan.gnmap | grep "80/open" | cut -d " " -f 2
```

---

## 실전 스캔 예시

### 빠른 전체 포트 스캔

```bash
# 1단계: 모든 포트 빠르게 스캔
sudo nmap -p- --min-rate 1000 -T4 -oA fast_scan <target>

# 2단계: 열린 포트만 상세 스캔
sudo nmap -p <열린포트들> -sV -sC -oA detailed_scan <target>
```

### 스텔스 스캔

```bash
# 느리지만 은밀한 스캔
sudo nmap -sS -T2 -f -D RND:10 <target>
```

**플래그**:
- `-f`: 패킷 단편화
- `-D RND:10`: 무작위 디코이 10개 사용

### 공격적 스캔

```bash
# 모든 정보 수집 (빠름)
sudo nmap -A -T4 -p- <target>
```

**-A 포함 내용**:
- OS 탐지 (-O)
- 버전 스캔 (-sV)
- 스크립트 스캔 (-sC)
- Traceroute (--traceroute)

### UDP + TCP 통합 스캔

```bash
# 주요 TCP 포트 + 상위 UDP 포트
sudo nmap -sS -sU -p T:1-1000,U:53,161,500 <target>
```

---

## 실무 팁

### Virtual Hosting 주의

동일 IP에 여러 도메인이 호스팅되는 경우:

```bash
# 도메인별로 따로 스캔
nmap example.com
nmap another-example.com

# 같은 IP여도 응답이 다를 수 있음
```

### 대규모 네트워크 스캔

많은 대상을 스캔할 때:

```bash
# 1. Masscan으로 빠르게 열린 포트 찾기
sudo masscan -p1-65535 192.168.1.0/24 --rate=1000 -oG masscan.txt

# 2. Nmap으로 상세 스캔
nmap -iL live_hosts.txt -sV -sC -oA detailed
```

### 스캔 범위 문서화

```bash
# 스캔 시작 전 기록
echo "Target: 192.168.1.0/24" > scan_log.txt
echo "Start: $(date)" >> scan_log.txt

# 스캔 실행
nmap -p- 192.168.1.0/24 -oA scan_results

# 스캔 종료 후 기록
echo "End: $(date)" >> scan_log.txt
```

---

## 주요 명령어 요약

```bash
# 기본 스캔
nmap <target>
sudo nmap -sS <target>

# 빠른 전체 포트 스캔
sudo nmap -p- --min-rate 1000 -T4 <target>

# 서비스 버전 + 스크립트
nmap -p <ports> -sV -sC <target>

# 호스트 탐지 우회
sudo nmap -Pn -n --open <target>

# 결과 저장
nmap -p- -oA scan_results <target>

# UDP 스캔
sudo nmap -sU --top-ports 100 <target>

# 공격적 스캔
sudo nmap -A -T4 -p- <target>
```

## 다음 단계

포트 스캔 완료 후:
1. **서비스 식별**: 열린 포트의 서비스 이름과 버전 확인
2. **취약점 조사**: 발견된 서비스 버전의 알려진 취약점 검색
3. **우선순위 결정**: 가장 위험하거나 공격 가능성이 높은 포트부터 공격
