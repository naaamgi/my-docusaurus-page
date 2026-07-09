---
sidebar_position: 9
title: Wfuzz
---

# Wfuzz (웹 애플리케이션 퍼저)

## Overview

**Wfuzz**: Python 기반의 다목적 웹 퍼징 도구. 디렉토리 발견, 파라미터 인젝션, 폼(Form) 브루트포스 등 웹 애플리케이션 취약점 진단 전반에 활용 가능.
- **특징**: 다양한 페이로드 타입(파일, 리스트, 범위 등) 조합 지원 및 강력한 응답 필터링 기능

---

## 1. Reconnaissance (기본 퍼징)

### 디렉토리 및 파일 스캔
지정된 위치(`FUZZ`)에 워드리스트를 치환하여 요청 전송
```bash
# 기본 스캔 (403, 404 상태 코드 숨기기)
wfuzz -c -z file,/usr/share/wordlists/dirb/common.txt --hc 403,404 http://<target>/FUZZ

# 파일 확장자 탐색
wfuzz -c -z file,wordlist.txt --hc 404 http://<target>/FUZZ.php
```

### 서브도메인 및 VHost 열거
Host 헤더에 페이로드를 주입하여 가상 호스트 식별
```bash
# 단어 수(hw)나 상태 코드(hc)를 기준으로 False Positive 필터링
wfuzz -c -z file,subdomains.txt -H "Host: FUZZ.<target_domain>" --hc 400,403,404 http://<target>/

# 기본 페이지의 특정 단어 수(--hw)를 확인 후 제외하여 실제 존재하는 VHost만 필터링
wfuzz -c -z file,subdomains.txt -H "Host: FUZZ.<target_domain>" --hw <default_word_count> http://<target>/
```

---

## 2. Exploitation (정밀 타겟팅)

### 다중 Payload (다중 위치 퍼징)
여러 개의 `FUZZ` 키워드(FUZZ, FUZ2Z, FUZ3Z 등)에 각각 다른 페이로드를 주입
```bash
# 디렉토리(FUZZ)와 확장자(FUZ2Z) 동시 퍼징
wfuzz -c -z file,wordlist.txt -z list,txt-php-html --hc 404 http://<target>/FUZZ.FUZ2Z
```

### 인증(Login) 폼 브루트포스
POST 요청 데이터를 제어하여 계정 정보 대입 공격 수행
```bash
# 응답 본문에 "Invalid login" 문자열이 없는 경우(--ss)를 성공으로 간주
wfuzz -c -X POST -z file,passwords.txt -d "username=admin&password=FUZZ" --ss "Success" http://<target>/login.php
```

### 숫자 범위(Range) 퍼징
순차적인 ID값이나 시간, PID 등을 추측할 때 유용
```bash
# 0000~9999 숫자 대입 (백업 파일 등 탐색)
wfuzz -c -z range,1000-9999 --hc 404 http://<target>/backup_FUZZ.zip
```

---

## 3. Advanced Techniques

### 강력한 필터링 옵션 (Show/Hide)
응답 결과에서 유의미한 데이터만 골라내기 위한 필터 옵션
```bash
# 응답 숨기기 (Hide)
--hc 404,403      # 특정 상태 코드 숨기기
--hl 50           # 응답 라인 수가 50인 결과 숨기기
--hw 100          # 응답 단어 수가 100인 결과 숨기기
--hh 1024         # 응답 크기(문자 수)가 1024인 결과 숨기기
--hs "error"      # 본문에 "error" 정규식이 포함된 결과 숨기기

# 응답 표시하기 (Show - Hide와 반대 개념)
--sc 200,301      # 지정한 상태 코드만 표시
--ss "success"    # 본문에 "success"가 포함된 결과만 표시
```

### 인코더 활용
Wfuzz 내장 인코더를 통해 주입되는 페이로드를 자동으로 인코딩하여 전송
```bash
# 사용 가능한 인코더 목록 확인
wfuzz -e encoders

# URL 인코딩(urlencode) 적용
wfuzz -c -z file,sqli.txt,urlencode http://<target>/search?q=FUZZ
```
