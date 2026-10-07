---
sidebar_position: 29.1
title: HTTP Request Smuggling
description: 웹 진단 - 프런트엔드와 백엔드의 요청 경계 해석 불일치(CL.TE, TE.CL, TE.TE, CL.0, HTTP/2 다운그레이드)를 안전하게 탐지하고 판정하는 실무 노트
keywords: [HTTP Request Smuggling, HTTP Desync, CL.TE, TE.CL, TE.TE, CL.0, HTTP/2 downgrade, Transfer-Encoding, Content-Length, request smuggling, OWASP]
draft: false
toc_max_heading_level: 3
---

> 프런트엔드 프록시와 백엔드 서버가 하나의 연결에서 요청 경계를 다르게 해석하는지(desync) 확인한다.

## 점검 목적

프런트엔드(로드밸런서·리버스 프록시·CDN)와 백엔드 서버가 같은 TCP 연결에 흐르는 바이트 스트림에서 **요청이 어디서 끝나는지**를 다르게 판단하면, 한 요청의 일부가 다음 요청의 앞부분으로 해석된다. 이 경계 불일치(desync)를 이용하면 다른 사용자의 요청 앞에 바이트를 끼워 넣어 응답 가로채기, 캐시 포이즈닝, 인증·접근 제어 우회로 이어질 수 있다.

핵심 원인은 `Content-Length`(CL)와 `Transfer-Encoding: chunked`(TE)를 두 서버가 다르게 우선하거나 다르게 파싱하는 것이다. HTTP/2를 프런트에서 받아 HTTP/1.1로 다운그레이드하는 경우 변환 과정에서 같은 종류의 불일치가 생긴다.

프런트/백엔드가 없는 단일 서버에서는 영향이 제한적이다. CRLF를 단일 응답 헤더에 주입하는 문제는 [보안 헤더](./security-headers.md)·[Open Redirect](./open-redirect.md) 범위이고, smuggling으로 도달한 내부 endpoint의 2차 취약점은 각 해당 페이지에서 이어 확인한다.

### 운영 안전 원칙

- Request smuggling은 **다른 실제 사용자의 요청에 영향을 줄 수 있는 침습적 기법**이다. 명시적 사전 승인과 점검 창(window) 없이 수행하지 않는다.
- 탐지는 **timing 기반(지연 차이)** 부터 시작한다. 응답을 소켓에 주입해 다른 사용자에게 보이게 만드는 재현은 승인 범위와 저트래픽 시간대에서 최소 횟수만 한다.
- 캐시 포이즈닝 입증은 **점검 전용 경로·고유 마커**로만 하고, 공용 캐시에 오래 남는 응답을 심지 않는다. 확인 후 캐시 무효화 가능 여부를 함께 기록한다.
- 운영 환경에서는 PoC를 "경계 불일치가 관측된다"는 수준에서 멈추고, 전체 체인은 스테이징·승인된 범위에서 재현한다.

## 유형 구분

| 유형 | 프런트엔드 | 백엔드 | 실무 판단 |
| :--- | :--- | :--- | :--- |
| **CL.TE** | `Content-Length` 신뢰 | `Transfer-Encoding` 신뢰 | 프런트가 본문 전체를 한 요청으로 넘기고, 백엔드가 chunked 경계로 끊어 뒷부분을 다음 요청으로 봄 |
| **TE.CL** | `Transfer-Encoding` 신뢰 | `Content-Length` 신뢰 | 프런트가 chunked로 끊고, 백엔드가 CL 길이만큼만 읽어 나머지가 다음 요청에 붙음 |
| **TE.TE** | 둘 다 TE 지원하나 파싱 상이 | 〃 | 한쪽만 `Transfer-Encoding` 헤더를 유효로 인식하도록 난독화 |
| **CL.0** | `Content-Length` 신뢰 | 본문 무시(0으로 취급) | 백엔드가 특정 경로에서 본문을 안 읽어 본문이 다음 요청으로 해석됨 |
| **H2.CL / H2.TE** | HTTP/2 수신 | HTTP/1.1 변환 후 CL/TE | 다운그레이드 시 길이 재계산·헤더 주입 불일치 |
| **Client-side desync** | 연결 재사용 | — | 브라우저 fetch 큐에서 경계가 밀려 자기 세션에 주입 |

