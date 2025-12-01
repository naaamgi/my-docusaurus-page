---
sidebar_position: 17
---

# HTTP/HTTPS - 80/443

## 기본 정보

**포트**: 80 (HTTP), 443 (HTTPS), 8080, 8443 (대체 포트)

HTTP는 웹 서버와 클라이언트 간의 통신 프로토콜입니다.

## 웹 서버 시작

### Python HTTP Server

```bash
# Python 2
sudo python -m SimpleHTTPServer 80

# Python 3
sudo python3 -m http.server 80

# 특정 디렉토리 공유
cd /path/to/share
python3 -m http.server 8080
```

### PHP Webserver

```bash
# PHP 내장 서버
sudo php -S 127.0.0.1:80

# 특정 디렉토리
sudo php -S 0.0.0.0:80 -t /var/www/html
```

### Apache2

```bash
# Apache 시작
sudo service apache2 start
sudo systemctl start apache2

# 웹 루트 디렉토리
/var/www/html/

# 파일 복사
sudo cp /path/to/file /var/www/html/
```

## Nmap

```bash
# HTTP 버전 확인
sudo nmap -p80,443 -sV <RHOST>

# HTTP 메서드 확인
sudo nmap -p80 --script http-methods <RHOST>

# HTTP 제목 확인
sudo nmap -p80 --script http-title <RHOST>

# HTTP 헤더 확인
sudo nmap -p80 --script http-headers <RHOST>

# HTTP 열거
sudo nmap -p80 --script http-enum <RHOST>

# WebDAV 확인
sudo nmap -p80 --script http-webdav-scan <RHOST>

# 취약점 스캔
sudo nmap -p80,443 --script http-vuln-* <RHOST>
```

## curl

```bash
# 기본 GET 요청
curl http://<RHOST>

# 헤더 포함
curl -I http://<RHOST>

# POST 요청
curl -X POST http://<RHOST>/api -d "param=value"

# JSON POST
curl -X POST http://<RHOST>/api -H "Content-Type: application/json" -d '{"key":"value"}'

# 쿠키 사용
curl -b "session=abc123" http://<RHOST>

# 쿠키 저장
curl -c cookies.txt http://<RHOST>

# User-Agent 변경
curl -A "Mozilla/5.0" http://<RHOST>

# 파일 다운로드
curl -O http://<RHOST>/file.txt

# 리다이렉트 따라가기
curl -L http://<RHOST>

# 인증
curl -u username:password http://<RHOST>
```

## wget

```bash
# 파일 다운로드
wget http://<RHOST>/file.txt

# 재귀 다운로드
wget -r http://<RHOST>/

# 배경 다운로드
wget -b http://<RHOST>/file.txt

# 계속 다운로드
wget -c http://<RHOST>/file.txt

# User-Agent 변경
wget --user-agent="Mozilla/5.0" http://<RHOST>
```

## Directory Enumeration

### ffuf

```bash
# 디렉토리 브루트포스
ffuf -u http://<RHOST>/FUZZ -w /usr/share/wordlists/dirb/common.txt

# 파일 확장자 포함
ffuf -u http://<RHOST>/FUZZ -w /usr/share/wordlists/dirb/common.txt -e .php,.txt,.html

# POST 파라미터 퍼징
ffuf -u http://<RHOST>/login -w /path/to/wordlist.txt -X POST -d "username=admin&password=FUZZ" -H "Content-Type: application/x-www-form-urlencoded"
```

### Gobuster

```bash
# 디렉토리 스캔
gobuster dir -u http://<RHOST>/ -w /usr/share/wordlists/dirb/common.txt

# 파일 확장자 지정
gobuster dir -u http://<RHOST>/ -w /usr/share/wordlists/dirb/common.txt -x php,txt,html

# DNS 서브도메인 열거
gobuster dns -d <DOMAIN> -w /usr/share/wordlists/subdomains.txt

# Vhost 열거
gobuster vhost -u http://<RHOST> -w /usr/share/wordlists/subdomains.txt
```

## WebDAV

### davtest

```bash
# WebDAV 테스트
davtest -url http://<RHOST>/webdav/
```

### cadaver

```bash
# WebDAV 연결
cadaver http://<RHOST>/webdav/

# 파일 업로드
dav:/webdav/> put shell.php
```

## 참고

- 디렉토리 열거 (ffuf, Gobuster, dirbuster)
- 취약점 스캔 (Nikto, WPScan)
- 파일 업로드 취약점
- LFI/RFI 테스트
- SQL Injection
- XSS
- SSRF
- XXE
- 더 자세한 웹 공격 기법은 Web Application Analysis 섹션 참고
