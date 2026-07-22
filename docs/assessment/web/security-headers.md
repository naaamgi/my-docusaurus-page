---
sidebar_position: 13
title: 보안 헤더 점검
description: 웹 진단 - CSP, HSTS, X-Frame-Options, X-Content-Type-Options 등 보안 헤더 점검 기준과 미흡 시 영향
keywords: [Security Headers, CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, COEP, Clickjacking, OWASP A02]
draft: false
---

## 점검 목적

응답 헤더가 페이지의 용도에 맞게 적용되고 브라우저에서 실제로 동작하는지 확인한다. 보안 헤더는 대개 보조 방어다. 누락만으로 큰 취약점이라고 단정하지 않고, 클릭재킹 가능 화면·민감 응답 캐시·실제 XSS처럼 연결되는 조건을 함께 본다.

- CORS는 [CORS 잘못된 설정](./cors.md)에서 확인한다.
- 쿠키의 `HttpOnly`, `Secure`, `SameSite`는 [세션 관리](./session-management.md)에서 확인한다.
- CSP를 우회해 스크립트가 실행되는지는 [XSS](./xss.md)에서 확인한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 스크립트·리소스 제한 | CSP가 스크립트와 리소스 출처를 제한함 | 정책 존재보다 실제 적용 범위와 약한 지시어를 확인 |
| HTTPS 고정 | HSTS가 이후 접속을 HTTPS로 고정함 | HTTPS 응답의 HSTS와 HTTP 진입 동작을 분리해 확인 |
| 화면 삽입 제한 | `frame-ancestors` 또는 `X-Frame-Options`가 iframe 삽입을 제한함 | 클릭 가능한 중요 화면에서 외부 iframe 로드를 재현 |
| 콘텐츠 해석 제한 | `nosniff`가 선언된 `Content-Type`을 따르게 함 | 업로드·사용자 콘텐츠 응답에서 MIME 오해석 조건 확인 |
| 정보 전달 제한 | Referrer와 Cache 정책이 URL·응답 정보의 잔존 범위를 줄임 | 실제 외부 요청과 캐시 재사용 여부로 판단 |
| 브라우저 기능·격리 | Permissions Policy와 COOP·COEP·CORP가 기능과 문서 경계를 제한함 | 서비스가 해당 기능을 사용하는 경우에만 우선 점검 |
| 제품 정보 노출 | `Server`, `X-Powered-By` 등이 제품 단서를 제공함 | 버전 문자열만으로 취약 판정하지 않음 |

## 진단 절차

#### Step 1. 비교할 응답 선택

메인 화면만 보지 않는다. 보호 목적이 다른 응답을 최소 한 개씩 고른다.

```text
로그인 전 HTML
로그인 후 개인정보 화면
상태 변경이 가능한 화면
JSON API
업로드 파일·정적 자산
오류·리다이렉트 응답
```

#### Step 2. 실제 GET 응답 저장

`curl -I`는 `HEAD` 요청이라 실제 `GET`과 헤더가 다를 수 있다. `GET` 응답 헤더를 기준선으로 저장하고, 필요할 때 `HEAD`와 비교한다.

```bash
curl -sS -D - -o /dev/null https://<TARGET>/
curl -sS -D - -o /dev/null https://<TARGET>/login
curl -sS -D - -o /dev/null https://<TARGET>/api/me
curl -sS -D - -o /dev/null http://<TARGET>/
```

Windows에서는 `curl.exe`와 출력 대상 `NUL`을 사용할 수 있다. 인증 후 화면은 Burp Repeater에서 세션 쿠키를 포함해 비교한다.

#### Step 3. 헤더가 필요한 응답인지 판단

- CSP와 framing 방어는 브라우저가 렌더링하는 HTML에서 우선 본다. 단순 JSON API의 CSP 누락은 보통 의미가 작다.
- 캐시 정책은 개인정보·토큰·결제 정보처럼 사용자별 응답에서 본다.
- `nosniff`는 JavaScript, CSS, 업로드 파일처럼 잘못된 MIME 해석이 영향을 주는 응답에서 본다.
- COOP·COEP·CORP는 교차 출처 격리나 `SharedArrayBuffer`가 필요한 서비스인지 먼저 확인한다.