## 진단 절차

#### Step 1. 아키텍처와 연결 재사용 확인

- 응답 헤더에서 `Via`, `X-Cache`, `Server`, `CF-RAY` 등 프런트엔드 존재 단서를 본다. 프런트/백엔드 2단 구조가 전제다.
- 같은 연결에서 keep-alive로 여러 요청이 처리되는지 확인한다. 연결 재사용이 없으면 고전적 smuggling 영향이 줄어든다.
- HTTP/2 지원 여부를 확인한다. 프런트가 HTTP/2를 받으면 다운그레이드 계열을 우선 본다.

#### Step 2. timing 기반 탐지 (비침습 우선)

- CL.TE / TE.CL 각각에 대해 "백엔드가 추가 바이트를 기다리게" 만드는 프로브를 보내 **응답 지연**이 생기는지 비교한다.
- 지연이 재현되면 경계 불일치 후보다. 이 단계는 다른 사용자 요청을 건드리지 않는다.
- 정상 요청의 응답 시간을 baseline으로 먼저 측정한다.

#### Step 3. 난독화(TE.TE) 변형 비교

- `Transfer-Encoding` 헤더를 한쪽만 무시하도록 공백·대소문자·중복·잘못된 값으로 변형해 하나씩 비교한다.
- 어떤 변형에서 지연·오류가 달라지는지로 어느 쪽이 TE를 무시하는지 좁힌다.

#### Step 4. 경계 불일치 확인 (승인 범위)

- 승인된 경우에만, 자기 자신의 후속 요청이 prefix로 오염되는지 **자기 요청 쌍**으로 확인한다. 다른 사용자 대상 재현은 피한다.
- 오염된 응답에 자신이 심은 고유 마커가 나타나는지로 판정한다.

#### Step 5. 영향 경로 분류

- 접근 제어 우회(내부 전용 경로 도달), 캐시 포이즈닝, 응답 가로채기 중 어떤 영향으로 이어지는지 분류한다.
- 각 영향은 해당 2차 취약점(인증, 캐시, 내부 API)으로 연결해 최소 증거만 남긴다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 할 테스트 |
| :--- | :--- |
| 프런트/백엔드 2단, HTTP/1.1 | CL.TE / TE.CL timing 프로브 |
| 둘 다 chunked 지원 | TE.TE 난독화 변형 비교 |
| HTTP/2 수신 프런트 | H2.CL / H2.TE 다운그레이드, CL 재계산 |
| 특정 경로만 본문 무시 | CL.0 (static·redirect 경로) |
| 로그인 상태 자기 세션만 | Client-side desync |

## 페이로드 노트

> 아래 요청은 **각 줄이 CRLF(`\r\n`)로 끝나야** 하며, Burp Repeater에서 `Content-Length`를 수동 계산해 보낸다. "Update Content-Length"를 끄고 바이트를 직접 맞춘다.

### 1. CL.TE timing 프로브

**이럴 때 사용**: 프런트가 CL, 백엔드가 TE를 신뢰하는지 지연으로 확인할 때.

```http
POST / HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded
Content-Length: 4
Transfer-Encoding: chunked

1
A
X
```

**확인할 것**: 프런트가 CL(4바이트)만 넘기면 백엔드는 chunked로 읽다가 다음 청크를 기다리며 **지연**된다. baseline 대비 일관된 지연이 생기면 CL.TE 후보다. 지연이 없으면 다른 계열로 넘어간다.

### 2. TE.CL timing 프로브

