---
sidebar_position: 9
---

# Python Webserver

## Python 내장 웹 서버

```bash
# Python 2 (포트 8000)
python -m SimpleHTTPServer

# Python 2 (포트 80)
sudo python -m SimpleHTTPServer 80

# Python 3 (포트 8000)
python3 -m http.server

# Python 3 (포트 80)
sudo python3 -m http.server 80

# 모든 인터페이스에서 접근 허용
python3 -m http.server 8000 --bind 0.0.0.0

# 특정 디렉토리에서 실행
cd /path/to/share
python3 -m http.server 8000
```

## 사용 예제

```bash
# 파일 공유용 서버 시작
python3 -m http.server 8080

# 현재 디렉토리 공유 (포트 80)
sudo python3 -m http.server 80

# 다른 디렉토리 공유
cd /tmp
python3 -m http.server 9000
```

## 다운로드

```bash
# 원격에서 다운로드
wget http://<LHOST>:8000/<FILE>
curl http://<LHOST>:8000/<FILE> -o <FILE>
```

## 참고

- 간단한 파일 전송에 유용
- 현재 디렉토리의 모든 파일 공유
- Ctrl+C로 종료
- 로그가 터미널에 출력됨
