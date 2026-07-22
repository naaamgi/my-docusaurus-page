---
sidebar_position: 5
title: Frida 후킹 실무
description: Frida 연결 확인부터 대상 식별, 관찰용 후킹, 출력 해석, 최소 변경, 트러블슈팅까지 이어지는 모바일 동적 분석 흐름
keywords: [Frida, Java.use, Java.choose, ObjC.classes, Interceptor, Android, iOS, Dynamic Analysis, MASVS, MASTG]
toc_max_heading_level: 2
draft: false
---

> Frida는 실행 중인 앱의 함수 호출을 관찰하거나 제한된 범위에서 동작을 바꾸는 동적 계측(Dynamic Instrumentation) 도구다. 처음부터 우회 스크립트를 넣기보다 **연결 확인 → 대상 식별 → 관찰 → 가설 확인 → 필요한 경우 최소 변경** 순서로 사용한다.

## 사용 시점

- 정적 분석에서 찾은 클래스와 메서드가 실제로 호출되는지 확인할 때
- 사용자 행동이 어떤 비즈니스 로직과 저장·네트워크 코드로 이어지는지 추적할 때
- 프록시에서는 암호화되어 보이지 않는 데이터의 처리 지점을 찾을 때
- 앱 시작 시 한 번만 실행되는 초기화 로직을 관찰할 때
- 보호 로직의 영향을 확인하기 전에 원래 반환값과 호출 조건을 기준선으로 남길 때

SSL Pinning, Root·탈옥 탐지, Anti-debug 우회 코드는 이 문서에서 반복하지 않는다. 대상 위치와 호출 조건을 찾은 뒤 각각의 보호·우회 문서로 이동한다.

## 작업 원칙

- 허가된 앱과 테스트 계정에서만 수행한다.
- 첫 스크립트는 인자와 반환값을 바꾸지 않는 관찰용으로 만든다.
- 비밀번호, 토큰, 주민번호, 전체 요청 본문은 콘솔과 파일에 그대로 남기지 않는다.
- 모든 클래스나 고빈도 함수를 한꺼번에 추적하지 않는다. 앱 성능과 로그 가독성에 영향을 준다.
- 스크립트에는 대상 빌드의 SHA-256, 패키지 또는 Bundle ID, 확인한 Frida 버전을 메모한다.
- 변경이 필요하면 한 번에 한 값만 바꾸고 원본 결과와 앱 동작을 함께 기록한다.

## 연결·실행

### Frida 버전 확인

호스트의 CLI와 단말의 `frida-server` 또는 Gadget이 호환되지 않으면 연결·spawn 오류가 발생할 수 있다. 문서에 고정 버전을 적지 말고 작업 시점의 실제 값을 확인한다.

```bash
frida --version
python -m pip show frida frida-tools
```

Android 단말에서 실행 파일 버전을 확인할 수 있다면 호스트와 대조한다.

```bash
adb shell "su -c '/data/local/tmp/frida-server --version'"
```

버전이 다르면 임의로 여러 조합을 시도하기보다 같은 릴리스 계열로 맞춘다. 설치와 서버 실행은 [Android 진단 환경 구성](setup-android.md)과 [iOS 진단 환경 구성](setup-ios.md)을 따른다.

### USB 연결·대상

#### Step 1. Frida가 단말을 찾는지 본다

```bash
frida-ls-devices
frida-ps -U
```

`frida-ps -U`에서 프로세스 목록이 보이면 기본 통신이 되는 상태다. 보이지 않으면 스크립트보다 USB 연결, 포트 전달, 서버 실행 권한부터 확인한다.

#### Step 2. 패키지 또는 Bundle ID를 찾는다

```bash
# 실행 중인 애플리케이션
frida-ps -Ua

# 설치된 애플리케이션까지 표시
frida-ps -Uai
```

표시 이름과 식별자를 구분한다. 이후 명령에는 `com.example.app` 같은 식별자와 현재 PID 중 무엇을 사용했는지 기록한다.

