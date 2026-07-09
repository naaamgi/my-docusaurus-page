---
sidebar_position: 2
title: Port Scanning (Without Nmap)
---

# Port Scanning (Without Nmap)

## Overview

Nmap을 사용할 수 없는 환경(예: 초기 침투 후 타겟 내부망)에서 시스템 내장 도구나 기본 스크립팅 언어를 활용하여 포트를 스캔하는 기법 모음

---

## 1. Netcat (nc) 기반 스캐닝

Netcat은 가장 범용적인 네트워크 도구로 포트 스캔에도 유용하게 활용 가능

```bash
# 기본 단일 포트 확인 (-z: 연결만 테스트, -w 1: 타임아웃 1초)
nc -vn <target> 80 -w 1 -z

# 특정 범위의 TCP 포트 스캔 (닫힌 포트 숨김)
for p in {1..1000}; do nc -vn <target> $p -w 1 -z 2>&1 | grep "succeeded"; done

# 주요 웹 포트 스캔
for p in 80 443 8080 8443; do nc -vn <target> $p -w 1 -z 2>&1 | grep -v "refused"; done

# UDP 포트 스캔 (-u 플래그)
nc -vnu <target> 53 -w 1 -z
```

---

## 2. Bash (/dev/tcp) 기반 스캐닝

Netcat조차 없는 환경에서 Bash 내장 기능을 이용한 스캐닝

```bash
# 단일 포트 테스트
timeout 1 bash -c "</dev/tcp/<target>/80" && echo "Port 80 is open"

# 1~1000번 포트 루프 스캔
for port in {1..1000}; do 
    timeout 0.1 bash -c "</dev/tcp/<target>/$port && echo Port $port is open" 2>/dev/null
done

# Bash /dev/tcp를 이용한 수동 배너 그랩
exec 3<>/dev/tcp/<target>/80
echo -e "GET / HTTP/1.1\r\nHost: <target>\r\n\r\n" >&3
cat <&3
```

---

## 3. Python 기반 스캐닝

Python이 설치된 환경에서 소켓(Socket) 라이브러리를 활용한 커스텀 스캐너 작성

```python
#!/usr/bin/env python3
import socket
import sys

def scan_port(host, port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        if result == 0:
            print(f"Port {port}: Open")
        sock.close()
    except:
        pass

host = sys.argv[1]
for port in range(1, 1024):
    scan_port(host, port)
```

---

## 4. PowerShell 기반 스캐닝 (Windows)

Windows 환경 리버스 쉘이나 초기 침투 시 활용 가능한 네이티브 스캔 기법

```powershell
# PowerShell Socket을 이용한 포트 스캔 (1~1024)
1..1024 | % {
    $sock = New-Object System.Net.Sockets.TcpClient
    $async = $sock.BeginConnect('<target>', $_, $null, $null)
    $wait = $async.AsyncWaitHandle.WaitOne(100, $false)
    if($wait) {
        $sock.EndConnect($async)
        Write-Host "Port $_ is open"
        $sock.Close()
    }
}

# Test-NetConnection 활용 (PowerShell 4.0 이상)
Test-NetConnection <target> -Port 80
```

---

## 5. Advanced Techniques

### 병렬 실행을 통한 스캔 속도 최적화
Bash 루프 스캔은 속도가 매우 느리므로 `xargs` 또는 `parallel`을 통해 병렬 처리 구성

```bash
# xargs를 사용한 50개 병렬 스레드 스캔
seq 1 65535 | xargs -P 50 -I {} nc -vn <target> {} -w 1 -z 2>&1 | grep succeeded

# GNU Parallel을 활용한 병렬 스캔
seq 1 65535 | parallel -j 100 'nc -vn <target> {} -w 1 -z 2>&1 | grep succeeded'
```

### cURL 및 Wget을 활용한 웹 서비스 식별
웹 전용 포트가 활성화되어 있는지 HTTP 응답 여부로 식별

```bash
# cURL 타임아웃을 이용한 식별
for port in {80..8080}; do
    curl -s --connect-timeout 1 http://<target>:$port && echo "Port $port: HTTP"
done

# Wget 스파이더 모드를 이용한 식별
for port in {80..8080}; do
    wget -q --timeout=1 --spider http://<target>:$port && echo "Port $port: HTTP"
done
```
