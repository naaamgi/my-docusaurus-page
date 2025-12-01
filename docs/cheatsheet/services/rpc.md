---
sidebar_position: 15
---

# RPC - 111

## 기본 정보

**포트**: 135 (RPC), 49152-65535 (Dynamic RPC)

RPC(Remote Procedure Call)는 원격 프로시저 호출을 위한 프로토콜입니다.

## rpcclient

```bash
# Null 세션으로 연결
rpcclient -U "" <RHOST>

# 사용자명 지정
rpcclient -U "<USERNAME>" <RHOST>

# 비밀번호와 함께
rpcclient -U "<USERNAME>%<PASSWORD>" <RHOST>
```

## rpcclient 명령어

```bash
# 도메인 컨트롤러 정보
dsr_getdcname
dsr_getdcnameex
dsr_getdcnameex2
dsr_getsitename

# 열거
enumdata
enumdomgroups          # 도메인 그룹 열거
enumdomusers           # 도메인 사용자 열거
enumjobs               # 프린터 작업 열거
enumports              # 프린터 포트 열거
enumprivs              # 권한 열거

# DC 이름 가져오기
getanydcname
getdcname

# SID 조회
lookupsids <SID>
lsaenumsid
lsaquery

# 네트워크 정보
netconnenum            # 네트워크 연결 열거
netdiskenum            # 디스크 열거
netfileenum            # 파일 열거
netsessenum            # 세션 열거
netshareenum           # 공유 열거
netshareenumall        # 모든 공유 열거
netsharegetinfo        # 공유 정보

# 사용자 정보
queryuser <USERNAME>
queryusergroups <RID>
querygroup <RID>
querygroupmem <RID>
querydominfo

# 서버 정보
srvinfo
```

## RID 브루트포스

```bash
# RID Cycling
for i in $(seq 500 1100); do
    rpcclient -N -U "" <RHOST> -c "queryuser 0x$(printf '%x\n' $i)"
done
```

## enum4linux

```bash
# 기본 열거
enum4linux <RHOST>

# 전체 열거
enum4linux -a <RHOST>

# 사용자 열거
enum4linux -U <RHOST>

# 공유 열거
enum4linux -S <RHOST>

# 그룹 열거
enum4linux -G <RHOST>

# 비밀번호 정책
enum4linux -P <RHOST>
```

## enum4linux-ng

```bash
# Python 버전 (더 빠름)
enum4linux-ng <RHOST>

# 전체 열거
enum4linux-ng -A <RHOST>

# JSON 출력
enum4linux-ng -A <RHOST> -oJ output.json
```

## Nmap

```bash
# RPC 포트 스캔
sudo nmap -p135 -sV <RHOST>

# RPC 열거
sudo nmap -p135 --script rpc-grind <RHOST>

# MS-RPC 열거
sudo nmap -p135 --script msrpc-enum <RHOST>
```

## impacket-rpcdump

```bash
# RPC 엔드포인트 열거
impacket-rpcdump <RHOST>

# 자격증명 사용
impacket-rpcdump <DOMAIN>/<USERNAME>:<PASSWORD>@<RHOST>
```

## 참고

- Null 세션 확인
- 익명 바인딩 가능 여부
- 사용자 및 그룹 열거
- 공유 열거
- RID Cycling을 통한 사용자 발견
- MS-RPC 서비스 열거