### attach·spawn 선택

이미 실행 중인 프로세스의 특정 기능을 관찰할 때는 attach가 단순하다.

```bash
# frida-ps에서 확인한 PID에 attach
frida -U -p 12345 -l observe.js
```

앱 시작 시 한 번만 호출되는 초기화 코드까지 봐야 하면 spawn을 사용한다.

```bash
frida -U -f com.target.app -l observe.js
```

현재 Frida CLI에서는 spawn한 앱이 기본적으로 계속 실행된다. 시작 지점에 의도적으로 멈춰야 할 때만 `--pause`를 사용하고 REPL에서 `%resume`으로 재개한다.

```bash
frida -U -f com.target.app -l observe.js --pause
```

스크립트 파일을 저장하면 `-l`로 로드한 파일이 다시 반영된다. 수정 후 동일 행동을 다시 수행해 로그가 중복 설치되지 않았는지도 확인한다.

### 런타임 확인

```javascript
setImmediate(function () {
    var javaReady = typeof Java !== "undefined" && Java.available;
    var objcReady = typeof ObjC !== "undefined" && ObjC.available;

    console.log("[*] pid=" + Process.id + " arch=" + Process.arch);
    console.log("[*] Java.available=" + javaReady);
    console.log("[*] ObjC.available=" + objcReady);
});
```

**결과에서 볼 항목:** 올바른 프로세스와 아키텍처인지, Android Java bridge 또는 iOS Objective-C bridge를 사용할 수 있는지 확인한다. Flutter·Unity·네이티브 앱은 앱 코드가 Java나 Objective-C 클래스에 충분히 노출되지 않을 수 있다.

## 후킹 대상 선정

1. [정적 분석](static-analysis.md)에서 앱 자체 패키지와 후보 메서드를 찾는다.
2. 메서드 시그니처와 overload 유무를 확인한다.
3. 해당 기능을 실행하는 사용자 행동을 정한다.
4. 인자 자체보다 길이·형식·호출 횟수와 원본 반환값을 먼저 기록한다.
5. 호출되지 않으면 호출자, 다른 프로세스, 클래스 로더, attach 시점을 다시 확인한다.

`auth`, `crypto`, `network` 같은 이름만 보고 결론을 내리지 않는다. 실제 호출 흐름과 앱의 반응을 연결해야 다음 테스트가 선명해진다.

## Android 관찰 패턴

아래 클래스와 메서드명은 예시다. jadx에서 확인한 실제 시그니처로 바꾼다.

### Java 인자·원본 반환값

```javascript
Java.perform(function () {
    var LoginManager = Java.use("com.target.app.LoginManager");
    var checkPassword = LoginManager.checkPassword.overload("java.lang.String");

    checkPassword.implementation = function (password) {
        var inputLength = password === null ? 0 : String(password).length;
        console.log("[*] checkPassword inputLength=" + inputLength);

        var result = checkPassword.call(this, password);
        console.log("[*] checkPassword returned=" + result);
        return result;
    };
});
```

저장한 overload wrapper의 `call()`로 원본을 호출하면 어떤 시그니처를 실행하는지 분명해진다. 관찰 단계에서는 반환값을 그대로 돌려준다.

**결과에서 볼 항목:** 기능을 수행할 때 호출되는지, 호출 횟수가 예상과 같은지, 서버 응답 전후 중 언제 판단하는지, 원본 반환값이 화면 동작과 일치하는지 본다.

### overload별 호출 구분

```javascript
Java.perform(function () {
    var Validator = Java.use("com.target.app.Validator");
    var validateText = Validator.validate.overload("java.lang.String");
    var validateWithLevel = Validator.validate.overload("java.lang.String", "int");

    validateText.implementation = function (input) {
        console.log("[*] validate(String) length=" + String(input).length);
        return validateText.call(this, input);
    };

    validateWithLevel.implementation = function (input, level) {
        console.log("[*] validate(String,int) length=" + String(input).length + " level=" + level);
        return validateWithLevel.call(this, input, level);
    };
});
```

