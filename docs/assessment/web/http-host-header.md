---
sidebar_position: 29.2
title: HTTP Host Header Attacks
description: 웹 진단 - Host / X-Forwarded-Host 헤더 변조로 비밀번호 재설정 포이즈닝, 캐시 포이즈닝, routing 기반 SSRF, 인증 우회를 안전하게 확인하는 실무 노트
keywords: [Host Header Injection, X-Forwarded-Host, password reset poisoning, web cache poisoning, routing SSRF, virtual host, authentication bypass, OWASP A02]
draft: false
toc_max_heading_level: 3
---

> 서버·애플리케이션이 요청의 `Host`(또는 `X-Forwarded-Host`)를 신뢰해 링크 생성·라우팅·인증에 그대로 쓰는지 확인한다.

## 점검 목적

`Host` 헤더는 클라이언트가 보내는 값이라 공격자가 바꿀 수 있다. 애플리케이션이 이 값을 절대 URL 생성(비밀번호 재설정 링크 등), 캐시 키, 내부 라우팅, 인증·접근 제어 판단에 검증 없이 사용하면 문제가 된다. 리버스 프록시 뒤에서는 `X-Forwarded-Host`, `X-Host`, `Forwarded` 같은 헤더가 같은 역할을 하기도 한다.

핵심은 "서버가 어떤 Host 값을 신뢰하고, 그 값이 어디에 흘러가는가"다. 단순히 Host를 바꿔 다른 응답이 온다고 모두 취약한 것은 아니다. 생성된 링크·캐시·라우팅·인증 중 **실제 영향 경로**까지 확인한다.

Host 값이 서버 측 외부 요청으로 이어지면 [SSRF](./ssrf.md), 프런트/백엔드 경계 해석 문제는 [HTTP Request Smuggling](./http-request-smuggling.md), 캐시 응답에 스크립트가 섞이면 [XSS](./xss.md), 재설정 토큰 자체의 처리 문제는 [인증](./authentication.md)·[세션 관리](./session-management.md)에서 이어 확인한다.

### 운영 안전 원칙

- 비밀번호 재설정 포이즈닝은 **본인 소유 테스트 계정**으로만 트리거한다. 실제 사용자에게 변조된 링크가 담긴 메일이 가지 않도록, 공격 Host는 **사전 승인된 Collaborator/OAST 도메인**으로 지정하고 자기 계정에 한정한다.
- 캐시 포이즈닝 확인은 **점검 전용 경로·고유 마커**로만 하고, 공용 캐시에 오래 남는 응답을 심지 않는다. 확인 후 캐시 무효화 가능 여부를 함께 기록한다.
- routing 기반 접근은 내부 전용 경로 "도달 여부" 확인에 머무르고, 변경·삭제 기능은 기본 검증에서 제외한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 재설정 링크 포이즈닝 | 재설정 메일 링크의 도메인을 Host가 결정함 | 자기 계정 메일 링크 host가 조작한 값으로 바뀌는지 확인 |
| 캐시 포이즈닝 | 응답에 Host 기반 절대 URL이 들어가고 캐시됨 | 조작 응답이 캐시되어 다른 요청에 제공되는지 확인 |
| routing 기반 접근 | Host/X-Forwarded-Host가 내부 vhost·백엔드 선택에 쓰임 | 내부 전용 vhost·관리 화면에 도달하는지 확인 |
| 인증·접근 우회 | Host 값으로 관리 접근·신뢰 판단을 함 | 특정 Host에서만 열리는 기능이 우회되는지 확인 |
| SSRF 연계 | 서버가 Host 값으로 다시 요청을 보냄 | 콜백·내부 응답 차이로 [SSRF](./ssrf.md) 분리 판정 |

## 진단 절차

#### Step 1. Host 반영 지점 식별

- 응답 본문·헤더(`Location`, `Link`, canonical, 스크립트 src)에 Host가 절대 URL로 반영되는지 본다.
- 메일을 보내는 기능(가입 인증, 비밀번호 재설정)의 링크 도메인이 요청 Host를 따르는지 자기 계정으로 확인한다.
- 프런트엔드 존재 시 `X-Forwarded-Host` 등 대체 헤더도 함께 기록한다.

#### Step 2. Host 변조 수용 여부 확인

- `Host`를 통제 도메인으로 바꿔 정상 응답(200)이 오는지, 거절(400/403)되는지 baseline과 비교한다.
- 완전히 거절되면 대체 헤더(`X-Forwarded-Host`, `X-Host`, `Forwarded`)나 중복 Host, 절대 URL 요청라인을 시도한다.

