---
sidebar_position: 1
---

# ffuf

> https://github.com/ffuf/ffuf

빠르고 강력한 웹 퍼저(Fast web fuzzer)입니다.

## 설치

```bash
# Kali Linux
sudo apt install ffuf

# Go
go install github.com/ffuf/ffuf@latest
```

## 기본 옵션

```bash
-w        # 워드리스트 (-w wordlist.txt 또는 -w wordlist.txt:KEYWORD)
-u        # 타겟 URL (FUZZ 키워드 사용)
-H        # 헤더
-X        # HTTP 메서드 (GET, POST, PUT 등)
-d        # POST 데이터
-b        # 쿠키
-mc       # 매치할 상태 코드 (Match Codes)
-fc       # 필터링할 상태 코드 (Filter Codes)
-fs       # 필터링할 응답 크기 (Filter Size)
-fw       # 필터링할 단어 수 (Filter Words)
-fl       # 필터링할 라인 수 (Filter Lines)
-fr       # 필터링할 정규식 (Filter Regex)
-c        # 컬러 출력
-ac       # 자동 캘리브레이션 (Auto Calibration)
-t        # 스레드 수 (기본 40)
-p        # 딜레이 시간 (초)
-timeout  # 타임아웃 (초)
-e        # 파일 확장자
-o        # 결과 출력 파일
-of       # 출력 형식 (json, html, csv, all)
-s        # 조용한 모드 (배너 숨기기)
-recursion      # 재귀 탐색
-recursion-depth # 재귀 깊이
-mode     # Fuzzing 모드 (clusterbomb, pitchfork)
```

## 기본 디렉토리/파일 Fuzzing

```bash
# 응답 크기 필터링
ffuf -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/FUZZ --fs <NUMBER> -mc all

# 단어 수 필터링
ffuf -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/FUZZ --fw <NUMBER> -mc all

# 특정 상태 코드만 표시
ffuf -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/FUZZ -mc 200,204,301,302,307,401 -o results.txt

# 404, 403 제외
ffuf -w /usr/share/wordlists/dirb/common.txt -u http://<RHOST>/FUZZ -fc 404,403
```

## VHost / Subdomain Discovery

```bash
# 자동 캘리브레이션
ffuf -c -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -H "Host: FUZZ.<RHOST>" -u http://<RHOST>/ -ac

# 응답 크기로 필터링
ffuf -c -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -H "Host: FUZZ.<RHOST>" -u http://<RHOST>/ -fs 185

# 작은 워드리스트
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt -H "Host: FUZZ.<RHOST>" -u http://<RHOST> -ac
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt -H "Host: FUZZ.<RHOST>" -u http://<RHOST> -fs 1495
```

## 파일 확장자 Fuzzing

```bash
# 단일 확장자
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt -u http://<RHOST>/cd/ext/logs/FUZZ -e .log

# 여러 확장자
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -e .php,.html,.js,.txt

# 확장자 없이도 테스트
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -e .php,.html,""

# 대규모 확장자 탐색
ffuf -w /opt/seclists/Discovery/Web-Content/directory-list-1.0.txt -u http://<RHOST>/FUZZ -t 30 -c -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0' -mc 200,204,301,302,307,401,403,500 -ic -e .7z,.action,.ashx,.asp,.aspx,.backup,.bak,.bz,.c,.cgi,.conf,.config,.dat,.db,.dhtml,.do,.doc,.docm,.docx,.dot,.dotm,.go,.htm,.html,.ini,.jar,.java,.js,.js.map,.json,.jsp,.jsp.source,.jspx,.jsx,.log,.old,.pdb,.pdf,.phtm,.phtml,.pl,.py,.pyc,.pyz,.rar,.rhtml,.shtm,.shtml,.sql,.sqlite3,.svc,.tar,.tar.bz2,.tar.gz,.tsx,.txt,.wsdl,.xhtm,.xhtml,.xls,.xlsm,.xlst,.xlsx,.xltm,.xml,.zip
```

## 재귀 탐색 (Recursion)

```bash
# 재귀 디렉토리 스캔
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt -u http://<RHOST>/cd/basic/FUZZ -recursion

# 재귀 깊이 설정
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -recursion -recursion-depth 2
```

## Request 파일 사용

```bash
# Burp Suite 등에서 저장한 요청 파일 사용
ffuf -request <FILE> -w /usr/share/wordlists/dirb/common.txt

# Request 파일에서 여러 위치 fuzzing
ffuf -request req.txt -w wordlist.txt -mode clusterbomb
```