`overload()` 오류가 나면 jadx에서 보이는 Java 표현만 믿지 말고 Frida가 인식한 overload 목록과 배열·기본형 표기를 확인한다.

### 클래스·메서드 열거

```javascript
Java.perform(function () {
    Java.enumerateLoadedClasses({
        onMatch: function (className) {
            var lower = className.toLowerCase();
            if (lower.indexOf("com.target.app") === 0 && lower.indexOf("crypto") !== -1) {
                console.log(className);
            }
        },
        onComplete: function () {
            console.log("[*] class enumeration complete");
        }
    });
});
```

```javascript
Java.perform(function () {
    var Target = Java.use("com.target.app.Vault");
    var methods = Target.class.getDeclaredMethods();

    for (var i = 0; i < methods.length; i++) {
        console.log(methods[i].toString());
    }
});
```

앱 패키지 접두사와 기능 키워드를 함께 사용한다. 모든 로드 클래스를 파일로 남기면 시스템·라이브러리 클래스가 섞여 분석이 느려진다.

### 실행 인스턴스 확인

```javascript
Java.perform(function () {
    Java.choose("com.target.app.SessionManager", {
        onMatch: function (instance) {
            console.log("[*] live instance=" + instance.$className);

            if (instance.authToken) {
                var value = String(instance.authToken.value);
                console.log("[*] authToken present=true length=" + value.length);
            }

            return "stop";
        },
        onComplete: function () {
            console.log("[*] instance search complete");
        }
    });
});
```

`Java.choose`는 Java heap을 검색하므로 큰 앱에서 반복 실행하면 지연이 생길 수 있다. 첫 인스턴스로 목적을 달성하면 `stop`을 반환하고, 토큰 값 자체는 출력하지 않는다.

### 요청 경로·본문 여부

```javascript
Java.perform(function () {
    var ApiClient = Java.use("com.target.app.ApiClient");
    var sendRequest = ApiClient.sendRequest.overload(
        "java.lang.String",
        "java.lang.String"
    );

    sendRequest.implementation = function (url, body) {
        var urlText = String(url);
        var pathOnly = urlText.split("?")[0];
        var bodyLength = body === null ? 0 : String(body).length;

        console.log("[*] request path=" + pathOnly + " bodyLength=" + bodyLength);
        var response = sendRequest.call(this, url, body);
        console.log("[*] response present=" + (response !== null));
        return response;
    };
});
```

쿼리 문자열과 본문에는 토큰이나 개인정보가 들어갈 수 있다. 기본 스크립트는 경로와 길이만 남기고, 평문 내용이 꼭 필요하면 테스트 값만 사용하는 별도 계정과 제한된 필드 allowlist를 정한다.

### 호출자 Stack Trace

```javascript
Java.perform(function () {
    var Log = Java.use("android.util.Log");
    var Exception = Java.use("java.lang.Exception");
    var SecretApi = Java.use("com.target.app.SecretApi");
    var getSecret = SecretApi.getSecret.overload();

    getSecret.implementation = function () {
        console.log(Log.getStackTraceString(Exception.$new()));
        return getSecret.call(this);
    };
});
```

호출 경로를 한 번 확보한 뒤에는 Stack Trace 출력을 끈다. 고빈도 메서드에서 계속 출력하면 앱 성능과 로그 파일 크기에 영향을 준다.

## iOS 관찰 패턴

Objective-C 메서드는 `-`가 인스턴스 메서드, `+`가 클래스 메서드다. selector의 콜론 수는 인자 수와 연결된다.

### Objective-C 호출·원본 반환값

```javascript
if (typeof ObjC !== "undefined" && ObjC.available) {
    var LoginManager = ObjC.classes.LoginManager;
    var method = LoginManager["- checkPassword:"];

    Interceptor.attach(method.implementation, {
        onEnter: function (args) {
            var input = new ObjC.Object(args[2]).toString();
            console.log("[*] checkPassword inputLength=" + input.length);
        },
        onLeave: function (retval) {
            console.log("[*] checkPassword returned=" + retval.toInt32());
        }
    });
}
```

