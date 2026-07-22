---
sidebar_position: 5.5
title: Frida 명령어·Scripts
description: 모바일 동적 분석에서 자주 쓰는 Frida CLI 옵션과 Android·iOS·Native 관찰용 Scripts 모음
keywords: [Frida, Frida CLI, Java.perform, Interceptor, Java.use, ObjC, Android, iOS, Native Hooking, Dynamic Analysis]
toc_max_heading_level: 3
draft: false
---

> 이 문서는 Frida를 사용할 때 바로 꺼내 쓰는 명령어와 범용 Scripts 모음이다. 여기의 Scripts는 기본적으로 우회용이 아니라 **관찰·탐색용**이다. 최종 우회는 앱별 의사결정 함수와 검증 분기를 찾은 뒤, 해당 지점만 최소 변경으로 작성한다.

우회 코드를 무작정 적용하기보다 **대상 식별 → 호출 관찰 → 원본 값 확인 → 앱별 최소 변경** 순서로 사용한다.

## 빠른 사용 패턴

가장 많이 쓰는 명령은 아래 다섯 개다. Script 파일은 항상 `-l`로 로드한다. `frida -U -f com.target.app ./hook.js`처럼 파일을 맨 뒤에 두면 Android 앱 실행 인자로 해석되어 spawn 오류가 날 수 있다.

| 상황 | 명령 | 확인할 것 |
|---|---|---|
| 설치 앱과 패키지 확인 | `frida-ps -Uai` | 표시 이름과 패키지 또는 Bundle ID 구분 |
| 앱 시작부터 관찰 | `frida -U -f com.target.app -l scripts/observe.js` | 초기화·탐지·로딩 코드 포함 여부 |
| 실행 중 앱에 attach | `frida -U -n com.target.app -l scripts/observe.js` | 이미 실행한 기능만 볼 때 사용 |
| PID 기준 attach | `frida -U -p 12345 -l scripts/observe.js` | 보조 프로세스 분리 여부 |
| 로그 저장 | `frida -U -f com.target.app -l scripts/observe.js -o evidence/frida.log` | 민감정보 포함 여부 |

자주 쓰는 반복 실행은 프로젝트별 스크립트로 고정한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

# 대상 앱의 패키지 또는 Bundle ID로 변경한다.
TARGET="com.target.app"
# 실행할 Frida Script 경로로 변경한다.
SCRIPT="./scripts/observe.js"

frida -U -f "$TARGET" -l "$SCRIPT"
```

WSL에서 Windows ADB 서버를 포트 프록시로 사용하는 환경이라면 실행 스크립트 상단에 필요한 값만 추가한다.

```bash
export ADB_SERVER_SOCKET="tcp:$(ip route | awk '/default/ {print $3; exit}'):5038"
```

## 옵션 빠른 선택

| 옵션 | 의미 | 자주 쓰는 상황 |
|---|---|---|
| `-U` | USB·ADB로 연결된 단말 선택 | Android 에뮬레이터, USB 단말, 탈옥 iOS 단말 |
| `-f <id>` | 패키지 또는 Bundle ID를 spawn | 앱 시작 시점부터 봐야 할 때 |
| `-n <name>` | 프로세스 이름으로 attach | 이미 실행 중인 앱에 붙을 때 |
| `-p <pid>` | PID로 attach | 같은 앱의 여러 프로세스를 구분할 때 |
| `-l <file.js>` | JavaScript agent 로드 | 대부분의 후킹 스크립트 실행 |
| `-o <file>` | 콘솔 출력을 파일에도 저장 | 증적 로그를 남길 때 |
| `-q` | 배너 등 출력을 줄임 | 자동화·반복 실행 |
| `--pause` | spawn 후 시작 지점에 정지 | 초반 race를 수동으로 제어할 때 |
| `--runtime=v8` | V8 런타임 사용 | 복잡한 스크립트, 최신 JS 기능 확인 |
| `--runtime=qjs` | QuickJS 런타임 사용 | 가볍게 실행하거나 기본 런타임과 비교 |

`--pause`를 사용한 경우 REPL에서 `%resume`으로 앱 실행을 재개한다. 현재 CLI에서는 일반 spawn이 자동으로 재개되는 흐름이 많으므로, 의도적으로 멈춰야 할 때만 붙인다.

## 범용 Scripts 빠른 선택

| 목적 | 우선 사용할 Script | 바꿀 값 |
|---|---|---|
| Frida가 올바른 프로세스에 붙었는지 확인 | 런타임·프로세스 확인 | 없음 |
| Android 클래스 후보 찾기 | Java 클래스·메서드 검색 | `APP_PREFIX`, `KEYWORD` |
| 특정 Java 메서드 호출 확인 | Java 메서드 관찰 | 클래스명, overload 시그니처 |
| 호출 경로 확인 | Java Stack Trace | 클래스명, 메서드명 |
| 살아 있는 객체 상태 확인 | Java 인스턴스 검색 | 클래스명, 출력 필드 |
| Native 라이브러리 찾기 | Native 모듈 검색 | `KEYWORD` |
| Native export·symbol 후보 찾기 | Native 심볼 검색 | `MODULE_NAME`, `KEYWORD` |
| 입력값과 정답 비교 지점 관찰 | 문자열 비교 함수 관찰 | `TARGET_MODULE` |
| Native offset에 직접 hook | Native offset hook | `MODULE_NAME`, `OFFSET` |
| 파일 접근 경로 확인 | 파일 API 관찰 | `PATH_KEYWORDS` |
| 암호화 API 사용 여부 확인 | Android Crypto 관찰 | 알고리즘·길이만 기록 |
| WebView 위험 설정 확인 | Android WebView 관찰 | 없음 |
| iOS 클래스 후보 찾기 | ObjC 클래스·selector 검색 | `KEYWORD` |
| iOS 요청 메타데이터 확인 | NSURLSession 관찰 | 민감정보 출력 금지 |

## 공통 헬퍼

공통 헬퍼는 단독으로 실행하는 Script가 아니라, 다른 Script에서 반복해서 쓰는 **보조 함수 묶음**이다. 예를 들어 Native 포인터를 문자열로 읽을 때 잘못된 주소를 만나면 Script가 중단될 수 있고, 긴 토큰이나 본문을 그대로 출력하면 로그가 오염될 수 있다. 헬퍼는 이런 처리를 안전하고 일관되게 하기 위한 작은 함수들이다.

| 함수 | 하는 일 | 주로 쓰는 곳 |
|---|---|---|
| `safeToString(value)` | Java 객체나 JS 값을 문자열로 바꾸되 실패해도 Script를 중단하지 않음 | Java 메서드 인자·반환값 관찰 |
| `previewText(value, maxLength)` | 긴 값을 지정 길이까지만 출력하고 원래 길이를 표시 | 토큰, 본문, 긴 문자열 로그 |
| `readCStringSafe(ptrValue, maxLength)` | Native 포인터를 C 문자열로 읽되 실패를 안전하게 처리 | `strcmp`, `open`, `NSURL` 계열 Native hook |
| `findGlobalExport(name)` | Frida 버전 차이를 흡수해서 libc export 주소를 찾음 | `strcmp`, `memcmp`, `open` 같은 공통 함수 hook |
| `moduleByReturnAddress(ctx)` | 현재 호출이 어느 모듈에서 왔는지 확인 | `TARGET_MODULE` 필터링 |

사용 방법은 단순하다. 아래 블록 전체를 Script 파일 상단에 붙이고, 아래쪽 hook 코드에서 필요한 함수를 호출한다.

```javascript
'use strict';