## API Fuzzing

```bash
# API 엔드포인트 fuzzing
ffuf -u https://<RHOST>/api/v2/FUZZ -w api_seen_in_wild.txt -c -ac -t 250 -fc 400,404,412

# API 파라미터 fuzzing
ffuf -u https://<RHOST>/api/user?FUZZ=value -w params.txt -ac
```

## LFI 탐지

```bash
ffuf -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt -u http://<RHOST>/admin../admin_staging/index.php?page=FUZZ -fs 15349
```

## 쿠키/세션 사용

```bash
# PHP 세션 ID와 함께
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-small.txt -u "http://<RHOST>/admin/FUZZ.php" -b "PHPSESSID=a0mjo6ukbkq271nb2rkb1joamp" -fw 2644

# 여러 쿠키
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -b "session=value; token=value"
```

## POST 요청 Fuzzing

```bash
# POST 데이터 fuzzing
ffuf -w wordlist.txt -u http://<RHOST>/login -X POST -d "username=FUZZ&password=test" -H "Content-Type: application/x-www-form-urlencoded"

# JSON POST
ffuf -w wordlist.txt -u http://<RHOST>/api -X POST -d '{"param":"FUZZ"}' -H "Content-Type: application/json"
```

## 여러 위치 동시 Fuzzing

```bash
# 2개 위치 fuzzing (사용자명과 비밀번호)
ffuf -w users.txt:USERS -w passwords.txt:PASS -u http://<RHOST>/login -X POST -d "username=USERS&password=PASS"

# Clusterbomb 모드
ffuf -w wordlist1.txt:W1 -w wordlist2.txt:W2 -u http://<RHOST>/W1/W2 -mode clusterbomb
```

## Rate Limiting

```bash
# 5개 스레드, 0.1초 딜레이
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt -t 5 -p 0.1 -u http://<RHOST>/cd/rate/FUZZ -mc 200,429

# 최소 지연 시간 설정
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -p 0.5 -t 10
```

## 숫자 범위 Fuzzing

```bash
# 백업 파일 찾기 (4자리 숫자)
ffuf -c -w /usr/share/wordlists/seclists/Fuzzing/4-digits-0000-9999.txt -u http://<RHOST>/backups/backup_2020070416FUZZ.zip
```

## 필터 옵션

```bash
# 파일 크기 필터
-fs 1234          # 크기가 1234인 응답 제외
-fs 100-200       # 100-200 범위 제외

# Word 개수 필터
-fw 42            # word 개수가 42인 응답 제외

# Line 개수 필터
-fl 10            # line 개수가 10인 응답 제외

# 상태 코드 필터
-mc 200,301       # 200, 301만 표시
-fc 404,403       # 404, 403 제외

# Regex 필터
-fr "error"       # "error" 포함된 응답 제외
-mr "success"     # "success" 포함된 응답만 표시
```

## 출력 형식

```bash
# JSON 출력
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -o output.json -of json

# HTML 출력
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -o output.html -of html

# CSV 출력
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -o output.csv -of csv

# 모든 결과 저장 (매치 여부 관계없이)
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -o output.txt -of all
```

## 성능 최적화

```bash
# 쓰레드 수 증가
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -t 100

# 타임아웃 설정
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -timeout 10

# 자동 조정
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -ac

# 조용한 모드 (배너 숨기기)
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -s

# 컬러 출력
ffuf -w wordlist.txt -u http://<RHOST>/FUZZ -c
```

## 유용한 Wordlists

```bash
# 디렉토리
/usr/share/wordlists/dirb/common.txt
/usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt

# 파일
/usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt

# 서브도메인
/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
/usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt

# LFI
/usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt

# API
/usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt
```

## 참고

- **FUZZ**는 워드리스트 항목으로 대체될 키워드
- 여러 FUZZ 위치 사용 시 `-w wordlist.txt:KEYWORD` 형식
- `-ac` 자동 캘리브레이션은 매우 유용 (false positive 제거)
- `-mc all`은 모든 상태 코드 표시
- VHost 발견 시 Host 헤더 활용
- 대량 스캔 시 `-t` 스레드 수 조절
- 속도 제한이 있는 사이트는 `-p` 딜레이 사용
- `-recursion`은 발견된 디렉토리 자동 탐색
- gobuster보다 빠르고 wfuzz보다 사용하기 쉬움