`args[0]`은 `self`, `args[1]`은 selector, `args[2]`부터 선언된 인자다. 객체가 아닐 수 있는 포인터를 무조건 `ObjC.Object`로 감싸면 앱이나 스크립트가 실패할 수 있으므로 메서드 시그니처를 먼저 확인한다.

### 클래스·selector 탐색

```javascript
if (typeof ObjC !== "undefined" && ObjC.available) {
    Object.keys(ObjC.classes).forEach(function (className) {
        var lower = className.toLowerCase();
        if (lower.indexOf("target") !== -1 && lower.indexOf("auth") !== -1) {
            console.log(className);
        }
    });
}
```

```javascript
if (typeof ObjC !== "undefined" && ObjC.available) {
    ObjC.classes.LoginManager.$ownMethods.forEach(function (selector) {
        console.log(selector);
    });
}
```

클래스 이름이 보이지 않으면 Swift 전용 타입이거나 심볼이 제거됐을 수 있다. 이때는 주 모듈의 심볼과 문자열 cross-reference로 범위를 줄인다.

### Swift·Native 런타임 주소

```javascript
var appModule = Process.getModuleByName("TargetApp");
var matches = appModule.enumerateSymbols().filter(function (symbol) {
    return symbol.name.indexOf("Login") !== -1;
});

matches.slice(0, 20).forEach(function (symbol) {
    console.log(symbol.name + " @ " + symbol.address);
});

if (matches.length > 0) {
    Interceptor.attach(matches[0].address, {
        onEnter: function () {
            console.log("[*] target symbol called");
        }
    });
}
```

심볼이 제거됐다면 정적 분석에서 확인한 **동일 빌드의 모듈 기준 오프셋**을 사용한다.

```javascript
var appModule = Process.getModuleByName("TargetApp");
var targetAddress = appModule.base.add(0x1234); // 같은 해시의 빌드에서 확인한 오프셋

console.log("[*] moduleBase=" + appModule.base + " target=" + targetAddress);
```

`0x100...` 형태의 절대 주소를 스크립트에 고정하면 ASLR과 빌드 변경 때문에 다른 위치를 가리킬 수 있다. 오프셋의 출처와 대상 파일 해시를 함께 기록한다.

### NSURLSession 요청 메타데이터

```javascript
if (typeof ObjC !== "undefined" && ObjC.available) {
    var NSURLSession = ObjC.classes.NSURLSession;
    var createTask = NSURLSession["- dataTaskWithRequest:completionHandler:"];

    Interceptor.attach(createTask.implementation, {
        onEnter: function (args) {
            var request = new ObjC.Object(args[2]);
            var url = request.URL().absoluteString().toString();
            var method = request.HTTPMethod();
            var body = request.HTTPBody();

            console.log("[*] method=" + (method ? method.toString() : "unknown"));
            console.log("[*] path=" + url.split("?")[0]);
            console.log("[*] bodyPresent=" + (body !== null));
        }
    });
}
```

이 패턴은 모든 네트워크 스택을 포괄하지 않는다. 앱이 다른 라이브러리나 네이티브 계층을 사용하면 정적 분석에서 실제 호출 지점을 찾아야 한다.

### Keychain API 호출

```javascript
var security = Process.getModuleByName("Security");

["SecItemAdd", "SecItemUpdate", "SecItemCopyMatching"].forEach(function (name) {
    var address = security.findExportByName(name);
    if (address === null) {
        return;
    }

    Interceptor.attach(address, {
        onEnter: function () {
            console.log("[*] " + name + " called");
        }
    });
});
```