// 1. 공통 헬퍼를 먼저 둔다.
function previewText(value, maxLength) {
    var text = String(value);
    var limit = maxLength || 120;
    return text.length > limit ? text.slice(0, limit) + '...<len=' + text.length + '>' : text;
}

// 2. 아래쪽 hook 코드에서 헬퍼를 사용한다.
Java.perform(function () {
    var Target = Java.use('com.target.app.LoginManager');
    var method = Target.checkPassword.overload('java.lang.String');

    method.implementation = function (password) {
        console.log('[*] password preview=' + previewText(password, 20));
        return method.call(this, password);
    };
});
```

아래는 문서의 Native·Java Scripts에서 공통으로 재사용할 수 있는 전체 헬퍼 묶음이다. 이미 같은 이름의 함수가 있는 Script에는 중복으로 붙이지 않는다.

```javascript
'use strict';

function safeToString(value) {
    try {
        if (value === null || value === undefined) return String(value);
        return String(value);
    } catch (e) {
        return '<toString failed: ' + e + '>';
    }
}

function previewText(value, maxLength) {
    var text = safeToString(value);
    var limit = maxLength || 120;
    if (text.length > limit) {
        return text.slice(0, limit) + '...<len=' + text.length + '>';
    }
    return text;
}

function readCStringSafe(ptrValue, maxLength) {
    try {
        if (ptrValue.isNull && ptrValue.isNull()) return '<null>';
        var text = ptrValue.readCString(maxLength || 256);
        return previewText(text, maxLength || 256);
    } catch (e) {
        return '<readCString failed: ' + e + '>';
    }
}

function findGlobalExport(name) {
    if (typeof Module.findGlobalExportByName === 'function') {
        return Module.findGlobalExportByName(name);
    }
    return Module.findExportByName(null, name);
}

function moduleByReturnAddress(ctx) {
    try {
        return Process.findModuleByAddress(ctx.returnAddress);
    } catch (e) {
        return null;
    }
}
```

## Android Scripts

아래 예시는 앱별 클래스명과 시그니처를 반드시 바꾼다. 첫 실행은 반환값을 바꾸지 않는 관찰용 Script로 시작한다.

### 런타임·프로세스 확인

**사용 목적:** Frida가 올바른 프로세스에 붙었는지, Java·ObjC bridge를 사용할 수 있는지 먼저 확인한다.  
**기대 결과:** PID, 아키텍처, 플랫폼, Android 버전과 런타임 사용 가능 여부가 출력된다.  
**다음 연계:** Java가 가능하면 Java Scripts로, Java가 보이지 않거나 Native 중심 앱이면 Native 모듈 검색으로 넘어간다.

```javascript
'use strict';

