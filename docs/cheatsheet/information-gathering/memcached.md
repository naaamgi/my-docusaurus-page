---
sidebar_position: 3
---

# memcached - 11211

> https://github.com/pd4d10/memcached-cli

Memcached 서버 열거 및 정보 수집입니다.

## 기본 정보

- **포트**: 11211/TCP, 11211/UDP
- **프로토콜**: ASCII, Binary

## 설치

```bash
npm install -g memcached-cli
```

## 연결

```bash
# memcached-cli
memcached-cli <USERNAME>:<PASSWORD>@<RHOST>:11211

# netcat (UDP)
echo -en "\x00\x00\x00\x00\x00\x01\x00\x00stats\r\n" | nc -q1 -u <RHOST> 11211

# telnet
telnet <RHOST> 11211
```

## Nmap

```bash
# 정보 수집
sudo nmap <RHOST> -p 11211 -sU -sS --script memcached-info

# 모든 스크립트
sudo nmap <RHOST> -p 11211 --script memcached-*
```

## 기본 명령어

```bash
# 연결 후

# 통계
stats
stats items
stats slabs
stats sizes

# 캐시 덤프
stats cachedump <SLAB_ID> <LIMIT>
stats cachedump 1 0
stats cachedump 1 100

# 키 가져오기
get <KEY>
```

## 공통 키 이름

```bash
get link
get file
get user
get passwd
get account
get username
get password
get email
get session
get token
get api_key
get secret
```

## 정보 수집

### 서버 정보

```
stats
```

출력 예시:
```
STAT pid 21357
STAT uptime 41557034
STAT time 1519734962
STAT version 1.4.25
STAT libevent 2.0.21-stable
STAT pointer_size 64
STAT curr_connections 10
STAT total_connections 1234
STAT connection_structures 11
STAT cmd_get 5678
STAT cmd_set 1234
STAT get_hits 4567
STAT get_misses 1111
STAT bytes_read 123456789
STAT bytes_written 987654321
STAT limit_maxbytes 67108864
STAT threads 4
```

### Items 확인

```
stats items
```

### Slabs 확인

```
stats slabs
```

### 캐시 키 덤프

```bash
# Slab 1의 모든 항목
stats cachedump 1 0

# Slab 1의 100개 항목
stats cachedump 1 100
```

## memccrashed (DDoS Amplification)

**경고**: 이 공격은 불법이며 허가 없이 사용하면 안 됩니다.

```bash
# UDP 포트 열려있는지 확인
sudo nmap <RHOST> -p 11211 -sU

# Amplification factor 확인
echo -en "\x00\x00\x00\x00\x00\x01\x00\x00stats\r\n" | nc -q1 -u <RHOST> 11211
```

## 취약점

### 인증 없음

```bash
# 인증 없이 접근 가능한지 확인
telnet <RHOST> 11211
stats
```

### 데이터 유출

```bash
# 모든 키 확인
stats items
stats cachedump <SLAB_ID> 0

# 중요 정보 검색
get session_*
get user_*
get admin_*
```

## 참고

- memcached는 기본적으로 인증이 없음
- UDP 포트가 열려있으면 DDoS 증폭 공격에 악용 가능
- 캐시된 세션 정보, 비밀번호 등 민감 정보 유출 가능
- SASL 인증 설정 권장