#### Step 4. 값·적용 위치·중복 확인

- 빈 값, 오타, 비표준 값이 브라우저에서 무시되는지 확인한다.
- 같은 헤더가 여러 번 나오면 서로 충돌하는지 확인한다.
- HSTS는 HTTPS 응답에서 받은 값만 유효하다.
- `frame-ancestors`는 `<meta http-equiv>`로 적용할 수 없다.
- `Content-Security-Policy-Report-Only`만 있으면 위반을 기록할 뿐 차단하지 않는다.

#### Step 5. 브라우저에서 최소 재현

- framing은 외부 Origin의 iframe과 Console 오류를 확인한다.
- CSP는 DevTools Console에서 차단된 지시어와 실제 실행 여부를 확인한다.
- Referrer Policy는 통제 가능한 외부 주소에 도착한 `Referer` 값을 확인한다.
- 캐시는 재요청의 `Age`, `Cache-Status`, `X-Cache`와 사용자 간 응답 재사용 여부를 확인한다.

#### Step 6. 연결되는 취약점과 분리 판정

보안 헤더 누락과 실제 취약점을 분리한다. 예를 들어 CSP가 없어도 XSS가 자동으로 생기지 않고, framing 방어가 없어도 클릭할 기능이 없는 JSON 응답은 클릭재킹 대상이 아니다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 확인할 것 |
| :--- | :--- |
| 브라우저가 렌더링하는 HTML | CSP 적용 여부와 `script-src`, framing 정책 |
| 관리자·결제·설정 변경 화면 | 외부 iframe 로드와 실제 클릭 가능 여부 |
| HTTPS 로그인 서비스 | HTTP 진입 동작과 HTTPS 응답의 HSTS |
| 업로드 파일을 같은 Origin에서 제공 | `Content-Type`, `nosniff`, `Content-Disposition` |
| 개인정보·토큰 API | `Cache-Control`과 공유 캐시 재사용 여부 |
| URL에 토큰·식별자가 존재 | 외부 이동 시 실제 `Referer` 값 |
| 카메라·마이크·위치 기능 사용 | Permissions Policy의 허용 Origin |

---

## 페이로드 노트

### 1. CSP 적용 범위와 기본 정책

**이럴 때 사용**: HTML 페이지에 CSP가 있거나 XSS 영향 완화 여부를 확인한다.

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<RANDOM>'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

먼저 `script-src`가 없을 때 `default-src`가 대신 적용되는지 본다. `frame-ancestors`는 `default-src`의 영향을 받지 않으므로 별도로 확인한다.

| 관찰 | 다음 확인 |
| :--- | :--- |
| CSP가 없음 | 실제 XSS 원시점이나 별도 기준에서 보조 방어 미흡으로 분리 |
| Report-Only만 존재 | Console 위반은 기록되지만 스크립트가 실제 차단되는지 확인 |
| `script-src`에 `*`, 넓은 host, `data:` | 해당 출처에서 실행 가능한 스크립트를 통제할 수 있는지 확인 |
| `'unsafe-inline'` | nonce·hash 기반 정책과 실제 인라인 스크립트 허용 여부 확인 |
| `'unsafe-eval'` | 애플리케이션이 `eval` 계열 실행에 의존하는지 확인 |
| nonce가 매 응답에서 반복됨 | 다른 사용자·다른 요청에서도 재사용되는지 확인 |

정책 문자열만으로 XSS를 확정하지 않는다. [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)는 검토 보조 도구로 사용하고, 브라우저 동작과 실제 입력 지점을 별도로 확인한다.

### 2. 화면 삽입과 클릭재킹

**이럴 때 사용**: 버튼·링크·입력창이 있는 중요 화면을 외부 사이트가 iframe으로 불러올 수 있는지 확인한다.

```html
<!doctype html>
<meta charset="utf-8">
<title>Framing test</title>
<iframe src="https://<TARGET>/settings/profile"
        width="1000" height="700"
        style="opacity:0.6"></iframe>
```

**확인할 것**: iframe이 보이는지만 확인하지 않는다. 테스트 계정으로 중요한 동작을 실제로 클릭할 수 있는지, 재인증·CSRF 방어·브라우저 차단이 있는지 함께 본다.