setImmediate(function () {
    // Frida agent가 붙은 프로세스와 런타임 상태를 먼저 출력한다.
    var javaReady = typeof Java !== 'undefined' && Java.available;
    var objcReady = typeof ObjC !== 'undefined' && ObjC.available;

    console.log('[*] pid=' + Process.id + ' arch=' + Process.arch + ' platform=' + Process.platform);
    console.log('[*] Java.available=' + javaReady);
    console.log('[*] ObjC.available=' + objcReady);

    if (javaReady) {
        // Java.perform() 안의 코드는 Android Java VM이 준비된 뒤 실행된다.
        Java.perform(function () {
            console.log('[*] Android=' + Java.androidVersion);
        });
    }
});
```

### Java 클래스·메서드 검색

**사용 목적:** jadx에서 본 후보가 실제 런타임에 로드됐는지 확인하고, 기능 키워드로 클래스·메서드 범위를 줄인다.  
**기대 결과:** 앱 패키지 접두사와 키워드에 맞는 클래스 또는 메서드 후보가 출력된다.  
**다음 연계:** 후보 클래스가 보이면 Java 메서드 목록으로 시그니처를 확인하고, 이후 Java 메서드 관찰로 호출 여부를 본다.

```javascript
'use strict';

// 대상 앱 패키지 접두사로 변경한다. 예: owasp.mstg.uncrackable2
var APP_PREFIX = 'com.target.app';
// 찾고 싶은 기능 키워드로 변경한다. 예: auth, crypto, root, token
var KEYWORD = 'crypto';

Java.perform(function () {
    console.log('[*] class search prefix=' + APP_PREFIX + ' keyword=' + KEYWORD);

    Java.enumerateLoadedClasses({
        onMatch: function (name) {
            var lower = name.toLowerCase();
            if (name.indexOf(APP_PREFIX) === 0 && lower.indexOf(KEYWORD.toLowerCase()) !== -1) {
                console.log(name);
            }
        },
        onComplete: function () {
            console.log('[*] class search complete');
        }
    });
});
```

Frida가 인식한 메서드 이름과 시그니처를 바로 찾고 싶을 때는 `Java.enumerateMethods()`가 빠르다.

```javascript
'use strict';

Java.perform(function () {
    // 형식: *클래스키워드*!*메서드키워드*/옵션
    // i=대소문자 무시, s=시그니처 포함, u=사용자 정의 클래스 중심
    var query = '*target*!*check*/isu';
    var groups = Java.enumerateMethods(query);
    console.log(JSON.stringify(groups, null, 2));
});
```

쿼리 뒤의 `i`는 대소문자 무시, `s`는 시그니처 포함, `u`는 사용자 정의 클래스 중심 필터다.

### Java 메서드 목록

**사용 목적:** 특정 클래스 안의 메서드와 overload 시그니처를 Frida 기준으로 확인한다.  
**기대 결과:** 반환형, 클래스명, 메서드명, 인자 타입이 포함된 메서드 목록이 출력된다.  
**다음 연계:** 확인한 시그니처를 Java 메서드 관찰 스크립트의 `overload()`에 넣는다.

```javascript
'use strict';

// 메서드 목록을 보고 싶은 실제 클래스명으로 변경한다.
var CLASS_NAME = 'com.target.app.Vault';

Java.perform(function () {
    var Target = Java.use(CLASS_NAME);
    var methods = Target.class.getDeclaredMethods();

    console.log('[*] methods of ' + CLASS_NAME);
    for (var i = 0; i < methods.length; i++) {
        console.log(methods[i].toString());
    }
});
```

### Java 메서드 관찰

**사용 목적:** 특정 Java 메서드가 실제 사용자 행동에서 호출되는지 보고, 인자 길이와 원본 반환값을 기준선으로 남긴다.  
**기대 결과:** 기능 실행 시 호출 로그, 인자 요약, 원본 반환값이 출력된다.  
**다음 연계:** 호출 지점이 맞으면 Stack Trace로 호출자를 찾거나, 필요한 경우 최소 동작 변경 스크립트로 분리한다.

```javascript
'use strict';

// 관찰할 실제 클래스명으로 변경한다.
var CLASS_NAME = 'com.target.app.LoginManager';

Java.perform(function () {
    var LoginManager = Java.use(CLASS_NAME);
    // jadx 또는 메서드 목록에서 확인한 정확한 overload 시그니처로 변경한다.
    var checkPassword = LoginManager.checkPassword.overload('java.lang.String');

    checkPassword.implementation = function (password) {
        var inputLength = password === null ? 0 : String(password).length;
        console.log('[*] checkPassword inputLength=' + inputLength);

        // 관찰 단계에서는 원본 메서드를 호출하고 결과를 그대로 돌려준다.
        var result = checkPassword.call(this, password);
        console.log('[*] checkPassword returned=' + result);
        return result;
    };

    console.log('[*] hook installed: ' + CLASS_NAME + '.checkPassword(String)');
});
```

overload가 많고 아직 시그니처를 좁히는 중이면 모든 overload를 관찰한다. 고빈도 메서드에는 오래 켜두지 않는다.

```javascript
'use strict';

// 모든 overload를 보고 싶은 실제 클래스명과 메서드명으로 변경한다.
var CLASS_NAME = 'com.target.app.Validator';
var METHOD_NAME = 'validate';

Java.perform(function () {
    var Target = Java.use(CLASS_NAME);
    var overloads = Target[METHOD_NAME].overloads;

    overloads.forEach(function (overload, index) {
        overload.implementation = function () {
            var args = [];
            for (var i = 0; i < arguments.length; i++) {
                args.push(previewText(arguments[i], 80));
            }

            console.log('[*] ' + METHOD_NAME + '[' + index + '] args=' + JSON.stringify(args));
            // overload wrapper를 통해 원본 구현을 호출한다.
            var result = overload.apply(this, arguments);
            console.log('[*] ' + METHOD_NAME + '[' + index + '] return=' + previewText(result, 80));
            return result;
        };
    });

    console.log('[*] hooked overload count=' + overloads.length);
});

