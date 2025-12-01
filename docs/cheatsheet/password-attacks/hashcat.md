---
sidebar_position: 1
---

# hashcat

> https://hashcat.net/hashcat/

> https://hashcat.net/wiki/

GPU 기반 고속 비밀번호 크래킹 도구입니다.

## 설치

```bash
# Kali Linux
sudo apt install hashcat

# 또는 공식 사이트에서 다운로드
# https://hashcat.net/hashcat/
```

## 기본 사용법

```bash
hashcat -m <MODE> <HASH_FILE> <WORDLIST>
hashcat -a <ATTACK_MODE> -m <MODE> <HASH_FILE> <WORDLIST>
```

## Hash 모드 (-m)

### 일반적인 Hash

```bash
hashcat -m 0 hash.txt wordlist.txt          # MD5
hashcat -m 100 hash.txt wordlist.txt        # SHA1
hashcat -m 1400 hash.txt wordlist.txt       # SHA256
hashcat -m 1700 hash.txt wordlist.txt       # SHA512
hashcat -m 1800 hash.txt wordlist.txt       # SHA512(Unix)
hashcat -m 900 hash.txt wordlist.txt        # MD4
hashcat -m 1000 hash.txt wordlist.txt       # NTLM
hashcat -m 3200 hash.txt wordlist.txt       # bcrypt
hashcat -m 160 hash.txt wordlist.txt        # HMAC-SHA1
```

### Windows

```bash
hashcat -m 1000 hash.txt wordlist.txt       # NTLM
hashcat -m 3000 hash.txt wordlist.txt       # LM
```

### Kerberos

```bash
hashcat -m 18200 hash.txt wordlist.txt      # Kerberos 5 AS-REP (ASREPRoast)
hashcat -m 13100 hash.txt wordlist.txt      # Kerberos 5 TGS-REP (Kerberoasting)
hashcat -m 19600 hash.txt wordlist.txt      # Kerberos 5 TGS-REP AES256
hashcat -m 19700 hash.txt wordlist.txt      # Kerberos 5 TGS-REP AES128
```

### NetNTLMv2

```bash
hashcat -m 5600 hash.txt wordlist.txt       # NetNTLMv2
```

## Attack 모드 (-a)

```bash
-a 0    # Straight (Dictionary attack)
-a 1    # Combination
-a 3    # Brute-force
-a 6    # Hybrid Wordlist + Mask
-a 7    # Hybrid Mask + Wordlist
```

## 예제

### Dictionary Attack

```bash
hashcat -a 0 -m 0 hash.txt /usr/share/wordlists/rockyou.txt
hashcat -a 0 -m 1000 ntlm.txt /usr/share/wordlists/rockyou.txt
```

### Rule-based Attack

```bash
hashcat -a 0 -m 0 hash.txt wordlist.txt -r /usr/share/hashcat/rules/best64.rule
hashcat -a 0 -m 1000 ntlm.txt wordlist.txt -r rules/OneRuleToRuleThemAll.rule
```

### Brute-force Attack

```bash
# 모든 조합 (최대 8자)
hashcat -a 3 -m 0 hash.txt ?a?a?a?a?a?a?a?a

# 소문자 + 숫자 (6자)
hashcat -a 3 -m 0 hash.txt ?l?l?l?l?d?d

# 대문자 시작 + 소문자 + 숫자 + 특수문자
hashcat -a 3 -m 0 hash.txt ?u?l?l?l?l?d?d?s
```

### Mask Attack (패턴 기반)

```bash
# Password123! 형태
hashcat -a 3 -m 0 hash.txt ?u?l?l?l?l?l?l?l?d?d?d?s

# 특정 패턴
hashcat -a 3 -m 0 hash.txt mantas?d?d?d?u?u?u --stdout

# Custom charset
hashcat -a 3 -m 0 hash.txt -1 ?l?u -2 ?d?s ?1?1?1?1?2?2
```

### Hybrid Attack

```bash
# Wordlist + Mask
hashcat -a 6 -m 0 hash.txt wordlist.txt ?d?d?d

# Mask + Wordlist  
hashcat -a 7 -m 0 hash.txt ?d?d?d wordlist.txt
```

## Charset

```bash
?l = abcdefghijklmnopqrstuvwxyz                # 소문자
?u = ABCDEFGHIJKLMNOPQRSTUVWXYZ                # 대문자
?d = 0123456789                                 # 숫자
?s = !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~          # 특수문자
?a = ?l?u?d?s                                   # 모두
?b = 0x00 - 0xff                                # 모든 바이트
```

