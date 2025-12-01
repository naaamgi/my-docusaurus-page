---
sidebar_position: 2
---

# Gobuster

디렉토리/파일 버스팅 도구

## 기본 옵션

```bash
-e            # Extended mode (전체 URL 표시)
-k            # SSL 인증서 검증 무시
-r            # 리다이렉트 따라가기
-s            # 상태 코드 지정
-b            # 제외할 상태 코드
--wildcard    # Wildcard 옵션 설정
```

## 디렉토리 스캔

```bash
# 기본 스캔
gobuster dir -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -u http://<RHOST>/

# PHP 확장자 포함
gobuster dir -w /usr/share/seclists/Discovery/Web-Content/big.txt -u http://<RHOST>/ -x php

# 여러 확장자 + 전체 URL + 상태 코드 200만
gobuster dir -w /usr/share/wordlists/dirb/big.txt -u http://<RHOST>/ -x php,txt,html,js -e -s 200

# HTTPS + 인증서 무시 + wildcard
gobuster dir -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt -u https://<RHOST>:<RPORT>/ -b 200 -k --wildcard

# 쓰레드 수 지정
gobuster dir -w wordlist.txt -u http://<RHOST>/ -t 50

# 특정 상태 코드만 표시
gobuster dir -w wordlist.txt -u http://<RHOST>/ -s 200,204,301,302,307,401,403
```

## 확장자

### 일반 파일 확장자

```bash
txt,bak,php,html,js,asp,aspx,jsp,xml,json,log,sql,old,zip,tar,gz
```

### 이미지 확장자

```bash
png,jpg,jpeg,gif,bmp,svg,ico
```

## POST 요청

```bash
gobuster dir -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-medium.txt -u http://<RHOST>/api/ -e -s 200
```

## DNS 열거

```bash
# 기본 DNS 열거
gobuster dns -d <RHOST> -w /usr/share/wordlists/SecLists/Discovery/DNS/subdomains-top1million-5000.txt

# 쓰레드 증가
gobuster dns -d <RHOST> -t 50 -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt

# 와일드카드 사용
gobuster dns -d <RHOST> -w wordlist.txt -i --wildcard
```

## VHost Discovery

```bash
# 기본 VHost 열거
gobuster vhost -u <RHOST> -t 50 -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt

# 도메인 자동 추가
gobuster vhost -u <RHOST> -t 50 -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt --append-domain

# 특정 상태 코드 제외
gobuster vhost -u http://<RHOST> -w wordlist.txt -exclude-length 1234
```

## User Agent 지정

```bash
# Linux User Agent
gobuster dir -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -u http://<RHOST>/ -a Linux

# 커스텀 User Agent
gobuster dir -w wordlist.txt -u http://<RHOST>/ -a "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
```

## 인증

```bash
# Basic Auth
gobuster dir -w wordlist.txt -u http://<RHOST>/ -U username -P password

# 쿠키 사용
gobuster dir -w wordlist.txt -u http://<RHOST>/ -c "session=abc123"

# 헤더 추가
gobuster dir -w wordlist.txt -u http://<RHOST>/ -H "Authorization: Bearer token"
```

## 출력 옵션

```bash
# 결과 저장
gobuster dir -w wordlist.txt -u http://<RHOST>/ -o results.txt

# Verbose 모드
gobuster dir -w wordlist.txt -u http://<RHOST>/ -v

# Quiet 모드
gobuster dir -w wordlist.txt -u http://<RHOST>/ -q

# 진행 상황 숨기기
gobuster dir -w wordlist.txt -u http://<RHOST>/ --no-progress
```

## 고급 옵션

```bash
# 타임아웃 설정
gobuster dir -w wordlist.txt -u http://<RHOST>/ --timeout 10s

# 리다이렉트 따라가기
gobuster dir -w wordlist.txt -u http://<RHOST>/ -r

# Wildcard 강제
gobuster dir -w wordlist.txt -u http://<RHOST>/ --wildcard

# 프록시 사용
gobuster dir -w wordlist.txt -u http://<RHOST>/ -p http://127.0.0.1:8080

# URL 경로 추가
gobuster dir -w wordlist.txt -u http://<RHOST>/ --add-slash
```

## 유용한 Wordlists

```bash
# 디렉토리
/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
/usr/share/wordlists/dirb/common.txt
/usr/share/seclists/Discovery/Web-Content/big.txt
/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt

# DNS/서브도메인
/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
/usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt

# API
/usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt
```

## 모드별 사용

### dir 모드 (디렉토리/파일)

```bash
gobuster dir -u http://<RHOST>/ -w wordlist.txt [옵션]
```

### dns 모드 (서브도메인)

```bash
gobuster dns -d <RHOST> -w wordlist.txt [옵션]
```

### vhost 모드 (가상 호스트)

```bash
gobuster vhost -u http://<RHOST> -w wordlist.txt [옵션]
```

### fuzz 모드 (파라미터 퍼징)

```bash
gobuster fuzz -u http://<RHOST>/?FUZZ=value -w wordlist.txt
```

## 실전 예제

```bash
# 웹 디렉토리 스캔 (PHP)
gobuster dir -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/ -x php,html,txt -t 50 -k

# API 엔드포인트 찾기
gobuster dir -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt -u http://<RHOST>/api/ -s 200,201,204

# 서브도메인 열거
gobuster dns -d example.com -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -t 50

# VHost 발견
gobuster vhost -u http://example.com -w wordlist.txt --append-domain -t 50

# 백업 파일 찾기
gobuster dir -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/ -x bak,backup,old,zip,tar.gz
```

## 참고

- dir: 디렉토리/파일 버스팅
- dns: DNS 서브도메인 열거
- vhost: Virtual Host 발견
- fuzz: 파라미터 퍼징
- -t: 쓰레드 수 (기본 10)
- -x: 확장자 지정
- -e: 전체 URL 표시
- -k: SSL 인증서 무시
- -r: 리다이렉트 따라가기
