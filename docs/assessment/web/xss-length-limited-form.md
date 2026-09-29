---
sidebar_position: 19.1
title: 길이 제한이 있는 XSS와 폼 활용
description: 20자 JavaScript 인젝션을 문자열 탈출부터 iframe, Window 이름 접근, 폼 제출과 실패 조건까지 풀어보는 학습 노트
keywords: [XSS, JavaScript Injection, 길이 제한, iframe, HTML Injection, CSRF, named access]
toc_max_heading_level: 3
---

## 이 사례에서 배울 것

사용자 이름은 20자까지만 입력할 수 있다. 그런데 그 이름이 웹 페이지의 JavaScript 코드 안에 그대로 들어간다면, 짧은 입력만으로도 브라우저에 동작을 시킬 수 있다.

이 문서에서 살펴볼 입력은 다음과 같다.

```javascript
");top.a.submit()//
```

이 코드는 19자다. 길이 검사를 통과하면서, 다른 곳에 준비된 폼을 제출하는 역할을 한다. **요청에 필요한 정보를 전부 19자에 집어넣은 것이 아니라, 그 정보를 HTML 폼에 두고 실행하는 부분만 짧게 만든 것이다.**

출발점은 [ENKI Jeopardy Write-up의 leakage 문제](https://www.enki.co.kr/media-center/blog/enki-redteam-ctf-jeopardy-writeup)다. 원문은 프로필의 JavaScript 삽입 지점과 메모의 HTML 삽입 지점을 연결한다. 여기서는 그 브라우저 동작을 분리해서 설명한다. 아래의 `/lesson/` 경로와 표시 이름 변경 폼은 이해를 위해 만든 예시이며, 원문 서비스의 실제 API가 아니다.

기본 유형은 [XSS 문서](./xss.md), 요청 위조의 기본 조건은 [CSRF 문서](./csrf.md)와 함께 읽을 수 있다.

## 1. console.log()에 이름을 출력하는데 왜 코드가 실행될까?

### 정상적인 출력

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

### 입력을 넣은 뒤 만들어지는 코드

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

### 따옴표만 닫으면 충분하지 않은 이유

이 예시에서는 문자열이 함수의 괄호 안에 있다. 따라서 문자열을 닫는 `"`에 이어 함수 호출을 닫는 `)`도 필요하다.

입력이 들어가는 자리가 `const name = "...";`인 경우에는 주변 구문이 달라진다. **같은 입력을 어디에 넣어도 실행되는 것이 아니라, 원래 코드의 따옴표와 괄호 구조에 맞아야 한다.**

또한 `//`는 한 줄 주석이다. 뒤에 남는 코드가 다음 줄에 배치되면 이 설명대로 가려지지 않는다. 서버가 생성한 실제 응답에서 줄바꿈까지 확인해야 한다.

## 2. 20자 제한을 어떻게 다루는가?

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

## 3. 폼과 iframe은 어디에 있는가?

### 바깥 페이지: 요청 정보를 가진 폼

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

### 안쪽 페이지: 짧은 코드가 실행되는 프로필

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

## 4. top.a.submit()을 정확하게 읽기

### top: 최상위 창

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

### a: Window의 이름 기반 요소 접근

브라우저는 HTML 요소의 `id` 등을 통해 `window`에서 요소를 이름으로 접근할 수 있게 하는 기능을 제공한다. 이 예시에서는 최상위 문서의 `id="a"` 폼이 `top.a`로 참조되는 조건을 이용한다. [MDN: Window의 named properties](https://developer.mozilla.org/en-US/docs/Web/API/Window#named_properties)

이를 명시적인 요소 탐색으로 풀어 쓰면 의도는 다음과 같다.

```javascript
top.document.getElementById("a").submit();
```

짧은 표현은 문자 수를 줄여준다. 다만 두 표현이 모든 DOM에서 동일한 결과를 보장하지는 않는다. 이름이 중복되거나 같은 이름의 전역 속성 등이 있으면 `top.a`가 기대한 폼을 가리키지 않을 수 있다. 일반적인 서비스 코드를 작성할 때는 명시적으로 요소를 찾는 편이 이해하기 쉽다.

이름 접근 기능이 등장했다는 이유만으로 곧바로 DOM Clobbering이라고 분류하지는 않는다. 여기서는 폼을 짧게 참조하는 데 사용했다. 기존 코드가 의존하는 변수나 속성을 HTML 요소로 덮어써 흐름을 바꾸는지까지 보아야 별도의 DOM Clobbering 분석이 된다.

### submit(): 폼을 제출하는 메서드

`submit()`은 폼에 적힌 `action`, `method`, 필드 정보를 바탕으로 제출을 수행한다. 서버 명령을 직접 실행하거나 브라우저의 권한을 관리자 권한으로 바꾸는 함수가 아니다.

또한 제출 버튼을 클릭하는 것과 완전히 같지 않다. 직접 호출하면 `submit` 이벤트와 브라우저의 폼 제약 검증이 실행되지 않는다. 따라서 `onsubmit`에서만 처리하는 검증은 이 호출을 막지 못한다. 서버의 검증은 별개로 계속 적용된다.

폼 안에 `name="submit"` 또는 `id="submit"`인 입력 요소가 있으면 메서드가 그 요소에 가려져 호출이 실패할 수도 있다. [MDN: HTMLFormElement.submit()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit)

## 5. 다른 사이트의 폼도 마음대로 제출할 수 있을까?

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

## 6. XSS 실행과 서버의 실제 변경은 별개다

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

## 7. 어떤 조건에서 실패하는가?

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

## 8. 네트워크 요청 없이 구문만 확인하기

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

## 9. 방어를 어느 지점에 적용해야 할까?

가장 먼저 끊어야 할 연결은 **사용자 이름이 실행 가능한 JavaScript 소스가 되는 부분**이다. 사용자 입력을 인라인 스크립트에 직접 이어 붙이지 말고, 데이터로 전달받아 처리한다. 화면에 이름만 출력할 때는 `textContent`처럼 텍스트로 다루는 방식을 사용한다.

HTML 본문, HTML 속성, JavaScript 문자열은 서로 다른 출력 위치다. HTML용 이스케이프만 적용하고 JavaScript에서도 안전하다고 가정하면 안 된다. HTML의 `<script>` 안에 값을 넣어야 한다면 JavaScript 문자열 처리뿐 아니라 HTML 파서가 인식하는 스크립트 종료도 고려하는, 해당 위치에 맞는 안전한 직렬화가 필요하다.

HTML 메모 기능에는 허용할 요소와 속성을 정한 검증된 정화 처리가 필요하다. 폼과 iframe이 서비스에 필요하지 않다면 허용할 이유도 없다. CSP는 추가 방어로 사용하되, 출력 처리의 대체 수단으로 취급하지 않는다. [OWASP: XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

마지막으로 상태를 변경하는 서버 기능에서는 인증과 수정 권한을 검증한다. 길이 제한은 이름의 형식을 관리하는 규칙이며, 코드 삽입이나 권한 검사를 대신하지 않는다.

## 이해했는지 확인하기

| 질문 | 설명할 수 있어야 하는 답 |
| :--- | :--- |
| `console.log()`가 위험한 실행 함수인가? | 아니다. 서버가 만든 JavaScript 소스에서 문자열 경계가 깨지는 것이 원인이다. |
| 이 예시는 20자 검사를 없앴는가? | 아니다. 제한 안의 코드로 다른 위치의 폼을 활용한다. |
| 긴 URL과 전송할 데이터는 어디에 있는가? | 최상위 문서의 HTML 폼에 있다. |
| `top`은 언제나 바로 위 부모인가? | 아니다. 최상위 창이며, 한 단계 iframe일 때만 부모와 같다. |
| HTML 폼만 삽입하면 자동 제출되는가? | 아니다. 이 예시에서는 프로필에서 실행되는 코드가 제출을 시작한다. |
| 외부 사이트의 iframe으로 바꾸면 같은가? | 아니다. 프레임 간 DOM 접근에는 동일 출처 등의 조건이 필요하다. |
| `submit()` 호출 성공은 계정 변경 성공인가? | 아니다. 서버가 요청을 받아들이고 실제 상태가 바뀌었는지까지 확인해야 한다. |