## Custom Rules

### Rule 파일 생성

```bash
# 끝에 1 추가
echo '$1' > custom.rule

# 첫 글자 대문자
echo 'c' > custom.rule

# 여러 규칙
cat > custom.rule << EOF
$1
$2
$3
c
EOF
```

### Rule 문법

```bash
:       # 아무것도 안함
l       # 모두 소문자
u       # 모두 대문자
c       # 첫 글자 대문자, 나머지 소문자
C       # 첫 글자 소문자, 나머지 대문자
t       # 대소문자 반전
$X      # 끝에 X 추가
^X      # 앞에 X 추가
```

### Rule 예제

```bash
# 끝에 1 추가
$1

# 끝에 ! 추가
$!

# 첫 글자 대문자 + 끝에 1
c $1

# 여러 숫자 추가
$1 $2 $3
```

### Rule 미리보기

```bash
hashcat -r custom.rule --stdout wordlist.txt
```

## 옵션

```bash
-m            # Hash 타입
-a            # Attack 모드
-r            # Rule 파일
-o            # 결과 출력 파일
--show        # 크랙된 비밀번호 표시
--username    # Username:Hash 형식 처리
-O            # 최적화 모드 (길이 제한 있음)
--force       # 강제 실행
-w            # Workload profile (1-4)
--session     # 세션 이름
--restore     # 세션 복구
--potfile-disable  # Potfile 사용 안함
--stdout      # 생성된 후보만 출력
-1, -2, -3, -4     # Custom charset
```

## Kerberos 크래킹

### ASREPRoast

```bash
hashcat -m 18200 -a 0 asreproast.txt /usr/share/wordlists/rockyou.txt
hashcat -m 18200 --force asreproast.txt wordlist.txt
```

### Kerberoasting

```bash
hashcat -m 13100 --force kerberoast.txt wordlist.txt
hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt
```

## NetNTLMv2 크래킹

```bash
# Responder로 캡처한 해시
hashcat -m 5600 netntlmv2.txt wordlist.txt

# InternalMonologue로 생성한 해시
hashcat -m 5600 'user::DOMAIN:challenge:response:response' wordlist.txt --force --potfile-disable
```

## 유용한 명령어

### Hash 타입 확인

```bash
hashcat --example-hashes
hashcat --example-hashes | grep -i "ntlm"
hashcat --help | grep -i "kerberos"
```

### Hash 식별

```bash
hashcat --identify hash.txt
hashcat --identify --user hash.txt
```

### 크랙된 비밀번호 보기

```bash
hashcat --show hash.txt
hashcat --show -m 1000 ntlm.txt
```

### 진행 상황 확인

```bash
# 실행 중 's' 키 - 상태 표시
# 실행 중 'p' 키 - 일시정지
# 실행 중 'r' 키 - 재개
# 실행 중 'q' 키 - 종료
```

### 세션 관리

```bash
# 세션으로 시작
hashcat -m 1000 hash.txt wordlist.txt --session mysession

# 세션 복구
hashcat --restore --session mysession
```

## 성능 최적화

```bash
# 최적화 모드 (빠르지만 길이 제한)
hashcat -m 1000 hash.txt wordlist.txt -O

# Workload 조정 (1=낮음, 4=악몽)
hashcat -m 1000 hash.txt wordlist.txt -w 3

# GPU 선택
hashcat -m 1000 hash.txt wordlist.txt -d 1,2
```

## 유용한 Wordlist

```bash
/usr/share/wordlists/rockyou.txt
/usr/share/wordlists/fasttrack.txt
/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000000.txt
```

## 유용한 Rules

```bash
/usr/share/hashcat/rules/best64.rule
/usr/share/hashcat/rules/rockyou-30000.rule
/usr/share/hashcat/rules/d3ad0ne.rule
```

### OneRuleToRuleThemAll

> https://github.com/NotSoSecure/password_cracking_rules

```bash
hashcat -m 3200 hash.txt -r OneRuleToRuleThemAll.rule wordlist.txt
```

## 참고

- GPU 사용으로 CPU보다 훨씬 빠름
- `-O` 옵션은 빠르지만 비밀번호 길이 제한
- Rule-based attack이 효과적
- ASREPRoast와 Kerberoasting에 자주 사용
- Potfile에 크랙된 비밀번호 자동 저장
- `--force`는 경고 무시 (주의해서 사용)