#### Step 3. 영향 경로별 확인

- 재설정 링크: 자기 계정 메일에서 링크 host 확인.
- 캐시: Host 반영 응답이 캐시되는지(캐시 헤더·반복 요청) 전용 경로로 확인.
- routing: 내부 vhost·관리 경로에 도달하는지 status/본문 차이로 확인.

#### Step 4. 제한된 영향 입증

- 재설정 포이즈닝은 자기 계정 토큰이 통제 도메인으로 전달되는 것까지만 입증한다.
- 캐시·routing은 고유 마커 1회 재현으로 영향을 남기고, 전역 영향이 남지 않게 한다.

### 상황별 빠른 선택

| 현재 상황 | 먼저 할 테스트 |
| :--- | :--- |
| 비밀번호 재설정 기능 있음 | 자기 계정으로 Host 변조 후 메일 링크 host 확인 |
| 응답에 절대 URL 반영됨 | 캐시 여부와 전용 경로 포이즈닝 |
| `Host` 변조가 거절됨 | `X-Forwarded-Host` 등 대체 헤더 |
| 리버스 프록시 뒤 | 중복 Host·절대 URL 요청라인 |
| 내부 vhost 의심 | 내부 도메인 Host로 routing 차이 확인 |

## 페이로드 노트

### 1. Host 반영·수용 확인

**이럴 때 사용**: 애플리케이션이 임의 Host를 수용하는지 처음 확인할 때.

```http
GET / HTTP/1.1
Host: <COLLAB>.oastify.com
```

**확인할 것**: 200 응답에 조작한 host가 `Location`·canonical·스크립트 src 등 절대 URL로 반영되는지 본다. 거절되면 대체 헤더로 넘어간다. 반영만으로는 영향이 확정되지 않으므로 어디에 쓰이는지 추적한다.

### 2. 대체 헤더 / 모호한 Host

**이럴 때 사용**: `Host` 직접 변조가 거절되지만 프런트엔드가 대체 헤더를 신뢰할 때.

```http
GET / HTTP/1.1
Host: <TARGET>
X-Forwarded-Host: <COLLAB>.oastify.com
```

```http
GET / HTTP/1.1
Host: <TARGET>
X-Host: <COLLAB>.oastify.com
Forwarded: host=<COLLAB>.oastify.com
```

중복 Host나 요청라인 절대 URL도 파서 차이를 만든다.

```http
GET https://<COLLAB>.oastify.com/ HTTP/1.1
Host: <TARGET>
```

**확인할 것**: 어떤 헤더/형식이 링크·캐시·라우팅에 반영되는지 하나씩 비교한다. 프런트와 애플리케이션이 다른 값을 신뢰하면 그 차이가 취약 지점이다.

### 3. 비밀번호 재설정 포이즈닝 (자기 계정)

**이럴 때 사용**: 재설정 링크 도메인이 요청 Host를 따를 정황이 있을 때. 반드시 **본인 소유 테스트 계정**으로만.

```http
POST /account/reset HTTP/1.1
Host: <COLLAB>.oastify.com
Content-Type: application/x-www-form-urlencoded

email=<OWN_TEST_EMAIL>
```

**확인할 것**: 자기 계정으로 온 재설정 메일의 링크 host가 `<COLLAB>` 로 바뀌면, 실제 공격 시 피해자 토큰이 공격자 도메인으로 전달될 수 있다. Collaborator 로그에 토큰이 포함된 경로 요청이 도착하는지로 입증한다. 다른 사용자 이메일로는 트리거하지 않는다.

### 4. 캐시 포이즈닝 (전용 경로)

**이럴 때 사용**: Host 기반 절대 URL이 응답에 들어가고 그 응답이 캐시될 때.

```http
GET /<DEDICATED_PATH>?cb=<RANDOM> HTTP/1.1
Host: <TARGET>
X-Forwarded-Host: <COLLAB>.oastify.com
```

**확인할 것**: 응답 헤더의 `X-Cache: hit/miss`, `Age`, `Cache-Control`로 캐시 여부를 보고, 동일 경로를 깨끗한 요청으로 다시 호출했을 때 조작된 host가 남아 있으면 캐시 포이즈닝이다. 반드시 고유 쿼리(`cb=<RANDOM>`)로 캐시 키를 분리해 공용 캐시 오염을 피한다. 반영된 절대 URL이 스크립트 src라면 [XSS](./xss.md) 연계로 판정한다.

### 5. routing 기반 접근