function previewText(value, maxLength) {
    var text;
    try { text = String(value); } catch (e) { text = '<toString failed>'; }
    var limit = maxLength || 120;
    return text.length > limit ? text.slice(0, limit) + '...<len=' + text.length + '>' : text;
}
```

### Java Stack Trace

**사용 목적:** 특정 메서드가 어디서 호출되는지 호출 경로를 한 번 확인한다.  
**기대 결과:** Android Stack Trace가 출력되어 Activity, ViewModel, Repository, API wrapper 같은 상위 호출자를 식별할 수 있다.  
**다음 연계:** 호출자를 찾은 뒤에는 Stack Trace 출력을 끄고, 더 상위의 안정적인 메서드에 관찰 hook을 건다.

```javascript
'use strict';

// 호출 경로를 보고 싶은 실제 클래스명과 메서드명으로 변경한다.
var CLASS_NAME = 'com.target.app.SecretApi';
var METHOD_NAME = 'getSecret';

Java.perform(function () {
    var Log = Java.use('android.util.Log');
    var Exception = Java.use('java.lang.Exception');
    var Target = Java.use(CLASS_NAME);
    var method = Target[METHOD_NAME].overload();

    method.implementation = function () {
        console.log('[*] stack for ' + CLASS_NAME + '.' + METHOD_NAME);
        // 호출자가 확인되면 이 출력은 끈다. 고빈도 메서드에서는 로그가 매우 커진다.
        console.log(Log.getStackTraceString(Exception.$new()));
        return method.call(this);
    };
});
```

호출 경로를 한 번 확보한 뒤에는 끈다. Stack Trace는 로그량이 크고 고빈도 함수에서는 앱 반응을 늦춘다.

### Java 인스턴스 검색

**사용 목적:** heap에 살아 있는 객체를 찾아 현재 세션·설정·상태 값이 객체에 보관되는지 확인한다.  
**기대 결과:** 대상 클래스의 live instance 존재 여부와 선택한 필드의 존재·길이가 출력된다.  
**다음 연계:** 인스턴스가 확인되면 해당 클래스의 getter, 저장 로직, 네트워크 전달 지점을 관찰한다.

```javascript
'use strict';

// heap에서 찾고 싶은 실제 클래스명으로 변경한다.
var CLASS_NAME = 'com.target.app.SessionManager';

Java.perform(function () {
    Java.choose(CLASS_NAME, {
        onMatch: function (instance) {
            console.log('[*] live instance=' + instance.$className);

            try {
                if (instance.authToken) {
                    var token = String(instance.authToken.value);
                    console.log('[*] authToken present=true length=' + token.length);
                }
            } catch (e) {
                console.log('[*] field read failed=' + e);
            }

            // 첫 인스턴스만 필요하면 stop으로 검색을 끝낸다.
            return 'stop';
        },
        onComplete: function () {
            console.log('[*] instance search complete');
        }
    });
});
```

### Android Crypto 관찰

**사용 목적:** 앱이 어떤 암호화 알고리즘과 mode를 사용하는지, 입력·출력 길이가 어떤 흐름에서 바뀌는지 확인한다.  
**기대 결과:** `Cipher.getInstance`, `Cipher.init`, `Cipher.doFinal` 호출과 알고리즘·길이가 출력된다.  
**다음 연계:** 후보가 좁혀지면 키 생성·KeyStore·Base64·네트워크 전송 지점과 연결해서 본다.

```javascript
'use strict';

Java.perform(function () {
    // Java 표준 Crypto API를 관찰한다. 키와 평문 전체는 기본 출력하지 않는다.
    var Cipher = Java.use('javax.crypto.Cipher');

    var getInstance = Cipher.getInstance.overload('java.lang.String');
    getInstance.implementation = function (transformation) {
        console.log('[*] Cipher.getInstance transformation=' + transformation);
        return getInstance.call(this, transformation);
    };

    var initWithKey = Cipher.init.overload('int', 'java.security.Key');
    initWithKey.implementation = function (mode, key) {
        console.log('[*] Cipher.init mode=' + mode + ' algorithm=' + key.getAlgorithm());
        return initWithKey.call(this, mode, key);
    };

    var doFinalBytes = Cipher.doFinal.overload('[B');
    doFinalBytes.implementation = function (input) {
        var inputLength = input === null ? 0 : input.length;
        console.log('[*] Cipher.doFinal inputLength=' + inputLength + ' algorithm=' + this.getAlgorithm());
        var output = doFinalBytes.call(this, input);
        console.log('[*] Cipher.doFinal outputLength=' + (output === null ? 0 : output.length));
        return output;
    };
});
```

키와 평문 전체를 기본 출력하지 않는다. 알고리즘, mode, 길이, 호출 시점으로 후보를 좁힌 뒤 허가된 테스트 값만 별도 스크립트에서 제한적으로 확인한다.

### SharedPreferences 관찰

**사용 목적:** SharedPreferences 접근 시점과 key 사용 여부를 확인한다.  
**기대 결과:** `getString` 호출 key와 값 길이, `edit()` 호출 시점이 출력된다.  
**다음 연계:** 중요한 key가 보이면 Android 데이터 저장 문서 기준으로 파일 권한, 백업, 암호화 여부를 확인한다.

```javascript
'use strict';

