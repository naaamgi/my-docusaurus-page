---
sidebar_position: 10
title: JavaScript 분석
description: 웹 진단 - JavaScript bundle과 source map에서 route, API, 입력 처리, 인증 흐름, 설정 단서를 찾고 실제 동작으로 검증하는 절차
keywords: [JavaScript Analysis, Source Map, JavaScript Bundle, API Endpoint, Webpack, Vite, Next.js, GraphQL, WebSocket]
draft: false
---

## 점검 목적

브라우저가 내려받는 JavaScript에서 route, API, 입력 처리, 인증·권한 흐름, 파일 처리, 실시간 통신과 설정 단서를 찾는다. 이 문서는 특정 취약점보다 전체 웹 공격 표면을 넓히는 데 목적이 있다. 코드 문자열만으로 취약을 단정하지 않고 실제 브라우저 동작과 서버 응답으로 검증한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 파일·원본 | bundle, chunk, worker, source map이 원본 구조를 보여줌 | 실제 로드 여부와 추가 노출 내용을 확인 |
| Route·API | URL, HTTP Method, 요청·응답 필드가 포함됨 | Network 요청과 대조한 뒤 직접 재현 |
| 입력·출력 | URL·메시지·저장값이 DOM·요청·redirect에 사용됨 | 입력 출처와 사용 위치를 연결해 후보 분류 |
| 인증·권한 | 토큰 처리, 역할 조건, 숨은 관리자 기능이 포함됨 | UI 제한과 서버 검증을 분리 확인 |
| 기능 흐름 | 주문·가입·승인 단계와 상태값이 포함됨 | 정상 순서와 서버 상태 검증에 활용 |
| 실시간·백그라운드 | WebSocket·GraphQL·worker가 별도 통신을 만듦 | 일반 XHR 목록 밖의 통신까지 추적 |
| 설정·키 | API 주소, 환경명, 공개 키, 토큰 문자열이 포함됨 | 공개 식별자와 사용 가능한 비밀값을 구분 |

## 진단 절차

#### Step 1. 화면과 Network 기준선 저장

로그인 전·후와 역할별로 주요 기능을 한 번씩 사용한다. DevTools Network에서 문서, XHR·Fetch, JavaScript, WebSocket 요청을 보존한다.

```text
화면 또는 기능
요청 URL과 Method
요청 body·Header
응답 상태와 주요 필드
요청을 시작한 JavaScript 파일(Initiator)
로그인 상태와 계정 역할
```

JS 분석만 먼저 하면 사용하지 않는 오래된 코드에 시간을 쓰기 쉽다. 실제 동작하는 요청을 기준점으로 잡고 정적 분석 결과와 연결한다.

#### Step 2. 실제 로드된 JavaScript 수집

HTML의 `<script src>`만 보지 않는다. Network의 JS 필터에서 동적으로 로드된 chunk, worker, lazy-loaded 화면 파일까지 확인한다.

```text
main.*.js
app.*.js
runtime.*.js
chunk-*.js
pages/*.js
service-worker.js
worker-*.js
```

브라우저에서 확인한 파일만 필요한 범위로 저장한다.

```bash
curl -sS 'https://<TARGET>/assets/app.<HASH>.js' -o app.js
```

#### Step 3. Source map 확인

배포된 JS 끝의 `sourceMappingURL` 주석과 DevTools의 Developer Resources를 확인한다.

```javascript
//# sourceMappingURL=app.abc123.js.map
```

명시된 경로가 없을 때만 같은 파일명 뒤에 `.map`을 붙인 후보를 제한적으로 확인한다.

```http
GET /assets/app.abc123.js.map HTTP/1.1
Host: <TARGET>
```

Source map JSON에서 볼 값:

| 필드 | 확인할 것 |
| :--- | :--- |
| `sources` | 원본 디렉터리와 파일명 |
| `sourcesContent` | 원본 코드가 실제 포함됐는지 |
| `names` | 함수·변수 이름 단서 |
| `sourceRoot` | 원본 경로 기준점 |

map 파일이 열린다는 사실만으로 취약을 확정하지 않는다. 원본 코드·내부 경로·비밀값·숨은 기능이 추가로 노출되는지 본다.

#### Step 4. 읽을 수 있는 형태로 정리

DevTools의 pretty print를 먼저 사용한다. source map이 로드되면 Authored 영역의 원본 파일을 우선 본다. 저장한 JS는 검색 편의를 위해 줄바꿈한 복사본을 사용할 수 있지만, 원본도 함께 보존한다.

검색은 한글 화면명과 실제 요청 필드에서 시작한다.