**이럴 때 사용**: Host/X-Forwarded-Host가 내부 vhost·백엔드 선택에 쓰일 정황이 있을 때.

```http
GET / HTTP/1.1
Host: internal.<TARGET>
```

```http
GET / HTTP/1.1
Host: localhost
X-Forwarded-Host: internal-admin
```

**확인할 것**: 외부에서 안 보이던 내부 vhost·관리 화면·staging이 특정 Host에서 열리는지 status·본문 차이로 본다. 도달이 확인되면 "접근 가능" 수준까지만 기록하고 민감 기능은 건드리지 않는다. 서버가 Host 값으로 다시 외부 요청을 보내면 [SSRF](./ssrf.md) 기준으로 분리한다.

### 6. 도구는 수동 확인 뒤 사용

```text
Burp 확장: Param Miner (Host/캐시 포이즈닝 프로브)
```

Param Miner는 캐시 키·숨은 헤더 탐색에 유용하다. 먼저 Host 반영 지점과 캐시 헤더를 수동 확인한 뒤 사용하고, 캐시 포이즈닝 프로브는 전용 경로·고유 마커로 요청량을 통제한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| 임의 Host가 200으로 수용됨 | 반영 위치(링크·캐시·라우팅) 추적 | 수용은 됨, 영향은 추적 필요 |
| `Host` 변조가 거절됨 | `X-Forwarded-Host`·`X-Host`·`Forwarded` | 대체 헤더 신뢰 여부 |
| 재설정 링크 host가 바뀜 | 자기 계정 토큰 전달 경로 확인 | 포이즈닝 후보 |
| 응답이 캐시되고 host 반영 | 깨끗한 요청에 남는지 확인 | 캐시 포이즈닝 후보 |
| 특정 Host에서 내부 화면 열림 | 접근 범위·인증 확인 | routing 기반 접근 |
| 서버가 Host로 재요청 | 콜백·내부 응답 차이 분리 | [SSRF](./ssrf.md) 분리 판정 |
| 반영되나 인코딩되어 무해 | 실제 소비 지점 재확인 | 영향 제한 가능 |

## 취약 판정

### 확정

- 조작한 Host(또는 대체 헤더)가 자기 계정 비밀번호 재설정 링크의 도메인을 통제 도메인으로 바꾼다.
- Host 기반 절대 URL이 포함된 응답이 캐시되어 깨끗한 후속 요청에도 조작 내용이 제공된다.
- Host/X-Forwarded-Host 조작으로 외부에서 접근 불가하던 내부 vhost·관리 경로에 도달한다.
- 특정 Host에서만 열리는 신뢰 기능이 헤더 조작으로 우회된다.

### 후보 또는 보류

- 임의 Host가 수용되지만 링크·캐시·라우팅 어디에도 영향이 확인되지 않는다.
- Host가 응답에 반영되지만 인코딩·고정값 처리로 소비되지 않는다.
- 재설정 링크 host가 바뀌는 듯하지만 토큰 전달까지는 확인되지 않았다.
- 캐시 반영이 있으나 캐시 키 분리로 공용 응답에는 영향이 없다.

### 영향 상승

- 포이즈닝된 재설정 링크로 다른 테스트 계정의 토큰 탈취가 재현된다.
- 캐시 포이즈닝이 공용 경로로 확산될 수 있음이 확인된다(전용 경로로 입증, 무효화 가능 여부 포함).
- 내부 관리 기능·민감 vhost 접근으로 이어진다.
- 동일 Host 신뢰가 인증 전 요청이나 여러 기능에서 반복된다.

Host 반영과 실제 영향은 분리해 판정한다. 반영만으로 취약을 단정하지 않고, 링크·캐시·라우팅·인증 중 하나에서 통제 가능한 영향이 재현될 때 확정한다.

## 참고자료

### 공식 및 테스트 가이드

- [OWASP WSTG - Testing for Host Header Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection)
- [PortSwigger - HTTP Host header attacks](https://portswigger.net/web-security/host-header)
- [PortSwigger - Web cache poisoning](https://portswigger.net/web-security/web-cache-poisoning)
- [RFC 9110 - HTTP Semantics (Host and :authority)](https://datatracker.ietf.org/doc/html/rfc9110#section-7.2)

### 커뮤니티 참고 / 도구

- [Param Miner (Burp 확장)](https://github.com/PortSwigger/param-miner)
- [PayloadsAllTheThings - Host Header Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Request%20Smuggling)
- [HackTricks - Host header injection](https://book.hacktricks.wiki/en/pentesting-web/abusing-hop-by-hop-headers.html)
