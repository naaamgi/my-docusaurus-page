---
sidebar_position: 3
---

# John the Ripper

강력한 오프라인 비밀번호 크래커입니다.

## 설치

```bash
# Kali Linux
sudo apt install john

# Jumbo 버전 (더 많은 기능)
git clone https://github.com/openwall/john.git
cd john/src
./configure
make
```

## 기본 사용법

```bash
john <HASH_FILE>
john <HASH_FILE> --wordlist=<WORDLIST>
john <HASH_FILE> --format=<FORMAT>
```

## Hash 포맷 변환

### SSH 키

```bash
ssh2john id_rsa > ssh.hash
john ssh.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### ZIP 파일

```bash
zip2john file.zip > zip.hash
john zip.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### RAR 파일

```bash
rar2john file.rar > rar.hash
john rar.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### KeePass

```bash
keepass2john database.kdbx > keepass.hash
john keepass.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### PDF

```bash
pdf2john file.pdf > pdf.hash
john pdf.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### Office 문서

```bash
office2john document.docx > office.hash
john office.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### 7z

```bash
7z2john file.7z > 7z.hash
john 7z.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### LUKS

```bash
luks2john /dev/sdX > luks.hash
john luks.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### Bitcoin Wallet

```bash
bitcoin2john wallet.dat > bitcoin.hash
john bitcoin.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

## Hash 포맷

### Unix/Linux

```bash
# /etc/shadow 해시
john shadow.hash --format=crypt
john shadow.hash --format=sha512crypt
```

### Windows

```bash
# NTLM
john ntlm.hash --format=NT
john ntlm.hash --format=ntlmv2
```

### 기타

```bash
john hash.txt --format=Raw-MD5
john hash.txt --format=Raw-SHA1
john hash.txt --format=Raw-SHA256
john hash.txt --format=bcrypt
```

## Attack 모드

### Dictionary Attack

```bash
john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt
john hash.txt --wordlist=/usr/share/wordlists/fasttrack.txt
```

### Rule-based Attack

```bash
# 기본 룰 적용
john hash.txt --wordlist=wordlist.txt --rules

# 특정 룰 파일 사용
john hash.txt --wordlist=wordlist.txt --rules=JumboSingle
john hash.txt --wordlist=wordlist.txt --rules=best64
```

### Incremental Mode (Brute-force)

```bash
# 기본 incremental
john hash.txt --incremental

# ASCII 문자만
john hash.txt --incremental=ASCII

# 숫자만
john hash.txt --incremental=Digits

# 소문자만
john hash.txt --incremental=Lower

# 대문자만
john hash.txt --incremental=Upper

# 알파벳만
john hash.txt --incremental=Alpha
```

### Single Crack Mode

```bash
# GECOS 정보 기반
john hash.txt --single
```

## 옵션

```bash
--wordlist=<FILE>        # 워드리스트 지정
--rules                  # 룰 적용
--format=<FORMAT>        # 해시 포맷 지정
--incremental            # Brute-force
--single                 # Single crack mode
--show                   # 크랙된 비밀번호 표시
--pot=<FILE>             # Potfile 경로
--session=<NAME>         # 세션 이름
--restore=<NAME>         # 세션 복구
--fork=<N>               # 멀티프로세싱
--devices=<N>            # GPU 장치 번호
--mask=<MASK>            # Mask attack
```

## 크랙된 비밀번호 확인

```bash
john --show hash.txt
john --show --format=NT ntlm.hash
john --show ssh.hash
```

## 세션 관리

```bash
# 세션 시작
john hash.txt --session=mysession --wordlist=wordlist.txt

# Ctrl+C로 중단 후 복구
john --restore=mysession

