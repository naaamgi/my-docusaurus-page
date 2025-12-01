---
sidebar_position: 4
---

# Upgrading Shells

리버스 쉘을 획득한 후 더 나은 상호작용(interactive) 쉘로 업그레이드하는 방법입니다.

## Python PTY를 이용한 방법

```bash
# Python 2
python -c 'import pty;pty.spawn("/bin/bash")'

# Python 3
python3 -c 'import pty;pty.spawn("/bin/bash")'

# 배경으로 전환
ctrl + z

# 터미널 설정 변경
stty raw -echo

# 포그라운드로 복귀
fg

# Enter 두 번
Enter
Enter

# 환경 변수 설정
export XTERM=xterm
export TERM=xterm
export SHELL=/bin/bash
```

## 전체 업그레이드 프로세스

```bash
# 1. 리버스 쉘 획득 후
python3 -c 'import pty;pty.spawn("/bin/bash")'

# 2. 터미널 크기 확인 (로컬 머신에서)
stty -a
# 결과: rows 37; columns 123

# 3. 쉘 배경으로 전환
ctrl + z

# 4. 로컬 터미널 설정
stty raw -echo
fg

# 5. Enter 두 번
Enter
Enter

# 6. 원격 쉘에서 설정
stty rows 37 cols 123
export TERM=xterm-256color
bash
```

## script를 이용한 방법

```bash
# 방법 1
script -q /dev/null -c bash

# 방법 2
/usr/bin/script -qc /bin/bash /dev/null
```

## 원라이너

```bash
# 한 줄로 전체 프로세스
stty raw -echo; fg; ls; export SHELL=/bin/bash; export TERM=screen; stty rows 38 columns 116; reset;
```

## Staircase Effect 수정

명령어 출력이 계단식으로 나타나는 문제 해결:

```bash
# 방법 1
env reset

# 방법 2
stty onlcr

# 방법 3
reset
```

## 터미널 크기 설정

```bash
# 로컬 머신에서 크기 확인
stty size
# 예: 37 123

# 원격 쉘에서 설정
stty rows 37 cols 123
```

## 추가 환경 변수

```bash
# TERM 설정
export TERM=xterm
export TERM=xterm-256color
export TERM=screen

# SHELL 설정
export SHELL=/bin/bash

# PATH 설정
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

## Netcat에서 사용 가능한 명령어

```bash
# rlwrap으로 netcat 실행 (히스토리 및 화살표 키 지원)
rlwrap nc -lvnp <LPORT>

# socat으로 완전한 TTY
socat file:`tty`,raw,echo=0 tcp-listen:<LPORT>
```

## 참고

- Python이 없는 경우 script 사용
- ctrl + c 사용 가능하려면 stty raw -echo 필수
- 화살표 키, 탭 완성 사용 가능
- 터미널 크기 설정으로 화면 깨짐 방지
