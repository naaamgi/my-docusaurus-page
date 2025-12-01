---
sidebar_position: 2
---

# Port Scanning

Nmap 없이 포트 스캔하는 방법입니다.

## Netcat를 이용한 포트 스캔

```bash
# 기본 포트 스캔 (1-65535)
for p in {1..65535}; do nc -vn <RHOST> $p -w 1 -z & done 2> scan_results.txt

# 특정 포트 범위
for p in {1..1000}; do nc -vn <RHOST> $p -w 1 -z & done 2> scan_results.txt

# 단일 포트 확인
nc -vn <RHOST> 80 -w 1 -z
```

## Bash /dev/tcp를 이용한 포트 스캔

```bash
# 전체 포트 스캔
export ip=<RHOST>
for port in $(seq 1 65535); do 
    timeout 0.01 bash -c "</dev/tcp/$ip/$port && echo The port $port is open || echo The Port $port is closed > /dev/null" 2>/dev/null || echo Connection Timeout > /dev/null
done

# 특정 포트 범위 스캔
for port in {1..1000}; do 
    timeout 0.01 bash -c "</dev/tcp/<RHOST>/$port && echo Port $port is open" 2>/dev/null
done

# 단일 포트 테스트
timeout 1 bash -c "</dev/tcp/<RHOST>/80" && echo "Port 80 is open"
```

## Python을 이용한 포트 스캔

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
for port in range(1, 65536):
    scan_port(host, port)
```

## 일반적인 포트 스캔

```bash
# 상위 20개 포트
for port in 21 22 23 25 53 80 110 111 135 139 143 443 445 993 995 1723 3306 3389 5900 8080; do
    nc -vn <RHOST> $port -w 1 -z 2>&1 | grep -v "refused"
done

# 웹 포트만
for port in 80 443 8000 8080 8443 8888; do
    nc -vn <RHOST> $port -w 1 -z
done
```

## curl/wget을 이용한 웹 포트 확인

```bash
# curl로 포트 확인
for port in {80..8080}; do
    curl -s --connect-timeout 1 http://<RHOST>:$port && echo "Port $port: HTTP"
done

# wget으로 포트 확인
for port in {80..8080}; do
    wget -q --timeout=1 --spider http://<RHOST>:$port && echo "Port $port: HTTP"
done
```

## 병렬 스캔 (빠른 스캔)

```bash
# GNU Parallel 사용
seq 1 65535 | parallel -j 100 'nc -vn <RHOST> {} -w 1 -z 2>&1 | grep -v "refused"'

# xargs 사용
seq 1 65535 | xargs -P 50 -I {} nc -vn <RHOST> {} -w 1 -z 2>&1 | grep succeeded
```

## UDP 포트 스캔 (Netcat)

```bash
# UDP 포트 스캔
nc -vnu <RHOST> 53 -w 1 -z

# 일반적인 UDP 포트
for port in 53 67 68 69 123 161 162 500 514 520; do
    nc -vnu <RHOST> $port -w 1 -z
done
```

## 특정 서비스 배너 그랩

```bash
# Netcat 배너 그랩
nc -v <RHOST> 22

# Telnet 배너 그랩
telnet <RHOST> 22

# Bash /dev/tcp 배너 그랩
exec 3<>/dev/tcp/<RHOST>/80
echo -e "GET / HTTP/1.1\r\nHost: <RHOST>\r\n\r\n" >&3
cat <&3
```

## 결과 필터링

```bash
# 열린 포트만 표시
for p in {1..1000}; do nc -vn <RHOST> $p -w 1 -z 2>&1 | grep "succeeded"; done

# 닫힌 포트 제외
for p in {1..1000}; do nc -vn <RHOST> $p -w 1 -z 2>&1 | grep -v "refused"; done
```

## Windows에서 포트 스캔

```powershell
# PowerShell 포트 스캔
1..1024 | % {
    $sock = New-Object System.Net.Sockets.TcpClient
    $async = $sock.BeginConnect('<RHOST>', $_, $null, $null)
    $wait = $async.AsyncWaitHandle.WaitOne(100, $false)
    if($wait) {
        $sock.EndConnect($async)
        Write-Host "Port $_ is open"
        $sock.Close()
    }
}

# Test-NetConnection (PowerShell 4.0+)
Test-NetConnection <RHOST> -Port 80
```

## 참고

- Netcat: 가장 범용적
- /dev/tcp: Bash 내장, Netcat 없을 때 유용
- timeout: 응답 없는 포트에서 대기 시간 단축
- 병렬 실행: 스캔 시간 단축
- UDP 스캔: 신뢰성 낮음
- 포트 범위: 1-65535 (전체 스캔은 시간 오래 걸림)