```bash
rg -n -i "fetch\(|axios|/api/|/graphql|wss://|token|authorization|role|admin|redirect|upload|download|innerHTML|postMessage|price|status" app.js
```

하나의 거대한 정규식 결과를 그대로 endpoint 목록으로 취급하지 않는다. 문자열이 주석·라이브러리·테스트 코드에만 있는지 주변 함수를 함께 읽는다.

#### Step 5. 입력과 동작을 연결하는 함수 추적

관심 문자열을 찾으면 값이 어디서 들어오고 어디에 사용되는지 주변 함수를 읽는다.

```javascript
const next = new URLSearchParams(location.search).get('next');
const token = sessionStorage.getItem('access_token');
api.get(`/api/files/${fileId}`, {headers: {Authorization: `Bearer ${token}`}});
messageBox.innerHTML = serverMessage;
```

이 코드에서는 다음 후보를 서로 분리해 기록한다.

```text
next가 실제 redirect에 사용되는지
token이 어떤 API와 역할에서 사용되는지
fileId의 소유권을 서버가 확인하는지
serverMessage가 신뢰 가능한 값인지
```

#### Step 6. Network와 코드 연결

화면에서 기능을 다시 실행하고 Network의 Initiator·Call Stack으로 해당 함수를 찾는다. 코드의 기본값과 실제 전송값이 다르면 변환 지점을 따라간다.

| 코드에서 찾은 값 | Network에서 확인할 것 |
| :--- | :--- |
| API 경로 | 실제 base URL, 버전 prefix, path parameter |
| body 필드 | 생략되는 값, 기본값, 직렬화 결과 |
| 입력 출처 | URL, DOM, storage, message, API 응답 중 어디서 오는지 |
| 사용 위치 | 요청, HTML 삽입, redirect, 파일 경로, 동적 코드 실행 여부 |
| 상태 상수 | 요청에 전송되는지 클라이언트 내부에서만 쓰는지 |
| 인증 Header | 브라우저가 토큰을 붙이는 위치 |
| 기능 플래그 | 서버 응답인지 로컬 조건인지 |

#### Step 7. Burp에서 한 항목씩 검증

정상 요청을 Repeater로 보내 기준선을 저장한 뒤, JS에서 찾은 값을 한 번에 하나씩 바꾼다.

```text
숨은 endpoint를 현재 세션으로 직접 요청
객체 ID를 다른 테스트 객체로 교체
URL·메시지 입력이 DOM이나 redirect에 반영되는지 확인
화면에 없는 body 필드를 하나만 추가·제거
다른 역할의 테스트 세션으로 같은 요청 전송
업로드·다운로드 파일 식별자를 교체
```

응답 코드만 보지 않고 화면 실행, 최종 URL, 객체 상태, 다운로드 내용, 권한과 이력을 취약점 문맥에 맞게 확인한다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 볼 위치 |
| :--- | :--- |
| API 문서가 없음 | Network Initiator와 `/api/`, `fetch`, `axios` 검색 |
| 관리자 메뉴가 숨겨짐 | route 목록, `admin`, `role`, `permission`, lazy chunk |
| URL 입력이 화면에 반영됨 | `location`, `URLSearchParams`, DOM 삽입 함수 |
| 파일 기능이 있음 | `upload`, `download`, `fileId`, `filename`, MIME 처리 |
| 새 창·iframe·외부 이동이 있음 | `postMessage`, `event.origin`, `window.open`, redirect 함수 |
| 가격이 화면에서 계산됨 | `price`, `amount`, `total`, `discount`, 주문 생성 함수 |
| 다단계 화면 | route 전환, 상태 상수, `nextStep`, `confirm`, `complete` |
| bundle이 한 줄로 압축됨 | pretty print와 source map Developer Resources |
| 초기 JS에 기능 코드가 없음 | 화면을 연 뒤 새로 로드된 chunk 확인 |
| XHR에 요청이 안 보임 | WebSocket, GraphQL, worker, service worker 확인 |

---

## 페이로드 노트

### 1. 파일 구조와 Source map

**이럴 때 사용**: minified bundle만으로 원래 파일과 기능 구분이 어렵다.

```text
src/api/users.ts
src/router/admin.ts
src/components/FilePreview.tsx
src/features/payment/confirm.ts
src/config/environment.ts
```

DevTools의 Authored 영역이나 source map의 `sources`, `sourcesContent`에서 원래 구조를 확인한다. 파일명으로 관련 영역을 좁힌 뒤 실제 로드된 코드인지 Network와 연결한다. 개발자 로컬 경로나 컴포넌트 이름만 보이는 경우는 정보 단서로 분리한다.