```http
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

`frame-ancestors`가 있으면 이를 우선 확인한다. `X-Frame-Options: ALLOW-FROM`은 오래된 비표준 방식이므로 현대 브라우저에서 보호된다고 가정하지 않는다.

### 3. HSTS와 HTTP 진입 경로

**이럴 때 사용**: HTTPS 서비스를 HTTP 주소로 처음 방문할 수 있는지 확인한다.

```bash
curl -sS -D - -o /dev/null http://<TARGET>/
curl -sS -D - -o /dev/null https://<TARGET>/
```

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- `max-age=0`은 저장된 HSTS 정책을 지우는 값이다.
- HSTS는 HTTPS 응답에서만 학습된다. HTTP 응답에 같은 헤더가 있어도 유효하지 않다.
- HTTP의 HTTPS 리다이렉트와 HSTS는 서로 다른 보호다. 둘 다 따로 확인한다.
- `includeSubDomains`와 preload는 모든 하위 도메인의 HTTPS 준비 상태와 운영 정책을 확인한 뒤 판단한다. 누락만으로 곧바로 취약을 확정하지 않는다.

### 4. `nosniff`와 업로드 파일 응답

**이럴 때 사용**: 사용자가 올린 파일이나 JavaScript·CSS를 브라우저가 직접 불러온다.

```http
Content-Type: text/plain
X-Content-Type-Options: nosniff
Content-Disposition: attachment
```

헤더 누락만 기록하지 말고 실제 `Content-Type`, 다운로드 여부, same-origin 제공 여부와 브라우저 렌더링을 확인한다. HTML·SVG가 same-origin에서 active content로 실행되면 [파일 업로드](./file-upload.md)와 [XSS](./xss.md) 관점으로 영향이 올라간다.

### 5. 민감 응답 캐시

**이럴 때 사용**: 개인정보·토큰·결제 정보가 사용자별로 반환된다.

| 값 | 의미 | 실무 확인 |
| :--- | :--- | :--- |
| `no-store` | 응답 저장 금지 | 민감 응답의 기본 후보 |
| `no-cache` | 저장할 수 있지만 재사용 전 재검증 | 저장 금지와 같은 뜻으로 보지 않음 |
| `private` | 공유 캐시 저장 금지 | 브라우저 캐시는 허용될 수 있음 |
| `public`, 양수 `s-maxage` | 공유 캐시 허용 | 사용자별 응답이면 cache key와 재사용 확인 |

헤더가 없다는 사실만으로 다른 사용자가 응답을 받는다고 단정하지 않는다. 인증 쿠키가 cache key에 반영되는지, CDN·프록시가 실제 저장했는지, 다른 테스트 계정 요청에 같은 본문이 반환되는지를 확인한다.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, s-maxage=300
Age: 42
X-Cache: HIT

{"id":42,"displayName":"test-user-a"}
```

다른 테스트 계정에서도 같은 사용자별 응답이 재사용될 때 취약으로 확정한다.

### 6. Referrer Policy

**이럴 때 사용**: URL에 식별자나 일회성 값이 있고 외부 링크·이미지·분석 도구로 이동한다.

```http
Referrer-Policy: strict-origin-when-cross-origin
```

통제 가능한 외부 페이지로 이동시킨 뒤 수신 요청의 `Referer`를 확인한다. 현대 브라우저의 기본 정책도 교차 출처에는 보통 Origin만 보내므로, 헤더 누락만으로 전체 URL 유출을 확정하지 않는다. URL에 비밀값을 넣는 설계는 별도 원인으로 기록한다.

### 7. Permissions Policy와 교차 출처 격리

이 헤더들은 서비스 요구사항을 먼저 확인한다.

```http
Permissions-Policy: geolocation=(), camera=(), microphone=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-site
```

- Permissions Policy가 없다고 카메라·마이크 권한이 자동 승인되는 것은 아니다. 브라우저 사용자 권한과 iframe의 기능 사용 범위를 추가로 제한하는 정책이다.
- COEP는 허용 표시가 없는 교차 출처 리소스를 막을 수 있어 기능 장애 가능성을 함께 확인한다.
- COOP·COEP·CORP 누락은 적용 목적과 실제 격리 요구가 없으면 일반 취약점으로 단정하지 않는다.

