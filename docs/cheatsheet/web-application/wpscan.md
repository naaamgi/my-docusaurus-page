---
sidebar_position: 10
title: WPScan
---

# WPScan (WordPress 취약점 스캐너)

## Overview

**WPScan**: Ruby로 작성된 WordPress 전용 블랙박스 취약점 스캐너. 테마, 플러그인, 사용자 계정 열거 및 알려진 취약점 연계 테스트에 필수적인 도구.

- **주의**: API 토큰(WPVulnDB)을 등록해야 최신 취약점 매칭 정보를 받을 수 있음 (`https://wpscan.com/` 에서 발급)

---

## 1. Reconnaissance (스캐닝 및 열거)

### 기본 정보 및 설정 파일 스캔
대상 워드프레스 사이트의 버전, 사용 중인 테마, 헤더 정보 확인
```bash
# 기본 스캔 (TLS 인증서 오류 무시: --disable-tls-checks)
wpscan --url https://<target> --disable-tls-checks

# 랜덤 User-Agent 사용 (WAF 차단 우회 시도)
wpscan --url https://<target> --random-user-agent
```

### 대상 요소 열거 (Enumerate 옵션)
플러그인, 테마, 사용자 계정 등 세부 정보 추출
```bash
-e u    # 사용자 계정 (User) 열거
-e p    # 플러그인 (Plugin) 열거
-e t    # 테마 (Theme) 열거
-e vp   # 취약한 플러그인(Vulnerable Plugin) 열거
-e vt   # 취약한 테마(Vulnerable Theme) 열거
-e cb   # 설정 백업 파일 (Config Backups)
-e dbe  # 데이터베이스 덤프 (Db Exports)

# 종합 열거 예시 (사용자, 테마, 취약한 플러그인)
wpscan --url https://<target> -e u,t,vp --api-token <YOUR_API_TOKEN>
```

---

## 2. Exploitation (공격 수행)

### 플러그인 탐지 강도 조절 (Plugins Detection)
기본 모드(Passive)에서 발견되지 않는 플러그인을 무차별 접근을 통해 식별
```bash
# Aggressive 모드: 대량의 요청을 발생시켜 설치된 플러그인 강제 확인
wpscan --url https://<target> -e p --plugins-detection aggressive

# Mixed 모드: Passive와 Aggressive 혼합
wpscan --url https://<target> -e p --plugins-detection mixed
```

### 계정 브루트포스 (Brute-Force) 공격
열거된 사용자 계정(`-U`)에 대해 패스워드 워드리스트(`-P`)를 대입
```bash
# 특정 계정(admin) 비밀번호 대입 공격 (쓰레드 50)
wpscan --url http://<target> -U admin -P /usr/share/wordlists/rockyou.txt -t 50

# 열거를 통해 수집된 다수 계정에 대입 공격
wpscan --url http://<target> -U users.txt -P passwords.txt
```

---

## 3. Advanced Techniques

### 주요 헌팅 포인트 (공통 발견 사항 점검)
WPScan 결과를 토대로 다음 항목들에 대한 수동 점검 연계
- **xmlrpc.php 활성화**: 대규모 핑백(Pingback) 요청을 통한 DDoS, 혹은 초고속 브루트포스 가능성 존재
- **wp-admin / wp-login.php 노출**: 관리자 페이지 직접 접근 가능 여부
- **readme.html 노출**: 정확한 워드프레스 코어 버전 확인 가능
- **wp-config.php.save 등 백업 파일**: DB 크리덴셜 평문 노출 확인

### 우회 및 프록시 설정
```bash
# HTTP 기본 인증(Basic Auth)이 걸린 대상 스캔
wpscan --url https://<target> --http-auth admin:password

# 세션 쿠키 수동 주입
wpscan --url https://<target> --cookie-string "PHPSESSID=123456789"

# 프록시 연동 (Burp Suite 로깅 등)
wpscan --url https://<target> --proxy http://127.0.0.1:8080
```