**이럴 때 사용**: 프런트가 TE, 백엔드가 CL을 신뢰하는지 확인할 때.

```http
POST / HTTP/1.1
Host: <TARGET>
Content-Type: application/x-www-form-urlencoded
Content-Length: 6
Transfer-Encoding: chunked

0

X
```

**확인할 것**: 프런트가 chunked 종료(`0`)로 요청을 끝내고, 백엔드가 CL(6)만큼 더 기다리면 지연이 발생한다. 두 프로브 중 어느 쪽에서 지연이 재현되는지로 CL.TE / TE.CL를 구분한다.

### 3. TE.TE 난독화 변형

**이럴 때 사용**: 양쪽 모두 chunked를 지원하지만 한쪽만 특정 `Transfer-Encoding` 표기를 무시하게 만들 때. 한 번에 하나씩 비교한다.

```text
Transfer-Encoding: xchunked
Transfer-Encoding : chunked
Transfer-Encoding:chunked
Transfer-Encoding: chunked
Transfer-Encoding: x
Transfer-Encoding:[tab]chunked
Transfer-Encoding: chunked, identity
```

**확인할 것**: 어떤 변형에서 한쪽만 TE를 유효로 인식하는지(지연·오류 변화)로 desync 조건을 좁힌다. 모든 변형이 동일하게 거절되면 양쪽 파서가 일치하는 것이다.

### 4. CL.0 확인

**이럴 때 사용**: 백엔드가 특정 경로(정적 파일, 리다이렉트, 일부 핸들러)에서 본문을 읽지 않을 때.

```http
POST /<STATIC_OR_REDIRECT_PATH> HTTP/1.1
Host: <TARGET>
Content-Length: 34
Connection: keep-alive

GET /<INTERNAL_PATH> HTTP/1.1
X: X
```

**확인할 것**: 백엔드가 본문을 무시하면 본문의 `GET /<INTERNAL_PATH>`가 같은 연결의 다음 요청으로 해석될 수 있다. 자기 후속 요청의 응답이 `/<INTERNAL_PATH>`로 바뀌는지 **자기 요청 쌍**으로만 확인한다.

### 5. HTTP/2 다운그레이드 (H2.CL / H2.TE)

**이럴 때 사용**: 프런트가 HTTP/2를 받아 백엔드로 HTTP/1.1로 변환할 때.

```text
# HTTP/2 요청에 명시적 길이 헤더를 주입 (Burp의 HTTP/2 inspector 사용)
:method   POST
:path     /
:authority <TARGET>
content-length  0
```

본문에 밀반입 요청을 넣고, 다운그레이드 시 `content-length`가 재계산되지 않으면 경계가 어긋난다.

**확인할 것**: HTTP/2는 메시지 길이를 프레임으로 정하므로 CL/TE 헤더는 원래 불필요하다. 변환기가 주입된 `content-length`·`transfer-encoding`을 그대로 백엔드에 넘기면 H2.CL / H2.TE가 성립한다. Burp Repeater의 HTTP/2 모드에서 길이 헤더를 수동 지정해 비교한다.

### 6. 영향 입증은 최소 범위로

**이럴 때 사용**: 경계 불일치가 확인된 뒤 실제 영향을 **승인 범위에서** 좁힐 때.

```text
접근 제어: 프런트가 막는 내부 경로(/admin 등)에 밀반입 prefix로 도달하는지
캐시 포이즈닝: 점검 전용 경로 + 고유 마커로만, 공용 리소스는 제외
응답 가로채기: 자기 요청 쌍에서 자신의 마커가 섞이는지
```

**확인할 것**: 영향은 "경계 불일치로 프런트 통제를 우회해 예상 밖 응답/경로에 도달한다"로 수렴한다. 다른 사용자 응답을 가로채는 재현은 하지 않고, 자기 세션·전용 경로로 입증한다.

### 7. 도구는 수동 확인 뒤 사용

