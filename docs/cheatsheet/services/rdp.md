---
sidebar_position: 10
---

# RDP - 3389

## 기본 정보

**포트**: 3389

RDP(Remote Desktop Protocol)는 Windows 원격 데스크톱 접속을 위한 프로토콜입니다.

## xfreerdp3

```bash
# 기본 연결
xfreerdp3 /v:<RHOST> /u:<USERNAME> /p:<PASSWORD> /cert-ignore

# 도메인 지정
xfreerdp3 /v:<RHOST> /u:<USERNAME> /p:<PASSWORD> /d:<DOMAIN> /cert-ignore

# 동적 해상도 및 클립보드 공유
xfreerdp3 /v:<RHOST> /u:<USERNAME> /p:<PASSWORD> +dynamic-resolution +clipboard

# Pass-the-Hash
xfreerdp3 /v:<RHOST> /u:<USERNAME> /d:<DOMAIN> /pth:'<HASH>' +dynamic-resolution +clipboard

# TLS 보안 레벨 낮춤
xfreerdp3 /v:<RHOST> +dynamic-resolution +clipboard /tls:seclevel:0 /sec:nla:off
```

## rdesktop

```bash
# 기본 연결
rdesktop <RHOST>

# 사용자 지정
rdesktop <RHOST> -u <USERNAME> -p <PASSWORD>

# 전체 화면
rdesktop <RHOST> -f

# 특정 해상도
rdesktop <RHOST> -g 1920x1080
```

## NetExec

```bash
# NLA 스크린샷 (자격증명 없이)
netexec rdp <RHOST> --nla-screenshot

# 스크린샷 (자격증명 필요)
netexec rdp <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --screenshot

# 스크린샷 시간 지정 (초)
netexec rdp <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --screenshot --screentime 3
```

## Nmap

```bash
# RDP 포트 스캔
sudo nmap -p3389 -sV <RHOST>

# RDP 열거
sudo nmap -p3389 --script rdp-enum-encryption <RHOST>

# RDP NTLMv2 해시 수집
sudo nmap -p3389 --script rdp-ntlm-info <RHOST>

# BlueKeep 취약점 확인
sudo nmap -p3389 --script rdp-vuln-ms12-020 <RHOST>
```

## Hydra 브루트포스

```bash
# RDP 브루트포스
hydra -L users.txt -P passwords.txt rdp://<RHOST>
hydra -l administrator -P passwords.txt rdp://<RHOST>
```

## rdesktop-vrdp

```bash
# VirtualBox RDP
rdesktop-vrdp <RHOST>:3389
```

## 참고

- NLA (Network Level Authentication) 활성화 여부 확인
- Restricted Admin Mode 확인
- BlueKeep (CVE-2019-0708) 취약점 확인
- Pass-the-Hash 가능 여부 확인
- 약한 자격증명 테스트
