---
sidebar_position: 10
---

# Ping

## 기본 사용법

```bash
# Linux/Mac - 1번 핑
ping -c 1 <RHOST>

# Windows - 1번 핑
ping -n 1 <RHOST>

# 연속 핑 (Linux)
ping <RHOST>

# 연속 핑 (Windows)
ping -t <RHOST>
```

## 고급 옵션

```bash
# TTL 설정
ping -c 1 -t 64 <RHOST>

# 패킷 크기 지정
ping -c 1 -s 1000 <RHOST>

# 타임아웃 설정
ping -c 1 -W 1 <RHOST>

# 인터벌 설정 (0.2초마다)
ping -c 10 -i 0.2 <RHOST>
```

## ICMP 우회

```bash
# TCP Ping (nmap 사용)
nmap -sn -PS <RHOST>

# UDP Ping
nmap -sn -PU <RHOST>

# ICMP 없이 포트 스캔
nmap -Pn <RHOST>
```

## 네트워크 진단

```bash
# 여러 호스트 핑
for i in {1..254}; do ping -c 1 192.168.1.$i; done

# 살아있는 호스트만 표시
for i in {1..254}; do ping -c 1 -W 1 192.168.1.$i | grep "64 bytes" && echo "192.168.1.$i is alive"; done
```

## Windows 명령어

```cmd
# 1번 핑
ping -n 1 <RHOST>

# 무한 핑
ping -t <RHOST>

# 패킷 크기
ping -l 1000 <RHOST>

# TTL
ping -i 64 <RHOST>
```

## 참고

- ICMP가 막혀있을 수 있음
- -c: count (Linux)
- -n: count (Windows)
- -W: timeout (초 단위)
- -i: interval (초 단위)
