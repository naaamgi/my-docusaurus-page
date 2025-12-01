---
sidebar_position: 1
---

# FTP - 21

## 기본 정보

**포트**: 21 (제어), 20 (데이터)

## 연결

```bash
# 기본 연결
ftp <RHOST>

# 익명 로그인 (Active Mode)
ftp -A <RHOST>

# 익명으로 재귀 다운로드
wget -r ftp://anonymous:anonymous@<RHOST>
```

## Nmap

```bash
# 포트 스캔 및 버전 확인
sudo nmap -p21 -sV <RHOST>

# 기본 스크립트 스캔
sudo nmap -p21 -sC <RHOST>

# 모든 FTP NSE 스크립트
sudo nmap -p21 --script=ftp-* <RHOST>

# 익명 로그인 확인
sudo nmap -p21 --script=ftp-anon <RHOST>

# 브루트포스
sudo nmap -p21 --script=ftp-brute <RHOST>

# 취약점 스캔
sudo nmap -p21 --script=ftp-vuln-* <RHOST>

# NSE 스크립트 찾기
ls -lh /usr/share/nmap/scripts/*ftp*
locate -r '\.nse$' | xargs grep categories | grep ftp
```

## FTP 명령어

```bash
# 바이너리 모드 (파일 전송 전 필수)
binary

# 디렉토리 목록
ls
dir

# 디렉토리 이동
cd <directory>

# 파일 다운로드
get <filename>

# 파일 업로드
put <filename>

# 다중 파일 다운로드
mget *

# 현재 디렉토리 확인
pwd

# 로컬 명령 실행
!<command>

# 종료
bye
quit
```

## 브루트포스

### Hydra

```bash
# 사용자명:비밀번호 조합 파일
hydra <RHOST> -C /PATH/TO/WORDLIST/<FILE> ftp

# 사용자명 리스트 & 비밀번호 리스트
hydra <RHOST> -L /PATH/TO/WORDLIST/<USERLIST> -P /PATH/TO/WORDLIST/<PASSLIST> ftp

# 단일 사용자 브루트포스
hydra <RHOST> -l <USERNAME> -P /PATH/TO/WORDLIST/<FILE> ftp
```

## NetExec

```bash
# 파일 목록 조회
netexec ftp <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --ls

# 파일 다운로드
netexec ftp <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --get-file <FILE>

# 파일 업로드
netexec ftp <RHOST> -u '<USERNAME>' -p '<PASSWORD>' --put-file <FILE> <FILE>
```

## 파일 전송

### Linux에서 FTP 다운로드

```bash
# 인터랙티브 모드
ftp <RHOST>
ftp> binary
ftp> get <filename>
ftp> bye

# 스크립트 모드
cat > ftp_commands.txt << EOF
open <RHOST>
anonymous
anonymous
binary
get <filename>
bye
EOF

ftp -n < ftp_commands.txt
```

### Windows CMD에서 FTP 다운로드

```cmd
echo open <RHOST> > download.txt
echo anonymous >> download.txt
echo anonymous >> download.txt
echo binary >> download.txt
echo get <filename> >> download.txt
echo bye >> download.txt
ftp -s:download.txt
```

### Windows PowerShell

```powershell
# FTP 파일 다운로드
$client = New-Object System.Net.WebClient
$client.Credentials = New-Object System.Net.NetworkCredential("anonymous", "anonymous")
$client.DownloadFile("ftp://<RHOST>/<filename>", "C:\path\to\save\<filename>")
```

## FTP 서버 시작

### Python FTP 서버

```bash
# 설치
sudo apt-get install python3-pyftpdlib

# 기본 서버 (포트 21)
sudo python3 -m pyftpdlib -p 21

# 쓰기 권한 허용
sudo python3 -m pyftpdlib -p 21 -w

# 특정 디렉토리 공유
sudo python3 -m pyftpdlib -p 21 -d /path/to/share
```

## 설정 파일

```bash
# vsftpd
/etc/vsftpd.conf
/etc/vsftpd/vsftpd.conf

# ProFTPD
/etc/proftpd/proftpd.conf

# Pure-FTPd
/etc/pure-ftpd/pure-ftpd.conf
```

## 로그 파일

```bash
/var/log/vsftpd.log
/var/log/proftpd/proftpd.log
/etc/logrotate.d/ftp
/etc/logrotate.d/proftpd
/etc/logrotate.d/vsftpd.log
```

## 참고

- Anonymous 로그인 확인
- 약한 자격증명 테스트
- 쓰기 권한 디렉토리 확인
- 구버전 취약점 확인