호출 시점과 사용자 행동을 연결한 뒤 [iOS 데이터 저장](data-storage-ios.md)에서 protection class, access group, access control을 확인한다. 쿼리 dictionary 전체를 출력하면 토큰과 계정 데이터가 로그에 남을 수 있으므로 기본 예시에 포함하지 않는다.

## 최소 동작 변경

관찰 로그와 원본 동작을 확보한 뒤, 허가된 시나리오에서만 반환값 변경이 필요한지 판단한다. 변경 여부를 상수로 분리하면 같은 스크립트로 기준선과 비교하기 쉽다.

```javascript
var OVERRIDE_ENABLED = false;

Java.perform(function () {
    var RiskGate = Java.use("com.target.app.RiskGate");
    var isAllowed = RiskGate.isAllowed.overload();

    isAllowed.implementation = function () {
        var original = isAllowed.call(this);
        var effective = OVERRIDE_ENABLED ? true : original;

        console.log("[*] isAllowed original=" + original + " effective=" + effective);
        return effective;
    };
});
```

변경 전후에는 동일 계정, 동일 기능, 동일 앱 상태를 사용한다. 다른 통제가 우연히 결과를 바꾼 것을 후킹 효과로 오해하지 않는다. 보호 로직 우회가 목적이면 다음 문서에서 해당 로직의 전제와 제한을 함께 확인한다.

## Objection 보조 탐색

Objection은 Frida 기반의 탐색용 REPL이다. 설치된 버전과 지원 명령을 먼저 확인한다.

```bash
objection --version
objection --help
objection -g com.target.app explore
```

REPL 안에서는 `help`와 플랫폼별 도움말로 현재 명령을 확인한다. 버전에 따라 CLI 문법과 자동 우회 패턴이 달라질 수 있으며, 성공 메시지만으로 실제 통제가 우회됐다고 판단하지 않는다.

클래스 전체 watch는 호출량이 많을 수 있다. 정적 분석과 Frida 열거로 후보를 한 클래스 또는 몇 개 메서드로 줄인 뒤 사용한다.

## 로그·증적

```bash
frida -U -p 12345 -l observe.js -o evidence/frida.log
```

`-o`는 콘솔 출력을 파일로 남긴다. 종료 후 다음 항목을 확인한다.

- 비밀번호, 토큰, 쿠키, 전체 요청·응답이 포함되지 않았는가
- 패키지 또는 Bundle ID, PID, 앱 빌드 해시를 함께 기록했는가
- 어떤 사용자 행동에서 몇 번 호출됐는가
- 원본 반환값과 변경한 반환값을 구분했는가
- 스크립트 오류와 앱 로그를 후킹 성공 로그로 오해하지 않았는가

필요한 값은 앞뒤 일부만 남기거나 길이와 해시로 대체한다. 원본 로그에 민감정보가 들어갔다면 일반 산출물로 복사하지 말고 프로젝트의 증적 처리 기준을 따른다.

## 트러블슈팅

### 단말·프로세스 미표시

```bash
frida-ls-devices
frida-ps -U
```

Android는 `adb devices`, 포트 전달, `frida-server` 프로세스와 실행 권한을 확인한다. iOS는 USB·네트워크 연결, jailbreak 환경의 서비스 상태, Gadget 사용 여부를 확인한다.

### `Failed to spawn`·protocol 오류

1. 패키지 또는 Bundle ID가 정확한지 확인한다.
2. 호스트와 단말 Frida 버전을 비교한다.
3. 서버가 필요한 권한으로 실행 중인지 확인한다.
4. attach가 되는지 먼저 시험해 spawn 자체의 문제인지 분리한다.
5. 기본 조건이 정상인데 특정 앱만 실패할 때 보호·탐지 로직을 검토한다.

처음부터 Frida 탐지로 단정하지 않는다. 버전 불일치와 권한 문제가 더 기본적인 원인이다.

### `Java`·`ObjC` 사용 불가

