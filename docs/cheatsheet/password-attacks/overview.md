---
sidebar_position: 1
title: Overview (Credential Attacks)
---

# 계정 정보 기반 공격 (Credential Attacks)

## Overview

**Credential Attacks**: 식별된 서비스의 인증을 우회하기 위해 사용자 계정 정보를 무차별 대입하거나 유출된 정보를 재사용하는 공격 기법.
- **주의사항**: (현업 필수) 서비스 가용성(Availability)에 영향을 주지 않도록 계정 잠금 정책을 사전에 필히 파악하고, 무리한 Brute Force 공격(예: 계정당 수백 번 시도)은 지양해야 함.

---

## 1. Reconnaissance (정책 확인 및 사용자 열거)

### 계정 잠금(Account Lockout) 정책 확인
공격을 시작하기 전에 대상 시스템의 로그인 실패 허용 횟수를 파악 (예: 5회 실패 시 30분 잠금)
- 정책을 모를 경우, 가상의 계정(예: `testuser_1234`)으로 5~10회 시도하여 잠금 여부 확인

### 대상 사용자(Usernames) 수집
공격 대상을 특정하기 위한 1차 열거 작업
- 웹 애플리케이션: 회원가입, 비밀번호 찾기 기능에서 "이미 존재하는 계정입니다" 응답 확인
- SMB/RPC: 익명 접근을 통해 `Enum4linux` 등으로 도메인 유저 목록 확보
- 이메일: 회사 이메일 규칙(예: `firstname.lastname@company.com`) 유추

---

## 2. Exploitation (주요 공격 기법)

### 패스워드 스프레이 (Password Spraying)
하나의 (혹은 소수의) 유력한 비밀번호를 수많은 사용자 계정에 한 번씩만 시도하여 계정 잠금을 우회하는 공격 기법
```bash
# 다수 유저 목록에 단일 패스워드 스프레잉 시도 (SSH 예시)
hydra -L users.txt -p 'Welcome2024!' ssh://<target_ip> -s 22 -V
```

### 크레덴셜 스터핑 (Credential Stuffing)
과거 다른 사이트에서 유출된 계정 정보(이메일:비밀번호) 쌍을 대상 시스템에 그대로 대입하는 공격
- 비밀번호 재사용(Password Reuse) 습관 악용
- 방어 측면에서는 유출 데이터(Dehashed, HaveIBeenPwned 등)를 활용한 모니터링 필요

### 기본 계정 (Default Credentials) 시도
Tomcat, Jenkins, 네트워크 장비 등에 설정된 초기 기본 계정으로 로그인 시도
- Tomcat: `admin:admin`, `tomcat:tomcat`
- MySQL: `root:root`, `root:`(빈 패스워드)
- WebLogic: `weblogic:weblogic1`

### 브루트포스 및 사전 대입 공격 (Dictionary Attack)
특정 중요 계정(예: admin)의 비밀번호를 무작위 또는 단어 사전을 통해 지속 대입 (가용성 영향 주의)
```bash
# 계정 잠금 정책이 없거나 무력화된 경우에 한해 제한적으로 수행
hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<target_ip> -s 22 -V -f
```

---

## 3. Advanced Techniques

### 속도 조절 및 회피 기법
웹 방화벽(WAF) 차단 및 계정 잠금을 피하기 위한 최적화 기법
```bash
# Hydra 병렬 연결 수(쓰레드) 조절 및 요청 간격 설정 (-t 및 대기 시간 옵션)
# 과도한 병렬 요청은 서비스(DoS) 장애를 유발할 수 있으므로 1~4 수준 유지 권장
hydra -t 4 -l admin -P custom_passwords.txt <target> http-post-form "/login:user=^USER^&pass=^PASS^:F=Failed"
```

### 타겟 맞춤형 워드리스트(Wordlist) 생성
Crunch나 CeWL을 이용해 타겟 기업에 특화된(회사명, 서비스명, 연도 포함) 단어 사전 제작
```bash
# CeWL을 이용해 타겟 웹사이트에서 단어 수집
cewl http://<target> -m 6 -w company_words.txt

# Crunch를 통해 특정 패턴(회사명+연도+특수문자) 생성
crunch 12 12 -t Company202@! > target_passwords.txt
```