### 8. 제품 정보와 오래된 헤더

```http
Server: nginx/1.24.0
X-Powered-By: Express
X-AspNet-Version: 4.0.30319
X-Generator: WordPress 6.x
X-XSS-Protection: 1; mode=block
```

버전 문자열은 정찰 단서다. 실제 서비스 버전과 일치하는지, 그 버전에 적용 가능한 취약점이 별도로 재현되는지 확인한다. `X-XSS-Protection`은 현대 CSP를 대신하지 않으며, 일반적으로 미설정 또는 `0`을 사용한다.

---

## 우회 매트릭스

| 관찰된 증상 | 다음 확인 | 판단 주의 |
| :--- | :--- | :--- |
| 메인 HTML에만 헤더가 있음 | 로그인 후 화면·오류·직접 URL 응답 비교 | CDN과 애플리케이션 적용 범위가 다를 수 있음 |
| `HEAD`와 `GET` 헤더가 다름 | 실제 브라우저와 GET 응답 기준으로 재검증 | `curl -I` 결과만 사용하지 않음 |
| CSP가 여러 줄로 존재 | 브라우저가 모든 정책을 함께 적용하는지 확인 | 단순 문자열 합치기로 판단하지 않음 |
| CSP 위반이 Console에만 표시됨 | Report-Only인지 확인 | 보고 발생과 차단은 다름 |
| iframe이 빈 화면임 | Console의 `frame-ancestors`·XFO 오류 확인 | 로그인 실패·JS 오류와 framing 차단을 구분 |
| HSTS가 HTTP 응답에만 있음 | HTTPS 응답에서 다시 확인 | HTTP에서 받은 HSTS는 무효 |
| 민감 응답에 `private`만 있음 | 공유 캐시 저장 여부와 브라우저 요구사항 확인 | `private`은 공유 캐시를 막음 |
| scanner가 헤더 누락을 표시함 | 보호 대상·브라우저 동작·결합 취약점 확인 | 도구 결과만으로 취약 확정하지 않음 |

---

## 취약 판정 기준

### 취약 확정

- 외부 iframe에서 중요 화면이 로드되고 테스트 계정의 상태 변경 동작을 클릭할 수 있다.
- 공유 캐시가 사용자별 민감 응답을 저장하고 다른 테스트 계정에 같은 내용을 반환한다.
- CSP가 차단해야 할 스크립트가 약한 정책이나 잘못된 적용 때문에 실행되며 실제 XSS 원시점과 연결된다.
- 업로드 파일이 잘못된 MIME 처리와 same-origin 제공 조건 때문에 active content로 실행된다.

### 후보 / 보류

- 필요한 HTML 응답에서 CSP·framing 정책·HSTS·`nosniff`가 빠졌지만 실제 악용 조건은 확인되지 않았다.
- CSP에 넓은 출처나 위험 지시어가 있지만 공격자가 통제 가능한 실행 경로는 확인되지 않았다.
- HTTP 접속과 HSTS 정책이 미흡하지만 실제 서비스 범위와 최초 방문 조건을 확인하지 못했다.
- Referrer·Permissions Policy·교차 출처 격리 헤더가 없지만 민감정보 전송이나 기능 악용은 재현되지 않았다.
- 제품·프레임워크 버전 문자열만 노출됐다.

### 영향 상승 조건

- 클릭재킹 대상이 결제·권한 변경·MFA 해제처럼 중요한 기능이다.
- CSP 미흡이 실제 XSS와 연결된다.
- 캐시 오염이 여러 사용자나 CDN 구간에서 반복 재현된다.
- 업로드 콘텐츠가 서비스 주 Origin에서 실행된다.
- HTTP 진입 경로에서 인증정보나 세션이 평문으로 전송되는 조건이 확인된다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Test Other HTTP Security Header Misconfigurations](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/14-Test_Other_HTTP_Security_Header_Misconfigurations)
- [OWASP WSTG - Testing for Content Security Policy](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/12-Test_for_Content_Security_Policy)
- [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN - Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [MDN - `frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- [HSTS Preload](https://hstspreload.org/)

### 점검 도구

- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Security Headers](https://securityheaders.com/)
