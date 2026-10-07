---
sidebar_position: 22.1
title: Prototype Pollution
description: 웹 진단 - JavaScript 프로토타입 오염의 client/server 탐지, __proto__·constructor 벡터, gadget 연계를 안전하게 확인하는 실무 노트
keywords: [Prototype Pollution, __proto__, constructor, prototype, JavaScript, Node.js, client-side, server-side, gadget, DoS, RCE, OWASP A05]
draft: false
toc_max_heading_level: 3
---

> 사용자 입력의 `__proto__`·`constructor.prototype` 키가 `Object.prototype`에 병합되어 애플리케이션 전역 기본값을 바꾸는지 확인한다.

## 점검 목적

JavaScript에서 모든 객체는 `Object.prototype`을 공유한다. 애플리케이션이 사용자 입력을 재귀적으로 병합(merge/extend/clone)하거나 경로 문자열로 객체에 값을 할당할 때, `__proto__`·`constructor.prototype` 같은 키를 걸러내지 않으면 입력이 공유 프로토타입에 들어간다. 그 결과 코드가 "기본값"으로 가정하던 속성이 공격자 값으로 바뀌어, 상황에 따라 로직 우회, DoS, 그리고 적절한 gadget이 있으면 XSS·RCE로 이어진다.

오염 지점(sink) 확인과 gadget(오염된 속성을 위험하게 소비하는 코드) 확인은 **별개**다. 오염이 되어도 이를 소비하는 gadget이 없으면 영향은 제한적이다. 둘을 나눠 확인한다.

클라이언트 측 오염이 DOM 기반 스크립트 실행으로 이어지면 [XSS](./xss.md), 서버 측 오염이 템플릿 평가로 이어지면 [SSTI](./ssti.md), 자식 프로세스 실행으로 이어지면 [Command Injection](./command-injection.md) 범위와 함께 판정한다.

### 운영 안전 원칙

- 프로토타입 오염은 **프로세스 전역에 영향**을 줄 수 있다. 오염된 속성은 재시작 전까지 남아 다른 사용자의 요청 처리에 영향을 줄 수 있으므로, 애플리케이션이 실제로 쓰는 속성명(`isAdmin`, `role` 등)으로 바로 덮지 않는다.
- 탐지는 **충돌하지 않는 고유 속성명**(`<RANDOM>`)으로 먼저 한다. 반영 여부만 확인하고, 영향 입증은 승인 범위에서 최소로 한다.
- RCE gadget(예: `child_process` 연계)은 승인된 스테이징에서만 재현하고, 운영에서는 "오염 반영 + gadget 존재"까지만 확인한다.
- DoS로 이어질 수 있는 속성(응답 처리·파서 동작을 깨는 키)은 운영 대상에 보내지 않는다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 클라이언트 측 오염 | URL·DOM 입력이 클라이언트 merge로 `Object.prototype`에 반영 | DOM gadget(속성 기반 sink)으로 XSS 연계되는지 확인 |
| 서버 측 오염 | JSON/폼 입력이 서버 merge로 반영 | 응답 변화·설정 변조·gadget으로 영향 확인 |
| 경로 할당 sink | `a.b.c` 같은 경로 문자열로 깊은 속성 할당 | `__proto__` 경로가 차단되는지 확인 |
| gadget 소비 | 오염된 기본값을 위험하게 쓰는 코드 | 템플릿·spawn 옵션·설정 플래그 연계 확인 |

## 진단 절차

#### Step 1. 병합/할당 지점 식별

- 설정 객체, 쿼리 파라미터 파싱, JSON body 병합, 기능 플래그, 사용자 설정 저장 같은 "입력을 객체에 합치는" 기능을 본다.
- 라이브러리 단서(`lodash.merge`, `jQuery.extend(true, ...)`, `Object.assign` 재귀 래퍼, `qs`/`query-string` 파서)를 기록한다.
- 클라이언트 측은 URL fragment·query, 서버 측은 JSON·폼 body가 주요 진입점이다.

#### Step 2. 고유 속성으로 오염 반영 확인 (비파괴)

- 애플리케이션이 쓰지 않는 **고유 속성명**을 `__proto__`로 심고, 그 속성이 무관한 객체에서 기본값으로 읽히는지 확인한다.
- 반영이 확인되면 오염 sink 후보다. 이 단계는 앱 동작을 깨지 않는 이름만 사용한다.

#### Step 3. 벡터·파서 동작 비교

- `__proto__`, `constructor.prototype`, 대괄호·점 표기, JSON vs 쿼리스트링을 하나씩 비교해 어떤 벡터가 통과하는지 좁힌다.
- 필터가 `__proto__`만 막고 `constructor.prototype`은 막지 않는 경우가 흔하다.

