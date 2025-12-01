---
sidebar_position: 18
---

# DNS - 53

## 기본 정보

**포트**: 53 (UDP/TCP)

DNS(Domain Name System)는 도메인 이름을 IP 주소로 변환하는 시스템입니다.

## nslookup

```bash
# 기본 조회
nslookup <DOMAIN>

# 특정 DNS 서버 사용
nslookup <DOMAIN> <DNS_SERVER>

# 역방향 조회
nslookup <IP>

# MX 레코드 조회
nslookup -type=MX <DOMAIN>

# NS 레코드 조회
nslookup -type=NS <DOMAIN>

# TXT 레코드 조회
nslookup -type=TXT <DOMAIN>

# ANY 레코드 조회
nslookup -type=ANY <DOMAIN>
```

## dig

```bash
# 기본 조회
dig <DOMAIN>

# 간단한 출력
dig <DOMAIN> +short

# 특정 DNS 서버 사용
dig @<DNS_SERVER> <DOMAIN>

# MX 레코드
dig <DOMAIN> MX

# NS 레코드
dig <DOMAIN> NS

# TXT 레코드
dig <DOMAIN> TXT

# AXFR (Zone Transfer)
dig @<DNS_SERVER> <DOMAIN> AXFR

# 역방향 조회
dig -x <IP>

# 추적 모드
dig <DOMAIN> +trace
```

## host

```bash
# 기본 조회
host <DOMAIN>

# 특정 DNS 서버
host <DOMAIN> <DNS_SERVER>

# 모든 레코드
host -a <DOMAIN>

# 역방향 조회
host <IP>
```

## DNS Zone Transfer

```bash
# dig 사용
dig @<DNS_SERVER> <DOMAIN> AXFR

# host 사용
host -l <DOMAIN> <DNS_SERVER>

# nslookup 사용
nslookup
> server <DNS_SERVER>
> ls -d <DOMAIN>
```

## dnsenum

```bash
# 기본 열거
dnsenum <DOMAIN>

# DNS 서버 지정
dnsenum --dnsserver <DNS_SERVER> <DOMAIN>

# 서브도메인 브루트포스
dnsenum --enum <DOMAIN>

# Zone Transfer 시도
dnsenum --enum <DOMAIN> -f /usr/share/wordlists/subdomains.txt
```

## dnsrecon

```bash
# 기본 열거
dnsrecon -d <DOMAIN>

# Zone Transfer
dnsrecon -d <DOMAIN> -t axfr

# 서브도메인 브루트포스
dnsrecon -d <DOMAIN> -D /usr/share/wordlists/subdomains.txt -t brt

# 역방향 조회
dnsrecon -r <IP_RANGE>
```

## fierce

```bash
# 서브도메인 스캔
fierce --domain <DOMAIN>

# DNS 서버 지정
fierce --domain <DOMAIN> --dns-servers <DNS_SERVER>
```

## Nmap

```bash
# DNS 버전 확인
sudo nmap -p53 -sV <RHOST>

# DNS 열거
sudo nmap -p53 --script dns-brute <DOMAIN>

# DNS Zone Transfer
sudo nmap -p53 --script dns-zone-transfer --script-args dns-zone-transfer.domain=<DOMAIN> <RHOST>

# DNS 캐시 스누핑
sudo nmap -p53 --script dns-cache-snoop <RHOST>
```

## Subdomain Enumeration

### subfinder

```bash
# 서브도메인 찾기
subfinder -d <DOMAIN>

# 결과 저장
subfinder -d <DOMAIN> -o subdomains.txt
```

### amass

```bash
# 서브도메인 열거
amass enum -d <DOMAIN>

# 수동 모드
amass enum -passive -d <DOMAIN>

# 결과 저장
amass enum -d <DOMAIN> -o subdomains.txt
```

### assetfinder

```bash
# 서브도메인 찾기
assetfinder <DOMAIN>

# 서브도메인만
assetfinder --subs-only <DOMAIN>
```

## 참고

- Zone Transfer 가능 여부 확인
- 서브도메인 열거
- DNS 캐시 포이즈닝
- DNS 터널링 탐지
- DNSSEC 확인