# 또는 단순히
john --restore
```

## Custom Wordlist 생성

### Mask Attack

```bash
# ?d = 숫자, ?l = 소문자, ?u = 대문자, ?s = 특수문자
john --mask='?u?l?l?l?l?d?d' --stdout > wordlist.txt
john --mask='password?d?d?d' --stdout > wordlist.txt
```

### 기존 워드리스트에 룰 적용

```bash
john --wordlist=base.txt --rules --stdout > enhanced.txt
```

## Rules

### 내장 Rules

```bash
john hash.txt --wordlist=wordlist.txt --rules=Single
john hash.txt --wordlist=wordlist.txt --rules=Wordlist
john hash.txt --wordlist=wordlist.txt --rules=Extra
john hash.txt --wordlist=wordlist.txt --rules=Jumbo
john hash.txt --wordlist=wordlist.txt --rules=KoreLogic
john hash.txt --wordlist=wordlist.txt --rules=All
```

### Custom Rule 작성

john.conf 또는 john-local.conf 파일에 추가:

```ini
[List.Rules:MyRule]
# 끝에 숫자 추가
$[0-9]

# 첫 글자 대문자
c

# 끝에 특수문자 추가
$[!@#$%]

# 조합
cAz"[0-9][0-9]"
```

사용:
```bash
john hash.txt --wordlist=wordlist.txt --rules=MyRule
```

## 실제 예제

### Linux Shadow 파일

```bash
# /etc/shadow 복사
sudo cat /etc/shadow > shadow.txt

# John으로 크랙
john shadow.txt --wordlist=/usr/share/wordlists/rockyou.txt

# 결과 확인
john --show shadow.txt
```

### SSH 키 크랙

```bash
# 변환
ssh2john id_rsa > ssh.hash

# 크랙
john ssh.hash --wordlist=/usr/share/wordlists/rockyou.txt

# 결과
john --show ssh.hash
```

### ZIP 파일 크랙

```bash
zip2john secret.zip > zip.hash
john zip.hash --wordlist=/usr/share/wordlists/rockyou.txt
john --show zip.hash
```

### KeePass 데이터베이스

```bash
keepass2john Database.kdbx > keepass.hash
john keepass.hash --wordlist=/usr/share/wordlists/rockyou.txt --format=KeePass
john --show keepass.hash
```

## 멀티프로세싱

```bash
# CPU 코어 수만큼 포크
john hash.txt --wordlist=wordlist.txt --fork=4

# GPU 사용
john hash.txt --wordlist=wordlist.txt --format=sha512crypt-opencl --devices=0
```

## 포맷 목록 확인

```bash
john --list=formats
john --list=formats | grep -i ntlm
john --list=formats | grep -i md5
```

## 성능 벤치마크

```bash
john --test
john --test --format=sha512crypt
```

## 유용한 워드리스트

```bash
/usr/share/wordlists/rockyou.txt
/usr/share/wordlists/fasttrack.txt
/usr/share/john/password.lst
/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000000.txt
```

## 특수 케이스

### NTLM Hash (Windows)

```bash
# 형식: username:uid:lm_hash:ntlm_hash:::
john ntlm.hash --format=NT --wordlist=/usr/share/wordlists/rockyou.txt
```

### NetNTLMv2

```bash
john netntlmv2.hash --format=netntlmv2 --wordlist=/usr/share/wordlists/rockyou.txt
```

### Kerberos

```bash
# AS-REP Roasting
john asrep.hash --format=krb5asrep --wordlist=/usr/share/wordlists/rockyou.txt

# Kerberoasting
john kerberoast.hash --wordlist=/usr/share/wordlists/rockyou.txt
```

### MD5 (Raw)

```bash
john md5.hash --format=Raw-MD5 --wordlist=/usr/share/wordlists/rockyou.txt
```

## Potfile 관리

```bash
# 기본 potfile 위치
~/.john/john.pot

# 다른 potfile 사용
john hash.txt --pot=custom.pot --wordlist=wordlist.txt

# Potfile 초기화 (조심!)
rm ~/.john/john.pot
```

## 상태 확인

```bash
# 실행 중 아무 키나 누르면 상태 표시
# Ctrl+C로 일시정지 (세션 저장됨)
```

## 참고

- John the Ripper Jumbo 버전이 더 많은 포맷 지원
- `--fork` 옵션으로 멀티코어 활용
- Rules를 사용하면 워드리스트 효율 크게 증가
- SSH 키, ZIP 등은 반드시 변환 도구 사용
- GPU 버전(--opencl)이 CPU보다 훨씬 빠름
- Incremental 모드는 시간이 오래 걸림
- 세션 기능으로 중단 후 재개 가능
- Potfile에 크랙된 비밀번호 자동 저장
