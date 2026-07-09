---
sidebar_position: 1
title: FFUF (Fuzz Faster U Fool)
---

# FFUF (웹 디렉토리/파라미터 퍼징)

## Overview

**FFUF (Fuzz Faster U Fool)**: Go 언어로 작성된 매우 빠르고 확장성이 뛰어난 웹 퍼징(Fuzzing) 도구. 디렉토리 버스팅, 가상 호스트(VHost) 식별, 파라미터 및 API 엔드포인트 탐색 등에 널리 사용됨.

---

## 1. Reconnaissance (기본 스캐닝)

### 디렉토리 및 파일 탐색
가장 기본적인 워드리스트를 사용한 웹 경로 탐색
```bash
# 기본 디렉토리 스캔
ffuf -u http://<target>/FUZZ -w /usr/share/wordlists/dirb/common.txt

# 여러 확장자 지정
ffuf -u http://<target>/FUZZ -w wordlist.txt -e .php,.html,.txt

# 특정 상태 코드(200, 301, 302)만 출력
ffuf -u http://<target>/FUZZ -w wordlist.txt -mc 200,301,302
```

### 서브도메인 및 가상 호스트(VHost) 열거
DNS 조회가 아닌 Host 헤더 조작을 통한 내부 가상 호스트 탐지
```bash
# Host 헤더를 FUZZ로 지정하여 VHost 열거 (-ac: 자동 캘리브레이션으로 기본 페이지 크기 필터링)
ffuf -u http://<target> -H "Host: FUZZ.<target_domain>" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -ac

# 응답 크기(Filter Size)를 수동으로 지정하여 오탐 제거
ffuf -u http://<target> -H "Host: FUZZ.<target_domain>" -w wordlist.txt -fs 185
```

---

## 2. Exploitation (고급 퍼징 및 필터링)

### API 및 파라미터 퍼징
REST API 엔드포인트나 숨겨진 GET/POST 파라미터 식별
```bash
# API 엔드포인트 퍼징 (응답 400, 404, 412 제외)
ffuf -u https://<target>/api/v2/FUZZ -w api_endpoints.txt -fc 400,404,412

# GET 파라미터 식별
ffuf -u "http://<target>/api/user?FUZZ=1" -w params.txt -ac

# POST 데이터 퍼징
ffuf -u http://<target>/login -X POST -d "username=FUZZ&password=test" -H "Content-Type: application/x-www-form-urlencoded" -w users.txt
```

### 여러 위치 동시 퍼징 (Clusterbomb)
두 개 이상의 워드리스트를 조합하여 모든 경우의 수(Permutation) 테스트
```bash
# 사용자명(W1)과 비밀번호(W2) 조합 브루트포스
ffuf -u http://<target>/login -X POST -d "user=W1&pass=W2" -w users.txt:W1 -w passwords.txt:W2 -mode clusterbomb
```

### Burp Suite Request 파일 연동
복잡한 헤더와 쿠키가 포함된 HTTP 요청 파일을 그대로 가져와서 활용
```bash
# req.txt 파일 내의 FUZZ 문자열을 워드리스트로 치환하여 전송
ffuf -request req.txt -request-proto http -w wordlist.txt
```

---

## 3. Advanced Techniques

### 다양한 필터링 옵션 (Match & Filter)
정상 응답과 비정상 응답(False Positives)을 구분하는 핵심 옵션
```bash
-mc 200,204,301       # [Match Codes] 지정한 상태 코드만 표시 (기본: 200,204,301,302,307,401,403)
-fc 403,404           # [Filter Codes] 지정한 상태 코드 제외
-fs 100-200           # [Filter Size] 응답 크기가 100~200 바이트인 결과 제외
-fw 42                # [Filter Words] 단어 개수가 42개인 결과 제외
-fl 10                # [Filter Lines] 라인 수가 10개인 결과 제외
-fr "error"           # [Filter Regex] 응답 본문에 "error" 정규식이 포함된 결과 제외
```

### 성능 및 안정성 최적화
```bash
# 스레드 수 증가 (기본 40 -> 100)
ffuf -u http://<target>/FUZZ -w wordlist.txt -t 100

# Rate Limiting(속도 제한) 서버 대상 (스레드 5, 요청 당 0.5초 대기)
ffuf -u http://<target>/FUZZ -w wordlist.txt -t 5 -p 0.5

# 재귀(Recursive) 탐색 (발견된 디렉토리 하위로 계속 스캔)
ffuf -u http://<target>/FUZZ -w wordlist.txt -recursion -recursion-depth 2
```

### 주요 출력 포맷
```bash
# 결과를 JSON 파일로 저장 (-of: json, html, csv, all)
ffuf -u http://<target>/FUZZ -w wordlist.txt -o results.json -of json
```
