---
sidebar_position: 10
---

# WPScan

> https://github.com/wpscanteam/wpscan

WordPress 취약점 스캐너입니다.

## 설치

```bash
# Kali Linux
sudo apt install wpscan

# RubyGems
gem install wpscan

# Docker
docker pull wpscanteam/wpscan
```

## 기본 옵션

```bash
--url              # 타겟 URL
--enumerate        # 열거 옵션 (u,t,p,cb,dbe)
--disable-tls-checks  # TLS/SSL 검증 비활성화
--api-token        # WPVulnDB API 토큰
-U                 # 사용자명 목록
-P                 # 비밀번호 목록
-t                 # 스레드 수
--plugins-detection   # 플러그인 탐지 모드
--random-user-agent   # 랜덤 User-Agent
```

## 열거 옵션

```bash
u   # 사용자 열거
t   # 테마 열거
p   # 플러그인 열거
cb  # Config Backups
dbe # Db Exports
vp  # 취약한 플러그인
vt  # 취약한 테마
```

## 기본 스캔

### 사용자, 테마, 플러그인 열거

```bash
wpscan --url https://<RHOST> --enumerate u,t,p
```

### TLS 검증 비활성화

```bash
wpscan --url https://<RHOST> --disable-tls-checks
wpscan --url https://<RHOST> --disable-tls-checks --enumerate u,t,p
```

## 플러그인 탐지

### Passive 모드 (기본)

```bash
wpscan --url https://<RHOST>
```

### Aggressive 모드

```bash
# 더 많은 플러그인 탐지
wpscan --url https://<RHOST> --plugins-detection aggressive
```

### Mixed 모드

```bash
wpscan --url https://<RHOST> --plugins-detection mixed
```

## 브루트포스 공격

```bash
# 사용자명 브루트포스
wpscan --url http://<RHOST> -U <USERNAME> -P passwords.txt -t 50

# 여러 사용자
wpscan --url http://<RHOST> -U users.txt -P passwords.txt -t 50

# 특정 사용자에 대한 비밀번호 브루트포스
wpscan --url http://<RHOST> -U admin -P /usr/share/wordlists/rockyou.txt
```

## API 토큰 사용

WPVulnDB API 토큰으로 취약점 정보 확인:

```bash
# 토큰 등록: https://wpscan.com/
wpscan --url https://<RHOST> --api-token <YOUR_API_TOKEN>
```

## 출력 형식

```bash
# JSON 출력
wpscan --url https://<RHOST> -f json -o output.json

# CLI 형식
wpscan --url https://<RHOST> -f cli
```

## 고급 옵션

### 프록시 사용

```bash
wpscan --url https://<RHOST> --proxy http://127.0.0.1:8080
```

### User-Agent 변경

```bash
wpscan --url https://<RHOST> --random-user-agent
wpscan --url https://<RHOST> --user-agent "Custom UA"
```

### 쿠키 사용

```bash
wpscan --url https://<RHOST> --cookie-string "name=value"
```

### HTTP 인증

```bash
wpscan --url https://<RHOST> --http-auth user:pass
```

## 취약점 탐지

```bash
# 취약한 플러그인만
wpscan --url https://<RHOST> --enumerate vp

# 취약한 테마만
wpscan --url https://<RHOST> --enumerate vt

# 모든 취약점
wpscan --url https://<RHOST> --enumerate vp,vt
```

## 예제 워크플로우

### 1. 초기 정찰

```bash
wpscan --url https://<RHOST> --disable-tls-checks
```

### 2. 상세 열거

```bash
wpscan --url https://<RHOST> --enumerate u,t,p --plugins-detection aggressive --api-token <TOKEN>
```

### 3. 브루트포스

```bash
wpscan --url https://<RHOST> -U admin,user -P /usr/share/wordlists/rockyou.txt -t 50
```

## 일반적인 발견 사항

- **wp-admin** 로그인 페이지 노출
- **xmlrpc.php** 활성화 (브루트포스 가능)
- **readme.html** 버전 정보 노출
- 오래된 플러그인/테마 취약점
- 사용자명 열거 가능
- 디렉토리 리스팅 활성화

## 참고

- API 토큰 없이도 기본 스캔 가능
- Aggressive 모드는 더 많은 요청 발생
- 브루트포스 시 계정 잠금 주의
- xmlrpc.php로 더 빠른 브루트포스 가능
- WordPress 5.0+ 부터 REST API로 사용자 열거 가능
