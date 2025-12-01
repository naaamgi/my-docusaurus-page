---
sidebar_position: 3
---

# Tmux

## 기본 단축키

```bash
# 윈도우 표시
ctrl b + w

# 수평 분할
ctrl b + "

# 수직 분할
ctrl b + %

# 윈도우 이름 변경
ctrl b + ,

# 패널 전환
ctrl b + {    # 왼쪽으로
ctrl b + }    # 오른쪽으로

# 패널 레이아웃 전환
ctrl b + spacebar
```

## 복사 & 붙여넣기

```bash
# vi 모드 활성화
:setw -g mode-keys vi

# 복사 모드 진입
ctrl b + [

# 복사 시작
space

# 복사 완료
enter

# 붙여넣기
ctrl b + ]
```

## 검색

```bash
# 복사 모드 진입
ctrl b + [

# 검색 (vi 모드)
ctrl + /

# 다음 검색 결과
n

# 이전 검색 결과
shift + n
```

## 로깅

```bash
# 로깅 시작/중지
ctrl b
shift + P
```

## 출력 저장

```bash
# 명령 모드 진입
ctrl b + :

# 패널 내용 캡처
capture-pane -S -

# 다시 명령 모드 진입
ctrl b + :

# 버퍼 저장
save-buffer <FILE>.txt
```

## 세션 관리

```bash
# 새 세션 시작
tmux

# 이름 있는 세션 시작
tmux new -s <SESSION_NAME>

# 세션 목록
tmux ls

# 세션 연결
tmux attach -t <SESSION_NAME>

# 세션 분리 (세션 유지하며 나가기)
ctrl b + d

# 세션 종료
exit
# 또는
ctrl b + :
kill-session
```

## 윈도우 관리

```bash
# 새 윈도우
ctrl b + c

# 윈도우 이동
ctrl b + n    # 다음 윈도우
ctrl b + p    # 이전 윈도우
ctrl b + 0-9  # 특정 윈도우 번호로 이동

# 윈도우 닫기
ctrl b + &
```

## 패널 관리

```bash
# 패널 이동
ctrl b + 방향키
ctrl b + o    # 다음 패널
ctrl b + ;    # 이전 패널

# 패널 크기 조정
ctrl b + :
resize-pane -D    # 아래로
resize-pane -U    # 위로
resize-pane -L    # 왼쪽으로
resize-pane -R    # 오른쪽으로

# 패널 닫기
ctrl b + x
```

## 유용한 명령어

```bash
# 설정 다시 로드
ctrl b + :
source-file ~/.tmux.conf

# 시간 표시
ctrl b + t

# 도움말
ctrl b + ?
```

## 참고

- Tmux는 SSH 연결이 끊겨도 세션 유지
- 여러 패널에서 동시 작업 가능
- 세션 분리 후 나중에 다시 연결 가능