Java.perform(function () {
    // Android 내부 구현 클래스다. 버전에 따라 앱 wrapper를 hook해야 할 수 있다.
    var Impl = Java.use('android.app.SharedPreferencesImpl');
    var getString = Impl.getString.overload('java.lang.String', 'java.lang.String');
    var edit = Impl.edit.overload();

    getString.implementation = function (key, defValue) {
        var result = getString.call(this, key, defValue);
        console.log('[*] SharedPreferences.getString key=' + key + ' valueLength=' + (result === null ? 0 : String(result).length));
        return result;
    };

    edit.implementation = function () {
        console.log('[*] SharedPreferences.edit called');
        return edit.call(this);
    };
});
```

Android 내부 구현 클래스는 버전과 제조사에 따라 달라질 수 있다. 오류가 나면 앱의 wrapper 클래스나 호출 지점을 정적 분석에서 다시 좁힌다.

### Android Intent 관찰

**사용 목적:** 앱 내부에서 Activity 이동이나 외부 호출에 어떤 Intent가 사용되는지 확인한다.  
**기대 결과:** action, data URI, component가 출력된다.  
**다음 연계:** 딥링크·export component 후보와 연결해 manifest, intent-filter, 권한 검사를 확인한다.

```javascript
'use strict';

Java.perform(function () {
    // Activity 이동에 사용되는 Intent 메타데이터만 먼저 관찰한다.
    var Activity = Java.use('android.app.Activity');
    var startActivity = Activity.startActivity.overload('android.content.Intent');

    startActivity.implementation = function (intent) {
        var action = intent.getAction();
        var data = intent.getDataString();
        var component = intent.getComponent();

        console.log('[*] startActivity action=' + action);
        console.log('[*] startActivity data=' + data);
        console.log('[*] startActivity component=' + component);
        return startActivity.call(this, intent);
    };
});
```

딥링크와 export component 점검에서는 action, data, component만 먼저 본다. extras 전체 출력은 토큰과 개인정보가 섞일 수 있다.

### Android WebView 관찰

**사용 목적:** WebView가 어떤 URL을 로드하고 위험 설정이 켜지는지 확인한다.  
**기대 결과:** 로드 경로와 JavaScript, file access, file URL universal access 설정 변경이 출력된다.  
**다음 연계:** 위험 설정이 확인되면 WebView 문서 기준으로 bridge, origin, file URL, deeplink 입력 경로를 확인한다.

```javascript
'use strict';

Java.perform(function () {
    // WebView 로드 경로와 위험 설정 변경 여부를 관찰한다.
    var WebView = Java.use('android.webkit.WebView');
    var Settings = Java.use('android.webkit.WebSettings');

    var loadUrlString = WebView.loadUrl.overload('java.lang.String');
    loadUrlString.implementation = function (url) {
        var text = String(url);
        console.log('[*] WebView.loadUrl path=' + text.split('?')[0]);
        return loadUrlString.call(this, url);
    };

    var setJavaScriptEnabled = Settings.setJavaScriptEnabled.overload('boolean');
    setJavaScriptEnabled.implementation = function (enabled) {
        console.log('[*] WebSettings.setJavaScriptEnabled=' + enabled);
        return setJavaScriptEnabled.call(this, enabled);
    };

    var setAllowFileAccess = Settings.setAllowFileAccess.overload('boolean');
    setAllowFileAccess.implementation = function (enabled) {
        console.log('[*] WebSettings.setAllowFileAccess=' + enabled);
        return setAllowFileAccess.call(this, enabled);
    };

    var setAllowUniversalAccess = Settings.setAllowUniversalAccessFromFileURLs.overload('boolean');
    setAllowUniversalAccess.implementation = function (enabled) {
        console.log('[*] WebSettings.setAllowUniversalAccessFromFileURLs=' + enabled);
        return setAllowUniversalAccess.call(this, enabled);
    };
});
```

## Native Scripts

Native Scripts는 Android와 iOS 모두에서 쓸 수 있다. 단, 모듈명과 export 이름은 플랫폼별로 다르다.

### Native 모듈 검색

**사용 목적:** 앱 프로세스에 로드된 `.so`, framework, main module 중 분석 대상 모듈을 찾는다.  
**기대 결과:** 키워드와 일치하는 모듈명, base 주소, 크기, 경로가 출력된다.  
**다음 연계:** 대상 모듈을 찾으면 Native 심볼 검색이나 offset hook으로 넘어간다.

```javascript
'use strict';

// 찾고 싶은 native 모듈 키워드로 변경한다. 예: foo, target, app 이름
var KEYWORD = 'foo';

setImmediate(function () {
    Process.enumerateModules()
        .filter(function (m) {
            return m.name.toLowerCase().indexOf(KEYWORD.toLowerCase()) !== -1 ||
                   m.path.toLowerCase().indexOf(KEYWORD.toLowerCase()) !== -1;
        })
        .forEach(function (m) {
            console.log(m.name + ' base=' + m.base + ' size=' + m.size + ' path=' + m.path);
        });
});
```

### Native 심볼 검색

**사용 목적:** Native 모듈 안에서 export 또는 symbol 이름으로 후보 함수를 찾는다.  
**기대 결과:** 키워드와 일치하는 export·symbol 이름과 주소가 출력된다.  
**다음 연계:** 이름 있는 함수는 바로 `Interceptor.attach`를 걸고, 이름이 없으면 정적 분석 오프셋을 기준으로 Native offset hook을 사용한다.

```javascript
'use strict';

