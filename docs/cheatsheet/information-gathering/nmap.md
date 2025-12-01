---
sidebar_position: 1
---

# Nmap

## 기본 스캔

```bash
# 빠른 포트 스캔 (모든 포트)
sudo nmap -p- <RHOST> --min-rate 10000 -vvv

# 서비스 및 버전 탐지
sudo nmap -sC -sV -p- <RHOST>

# UDP 스캔
sudo nmap -sV -sU <RHOST>

# 취약점 스캔
sudo nmap -sC -sV --script vuln <RHOST>

# 상위 포트 스캔
sudo nmap --top-ports 1000 <RHOST>
```

## 스캔 타입

```bash
# TCP SYN 스캔 (스텔스)
sudo nmap -sS <RHOST>

# TCP Connect 스캔
nmap -sT <RHOST>

# UDP 스캔
sudo nmap -sU <RHOST>

# TCP ACK 스캔 (방화벽 탐지)
sudo nmap -sA <RHOST>

# TCP Window 스캔
sudo nmap -sW <RHOST>

# NULL 스캔
sudo nmap -sN <RHOST>

# FIN 스캔
sudo nmap -sF <RHOST>

# Xmas 스캔
sudo nmap -sX <RHOST>
```

## 호스트 탐지

```bash
# Ping 스캔
sudo nmap -sn <RHOST>

# ICMP 없이 스캔
sudo nmap -Pn <RHOST>

# ARP 스캔 (로컬 네트워크)
sudo nmap -PR <RHOST>

# TCP SYN Ping
sudo nmap -PS <RHOST>

# TCP ACK Ping
sudo nmap -PA <RHOST>

# UDP Ping
sudo nmap -PU <RHOST>
```

## 서비스 탐지

```bash
# 버전 탐지
sudo nmap -sV <RHOST>

# 강도 높은 버전 탐지
sudo nmap -sV --version-intensity 9 <RHOST>

# OS 탐지
sudo nmap -O <RHOST>

# 공격적인 스캔 (OS, 버전, 스크립트, traceroute)
sudo nmap -A <RHOST>
```

## NSE 스크립트

```bash
# 기본 스크립트 실행
sudo nmap -sC <RHOST>

# 특정 스크립트 실행
sudo nmap --script <SCRIPT_NAME> <RHOST>

# 여러 스크립트 실행
sudo nmap --script "http-*" <RHOST>

# 취약점 스크립트
sudo nmap --script vuln <RHOST>

# Kerberos 사용자 열거
sudo nmap -p 88 --script krb5-enum-users --script-args krb5-enum-users.realm='<DOMAIN>' <RHOST>

# SMB 스크립트
sudo nmap --script smb-enum-shares,smb-enum-users <RHOST>

# SSH 스크립트 찾기
ls -lh /usr/share/nmap/scripts/*ssh*

# SMB 스크립트 찾기
locate -r '\.nse$' | xargs grep categories | grep 'default\|version\|safe' | grep smb
```

## 포트 지정

```bash
# 특정 포트
sudo nmap -p 80 <RHOST>

# 여러 포트
sudo nmap -p 80,443,8080 <RHOST>

# 포트 범위
sudo nmap -p 1-1000 <RHOST>

# 모든 포트
sudo nmap -p- <RHOST>

# 상위 N개 포트
sudo nmap --top-ports 100 <RHOST>
```

## 출력 형식

```bash
# 일반 출력
sudo nmap <RHOST> -oN output.txt

# XML 출력
sudo nmap <RHOST> -oX output.xml

# Grepable 출력
sudo nmap <RHOST> -oG output.txt

# 모든 형식 출력
sudo nmap <RHOST> -oA output
```

## 타이밍 및 성능

```bash
# 타이밍 템플릿 (0-5, 빠를수록 큰 숫자)
sudo nmap -T4 <RHOST>

# 최소 전송 속도
sudo nmap --min-rate 10000 <RHOST>

# 최대 전송 속도
sudo nmap --max-rate 50000 <RHOST>

# 병렬 호스트 수
sudo nmap --min-hostgroup 256 <RHOST>
```

## 방화벽 우회

```bash
# 패킷 단편화
sudo nmap -f <RHOST>

# MTU 설정
sudo nmap --mtu 24 <RHOST>

# Decoy 스캔
sudo nmap -D RND:10 <RHOST>
sudo nmap -D decoy1,decoy2,ME <RHOST>

# 소스 포트 지정
sudo nmap --source-port 53 <RHOST>

# Data Length
sudo nmap --data-length 25 <RHOST>

# MAC 주소 스푸핑
sudo nmap --spoof-mac 0 <RHOST>
```

## IPv6 스캔

```bash
sudo nmap -6 <IPv6_ADDRESS>
```

## 서브넷 스캔

```bash
# CIDR 표기
sudo nmap 192.168.1.0/24

# 범위 지정
sudo nmap 192.168.1.1-254

# 파일에서 타겟 읽기
sudo nmap -iL targets.txt
```

## Verbose 출력

```bash
# 상세 출력
sudo nmap -v <RHOST>

# 매우 상세한 출력
sudo nmap -vv <RHOST>

# 극도로 상세한 출력
sudo nmap -vvv <RHOST>
```

## 유용한 조합

```bash
# 빠른 전체 포트 스캔 후 서비스 탐지
sudo nmap -p- --min-rate 10000 <RHOST>
sudo nmap -sC -sV -p [발견된 포트] <RHOST>

# 내부 네트워크 빠른 스캔
sudo nmap -sn 192.168.1.0/24

# 스텔스 SYN 스캔 + 서비스 버전
sudo nmap -sS -sV -p- <RHOST>

# 공격적인 전체 스캔
sudo nmap -A -T4 -p- <RHOST>
```

## 참고

- -sS: root 권한 필요 (SYN 스캔)
- -sT: root 권한 불필요 (Connect 스캔)
- -Pn: 방화벽이 ping을 차단할 때 유용
- --min-rate: 빠른 스캔에 유용
- -A: 공격적 스캔 (시간 오래 걸림)
- NSE 스크립트: /usr/share/nmap/scripts/
