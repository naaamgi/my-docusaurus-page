---
sidebar_position: 2
title: Gobuster
---

# Gobuster (디렉토리 및 서브도메인 열거)

## Overview

**Gobuster**: Go 언어로 작성된 고속 디렉토리/파일 및 서브도메인 브루트포스 도구. 직관적인 명령어 구조와 빠른 속도가 특징.

- **지원 모드**: `dir`(디렉토리/파일), `dns`(서브도메인), `vhost`(가상 호스트), `fuzz`(파라미터)

---

## 1. Reconnaissance (스캐닝 모드)

### dir 모드 (디렉토리 및 파일 스캔)
웹 서버의 숨겨진 경로나 파일을 식별
```bash
# 기본 스캔 (쓰레드 50)
gobuster dir -u http://<target>/ -w /usr/share/wordlists/dirb/common.txt -t 50

# 확장자 지정 (-x) 및 상태 코드 필터링 (-s)
gobuster dir -u http://<target>/ -w wordlist.txt -x php,txt,html,js -s "200,204,301,302,307"

# HTTPS 인증서 검증 무시 (-k) 및 리다이렉트 추적 (-r)
gobuster dir -u https://<target>/ -w wordlist.txt -k -r

# User-Agent 설정 (-a) 및 인증 추가 (-U, -P)
gobuster dir -u http://<target>/ -w wordlist.txt -a "Mozilla/5.0" -U admin -P password123
```

### dns 모드 (서브도메인 열거)
DNS 쿼리를 통해 유효한 서브도메인 주소 도출
```bash
# 기본 DNS 스캔
gobuster dns -d <target_domain.com> -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# 와일드카드(Wildcard) 레코드 필터링 적용 (-i)
gobuster dns -d <target_domain.com> -w wordlist.txt -i --wildcard
```

### vhost 모드 (가상 호스트 발견)
DNS 서버에 등록되지 않은 내부 가상 호스트 식별
```bash
# 기본 VHost 열거 (Host 헤더 브루트포스)
gobuster vhost -u http://<target> -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -t 50

# 기본 도메인을 단어 뒤에 자동 결합 (--append-domain)
gobuster vhost -u http://<target_domain.com> -w wordlist.txt --append-domain
```

---

## 2. Exploitation (활용 옵션)

### API 및 파라미터 퍼징 (fuzz 모드)
URL 파라미터 등을 대상으로 브루트포스 수행
```bash
gobuster fuzz -u "http://<target>/?FUZZ=value" -w wordlist.txt
```

### 유용한 공통 옵션 정리
```bash
-e, --expanded        # 출력 시 전체 URL 표시 (http://.../path)
-q, --quiet           # 배너 및 진행률 등 불필요한 메시지 생략 (파이프 전달 시 유용)
-o, --output          # 결과를 파일로 저장
-b, --status-codes-blacklist # 제외할 상태 코드 (기본: 404)
--add-slash           # 각 워드리스트 항목 끝에 '/'를 붙여서 디렉토리 여부 명확화 테스트
```

---

## 3. Advanced Techniques

### 거대 워드리스트 및 백업 파일 헌팅
큰 워드리스트와 자주 쓰이는 백업/로그 확장자를 결합하여 중요 정보 유출 탐색
```bash
gobuster dir -u http://<target>/ -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -x bak,backup,old,zip,tar.gz,sql,log -t 100
```