// 분석할 실제 native 모듈명과 함수명 키워드로 변경한다.
var MODULE_NAME = 'libtarget.so';
var KEYWORD = 'check';

setImmediate(function () {
    var module = Process.findModuleByName(MODULE_NAME);
    if (module === null) {
        console.log('[-] module not found: ' + MODULE_NAME);
        return;
    }

    console.log('[*] exports');
    module.enumerateExports()
        .filter(function (e) { return e.name.toLowerCase().indexOf(KEYWORD.toLowerCase()) !== -1; })
        .slice(0, 50)
        .forEach(function (e) { console.log(e.type + ' ' + e.name + ' @ ' + e.address); });

    console.log('[*] symbols');
    module.enumerateSymbols()
        .filter(function (s) { return s.name.toLowerCase().indexOf(KEYWORD.toLowerCase()) !== -1; })
        .slice(0, 50)
        .forEach(function (s) { console.log(s.type + ' ' + s.name + ' @ ' + s.address); });
});
```

### 문자열 비교 함수 관찰

**사용 목적:** 입력값과 기준값이 `strcmp`, `strncmp`, `memcmp`에서 만나는 순간을 관찰한다.  
**기대 결과:** 대상 모듈에서 호출된 비교 함수의 인자 문자열, hex, 반환값이 출력된다.  
**다음 연계:** 내가 입력한 값이 아닌 쪽을 기준값 후보로 보고, 호출자 주소를 정적 분석의 비교 루틴과 대조한다.

```javascript
'use strict';

// 비교 함수 로그를 이 모듈에서 호출된 경우로만 제한한다. 예: libfoo.so
var TARGET_MODULE = 'libtarget.so';
// 너무 긴 문자열이 로그를 덮지 않도록 최대 출력 길이를 제한한다.
var MAX_TEXT = 160;

['strcmp', 'strncmp'].forEach(hookStringCompare);
hookMemcmp();

function hookStringCompare(name) {
    var address = findGlobalExport(name);
    if (address === null) {
        console.log('[-] export not found: ' + name);
        return;
    }

    Interceptor.attach(address, {
        onEnter: function (args) {
            var caller = moduleByReturnAddress(this);
            // libc 비교 함수는 매우 자주 호출되므로 대상 모듈 호출만 남긴다.
            if (TARGET_MODULE && (!caller || caller.name !== TARGET_MODULE)) return;

            this.hit = true;
            console.log('\n[*] ' + name + ' from ' + (caller ? caller.name : '<unknown>'));
            console.log('    arg0=' + readCStringSafe(args[0], MAX_TEXT));
            console.log('    arg1=' + readCStringSafe(args[1], MAX_TEXT));
        },
        onLeave: function (retval) {
            if (this.hit) console.log('    ret=' + retval.toInt32());
        }
    });

    console.log('[*] hooked ' + name + ' @ ' + address);
}

function hookMemcmp() {
    var address = findGlobalExport('memcmp');
    if (address === null) {
        console.log('[-] export not found: memcmp');
        return;
    }

    Interceptor.attach(address, {
        onEnter: function (args) {
            var caller = moduleByReturnAddress(this);
            if (TARGET_MODULE && (!caller || caller.name !== TARGET_MODULE)) return;

            // memcmp의 세 번째 인자는 비교 길이다.
            var length = args[2].toInt32();
            if (length <= 0 || length > 256) return;

            console.log('\n[*] memcmp from ' + (caller ? caller.name : '<unknown>') + ' len=' + length);
            console.log('    arg0.str=' + readCStringSafe(args[0], MAX_TEXT));
            console.log('    arg1.str=' + readCStringSafe(args[1], MAX_TEXT));
            console.log('    arg0.hex\n' + hexdump(args[0], { length: length, ansi: false }));
            console.log('    arg1.hex\n' + hexdump(args[1], { length: length, ansi: false }));
        }
    });

    console.log('[*] hooked memcmp @ ' + address);
}

function findGlobalExport(name) {
    if (typeof Module.findGlobalExportByName === 'function') {
        return Module.findGlobalExportByName(name);
    }
    return Module.findExportByName(null, name);
}

function moduleByReturnAddress(ctx) {
    try { return Process.findModuleByAddress(ctx.returnAddress); } catch (e) { return null; }
}

function readCStringSafe(ptrValue, maxLength) {
    try {
        if (ptrValue.isNull && ptrValue.isNull()) return '<null>';
        var text = ptrValue.readCString(maxLength || 256);
        if (text.length > maxLength) return text.slice(0, maxLength) + '...<len=' + text.length + '>';
        return text;
    } catch (e) {
        return '<readCString failed>';
    }
}
```

정답 검증, 라이선스 키 비교, native feature flag 확인처럼 입력값과 기준값이 만나는 지점에서 유용하다. 로그가 많으면 `TARGET_MODULE`을 반드시 지정한다.

### Native offset hook

**사용 목적:** 정적 분석에서 확인한 모듈 내부 offset에 직접 hook을 건다.  
**기대 결과:** 함수 진입, return address, 반환값이 출력된다.  
**다음 연계:** 인자 타입을 정적 분석으로 확인한 뒤 `args[n]` 해석, `retval` 관찰, 필요 시 제한적 변경으로 확장한다.

```javascript
'use strict';