### 2. Route·API와 HTTP Method

**이럴 때 사용**: 화면에서 호출되지 않는 API나 같은 기능의 다른 Method를 찾는다.

```javascript
api.get('/api/orders/' + id)
api.post('/api/orders/' + id + '/confirm')
api.patch('/api/orders/' + id)
api.delete('/api/orders/' + id)
```

**확인할 것**: 문자열만 추출하지 말고 어떤 계정 상태에서 호출되는지, path·query·body 중 어디에 ID가 들어가는지 기록한다. 직접 요청 결과는 [권한 검증 / IDOR](./authorization-idor.md)와 연결한다.

### 3. 인증·권한·세션 단서

**이럴 때 사용**: 토큰 저장과 갱신, 역할별 메뉴, 관리자 route, 권한 이름이 코드에 보인다.

```javascript
const token = sessionStorage.getItem('access_token');
if (user.role === 'ADMIN') showAdminMenu();
if (permissions.includes('USER_EXPORT')) enableExport();
```

토큰의 저장 위치와 API client가 Authorization Header를 붙이는 지점을 확인한다. UI 조건을 바꾸거나 숨은 route를 여는 것만으로 권한 우회가 아니다. 일반 사용자·비인증 세션의 직접 요청이 서버에서 처리되는지는 [인증](./authentication.md), [세션 관리](./session-management.md), [권한 검증 / IDOR](./authorization-idor.md)에서 확인한다.

### 4. 입력값의 출처와 사용 위치

**이럴 때 사용**: URL·DOM·Web Storage·`postMessage`·API 응답이 화면 출력이나 이동 함수에 들어간다.

```javascript
const q = new URLSearchParams(location.search).get('q');
const next = new URLSearchParams(location.search).get('next');
result.innerHTML = q;
location.href = next;
window.addEventListener('message', event => render(event.data));
```

입력 출처(source)와 위험한 사용 위치(sink)를 한 쌍으로 기록한다. 값이 그 함수까지 실제로 도달하는지 DevTools breakpoint로 확인한다. 문맥에 따라 [XSS](./xss.md), [Open Redirect](./open-redirect.md), `postMessage` Origin 검증으로 분기한다.

### 5. 파일 업로드·다운로드 단서

**이럴 때 사용**: 파일 선택, 미리보기, 변환, 내보내기, 다운로드 코드가 있다.

```javascript
upload('/api/files', formData)
download(`/api/files/${fileId}?name=${filename}`)
previewUrl = URL.createObjectURL(file)
```

허용 확장자·MIME 목록이 클라이언트에만 있는지, 다운로드 요청에 객체 ID·경로·파일명이 들어가는지 확인한다. 실제 검증은 [파일 업로드](./file-upload.md), [Path Traversal / LFI](./lfi.md), [권한 검증 / IDOR](./authorization-idor.md)로 연결한다.

### 6. 비즈니스 규칙과 상태 전이

**이럴 때 사용**: 가격 계산, 쿠폰 조건, 단계 함수, 상태 상수가 코드에 보인다.

```javascript
const finalPrice = subtotal - coupon.discount + shippingFee;
const allowedNext = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'REFUND_REQUESTED']
};
```

클라이언트 계산식과 상태표는 여러 단서 중 하나다. 실제 서버가 같은 규칙을 강제하는지는 [비즈니스 로직 결함](./business-logic.md)에서 확인한다.

### 7. GraphQL과 WebSocket

**이럴 때 사용**: 일반 XHR 요청이 적거나 실시간 화면에서 상태가 바뀐다.

```javascript
client.query({query: GET_DOCUMENT, variables: {id}})
new WebSocket('wss://api.target.example/events')
socket.emit('subscribe', {channelId})
```

GraphQL operation 이름·variables와 WebSocket event 이름을 기록한다. 실제 handshake, 인증정보, 전송 frame은 Network에서 확인하고 같은 세션 문맥으로 재현한다.

### 8. Worker와 동적 chunk

**이럴 때 사용**: 초기 bundle에는 코드가 없고 특정 화면을 열 때만 기능이 동작한다.

```javascript
import('./pages/account/settings.js')
new Worker('/assets/export-worker.js')
navigator.serviceWorker.register('/service-worker.js')
```

해당 화면을 실제로 연 뒤 새로 내려받은 파일을 수집한다. chunk 이름만 보고 관리자 기능 접근을 확정하지 않는다.

### 9. 설정값·키·토큰 문자열

**이럴 때 사용**: API key, DSN, 환경 변수 이름, Authorization 문자열이 보인다.