- 올바른 앱 프로세스에 붙었는지 확인한다. 보조 프로세스에는 기대한 런타임이 없을 수 있다.
- Android에서 Java VM이 준비되기 전이라면 `Java.perform()` 시점과 spawn 여부를 확인한다.
- 대상 클래스가 custom ClassLoader나 런타임 DEX에 있는지 확인한다.
- iOS에서 앱 코드가 Swift·C/C++ 중심이면 모듈 심볼과 `Interceptor`를 사용한다.
- bridge 관련 오류가 있으면 설치한 Frida와 사용 중인 agent 빌드 방식을 공식 문서에서 확인한다.

### 클래스·메서드 탐색 실패

```javascript
Java.perform(function () {
    console.log(Java.enumerateLoadedClassesSync()
        .filter(function (name) { return name.indexOf("com.target") === 0; })
        .slice(0, 50)
        .join("\n"));
});
```

클래스가 아직 로드되지 않았거나 이름이 난독화됐거나 다른 ClassLoader에 있을 수 있다. 기능을 한 번 실행한 뒤 다시 확인하고, [정적 분석](static-analysis.md)의 호출 위치와 대조한다.

### 후킹 호출 미확인

- 테스트한 사용자 행동이 실제 코드 경로를 지나가는지 확인한다.
- overload와 인자 형식이 맞는지 확인한다.
- attach가 늦었다면 spawn으로 전환한다.
- 같은 기능이 다른 프로세스나 네이티브 모듈에 구현됐는지 확인한다.
- 앱 업데이트로 정적 분석한 파일과 실행 파일이 달라지지 않았는지 해시를 비교한다.

### 과도한 로그·성능 저하

- 클래스 전체 watch와 Stack Trace를 끈다.
- 앱 패키지와 특정 메서드로 범위를 줄인다.
- 인자 전체 대신 길이·호출 횟수만 남긴다.
- 초당 호출이 많은 함수는 샘플링하거나 집계 후 출력한다.

## 빠른 명령어 참조

```bash
# 연결과 대상 식별
frida --version
frida-ls-devices
frida-ps -U
frida-ps -Uai

# 실행 중 프로세스에 attach
frida -U -p 12345 -l observe.js

# 앱 시작부터 관찰
frida -U -f com.target.app -l observe.js

# 의도적으로 시작 지점에 정지
frida -U -f com.target.app -l observe.js --pause

# 콘솔 출력을 파일에도 기록
frida -U -p 12345 -l observe.js -o evidence/frida.log
```

## 관련 문서

- [정적 분석](static-analysis.md)
- [Android 진단 환경 구성](setup-android.md)
- [iOS 진단 환경 구성](setup-ios.md)
- [SSL Pinning 우회](ssl-pinning-bypass.md)
- [Root 탐지 우회](root-detection-bypass.md)
- [탈옥 탐지 우회](jailbreak-detection-bypass.md)
- [Anti-debug 우회](anti-debug-bypass.md)
- [Android 데이터 저장](data-storage-android.md)
- [iOS 데이터 저장](data-storage-ios.md)

## 참고자료

### 공식 문서와 프로젝트

- [Frida CLI](https://frida.re/docs/frida-cli/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)
- [Frida Android](https://frida.re/docs/android/)
- [Frida iOS](https://frida.re/docs/ios/)
- [frida-ps](https://frida.re/docs/frida-ps/)
- [Frida 릴리스](https://frida.re/news/releases/)
- [OWASP MASTG - Testing Tools](https://mas.owasp.org/MASTG/tools/)
- [OWASP MASTG - Method Hooking on iOS](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0095/)
- [Objection](https://github.com/sensepost/objection)

### 커뮤니티 참고자료

- [Frida CodeShare](https://codeshare.frida.re/)
- [HackTricks - Frida Tutorial](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/frida-tutorial)

CodeShare와 커뮤니티 스크립트는 대상 앱, Frida 버전, 포함된 후킹 범위를 검토한 뒤 사용한다. 스크립트가 무엇을 바꾸는지 모르는 상태에서는 고객사 앱에 바로 적용하지 않는다.
