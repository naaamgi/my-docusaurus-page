---
sidebar_position: 24
title: 보안 헤더 (Security Headers)
description: 웹 진단 - CSP, HSTS, X-Frame-Options, X-Content-Type-Options 등 보안 헤더 점검 기준과 미흡 시 영향
keywords: [Security Headers, CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, COEP, Clickjacking, OWASP A02]
draft: false
---

# 보안 헤더 (Security Headers)

> 응답 헤더의 보안 강화 정책 미흡으로 인한 결함. 단독으로는 Medium 등급이 많지만, **다른 취약점 (XSS, MITM, Clickjacking) 의 영향을 증폭/완화** 하는 방어막 역할.
> 보고서엔 거의 항상 포함되는 항목 — 표준 항목으로 점검 매트릭스 일괄 적용.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A02:2025 - Security Misconfiguration / KISA 보안 설정 |
| **CWE** | [CWE-1021: Clickjacking](https://cwe.mitre.org/data/definitions/1021.html), [CWE-693: Protection Mechanism Failure](https://cwe.mitre.org/data/definitions/693.html), [CWE-319: Cleartext Transmission](https://cwe.mitre.org/data/definitions/319.html), [CWE-200: Information Exposure](https://cwe.mitre.org/data/definitions/200.html) |
| **영향도** | 🟡 (대부분 단독 Medium) / 🔴 (CSP 없음 + XSS 존재 / HSTS 없음 + MITM 환경) |
| **점검 난이도** | 하 (응답 헤더 1회 확인) |
| **예상 점검 시간** | 30분 ~ 1시간 |

---

## 점검 목적

응답 헤더의 보안 강화 정책이 적절히 설정되어 있는지 확인한다. 보안 헤더는 단일 결함보다 **다른 취약점의 영향을 증폭/완화** 하는 방어막 역할이 핵심 — CSP 가 있으면 XSS 가 발생해도 영향이 축소되고, HSTS 가 있으면 MITM 환경에서 평문 자격증명 탈취가 어려워진다.

> **다른 페이지와 영역 분리**
> - CORS 헤더 (`Access-Control-Allow-*`) → `cors.md`
> - 쿠키 속성 (`HttpOnly`, `Secure`, `SameSite`) → `session-management.md`
> - CSP 우회 후 실제 XSS 입증 → `xss.md`
> - HTTP Response Splitting / CRLF Injection → 별개 (모던 환경에선 거의 발견 안 됨)

---

## 유형 구분 — 점검 헤더 매트릭스

| 헤더 | 점검 목적 | 권장 값 | 미설정 / 미흡 영향 |
| :--- | :--- | :--- | :--- |
| `Content-Security-Policy` | XSS 영향 축소 | `default-src 'self'; script-src 'self' 'nonce-...'` | 🟡 단독 / 🔴 (XSS 존재 시 증폭) |
| `Strict-Transport-Security` | HTTPS 강제, SSL Strip 방어 | `max-age=31536000; includeSubDomains; preload` | 🔴 (MITM 환경에서 자격증명 탈취) |
| `X-Frame-Options` / `CSP frame-ancestors` | Clickjacking 방어 | `DENY` / `SAMEORIGIN` / `frame-ancestors 'none'` | 🟡 (관리자/금융 페이지면 🔴) |
| `X-Content-Type-Options` | MIME sniffing 방어 | `nosniff` | 🟡 (업로드 결함과 결합 시 🔴) |
| `Referrer-Policy` | Referer 헤더로 정보 유출 방지 | `strict-origin-when-cross-origin` | 🟢 (URL 에 토큰이 있으면 🟡) |
| `Permissions-Policy` | 브라우저 기능 제어 (카메라/위치 등) | 필요한 기능만 명시 허용 | 🟢 |
| `Cross-Origin-Opener-Policy` (COOP) | 윈도우 격리 | `same-origin` | 🟡 |
| `Cross-Origin-Embedder-Policy` (COEP) | 리소스 격리 | `require-corp` | 🟡 |
| `Cross-Origin-Resource-Policy` (CORP) | 리소스 보호 | `same-origin` | 🟡 |
| `Cache-Control` (민감 응답) | 민감 데이터 캐싱 방지 | `no-store, no-cache, must-revalidate` | 🟡 (개인정보/토큰 응답이 캐시되면 🔴) |
| `Server` / `X-Powered-By` 등 | 정보 노출 | 헤더 제거 / 값 비활성 | 🟢 (정찰 정보 제공) |
| `X-XSS-Protection` (deprecated) | 옛 브라우저 XSS 필터 | `0` 또는 미설정 — 활성화는 오히려 위험 | - |

---

## 진단 절차

### Step 1. 응답 헤더 수집

```bash
# 메인 페이지 / 로그인 페이지 / 관리자 페이지 / API 엔드포인트 각각 확인
curl -I https://<TARGET>/
curl -I https://<TARGET>/login
curl -I https://<TARGET>/admin
curl -I https://<TARGET>/api/me

# 외부 노출 환경이면 일괄 점검 도구 활용
# - https://securityheaders.com/
# - https://observatory.mozilla.org/
```

Burp Repeater 로도 동일하게 수집 가능. **페이지별로 헤더가 다른 경우가 흔함** — 메인은 헤더 적용, API 는 누락 등의 패턴.

### Step 2. 헤더별 존재 / 값 검증

위 매트릭스 기준으로 한 줄씩 체크. 헤더가 있어도 **값이 약하면 미흡** (예: CSP 가 있지만 `unsafe-inline` 포함).

### Step 3. CSP 분석 (가장 복잡)

CSP 정책 분석은 [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/) 에 그대로 붙여넣으면 약점이 자동 분석됨. 주요 약점:

- `unsafe-inline` (script-src) → 인라인 스크립트 허용 → XSS 거의 무방비
- `unsafe-eval` → `eval()` 허용 → DOM XSS 영향 증폭
- `data:` (script-src) → `<script src="data:...">` 우회
- `*` 와일드카드 → 모든 외부 도메인 허용 = 사실상 정책 없음
- JSONP 가능한 도메인 화이트리스트 → `script-src 'self' https://cdn.example.com` 인데 CDN 에 JSONP 엔드포인트 존재 시 우회

### Step 4. Clickjacking PoC + HSTS 검증

- `X-Frame-Options` / `frame-ancestors` 둘 다 없으면 `<iframe>` 임베드 PoC 작성
- HSTS 미설정 시 `curl -I http://<TARGET>` 으로 HTTP 응답이 돌아오는지, HTTPS 응답 헤더에 `Strict-Transport-Security` 가 있는지 확인 → MITM 시나리오 입증

---

## 페이로드 / 테스트 케이스

### 케이스 1: `Content-Security-Policy` 미설정 / 약한 정책

**언제 점검하는지**: 모든 페이지. 특히 사용자 입력이 출력되는 페이지 (XSS 가능성 있는 곳) 는 필수.

**판정 매트릭스:**

```
1. CSP 헤더 자체 없음                                          → 취약 (Medium)
2. CSP 있지만 'unsafe-inline' 포함 (script-src)                → 취약 (효과 없음)
3. CSP 있지만 'unsafe-eval' 포함                               → 미흡 (DOM XSS 증폭)
4. CSP 있지만 * 와일드카드 (script-src *)                      → 취약 (효과 없음)
5. CSP 에 data: 허용 (script-src 'self' data:)                 → 우회 가능
6. CSP report-only 만 (Content-Security-Policy-Report-Only)    → 실제 차단 안 함, 보고서엔 미흡으로 보고
7. CSP 에 nonce/hash 없는 'unsafe-inline' 대체 패턴 없음        → 인라인 스크립트 못 차단
```

**판정**: CSP Evaluator 점수 + 위 패턴 매칭. 점검 보고서엔 현재 CSP 값 그대로 + 약점 항목 나열.

### 케이스 2: `Strict-Transport-Security` 미설정 / 짧은 max-age

**언제 점검하는지**: HTTPS 를 사용하는 모든 서비스. 특히 로그인 / 결제 / 관리자 페이지 우선.

**판정 매트릭스:**

```
1. HSTS 헤더 없음                                              → 🔴 취약 (SSL Strip 가능)
2. max-age=0                                                  → HSTS 비활성 (취약)
3. max-age < 15768000 (6개월)                                  → 미흡
4. includeSubDomains 누락                                      → 미흡 (서브도메인 MITM 가능)
5. preload 누락 + HSTS Preload List 미등록                     → 첫 방문은 보호 못 함
6. http://<TARGET> 로 접속 시 200 OK (HTTPS 리다이렉트 없음)    → 🔴 (HSTS 와 별개 결함)
```

**확인 명령:**

```bash
curl -I http://<TARGET>/                  # HTTPS 리다이렉트 여부
curl -I https://<TARGET>/ | grep -i strict-transport-security
```

**판정**: HSTS 가 없거나 `max-age` 가 짧으면 공용 Wi-Fi 등 MITM 환경에서 SSL Strip 으로 평문 자격증명 탈취 가능 → Critical 시나리오 (PoC 2 에서 입증).

### 케이스 3: Clickjacking — `X-Frame-Options` / `frame-ancestors` 미설정

**언제 점검하는지**: 변경 액션이 있는 모든 페이지. 특히 관리자 페이지, 결제, 권한 변경 페이지 우선.

**판정 매트릭스:**

```
1. X-Frame-Options 헤더 없음 + CSP frame-ancestors 도 없음     → 🟡 ~ 🔴 (임팩트 큰 페이지면 🔴)
2. X-Frame-Options: ALLOWALL (또는 비표준 값)                   → 취약
3. X-Frame-Options: ALLOW-FROM <URL>                          → deprecated, 모던 브라우저 무시
4. CSP frame-ancestors 'self' 또는 'none' 있으면                → X-Frame-Options 가 없어도 보호됨
```

**PoC HTML — 외부 도메인에서 iframe 임베드 시도:**

```html
<!DOCTYPE html>
<html>
<head><title>Clickjacking PoC</title></head>
<body>
  <h1>외부 사이트에 임베드 가능 여부 확인</h1>
  <iframe src="https://<TARGET>/admin/delete-user?id=123"
          width="1200" height="800"
          style="opacity:0.5"></iframe>
</body>
</html>
```

**판정**: 외부 도메인에서 iframe 이 정상 로드되면 Clickjacking 가능. 임팩트가 큰 액션 (계정 삭제, 권한 부여, 이체) 이 1-클릭으로 트리거 가능하면 보고서 등급 상향.

### 케이스 4: `X-Content-Type-Options: nosniff` 미설정

**언제 점검하는지**: 파일 업로드 기능이 있는 사이트, 사용자 콘텐츠를 서빙하는 도메인 (이미지 / 첨부파일 등).

**판정:**

```
1. X-Content-Type-Options: nosniff 헤더 없음                    → 미흡

2. 결합 시나리오 — 파일 업로드 결함 + nosniff 없음:
   - 업로드된 .txt 파일에 <script>...</script> 가 있고
   - 브라우저가 MIME sniffing 으로 HTML 로 해석
   → Stored XSS 발생 (file-upload.md 의 케이스와 결합)
```

단독으로는 Low/Medium 이지만 업로드 결함과 결합 시 임팩트 증폭. `file-upload.md` 참조.

### 케이스 5: 민감 응답 캐시 (`Cache-Control` 미흡)

**언제 점검하는지**: 개인정보 / 토큰 / 세션 / 결제 정보가 포함된 응답.

**판정 매트릭스:**

```
1. Cache-Control 헤더 없음 (기본값 = 캐시 가능)                  → 취약
2. Cache-Control: public 또는 max-age=N (양수)                  → 취약
3. Cache-Control: private 만 있음 (브라우저는 캐시함)            → 미흡 (공유 PC 환경 위험)
4. Cache-Control: no-store (또는 no-store, no-cache)            → 안전
5. Pragma: no-cache 만 있고 Cache-Control 누락 (HTTP/1.0 만 대응) → 미흡
```

**예시 — 민감 응답:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=300         ← 취약: 5분 동안 공유 캐시 가능

{
  "user_id": 42,
  "email": "victim@example.com",
  "access_token": "eyJ..."
}
```

**판정**: 위 응답이 회사 프록시 / CDN / 공유 PC 브라우저 캐시에 5분 저장됨 → 다른 사용자가 해당 캐시 키로 동일 응답 받을 가능성. `private` 만 있어도 공유 PC 브라우저 캐시는 노출.

### 케이스 6: 정보 노출 헤더

**언제 점검하는지**: 모든 응답. 정찰 단계 정보 제공으로 임팩트는 낮지만 보고 항목으로 표준.

**탐지 대상 헤더:**

```
Server: nginx/1.18.0                ← 웹 서버 종류 + 버전
X-Powered-By: Express                ← 백엔드 프레임워크
X-Powered-By: PHP/7.4.3              ← 언어 + 버전
X-AspNet-Version: 4.0.30319          ← .NET 버전
X-AspNetMvc-Version: 5.2             ← ASP.NET MVC 버전
X-Generator: WordPress 5.8           ← CMS 버전
Liferay-Portal: ...                  ← 포털 정보
X-Drupal-Cache: ...
```

**판정**: 버전이 노출되면 알려진 CVE 와 매칭 가능 → 공격 난이도 감소. 단독은 Low 지만 보고서엔 거의 항상 포함.

### 그 외 — 한 줄 언급만 (실무 우선순위 낮음 / 별도 영역)

- **`Referrer-Policy` 미설정** — 외부 사이트로 이동 시 전체 URL 유출. URL 에 토큰이 있는 패턴 (`?token=...`) 이면 영향 큼
- **`Permissions-Policy` 미설정** — 카메라/마이크/위치 권한 자동 허용 페이지로 동작. iframe 으로 임베드된 페이지에서 권한 남용 가능
- **COOP / COEP / CORP 미설정** — Spectre 류 사이드 채널 표면 확장. SharedArrayBuffer 사용 페이지가 아니면 우선순위 낮음
- **`X-XSS-Protection: 1; mode=block`** → deprecated. 활성화 시 오히려 우회 결함 (XS-Leak) 발생 가능 → `0` 또는 미설정 권장
- **CSP 우회 (JSONP, AngularJS, `unsafe-eval` 결합)** → CSP 가 있어도 우회 가능한 케이스. 실제 XSS 입증은 `xss.md` 영역
- **HTTP Response Splitting / CRLF Injection** → 모던 웹 서버는 거의 차단. 발견되면 Critical 이지만 빈도 낮음

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약 / 미흡:

- [ ] `Content-Security-Policy` 미설정 또는 `unsafe-inline` / `unsafe-eval` / `*` / `data:` 포함
- [ ] `Strict-Transport-Security` 미설정 또는 `max-age` < 6개월 / `includeSubDomains` 누락
- [ ] `X-Frame-Options` / `CSP frame-ancestors` 둘 다 없음 (Clickjacking 가능)
- [ ] `X-Content-Type-Options: nosniff` 미설정
- [ ] 민감 응답 (개인정보 / 토큰 / 세션) 에 `Cache-Control: no-store` 누락
- [ ] `Server` / `X-Powered-By` / `X-AspNet-Version` 등 버전 정보 노출
- [ ] HTTP 접속이 HTTPS 로 강제 리다이렉트되지 않음

**오탐 주의:**

- [ ] CSP 가 있어도 너무 관대 (`*`, `unsafe-inline`) 면 실질 효과 없음 — CSP Evaluator 점수 함께 보고
- [ ] 동적 콘텐츠 페이지 (CMS / 관리자) 는 `Cache-Control: no-store` 정상, 정적 자산 (이미지 / CSS / JS) 은 캐시 가능 — 페이지별 분리
- [ ] `X-Frame-Options` 가 없어도 `CSP frame-ancestors` 가 있으면 보호됨 (모던 브라우저)
- [ ] HSTS 가 없어도 모든 응답이 HTTPS 로 강제되면 즉시 Critical 아님 (Medium) — 단, 첫 방문 시점은 여전히 위험
- [ ] B2B 내부망 등 MITM 시나리오가 비현실적인 환경은 HSTS 영향 등급 하향 가능

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Security Headers] X-Frame-Options 미설정으로 인한 Clickjacking

1. `<TARGET>` 응답 헤더 확인 — `X-Frame-Options` 및 `CSP frame-ancestors` 모두 부재
2. 외부 도메인 (`http://attacker.com/poc.html`) 에서 `<iframe>` 으로 임베드
3. CSS 로 iframe 을 투명하게 처리한 위에 가짜 버튼 배치 → 사용자가 가짜 버튼 클릭 시 실제로는 iframe 내부의 민감 액션 (계정 삭제 등) 트리거

**1차 확인 — 응답 헤더:**

```http
HTTP/1.1 200 OK
Content-Type: text/html
Set-Cookie: SESSION=...; HttpOnly; Secure
                       ← X-Frame-Options 헤더 없음
                       ← Content-Security-Policy 헤더 없음 (또는 frame-ancestors 없음)
```

**2차 — PoC HTML (`http://attacker.com/poc.html`):**

```html
<!DOCTYPE html>
<html>
<head>
  <title>경품 응모 이벤트</title>
  <style>
    .wrapper { position: relative; width: 1200px; height: 800px; }
    iframe   { position: absolute; top: 0; left: 0;
               width: 100%; height: 100%;
               opacity: 0.0001;                    /* 사용자에게 안 보이게 */
               z-index: 2; }
    .fake    { position: absolute; top: 350px; left: 500px;
               z-index: 1; padding: 20px 40px;
               background: #ff6b6b; color: white;
               font-size: 24px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>경품 응모 이벤트 - 클릭하면 응모 완료!</h1>

  <div class="wrapper">
    <div class="fake">응모하기 (클릭)</div>
    <iframe src="https://<TARGET>/account/delete?confirm=yes"></iframe>
  </div>
</body>
</html>
```

**확인 사항:**
- 응답 헤더에 `X-Frame-Options` / `CSP frame-ancestors` 가 모두 없어 외부 도메인에서 iframe 임베드 가능
- 로그인된 피해자가 공격자 페이지의 "응모하기" 버튼을 클릭하면, 실제로는 투명 iframe 내부의 계정 삭제 액션 (`/account/delete?confirm=yes`) 이 트리거됨
- 단일 클릭만으로 임팩트 큰 액션 실행 가능
- 임팩트가 큰 액션 (계정 삭제, 권한 부여, 이체) 이 GET 또는 토큰 검증 없는 POST 면 Critical (CSRF 와도 결합)

---

### PoC 2 — [Security Headers] HSTS 미설정으로 인한 SSL Strip MITM 시나리오

1. `<TARGET>` 의 HTTPS 응답에 `Strict-Transport-Security` 헤더 없음 확인
2. HTTP (평문) 접속 시 HTTPS 로 리다이렉트만 있고 HSTS 정책 미적용
3. 공용 Wi-Fi 등 MITM 환경에서 공격자가 HTTPS → HTTP 다운그레이드 (SSL Strip) → 평문 자격증명 탈취

**1차 확인 — 응답 헤더:**

```bash
$ curl -I https://<TARGET>/
HTTP/1.1 200 OK
Content-Type: text/html
                        ← Strict-Transport-Security 헤더 없음

$ curl -I http://<TARGET>/
HTTP/1.1 301 Moved Permanently
Location: https://<TARGET>/
                        ← HTTPS 리다이렉트만 있음, HSTS 정책 없음
```

**MITM 시나리오:**

```
1. 피해자가 공용 Wi-Fi 접속 (카페, 공항)
2. 공격자가 ARP Spoofing + sslstrip 으로 트래픽 가로채기
3. 피해자 브라우저 첫 접속 (http://<TARGET>):
   - HSTS 가 없으면 브라우저는 HTTPS 강제 X
   - 공격자가 HTTPS 응답을 HTTP 로 재작성하여 피해자에게 전달
4. 피해자는 HTTP 페이지에서 로그인 → 자격증명이 평문으로 전송됨
5. 공격자가 자격증명 캡처
```

**확인 사항:**
- `Strict-Transport-Security` 헤더가 없어 브라우저가 HTTPS 를 강제하지 않음
- HTTPS 리다이렉트만 있는 구조는 첫 접속 시점에 다운그레이드 공격에 노출됨
- MITM 환경 (공용 Wi-Fi, 회사 네트워크 침해, 로컬 라우터 침해 등) 에서 평문 자격증명 / 세션 쿠키 탈취 가능
- HSTS Preload List 등록까지 적용되면 첫 방문 시점도 보호됨

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🟡 (단독) / 🔴 (HSTS 없음 + MITM → 자격증명 탈취 / Cache 미흡 + 토큰 노출)
- **무결성 (Integrity)**: 🟡 (Clickjacking 시 사용자 의도와 다른 액션 트리거)
- **가용성 (Availability)**: 🟢 — 직접 영향 거의 없음
- **추가 위협**:
  - **CSP 없음 + XSS 발생** → XSS 영향이 즉시 토큰 탈취 / 외부 도메인 전송으로 확장
  - **HSTS 없음 + MITM** → 평문 자격증명 / 세션 탈취
  - **X-Frame-Options 없음 + 임팩트 큰 액션** → Clickjacking 으로 1-클릭 계정 탈취 / 권한 부여
  - **nosniff 없음 + 파일 업로드 결함** → Stored XSS

**비즈니스 임팩트:**
보안 헤더는 단독 결함보다 **다른 결함의 영향을 증폭/완화** 하는 게 본질. 보고서에서는 모든 항목을 매트릭스 형태로 일괄 보고하는 게 표준이며, 다른 결함 (XSS / 파일 업로드 / 변경 액션) 과의 결합 시나리오를 명시해 등급 산정의 근거를 마련. 보안 헤더만 정확히 적용해도 다른 결함의 임팩트가 크게 축소되므로 비용 대비 효과가 높은 항목.

---

## 대응방안

### 개발자 관점 (필수)

1. **모든 응답에 보안 헤더 일괄 적용** — 미들웨어 / 프레임워크 단위로. 어플리케이션 코드마다 직접 처리하지 말 것.

2. **CSP 적용 전략** — 단계적 도입:
   - 1단계: `Content-Security-Policy-Report-Only` 로 시작 → 위반 패턴 수집
   - 2단계: `unsafe-inline` 제거를 위해 인라인 스크립트를 nonce / hash 로 전환
   - 3단계: `strict-dynamic` 적용 (`script-src 'self' 'nonce-...' 'strict-dynamic'`)
   - 절대 금지: `unsafe-inline`, `unsafe-eval`, `*`, `data:` (script-src)

3. **HSTS 적용** — `max-age=31536000; includeSubDomains; preload` + HSTS Preload List 등록 (https://hstspreload.org/).

4. **민감 응답 캐시 차단** — 개인정보 / 토큰 / 세션 응답:

   ```http
   Cache-Control: no-store, no-cache, must-revalidate
   Pragma: no-cache
   ```

5. **버전 정보 비활성화** — `Server` / `X-Powered-By` / `X-AspNet-Version` 등 모두 제거.

### 운영자 관점

1. **Nginx / Apache / API Gateway 단위 일괄 적용** — 어플리케이션 코드 변경 없이도 적용 가능. 가장 빠른 대응.

2. **주기 점검** — 다음 도구로 정기 점수 확인:
   - https://securityheaders.com/
   - https://observatory.mozilla.org/
   - https://csp-evaluator.withgoogle.com/

3. **HSTS Preload List 등록** — https://hstspreload.org/ 에서 등록 신청. 첫 방문 시점도 보호됨.

### 안전한 예시 코드 (스택별)

**Nginx:**

```nginx
# nginx.conf 또는 site 설정 파일
server {
    # CSP — 어플리케이션 환경에 맞게 nonce 적용 필요 (정적 사이트 예시)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Clickjacking
    add_header X-Frame-Options "DENY" always;

    # MIME sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # Referrer
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Permissions
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Cross-Origin Isolation
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # 정보 노출 차단
    server_tokens off;                # Server: nginx 만 표시 (버전 숨김)
    # 더 강하게는 https://github.com/openresty/headers-more-nginx-module 의 more_clear_headers
}
```

**Apache (`.htaccess` 또는 `httpd.conf`):**

```apache
<IfModule mod_headers.c>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; frame-ancestors 'none'"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"

    # 정보 노출 차단
    Header unset X-Powered-By
    Header unset Server
</IfModule>

ServerTokens Prod        # Server: Apache 만 표시
ServerSignature Off
```

**Node.js (Express + `helmet`):**

```javascript
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
            styleSrc: ["'self'", "'unsafe-inline'"],   // 가능하면 nonce 로 전환
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy: true,
}));

// nonce 미들웨어 (CSP 인라인 스크립트 대응)
const crypto = require('crypto');
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});
```

**Spring Security:**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'"
                ))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000L)
                    .preload(true))
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .referrerPolicy(ref -> ref.policy(
                    ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .permissionsPolicy(pp -> pp.policy("camera=(), microphone=(), geolocation=()"))
            )
            // ... 다른 설정
            ;
        return http.build();
    }
}
```

**Django (`settings.py`):**

```python
# Django 기본 보안 설정 + django-csp 패키지 사용

# HSTS
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True

# X-Content-Type-Options
SECURE_CONTENT_TYPE_NOSNIFF = True

# X-Frame-Options
X_FRAME_OPTIONS = 'DENY'

# Referrer-Policy
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# CSP (django-csp 패키지)
INSTALLED_APPS = [..., 'csp']
MIDDLEWARE = [..., 'csp.middleware.CSPMiddleware']

CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'",)
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_BASE_URI = ("'self'",)
CSP_FORM_ACTION = ("'self'",)
```

**민감 응답 캐시 차단 (스택 공통):**

```python
# Flask
@app.route('/api/me')
def me():
    response = jsonify({...})
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    return response
```

```java
// Spring
@GetMapping("/api/me")
public ResponseEntity<Map<String, Object>> me() {
    return ResponseEntity.ok()
        .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
        .header(HttpHeaders.PRAGMA, "no-cache")
        .body(...);
}
```

---

## 참고자료

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [OWASP Cheat Sheet - HTTP Security Response Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [MDN - HTTP Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [MDN - Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [securityheaders.com (Scott Helme)](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [HSTS Preload List](https://hstspreload.org/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