| 발견 값 | 기본 판단 |
| :--- | :--- |
| API base URL·환경명 | 구조 단서 |
| 공개용 지도·분석 키 | 도메인 제한과 사용 목적 확인 |
| Sentry DSN | 일반적으로 클라이언트 공개 가능, 오용 가능성 별도 확인 |
| 비공개 API credential | 최소 권한의 읽기 요청 등으로 유효성 제한 확인 |
| 사용자 access token | 실제 사용자·만료·권한 범위를 확인 |

문자열 모양만으로 비밀값이라고 단정하지 않는다. 유효성 확인이 필요해도 대량 조회나 비용이 발생하는 API 호출은 기본 검증에서 피한다.

### 10. 도구 참고

- DevTools Sources의 전체 검색, pretty print, Developer Resources를 먼저 사용한다.
- LinkFinder·JSFinder·SecretFinder 같은 도구 결과는 후보 목록으로만 사용한다.
- 도구가 찾지 못한 문자열 결합 URL, runtime base URL, GraphQL operation은 수동으로 확인한다.
- 분석 대상은 스코프의 실제 로드 파일로 제한하고 무작정 외부 domain 전체를 수집하지 않는다.

---

## 우회 매트릭스

| 관찰된 증상 | 다음 시도 | 확인할 것 |
| :--- | :--- | :--- |
| bundle이 한 줄이고 이름이 짧음 | pretty print, source map, Network Initiator | 난독화와 단순 minify 구분 |
| source map 주석이 없음 | DevTools Developer Resources, 명시된 manifest 확인 | `.map` 경로 대량 추측은 피함 |
| 초기 bundle에 endpoint가 없음 | 기능 화면을 열어 lazy chunk 수집 | 동적 import 여부 |
| API 문자열이 조각으로 결합됨 | base URL·template literal·호출 함수 추적 | 최종 Network URL |
| 숨은 route가 열리지만 데이터가 없음 | XHR·Fetch 응답과 서버 권한 확인 | UI 노출과 권한 우회 구분 |
| endpoint가 `404`를 반환함 | Method, prefix, path parameter, 환경 조건 확인 | 오래된 코드일 수 있음 |
| 필드를 바꿔도 결과가 같음 | 필드 제거와 후속 조회 비교 | 서버 재계산·무시 가능성 |
| 키처럼 보이는 문자열 발견 | 공급자와 키 유형 확인 | 공개 키와 credential 구분 |

---

## 취약 판정 기준

### 취약 확정

- JS에서 찾은 숨은 API가 일반 사용자 또는 비인증 요청을 서버에서 허용한다.
- URL·메시지·API 응답이 위험한 DOM·redirect·동적 실행 위치까지 도달해 실제 동작한다.
- 화면에서만 제한하던 권한·파일·업무 필드를 변조해 서버 상태나 응답 내용이 실제로 바뀐다.
- source map이나 bundle에 포함된 비공개 credential이 유효하며 스코프 내 자원 접근에 사용된다.
- 클라이언트에만 있는 검증을 제거해 정상 UI로는 불가능한 중요 동작이 처리된다.

### 후보 / 보류

- 사용하지 않는 API 경로·관리자 route·입력 처리 함수·상태값 문자열만 발견했다.
- source map이 열리지만 공개된 프런트엔드 원본 외에 민감한 내용은 확인되지 않았다.
- 공개 목적의 API key·DSN·프로젝트 식별자만 발견했다.
- 숨은 필드를 전송했지만 서버가 무시하거나 다시 계산한다.

### 영향 상승 조건

- 숨은 기능이 결제·환불·개인정보·관리자 동작과 연결된다.
- credential이 운영 환경의 비공개 API나 데이터에 접근할 수 있다.
- JS 단서가 XSS·Open Redirect·파일 처리·IDOR·인증·비즈니스 로직 같은 실제 취약점으로 재현된다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Identify Application Entry Points](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/06-Identify_Application_Entry_Points)
- [OWASP WSTG - Testing for Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure)
- [Chrome DevTools - Debug your original code with source maps](https://developer.chrome.com/docs/devtools/javascript/source-maps)
- [PortSwigger - Bypassing client-side controls](https://portswigger.net/burp/documentation/desktop/testing-workflow/vulnerabilities/input-validation/client-side-controls)

### 커뮤니티 참고 / 도구

- [LinkFinder](https://github.com/GerbenJavado/LinkFinder)
- [SecretFinder](https://github.com/m4ll0k/SecretFinder)
- [JSFinder](https://github.com/Threezh1/JSFinder)
