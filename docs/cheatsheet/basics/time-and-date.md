---
sidebar_position: 11
---

# Time and Date

Kerberos 인증 등에서 시간 동기화가 중요한 경우 사용합니다.

## 서버 시간 확인

```bash
# NTP로 서버 시간 확인
sudo nmap -sU -p 123 --script ntp-info <RHOST>

# 현재 시간 확인
date
timedatectl
```

## 자동 시간 동기화 중지

### VirtualBox Guest Utils 중지

```bash
sudo /etc/init.d/virtualbox-guest-utils stop
```

### systemd-timesyncd 중지

```bash
# 일시 중지
sudo systemctl stop systemd-timesyncd

# 영구 비활성화
sudo systemctl disable systemd-timesyncd
```

### chronyd 비활성화

```bash
sudo systemctl disable --now chronyd
```

## 시간 동기화 방법

### net time (Windows/Linux)

```bash
# 시간 확인
sudo net time -c <RHOST>

# 시간 설정
sudo net time set -S <RHOST>
sudo net time \\<RHOST> /set /y
```

### ntpdate

```bash
# 기본 동기화
sudo ntpdate <RHOST>

# silent 모드
sudo ntpdate -s <RHOST>

# 강제 동기화
sudo ntpdate -b -u <RHOST>
```

### rdate

```bash
# 시간만 표시
sudo rdate -n <RHOST>

# 시간 설정
sudo rdate -s <RHOST>
```

### timedatectl

```bash
# 타임존 설정 (UTC)
sudo timedatectl set-timezone UTC

# 타임존 목록
sudo timedatectl list-timezones

# 특정 타임존 설정
sudo timedatectl set-timezone '<COUNTRY>/<CITY>'
sudo timedatectl set-timezone 'Asia/Seoul'

# 시간 설정
sudo timedatectl set-time 15:58:30

# 날짜와 시간 설정
sudo timedatectl set-time '2015-11-20 16:14:50'

# RTC 로컬 시간 사용
sudo timedatectl set-local-rtc 1
```

## 지속적 동기화

```bash
# 무한 루프로 계속 동기화
while [ 1 ]; do sudo ntpdate <RHOST>; done

# 5초마다 동기화
while true; do sudo ntpdate <RHOST>; sleep 5; done
```

## 수동 시간 설정

```bash
# date 명령어로 설정
sudo date -s "2024-01-01 12:00:00"

# hwclock 동기화
sudo hwclock --systohc
```

## Kerberos 시간 동기화

```bash
# Kerberos는 5분 이내 시간차 필요
# DC 시간 확인
net time \\<DC_IP>

# 동기화
sudo ntpdate <DC_IP>

# 지속적 동기화 (Kerberos 공격 중)
while true; do sudo ntpdate <DC_IP>; sleep 60; done
```

## 참고

- Kerberos: 5분 이내 시간차 필수
- NTP 포트: 123/UDP
- 관리자 권한 필요
- 타임존 설정 중요
- VirtualBox 시간 동기화 방해 가능