// 정적 분석에서 확인한 실제 모듈명과 같은 빌드 기준 offset으로 변경한다.
var MODULE_NAME = 'libtarget.so';
var OFFSET = 0x1234;

setImmediate(function () {
    var module = Process.findModuleByName(MODULE_NAME);
    if (module === null) {
        console.log('[-] module not found: ' + MODULE_NAME);
        return;
    }

    // ASLR 때문에 절대 주소가 아니라 module base + offset으로 계산한다.
    var target = module.base.add(OFFSET);
    console.log('[*] hook target=' + MODULE_NAME + ' base=' + module.base + ' offset=0x' + OFFSET.toString(16) + ' address=' + target);

    Interceptor.attach(target, {
        onEnter: function (args) {
            console.log('[*] native function entered returnAddress=' + this.returnAddress);
        },
        onLeave: function (retval) {
            console.log('[*] native function retval=' + retval);
        }
    });
});
```

정적 분석에서 확인한 같은 빌드의 모듈 오프셋만 사용한다. ASLR 때문에 절대 주소를 스크립트에 고정하지 않는다.

### 파일 API 관찰

**사용 목적:** 앱이 어떤 파일 경로에 접근하는지 Native libc API 수준에서 확인한다.  
**기대 결과:** 지정한 키워드가 포함된 경로에 대해 `open`, `openat`, `access`, `stat` 호출이 출력된다.  
**다음 연계:** 경로가 확인되면 저장소 문서 기준으로 파일 권한, 백업 포함 여부, 암호화 여부를 확인한다.

```javascript
'use strict';

// 관찰할 경로 키워드를 대상 시나리오에 맞게 줄인다.
var PATH_KEYWORDS = ['/data/data/', 'shared_prefs', 'databases', 'files'];

['open', 'openat', 'access', 'stat'].forEach(function (name) {
    var address = findGlobalExport(name);
    if (address === null) return;

    Interceptor.attach(address, {
        onEnter: function (args) {
            var pathPtr = name === 'openat' ? args[1] : args[0];
            var path = readCStringSafe(pathPtr, 240);
            if (!containsKeyword(path)) return;
            console.log('[*] ' + name + ' path=' + path);
        }
    });

    console.log('[*] hooked ' + name + ' @ ' + address);
});

function containsKeyword(path) {
    return PATH_KEYWORDS.some(function (keyword) { return path.indexOf(keyword) !== -1; });
}

function findGlobalExport(name) {
    if (typeof Module.findGlobalExportByName === 'function') return Module.findGlobalExportByName(name);
    return Module.findExportByName(null, name);
}

function readCStringSafe(ptrValue, maxLength) {
    try {
        if (ptrValue.isNull && ptrValue.isNull()) return '<null>';
        var text = ptrValue.readCString(maxLength || 256);
        return text.length > maxLength ? text.slice(0, maxLength) + '...<len=' + text.length + '>' : text;
    } catch (e) {
        return '<readCString failed>';
    }
}
```

경로만 남기고 파일 내용은 기본 출력하지 않는다. 저장소 진단에서는 파일 존재, 접근 시점, 호출자 범위를 먼저 잡는다.

## iOS Scripts

Objective-C bridge가 사용 가능한 프로세스에서만 실행한다. Swift 전용 앱이나 심볼 제거 빌드는 Native Scripts와 정적 분석 오프셋을 함께 사용한다.

### ObjC 클래스·selector 검색

**사용 목적:** iOS 앱에서 Objective-C runtime에 노출된 클래스와 selector 후보를 찾는다.  
**기대 결과:** 키워드와 일치하는 클래스명과 일부 selector가 출력된다.  
**다음 연계:** 후보 selector를 Objective-C 메서드 관찰 스크립트에 넣고 호출 여부를 확인한다.

```javascript
'use strict';

// 찾고 싶은 Objective-C 클래스명 또는 기능 키워드로 변경한다.
var KEYWORD = 'login';

if (typeof ObjC !== 'undefined' && ObjC.available) {
    Object.keys(ObjC.classes)
        .filter(function (name) { return name.toLowerCase().indexOf(KEYWORD.toLowerCase()) !== -1; })
        .slice(0, 100)
        .forEach(function (name) {
            console.log('\n[*] class=' + name);
            try {
                ObjC.classes[name].$ownMethods.slice(0, 30).forEach(function (selector) {
                    console.log('    ' + selector);
                });
            } catch (e) {
                console.log('    <method listing failed: ' + e + '>');
            }
        });
} else {
    console.log('[-] ObjC runtime is not available');
}
```

### Objective-C 메서드 관찰

**사용 목적:** 특정 Objective-C selector의 호출과 인자·반환값을 관찰한다.  
**기대 결과:** 메서드 호출 시 입력 요약과 반환값이 출력된다.  
**다음 연계:** 호출자가 필요하면 Native backtrace를 추가하고, Swift·C 함수로 이어지면 Native Scripts로 넘어간다.

```javascript
'use strict';

