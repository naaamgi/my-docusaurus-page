---
sidebar_position: 2
---

# Burp Suite

웹 애플리케이션 보안 테스트 도구입니다.

## 주요 단축키

```bash
Ctrl+r          # Repeater로 요청 전송
Ctrl+i          # Intruder로 요청 전송
Ctrl+Shift+b    # Base64 인코딩
Ctrl+Shift+u    # URL 디코딩
```

## Proxy 환경 변수 설정

Burp Suite를 시스템 전체 프록시로 사용하려면:

```bash
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=https://localhost:8080
```

## 주요 기능

### Proxy

- HTTP/HTTPS 트래픽 가로채기
- 요청/응답 수정
- 히스토리 확인

### Repeater

- 개별 요청 반복 전송
- 요청 수정 후 즉시 테스트
- 단축키: `Ctrl+R`

### Intruder

- 자동화된 공격 (Fuzzing)
- Payload 설정
- 다양한 공격 타입 (Sniper, Battering Ram, Pitchfork, Cluster Bomb)
- 단축키: `Ctrl+I`

### Scanner (Pro 버전)

- 자동 취약점 스캔
- Passive/Active 스캔

### Decoder

- 인코딩/디코딩 도구
- Base64, URL, HTML 등 지원

### Comparer

- 두 요청/응답 비교
- Diff 확인

## Burp Collaborator

외부 서비스와의 상호작용 감지:

- SSRF 테스트
- Blind XSS 탐지
- DNS/HTTP 요청 모니터링

## 확장 기능 (Extensions)

유용한 확장 프로그램:

- **Autorize** - 권한 부여 테스트
- **Logger++** - 향상된 로깅
- **Active Scan++** - 추가 스캔 기능
- **Turbo Intruder** - 빠른 Fuzzing
- **Upload Scanner** - 파일 업로드 취약점
- **JSON Web Tokens** - JWT 분석

## 팁

- Scope 설정으로 타겟 범위 제한
- Match and Replace로 자동 수정
- Session Handling Rules로 세션 관리
- Macro 기능으로 복잡한 워크플로우 자동화

## 참고

- Burp Suite Professional은 상용 버전
- Burp Suite Community Edition은 무료 (기능 제한)
- OWASP ZAP이 오픈소스 대안
