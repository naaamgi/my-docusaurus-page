---
sidebar_position: 8
---

# PHP Webserver

## PHP 내장 웹 서버

```bash
# 기본 실행 (포트 8000)
php -S 127.0.0.1:8000

# 포트 80으로 실행 (sudo 필요)
sudo php -S 127.0.0.1:80

# 모든 인터페이스에서 접근 허용
php -S 0.0.0.0:8000

# 특정 디렉토리에서 실행
php -S 127.0.0.1:8000 -t /path/to/directory
```

## 사용 예제

```bash
# 현재 디렉토리에서 웹 서버 시작
php -S 0.0.0.0:8000

# 공용 포트로 시작
sudo php -S 0.0.0.0:80

# 특정 라우터 스크립트 사용
php -S 127.0.0.1:8000 router.php
```

## 참고

- PHP 내장 서버는 개발용으로만 사용 권장
- 프로덕션 환경에서는 Apache, Nginx 사용
- 간단한 파일 공유나 테스트에 유용