if (typeof ObjC !== 'undefined' && ObjC.available) {
    // 실제 Objective-C 클래스명과 selector로 변경한다.
    var CLASS_NAME = 'LoginManager';
    var SELECTOR = '- checkPassword:';
    var klass = ObjC.classes[CLASS_NAME];

    if (!klass || !klass[SELECTOR]) {
        console.log('[-] method not found: ' + CLASS_NAME + ' ' + SELECTOR);
    } else {
        Interceptor.attach(klass[SELECTOR].implementation, {
            onEnter: function (args) {
                // args[0]=self, args[1]=selector, args[2]부터 선언된 인자다.
                var input = new ObjC.Object(args[2]).toString();
                console.log('[*] ' + CLASS_NAME + ' ' + SELECTOR + ' inputLength=' + input.length);
            },
            onLeave: function (retval) {
                console.log('[*] retval=' + retval);
            }
        });

        console.log('[*] ObjC hook installed');
    }
}
```

`args[0]`은 `self`, `args[1]`은 selector, `args[2]`부터 선언된 인자다. 객체가 아닌 포인터를 `ObjC.Object`로 감싸면 실패할 수 있다.

### NSURLSession 관찰

**사용 목적:** iOS 기본 네트워크 API에서 요청 메타데이터를 관찰한다.  
**기대 결과:** HTTP method, query를 제거한 path, body 존재 여부가 출력된다.  
**다음 연계:** 프록시 로그와 대조하고, 다른 네트워크 라이브러리를 쓰면 해당 wrapper 또는 lower-level API를 찾는다.

```javascript
'use strict';

if (typeof ObjC !== 'undefined' && ObjC.available) {
    // 기본 NSURLSession 요청 생성 지점을 관찰한다. 다른 네트워크 라이브러리는 별도 hook이 필요하다.
    var NSURLSession = ObjC.classes.NSURLSession;
    var method = NSURLSession['- dataTaskWithRequest:completionHandler:'];

    Interceptor.attach(method.implementation, {
        onEnter: function (args) {
            var request = new ObjC.Object(args[2]);
            var url = request.URL() ? request.URL().absoluteString().toString() : '<null>';
            var httpMethod = request.HTTPMethod();
            var body = request.HTTPBody();

            console.log('[*] NSURLSession method=' + (httpMethod ? httpMethod.toString() : 'unknown'));
            console.log('[*] NSURLSession path=' + url.split('?')[0]);
            console.log('[*] NSURLSession bodyPresent=' + (body !== null));
        }
    });
}
```

쿼리 문자열, header, body 전체는 기본 출력하지 않는다. 프록시에서 보이지 않는 요청 지점을 찾는 용도로 먼저 쓴다.

### Keychain API 관찰

**사용 목적:** Keychain API 호출 시점과 반환 코드를 확인한다.  
**기대 결과:** `SecItemAdd`, `SecItemUpdate`, `SecItemCopyMatching`, `SecItemDelete` 호출과 반환값이 출력된다.  
**다음 연계:** 호출 시점을 찾은 뒤 query 속성, access group, protection class는 제한적으로 추가 확인한다.

```javascript
'use strict';

// iOS Keychain 함수가 들어 있는 Security framework를 찾는다.
var security = Process.findModuleByName('Security');
if (security === null) {
    console.log('[-] Security framework not loaded');
} else {
    ['SecItemAdd', 'SecItemUpdate', 'SecItemCopyMatching', 'SecItemDelete'].forEach(function (name) {
        var address = security.findExportByName(name);
        if (address === null) return;

        Interceptor.attach(address, {
            onEnter: function () {
                // 기본값은 호출 시점과 반환 코드만 남긴다. query 전체 출력은 별도 스크립트에서 제한적으로 한다.
                console.log('[*] ' + name + ' called');
            },
            onLeave: function (retval) {
                console.log('[*] ' + name + ' retval=' + retval.toInt32());
            }
        });
    });
}
```

Keychain query dictionary 전체 출력은 기본값으로 두지 않는다. 호출 시점과 반환 코드로 범위를 좁힌 뒤 필요한 속성만 제한적으로 확인한다.

## 로그 관리

관찰 스크립트는 필요한 값만 남긴다. 토큰, 비밀번호, 쿠키, 주민번호, 전체 요청·응답은 기본 출력하지 않는다.

| 값 | 기본 기록 | 필요 시 제한 기록 |
|---|---|---|
| 비밀번호·PIN | 길이, null 여부 | 테스트 계정의 고정 문자열 일부 |
| 토큰·쿠키 | 존재 여부, 길이, 앞뒤 3~4자 마스킹 | 프로젝트 증적 기준에 따른 해시 |
| 요청 본문 | bodyLength, content type | allowlist 필드만 |
| 파일 내용 | 경로, 접근 시점 | 민감정보 없는 테스트 파일 일부 |
| 암호화 입력·출력 | 알고리즘, mode, 길이 | 테스트 값의 hex 일부 |

콘솔과 파일을 동시에 남길 때는 `-o`를 사용한다.

```bash
frida -U -f com.target.app -l scripts/observe.js -o evidence/frida.log
```

로그를 산출물로 옮기기 전에 민감정보 포함 여부를 다시 확인한다.

## 참고자료

### 공식 문서

- [Frida CLI](https://frida.re/docs/frida-cli/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)
- [Frida Android](https://frida.re/docs/android/)
- [Frida iOS](https://frida.re/docs/ios/)
- [frida-ps](https://frida.re/docs/frida-ps/)
- [Frida Functions](https://frida.re/docs/functions/)

### 테스트 가이드·도구

- [OWASP MASTG - Method Hooking on iOS](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0095/)
- [OWASP MASTG - Tools](https://mas.owasp.org/MASTG/tools/)
- [Objection](https://github.com/sensepost/objection)