#### Step 4. gadget 존재 확인

- 오염된 기본값을 소비하는 gadget을 찾는다. 서버 측은 템플릿 엔진·spawn 옵션·설정 플래그, 클라이언트 측은 DOM 속성 기반 sink.
- gadget 없이 오염만 되는 경우와, gadget까지 연결되는 경우를 구분해 기록한다.

#### Step 5. 제한된 영향 확인

- 먼저 로직 우회·응답 변화처럼 되돌릴 수 있는 영향으로 입증한다.
- XSS·RCE 연계는 승인 범위에서 고유 마커로 1회 재현하고, 전역 영향이 남지 않도록 주의한다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 할 테스트 |
| :--- | :--- |
| URL query / fragment 파싱 | 클라이언트 측 `#__proto__[<RANDOM>]=1` |
| JSON API body 병합 | `{"__proto__":{"<RANDOM>":"1"}}` |
| `__proto__`가 차단됨 | `constructor.prototype` 경유 |
| Node.js 템플릿 렌더링 | EJS·Handlebars gadget 존재 확인 |
| 자식 프로세스 실행 기능 | spawn 옵션(shell/env) gadget (스테이징) |

## 페이로드 노트

### 1. 클라이언트 측 오염 반영 확인

**이럴 때 사용**: URL query·fragment를 클라이언트 스크립트가 객체로 병합할 때.

```text
https://<TARGET>/#__proto__[<RANDOM>]=polluted
https://<TARGET>/?__proto__[<RANDOM>]=polluted
```

브라우저 콘솔에서 반영을 확인한다.

```javascript
({}).<RANDOM>
// "polluted" 가 나오면 Object.prototype 오염
```

**확인할 것**: 무관한 빈 객체에서 심은 고유 속성이 읽히면 클라이언트 측 오염이다. 고유명이라 앱 로직을 깨지 않는다. 반영이 없으면 벡터·파서를 바꿔 비교한다.

### 2. 서버 측 오염 반영 확인

**이럴 때 사용**: JSON body를 서버가 기존 설정 객체에 병합할 때.

```http
POST /api/<ENDPOINT> HTTP/1.1
Host: <TARGET>
Content-Type: application/json

{"<PARAM>":"value","__proto__":{"<RANDOM>":"polluted"}}
```

**확인할 것**: 서버 측 오염은 직접 눈에 안 보일 수 있다. 알려진 블랙박스 단서로 판단한다 — 이후 요청에서 해당 고유 속성이 기본값으로 쓰이는지, 응답 헤더·상태 코드·JSON 처리 동작이 달라지는지. 단, 앱 전역에 남을 수 있으므로 고유명만 쓰고 결과를 기록한 뒤 재시작 가능 여부를 함께 확인한다.

### 3. constructor 우회 벡터

**이럴 때 사용**: `__proto__` 키가 필터링될 때.

```json
{"constructor":{"prototype":{"<RANDOM>":"polluted"}}}
```

```text
?constructor[prototype][<RANDOM>]=polluted
```

**확인할 것**: `constructor.prototype`도 `Object.prototype`에 도달한다. 필터가 문자열 `__proto__`만 거르면 이 벡터가 통과한다. 두 벡터 결과를 비교해 필터 범위를 기록한다.

### 4. 블랙박스 서버 측 탐지 단서

**이럴 때 사용**: 응답에 오염이 직접 반영되지 않아 간접 단서가 필요할 때.

```json
{"__proto__":{"status":555}}
{"__proto__":{"json spaces":10}}
{"__proto__":{"content-type":"application/json; charset=utf-7"}}
```

**확인할 것**: 일부 프레임워크는 오염된 기본값을 응답 상태 코드·JSON 들여쓰기·헤더 생성에 사용한다. 비정상 상태 코드(555), 응답 공백 변화, 헤더 변화가 나타나면 서버 측 오염 후보다. 이들은 동작을 바꿀 수 있으므로 운영 대상에는 보내지 않고 스테이징에서 확인한다.

### 5. gadget 연계 — 템플릿 (서버 측, 스테이징)

**이럴 때 사용**: Node.js 템플릿 엔진이 있고 오염이 확인된 경우.

```json
{"__proto__":{"<ENGINE_SPECIFIC_OPTION>":"<MARKER>"}}
```

