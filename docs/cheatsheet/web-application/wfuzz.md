---
sidebar_position: 9
---

# Wfuzz

> https://github.com/xmendez/wfuzz

웹 애플리케이션 퍼저 및 브루트포스 도구입니다.

## 기본 옵션

```bash
-w        # 워드리스트
-u        # 타겟 URL
-c        # 컬러 출력
-f        # 결과를 파일로 저장
--hc      # 응답 코드 숨기기
--hw      # 단어 수 숨기기
--hh      # 헤더 크기 숨기기
--sc      # 표시할 응답 코드만
--ss      # 특정 문자열 포함된 것만 표시
-t        # 스레드 수
-z        # Payload 타입
-d        # POST 데이터
-X        # HTTP 메소드
-H        # 헤더
```

## 기본 디렉토리/파일 퍼징

```bash
# 기본 스캔
wfuzz -w /usr/share/wfuzz/wordlist/general/big.txt -u http://<RHOST>/FUZZ/<FILE>.php --hc '403,404'

# Git 디렉토리 스캔
wfuzz -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-files-lowercase.txt -u http://<RHOST>/FUZZ --hc 403,404
```

## 파일 출력

```bash
wfuzz -w /PATH/TO/WORDLIST -c -f output.txt -u http://<RHOST> --hc 403,404
```

## 커스텀 스캔

```bash
# 200 응답만 표시, 20 스레드
wfuzz -w /PATH/TO/WORDLIST -u http://<RHOST>/dev/304c0c90fbc6520610abbf378e2339d1/db/file_FUZZ.txt --sc 200 -t 20
```

## 다중 Parameter Fuzzing

```bash
# 파일명과 확장자 동시 퍼징
wfuzz -w /usr/share/wordlists/seclists/Discovery/Web-Content/big.txt -u http://<RHOST>:/<directory>/FUZZ.FUZ2Z -z list,txt-php --hc 403,404 -c
```

## VHost / Subdomain Discovery

```bash
# Host 헤더로 VHost 발견
wfuzz --hh 0 -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -H 'Host: FUZZ.<RHOST>' -u http://<RHOST>/

# Subdomain 브루트포스
wfuzz -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-110000.txt -H "Host: FUZZ.<RHOST>" --hc 200 --hw 356 -t 100 <RHOST>

# DNS 서브도메인 스캔
wfuzz -c -w /usr/share/wordlists/secLists/Discovery/DNS/subdomains-top1million-110000.txt --hc 400,404,403 -H "Host: FUZZ.<RHOST>" -u http://<RHOST> -t 100

# 특정 단어 수 제외
wfuzz -c -w /usr/share/wordlists/secLists/Discovery/DNS/subdomains-top1million-110000.txt --hc 400,403,404 -H "Host: FUZZ.<RHOST>" -u http://<RHOST> --hw <value> -t 100

# Origin 헤더로 CORS 테스트
wfuzz -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -H "Origin: http://FUZZ.<RHOST>" --filter "r.headers.response~'Access-Control-Allow-Origin'" http://<RHOST>/
```

## Login 브루트포스

```bash
# Email 브루트포스
wfuzz -X POST -u "http://<RHOST>:<RPORT>/login.php" -d "email=FUZZ&password=<PASSWORD>" -w /PATH/TO/WORDLIST/<WORDLIST> --hc 200 -c

# Username 브루트포스 (특정 문자열 매칭)
wfuzz -X POST -u "http://<RHOST>:<RPORT>/login.php" -d "username=FUZZ&password=<PASSWORD>" -w /PATH/TO/WORDLIST/<WORDLIST> --ss "Invalid login"
```

## SQL Injection Fuzzing

```bash
wfuzz -c -z file,/usr/share/wordlists/seclists/Fuzzing/SQLi/Generic-SQLi.txt -d 'db=FUZZ' --hl 16 http://<RHOST>/select
```

## 숫자 범위 퍼징

```bash
# 4자리 숫자 (백업 파일)
wfuzz -w /usr/share/wordlists/seclists/Fuzzing/4-digits-0000-9999.txt --hw 31 http://10.13.37.11/backups/backup_2021052315FUZZ.zip

# PID Enumeration
wfuzz -u 'http://backdoor.htb/wp-content/plugins/ebook-download/filedownload.php?ebookdownloadurl=/proc/FUZZ/cmdline' -z range,900-1000
```

## Payload 타입

```bash
# 리스트
-z list,value1-value2-value3

# 파일
-z file,/path/to/wordlist.txt

# 범위
-z range,1-100

# 조합
-z list,txt-php -z list,admin-test
```

## 필터링 옵션

```bash
# 응답 코드로 필터링
--hc 403,404          # 숨기기
--sc 200,301          # 표시만

# 단어 수로 필터링
--hw 100              # 100 단어 숨기기

# 라인 수로 필터링
--hl 50               # 50 라인 숨기기

# 문자 수로 필터링
--hh 1024             # 1024 글자 숨기기

# 정규식으로 필터링
--ss "success"        # "success" 포함된 것만
--hs "error"          # "error" 포함된 것 숨기기
```

## 참고

- FUZZ는 기본 키워드 (FUZ2Z, FUZ3Z 등으로 다중 퍼징)
- `--hc` vs `--sc`: 숨기기 vs 표시만
- `-t` 스레드 수 조절로 속도 향상
- `--ss`/`--hs`로 응답 내용 기반 필터링
- ffuf보다 느리지만 더 많은 기능 제공
