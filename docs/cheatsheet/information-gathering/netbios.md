---
sidebar_position: 4
---

# NetBIOS - 137/138/139

NetBIOS (Network Basic Input/Output System) 열거 및 정보 수집입니다.

## 기본 정보

- **포트**: 137/UDP (Name Service), 138/UDP (Datagram Service), 139/TCP (Session Service)
- **프로토콜**: NetBIOS over TCP/IP (NBT)

## nbtscan

```bash
# 기본 스캔
nbtscan <RHOST>

# 범위 스캔
nbtscan <NETWORK>/24
nbtscan 192.168.1.0/24

# 상세 출력
nbtscan -v <RHOST>

# 옵션
nbtscan -r <NETWORK>/24  # UDP port 137만 사용
nbtscan -h               # 도움말
```

## nmblookup

```bash
# NetBIOS 이름 조회
nmblookup -A <RHOST>

# 특정 이름 찾기
nmblookup <NETBIOS_NAME>

# 마스터 브라우저 찾기
nmblookup -M -- -

# 워크그룹 조회
nmblookup -d 2 '*'
```

## Nmap

```bash
# NetBIOS 정보 수집
nmap -sV -p 137,139 <RHOST>
nmap -sU -p 137 --script nbstat <RHOST>

# NetBIOS 스크립트
nmap -p 139 --script nbstat,smb-os-discovery <RHOST>
nmap -sU -sV -T4 --script nbstat.nse -p137 <RHOST>
```

## enum4linux

```bash
# 기본 열거
enum4linux <RHOST>

# 모든 정보
enum4linux -a <RHOST>

# 사용자 열거
enum4linux -U <RHOST>

# 공유 열거
enum4linux -S <RHOST>

# 그룹 열거
enum4linux -G <RHOST>

# OS 정보
enum4linux -o <RHOST>
```

## rpcclient

```bash
# 연결 (Null Session)
rpcclient -U "" -N <RHOST>

# 연결 후 명령어
rpcclient $> enumdomusers
rpcclient $> enumdomgroups
rpcclient $> queryuser <RID>
rpcclient $> querygroupmem <RID>
rpcclient $> getdompwinfo
```

## smbclient

```bash
# 공유 목록
smbclient -L //<RHOST>/ -N

# Null Session
smbclient //<RHOST>/share -N

# 인증
smbclient //<RHOST>/share -U <USERNAME>
```

## NetBIOS Name Types

| Suffix | Type | Description |
|--------|------|-------------|
| `<00>` | U | Workstation Service |
| `<03>` | U | Messenger Service |
| `<06>` | U | RAS Server Service |
| `<1B>` | U | Domain Master Browser |
| `<1C>` | G | Domain Controllers |
| `<1D>` | U | Master Browser |
| `<1E>` | G | Browser Service Elections |
| `<20>` | U | File Server Service |

**U** = Unique  
**G** = Group

## 정보 수집

### 호스트 이름 및 도메인

```bash
nmblookup -A <RHOST>
```

출력 예시:
```
Looking up status of 192.168.1.100
    DESKTOP-ABC123  <00> -         B <ACTIVE>
    DESKTOP-ABC123  <03> -         B <ACTIVE>
    DESKTOP-ABC123  <20> -         B <ACTIVE>
    WORKGROUP       <00> - <GROUP> B <ACTIVE>
    WORKGROUP       <1e> - <GROUP> B <ACTIVE>
```

### 공유 폴더

```bash
smbclient -L //<RHOST>/ -N
```

### 사용자 목록

```bash
enum4linux -U <RHOST>
```

## 취약점

### Null Session

```bash
# Null Session 테스트
rpcclient -U "" -N <RHOST>
smbclient //<RHOST>/IPC$ -N
enum4linux -a <RHOST>
```

### 정보 유출

- 사용자 목록
- 공유 폴더
- 도메인/워크그룹 정보
- OS 버전

## 참고

- NetBIOS는 구형 프로토콜이지만 여전히 많이 사용됨
- Null Session 공격으로 인증 없이 정보 수집 가능
- SMB와 함께 사용됨
- Windows 환경에서 주로 사용
- Firewall에서 차단 권장
