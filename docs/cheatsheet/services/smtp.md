---
sidebar_position: 19
---

# SMTP - 25

## 기본 정보

**포트**: 25 (SMTP), 465 (SMTPS), 587 (Submission)

SMTP(Simple Mail Transfer Protocol)는 이메일 전송을 위한 프로토콜입니다.

## Telnet/NC를 이용한 수동 연결

```bash
# Telnet으로 연결
telnet <RHOST> 25

# Netcat으로 연결
nc <RHOST> 25
```

## SMTP 명령어

```bash
# 연결 후 명령어
HELO <DOMAIN>
EHLO <DOMAIN>

# 발신자 설정
MAIL FROM:<sender@domain.com>

# 수신자 설정
RCPT TO:<recipient@domain.com>

# 메일 내용 시작
DATA
Subject: Test Email
From: sender@domain.com
To: recipient@domain.com

This is a test email.
.

# 연결 종료
QUIT
```

## 사용자 열거

### VRFY (Verify)

```bash
# Telnet으로 사용자 확인
telnet <RHOST> 25
VRFY root
VRFY admin
VRFY user
```

### EXPN (Expand)

```bash
telnet <RHOST> 25
EXPN root
EXPN admin
```

### RCPT TO

```bash
telnet <RHOST> 25
MAIL FROM:test@test.com
RCPT TO:root@<DOMAIN>
RCPT TO:admin@<DOMAIN>
```

## smtp-user-enum

```bash
# VRFY 모드
smtp-user-enum -M VRFY -U /usr/share/wordlists/users.txt -t <RHOST>

# EXPN 모드
smtp-user-enum -M EXPN -U /usr/share/wordlists/users.txt -t <RHOST>

# RCPT 모드
smtp-user-enum -M RCPT -U /usr/share/wordlists/users.txt -t <RHOST>

# 포트 지정
smtp-user-enum -M VRFY -U users.txt -t <RHOST> -p 25
```

## Nmap

```bash
# SMTP 버전 확인
sudo nmap -p25 -sV <RHOST>

# SMTP 명령어 확인
sudo nmap -p25 --script smtp-commands <RHOST>

# SMTP 사용자 열거
sudo nmap -p25 --script smtp-enum-users <RHOST>

# SMTP Open Relay 확인
sudo nmap -p25 --script smtp-open-relay <RHOST>

# SMTP 취약점 스캔
sudo nmap -p25 --script smtp-vuln-* <RHOST>
```

## swaks (Swiss Army Knife for SMTP)

```bash
# 기본 이메일 전송
swaks --to recipient@domain.com --from sender@domain.com --server <RHOST>

# 첨부파일 포함
swaks --to recipient@domain.com --from sender@domain.com --server <RHOST> --attach /path/to/file

# TLS 사용
swaks --to recipient@domain.com --from sender@domain.com --server <RHOST> --tls

# 인증 사용
swaks --to recipient@domain.com --from sender@domain.com --server <RHOST> --auth-user <USERNAME> --auth-password <PASSWORD>
```

## 피싱 이메일 전송

```bash
# HTML 이메일
swaks --to target@company.com \
      --from trusted@company.com \
      --server <RHOST> \
      --header "Subject: Important Security Update" \
      --body "Please click here: http://malicious.com" \
      --attach-type text/html
```

## Hydra 브루트포스

```bash
# SMTP 브루트포스
hydra -L users.txt -P passwords.txt <RHOST> smtp

# SMTP AUTH
hydra -l admin -P passwords.txt <RHOST> smtp -s 587
```

## 참고

- Open Relay 확인
- 사용자 열거 (VRFY, EXPN, RCPT)
- SPF, DKIM, DMARC 레코드 확인
- 피싱 이메일 전송 가능 여부
- STARTTLS 지원 확인