**확인할 것**: EJS·Handlebars·Pug 등은 내부 옵션을 프로토타입에서 읽을 수 있어, 오염된 옵션이 템플릿 컴파일 경로에 주입되면 [SSTI](./ssti.md)·RCE로 연결된다. 엔진·버전별로 gadget이 다르므로 확인된 엔진의 공개 gadget만 제한적으로 확인하고, 명령 실행은 짧은 고유 마커로 1회만 재현한다.

### 6. gadget 연계 — 자식 프로세스 (스테이징)

**이럴 때 사용**: 애플리케이션이 `child_process.spawn`·`exec` 류를 사용하고 오염이 확인된 경우.

```json
{"__proto__":{"shell":"/bin/sh","argv0":"<MARKER>"}}
{"__proto__":{"NODE_OPTIONS":"--require=/proc/self/environ"}}
```

**확인할 것**: spawn 옵션(`shell`, `env`, `argv0`)이나 `NODE_OPTIONS` 기본값이 오염되면 프로세스 실행에 영향을 줄 수 있다. 이는 **승인된 스테이징에서만** 재현하고, 운영에서는 "spawn 사용 + 오염 반영"까지만 확인한다.

### 7. 도구는 수동 확인 뒤 사용

```text
PP-finder, server-side-prototype-pollution(ssrfmap류), Burp 확장
```

자동 도구는 벡터·gadget 탐색에 유용하다. 먼저 병합 지점과 고유 속성 반영을 수동 확인한 뒤 사용하고, 전역 오염이 남지 않도록 요청량과 속성명을 통제한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| 고유 속성이 빈 객체에 반영됨 | gadget 존재 확인 | 오염 sink 확정 |
| `__proto__`가 차단됨 | `constructor.prototype` 경유 | 필터 우회 후보 |
| 쿼리스트링만 막힘 | JSON body 벡터 비교 | 파서별 편차 |
| 상태 코드·헤더가 변함 | 서버 측 간접 반영 확인 | 서버 측 오염 후보 |
| 오염은 되나 gadget 없음 | 소비 코드·템플릿·spawn 재확인 | 영향 제한적 |
| 반영이 사라짐 | 프로세스 재시작·요청 격리 확인 | 전역 영향 여부 판단 |

## 취약 판정

### 확정

- 사용자 입력의 `__proto__`·`constructor.prototype` 키가 `Object.prototype`에 반영되어, 무관한 객체에서 기본값으로 읽힌다(client 또는 server).
- 오염된 기본값이 로직(권한·기능 플래그)에 영향을 주어 동작이 바뀐다.
- 오염 + 확인된 gadget으로 XSS·SSTI·명령 실행이 승인 범위에서 재현된다.

### 후보 또는 보류

- 고유 속성 반영은 확인되지만 이를 소비하는 gadget이 없다.
- 간접 단서(상태 코드·헤더 변화)만 있고 명확한 sink는 미확인이다.
- `__proto__`는 막혔고 `constructor` 우회 재현은 되지 않았다.
- 반영이 요청 간 격리되어 전역 오염으로 이어지지 않는다.

### 영향 상승

- 오염으로 인증·권한·기능 플래그가 우회된다.
- 클라이언트 측 gadget으로 DOM 기반 스크립트 실행이 재현된다.
- 서버 측 gadget으로 템플릿 평가·명령 실행에 도달한다.
- 전역 오염이 다른 사용자 요청 처리나 여러 기능에 영향을 준다.

오염 반영과 gadget은 반드시 분리해 판정한다. 반영만으로 RCE를 단정하지 않고, 확인된 gadget과 최소 재현까지 도달했을 때 영향 상승으로 본다. 전역 상태를 바꾸는 특성상, 운영 환경에서는 비파괴 반영 확인에 머무르는 것을 기본으로 한다.

## 참고자료

### 공식 및 테스트 가이드

- [OWASP - Prototype Pollution](https://owasp.org/www-community/attacks/Prototype_Pollution)
- [PortSwigger - Prototype pollution](https://portswigger.net/web-security/prototype-pollution)
- [PortSwigger - Server-side prototype pollution](https://portswigger.net/web-security/prototype-pollution/server-side)
- [Snyk - Prototype pollution research](https://security.snyk.io/vuln/npm?search=prototype%20pollution)

### 커뮤니티 참고 / 도구

- [PortSwigger - Server-Side Prototype Pollution scanner (Burp 확장)](https://github.com/portswigger/server-side-prototype-pollution)
- [PayloadsAllTheThings - Prototype Pollution](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Prototype%20Pollution)
- [HackTricks - Prototype Pollution](https://book.hacktricks.wiki/en/pentesting-web/deserialization/nodejs-proto-prototype-pollution/index.html)