```text
Burp 확장: HTTP Request Smuggler (Active scan의 smuggling probe)
```

자동 프로브는 변형 조합 탐색에 유용하다. 먼저 baseline 응답 시간과 2단 구조를 수동 확인한 뒤 사용하고, 보고된 결과는 timing 재현으로 다시 검증한다. 자동 스캔은 운영 영향을 고려해 요청량을 제한한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| CL.TE 프로브에서만 지연 | TE.CL와 교차 비교 | CL.TE 후보 |
| TE.CL 프로브에서만 지연 | 난독화 변형으로 조건 좁힘 | TE.CL 후보 |
| 특정 TE 변형에서만 지연 변화 | 어느 쪽이 무시하는지 기록 | TE.TE desync 조건 |
| static/redirect 경로에서만 본문 무시 | 자기 후속 요청 오염 확인 | CL.0 후보 |
| HTTP/2에서만 재현 | 다운그레이드 길이 재계산 확인 | H2.CL / H2.TE |
| 지연은 있으나 응답 오염 없음 | 연결 재사용·분리 정책 확인 | 영향 제한 가능 |
| 단일 서버 구조 | 프런트엔드 유무 재확인 | smuggling 영향 낮음 |

## 취약 판정

### 확정

- CL.TE / TE.CL / TE.TE / CL.0 중 하나로 프런트와 백엔드의 요청 경계 해석 불일치가 **일관되게** 재현된다.
- 밀반입한 prefix로 프런트가 통제하는 경로·응답에 도달하거나, 자기 요청 쌍에서 고유 마커가 다음 응답에 섞인다.
- HTTP/2 다운그레이드 과정에서 주입한 길이 헤더가 백엔드로 전달되어 경계가 어긋난다.

### 후보 또는 보류

- timing 지연은 관측되지만 응답 오염까지는 확인되지 않았다.
- 특정 TE 변형에서 오류가 다르지만 desync 재현은 되지 않았다.
- 프런트엔드 존재가 불확실하거나 연결 재사용이 없다.
- 네트워크 장비·WAF의 정규화로 변형이 일괄 거절된다.

### 영향 상승

- 프런트의 접근 제어를 우회해 내부 전용 경로·관리 기능에 도달한다.
- 캐시 포이즈닝으로 다른 응답에 통제된 내용이 제공된다(전용 경로로 입증).
- 다른 세션의 요청/자격 증명이 밀반입 체인으로 노출된다.
- 동일 desync가 인증 전 요청이나 여러 백엔드 서비스에서 반복된다.

경계 불일치는 timing만으로도 강한 후보 증거가 된다. 그러나 운영 영향이 큰 재현(응답 가로채기·캐시 포이즈닝)은 승인 범위와 최소 증거 원칙 안에서만 수행하고, 그렇지 않으면 "desync 관측" 수준에서 멈춰 보고한다.

## 참고자료

### 공식 및 테스트 가이드

- [RFC 9112 - HTTP/1.1 Message Syntax and Routing](https://datatracker.ietf.org/doc/html/rfc9112)
- [OWASP WSTG - Testing for HTTP Request Smuggling](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/)
- [PortSwigger - HTTP request smuggling](https://portswigger.net/web-security/request-smuggling)
- [PortSwigger - Browser-powered desync attacks](https://portswigger.net/research/browser-powered-desync-attacks)
- [James Kettle - HTTP Desync Attacks: Request Smuggling Reborn](https://portswigger.net/research/http-desync-attacks-request-smuggling-reborn)

### 커뮤니티 참고 / 도구

- [HTTP Request Smuggler (Burp 확장)](https://github.com/PortSwigger/http-request-smuggler)
- [PayloadsAllTheThings - Request Smuggling](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Request%20Smuggling)
- [HackTricks - HTTP Request Smuggling](https://book.hacktricks.wiki/en/pentesting-web/http-request-smuggling/index.html)
