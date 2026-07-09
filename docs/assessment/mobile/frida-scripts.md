---
sidebar_position: 4
title: Frida 후킹 스크립트 모음
description: 모바일 진단 - 자주 쓰는 Frida 후킹 패턴 (Java.use / Java.choose / ObjC.classes / Interceptor.attach) 및 클래스/메서드 enumeration
keywords: [Frida, Java.use, Java.choose, Java.perform, ObjC.classes, Interceptor, hook, Android, iOS, MASVS, MASTG]
draft: false
---

# Frida 후킹 스크립트 모음
> 다른 모바일 페이지에서 반복적으로 등장하는 **Frida 기본 후킹 패턴 + 자주 쓰는 스크립트** 모음.
> 페이지별로 동일 코드를 반복하지 않기 위해 이 페이지에 정리하고, 다른 페이지에선 "이 페이지의 패턴 N 참조" 식으로 인용.

## 점검 환경 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | 점검 도구 (모든 MASVS 카테고리에서 활용) |
| **대상 OS** | Android 14 / iOS 17 표준 |
| **사전 조건** | `setup-android.md` / `setup-ios.md` 환경 구축 완료 |
| **Frida 버전** | 16.x 기준 (2025~2026) |

---

## 사용 목적

Frida 는 모바일 점검의 사실상 표준 동적 계측 도구. 이 페이지의 스크립트는 **"왜 이 함수를 후킹하는지 + 후킹 결과로 무엇을 봐야 하는지"** 를 같이 적어, 단순 명령 모음이 아닌 점검 흐름의 일부로 활용 가능하도록 정리.

> **다른 페이지와 영역 분리**
> - SSL Pinning 우회 전용 스크립트 → `ssl-pinning-bypass.md`
> - Root 탐지 우회 전용 스크립트 → `root-detection-bypass.md`
> - 탈옥 탐지 우회 전용 스크립트 → `jailbreak-detection-bypass.md`
> - 디버그 / Frida 탐지 우회 → `anti-debug-bypass.md`
>
> 이 페이지는 **공용 패턴 + 점검 보조 스크립트** 만 다룬다.

---

## Frida 실행 패턴

### 패턴 A — `-l` 옵션으로 스크립트 주입
```bash
# 앱이 이미 실행 중일 때 attach
frida -U -l hook.js com.target.app

# 앱 실행 시점부터 후킹 (spawn) — 초기화 코드 후킹에 필수
frida -U -f com.target.app -l hook.js --no-pause

# 출력만 확인하고 자동 종료
frida -U -f com.target.app -l hook.js --no-pause -o output.log
```

**언제 spawn 모드를 쓰는지**: SSL Pinning / Root 탐지 / 자격증명 초기화 같은 **앱 시작 직후 1회만 호출되는 코드** 후킹 시. attach 모드는 너무 늦어 후킹 누락.

### 패턴 B — Objection
```bash
pip3 install objection

# 앱에 attach
objection -g com.target.app explore

# REPL 내부에서:
android sslpinning disable                 # SSL Pinning 우회 (대표 패턴 자동 적용)
android root disable                       # Root 탐지 우회 (대표 패턴)
android hooking list classes               # 모든 클래스 enumeration
android hooking search classes <KEYWORD>   # 클래스명 검색
android hooking watch class <CLASS>        # 클래스의 모든 메서드 호출 추적
ios sslpinning disable                     # iOS SSL Pinning 우회
ios jailbreak disable                      # iOS 탈옥 탐지 우회
```

**언제 Objection 을 쓰는지**: 점검 초기 / 신속한 탐색. 대표 우회 패턴이 자동 적용되므로 빠른 PoC 에 유용. 정밀 점검 (특정 메서드 후킹 / 인자 조작) 은 직접 Frida 스크립트 작성.

---

## Android 후킹 패턴

### 패턴 1 — `Java.perform` 기본 골격 + 메서드 후킹

```javascript
Java.perform(function () {
    var TargetClass = Java.use("com.target.app.LoginManager");

    // 메서드 후킹 — 인자 / 반환 값 조작
    TargetClass.checkPassword.implementation = function (password) {
        console.log("[+] checkPassword called with: " + password);

        // 원본 호출
        var result = this.checkPassword(password);
        console.log("[+] original returned: " + result);

        // 항상 true 반환 (인증 우회)
        return true;
    };
});
```

**왜 이 패턴인지**: `Java.perform` 은 Frida 가 ART (Android Runtime) 에 진입할 수 있는 컨텍스트를 만든다. 모든 Java 후킹은 이 안에서. `Java.use` 는 클래스 핸들을 가져오는 표준 방법.

**판정**: 콘솔에 `[+] checkPassword called with: ...` 로그가 찍히면 후킹 성공. 원본 반환값과 강제 반환값이 다르게 나오는지 확인.

### 패턴 2 — 오버로드된 메서드 후킹
```javascript
Java.perform(function () {
    var TargetClass = Java.use("com.target.app.Validator");

    // 동일 이름 + 다른 시그니처 메서드가 있을 때
    TargetClass.validate.overload('java.lang.String').implementation = function (input) {
        console.log("[+] validate(String) called: " + input);
        return this.validate(input);
    };

    TargetClass.validate.overload('java.lang.String', 'int').implementation = function (input, level) {
        console.log("[+] validate(String, int) called: " + input + ", " + level);
        return this.validate(input, level);
    };
});
```

**언제 쓰는지**: `validate(String)`, `validate(String, int)` 처럼 같은 이름이 여러 시그니처일 때. `overload` 명시 없이 후킹하면 Frida 가 어느 걸 후킹할지 몰라 에러.

### 패턴 3 — `Java.choose` 로 살아있는 인스턴스 검색 + 필드 접근

```javascript
Java.perform(function () {
    Java.choose("com.target.app.SessionManager", {
        onMatch: function (instance) {
            console.log("[+] live instance found");
            console.log("    user_id: " + instance.userId.value);
            console.log("    token:   " + instance.authToken.value);

            // 필드 변조도 가능
            instance.userId.value = 999;
        },
        onComplete: function () { console.log("[+] choose done"); }
    });
});
```

**왜 쓰는지**: `Java.use` 는 클래스 자체 (정적 멤버 / 새 인스턴스 생성) 만 다룰 수 있다. **이미 메모리에 존재하는 인스턴스의 필드** (예: 세션 토큰, 로그인 사용자 정보) 를 보거나 변조하려면 `Java.choose`.

### 패턴 4 — 메서드 인자 / 반환값 출력
```javascript
Java.perform(function () {
    var Target = Java.use("com.target.app.ApiClient");

    Target.sendRequest.implementation = function (url, body) {
        console.log("--- sendRequest ---");
        console.log("URL:  " + url);
        console.log("Body: " + body);

        var response = this.sendRequest(url, body);
        console.log("Resp: " + response);
        console.log("---");
        return response;
    };
});
```

**언제 쓰는지**: 앱이 어떤 API 를 호출하는지 / 어떤 인자를 넣는지 모르는 상태에서 행동 관찰. Burp 만으로는 본문이 암호화되어 안 보이는 경우, 함수 호출 시점의 평문을 출력.

### 패턴 5 — 클래스 / 메서드 enumeration
```javascript
Java.perform(function () {
    // 모든 로드된 클래스 중 키워드 매칭
    Java.enumerateLoadedClasses({
        onMatch: function (className) {
            if (className.toLowerCase().indexOf("crypto") !== -1) {
                console.log(className);
            }
        },
        onComplete: function () {}
    });
});

// 특정 클래스의 모든 메서드 출력
Java.perform(function () {
    var T = Java.use("com.target.app.Vault");
    var methods = T.class.getDeclaredMethods();
    methods.forEach(function (m) { console.log(m.toString()); });
});
```

**언제 쓰는지**: 후킹할 메서드명을 모를 때. `crypto` / `auth` / `pin` / `validate` 같은 키워드로 후보 클래스 추리고, 그 안의 메서드 시그니처를 본 뒤 패턴 1~3 으로 후킹.

### 패턴 6 — Stack Trace 출력
```javascript
Java.perform(function () {
    var Log = Java.use("android.util.Log");
    var Exception = Java.use("java.lang.Exception");

    var Target = Java.use("com.target.app.SecretApi");
    Target.getSecret.implementation = function () {
        console.log("[+] getSecret called from:");
        console.log(Log.getStackTraceString(Exception.$new()));
        return this.getSecret();
    };
});
```

**언제 쓰는지**: 어떤 메서드가 어디서 호출되는지 모를 때. 호출 경로를 보면 사용자 액션 (클릭) → 비즈니스 로직 → 보안 검증 흐름이 한눈에 들어옴.

---

## iOS 후킹 패턴

### 패턴 1 — `ObjC.classes` 기본 골격 + 메서드 후킹

```javascript
if (ObjC.available) {
    var Target = ObjC.classes.LoginManager;

    Interceptor.attach(Target['- checkPassword:'].implementation, {
        onEnter: function (args) {
            // args[0] = self, args[1] = SEL, args[2] = 첫 번째 NSString 인자
            var password = ObjC.Object(args[2]).toString();
            console.log("[+] checkPassword: " + password);
        },
        onLeave: function (retval) {
            console.log("[+] returned: " + retval);
            // 반환값 강제 변조 (Boolean true)
            retval.replace(0x1);
        }
    });
}
```

**왜 이 패턴인지**: Objective-C 메서드는 C 함수 호출 형식 (`objc_msgSend`) 로 변환된다. `Interceptor.attach` 로 메서드 진입 / 종료 시점을 가로채고, `onLeave` 의 `retval.replace()` 로 반환값을 변조.

### 패턴 2 — Swift 클래스 후킹
```javascript
// Swift 는 메서드명이 mangling 됨 — 원본명으로는 못 찾음
// 1) 모든 클래스 출력 후 검색
for (var cls in ObjC.classes) {
    if (cls.indexOf("TargetApp") !== -1) console.log(cls);
}

// 2) 모듈의 모든 export 출력
Module.enumerateExports("TargetApp").forEach(function (exp) {
    if (exp.name.indexOf("Login") !== -1) console.log(exp.name + " @ " + exp.address);
});

// 3) 주소로 직접 후킹
Interceptor.attach(ptr("0x1001234ab"), {
    onEnter: function (args) { console.log("called"); }
});
```

**언제 쓰는지**: Swift 로 작성된 앱. `ObjC.classes` 는 Swift 클래스도 일부 노출하지만, mangling 된 메서드명을 알아야 후킹 가능 → `Module.enumerateExports` 로 후보 검색.

### 패턴 3 — NSURLSession 콜백 / 응답 출력
```javascript
if (ObjC.available) {
    var NSURLSession = ObjC.classes.NSURLSession;
    Interceptor.attach(NSURLSession['- dataTaskWithRequest:completionHandler:'].implementation, {
        onEnter: function (args) {
            var request = ObjC.Object(args[2]);
            console.log("URL: " + request.URL().absoluteString());
            console.log("Method: " + request.HTTPMethod());
            var body = request.HTTPBody();
            if (body) console.log("Body: " + ObjC.Object(body).bytes().readUtf8String(body.length()));
        }
    });
}
```

**언제 쓰는지**: iOS 앱의 HTTP 요청을 함수 호출 시점에 가시화. 본문이 암호화되어 Burp 에서 안 보일 때 평문 추출.

### 패턴 4 — Keychain 접근 가시화

```javascript
if (ObjC.available) {
    var SecItemAdd  = new NativeFunction(Module.findExportByName("Security", "SecItemAdd"),  "int", ["pointer", "pointer"]);
    var SecItemCopy = new NativeFunction(Module.findExportByName("Security", "SecItemCopyMatching"), "int", ["pointer", "pointer"]);

    Interceptor.attach(Module.findExportByName("Security", "SecItemAdd"), {
        onEnter: function (args) {
            console.log("[+] SecItemAdd query:");
            console.log(ObjC.Object(args[0]).toString());
        }
    });

    Interceptor.attach(Module.findExportByName("Security", "SecItemCopyMatching"), {
        onEnter: function (args) {
            console.log("[+] SecItemCopyMatching query:");
            console.log(ObjC.Object(args[0]).toString());
        }
    });
}
```

**왜 후킹하는지**: 앱이 Keychain 에 어떤 항목을 저장 / 조회하는지 가시화. 토큰 / 시크릿이 평문으로 저장되는지, Access Control (Biometric / Passcode) 이 적용됐는지 확인. 자세한 점검은 `data-storage-ios.md`.

### 패턴 5 — 클래스 / 메서드 enumeration

```javascript
// 모든 로드된 클래스 출력
console.log(JSON.stringify(Object.keys(ObjC.classes)));

// 키워드 매칭 클래스
for (var cls in ObjC.classes) {
    if (cls.toLowerCase().indexOf("auth") !== -1) console.log(cls);
}

// 특정 클래스의 모든 메서드 출력
ObjC.classes.LoginManager.$ownMethods.forEach(function (m) { console.log(m); });
// 결과: '- checkPassword:', '- generateToken', ...
```

**언제 쓰는지**: 후킹할 메서드명을 모를 때. iOS 점검 첫 정찰 단계.

---

## 공용 정찰 스크립트

### 1. 모든 메서드 호출 추적
```bash
# Objection 으로 빠르게
objection -g com.target.app explore
> android hooking watch class 'com.target.app.LoginManager'
> ios hooking watch class 'LoginManager'
```

→ 해당 클래스의 모든 메서드 호출이 인자 / 반환값과 함께 출력됨. 점검 초기에 앱 동작 파악용.

### 2. 후킹 라이브 리로드
```bash
# Frida 의 -l 옵션은 파일 변경 감지 + 자동 재주입 지원
frida -U -f com.target.app -l hook.js --no-pause
# hook.js 를 에디터에서 저장하면 자동 재주입
```

### 3. 콘솔 출력 색상
```javascript
console.log("\x1b[32m[+] success\x1b[0m");
console.log("\x1b[31m[!] fail\x1b[0m");
console.log("\x1b[33m[*] info\x1b[0m");
```

---

## 다른 페이지와 결합

| 후킹 대상 | 사용 패턴 | 상세 페이지 |
| :--- | :--- | :--- |
| `OkHttpClient` / `TrustManager` (SSL Pinning) | Android 패턴 1, 2 | `ssl-pinning-bypass.md` |
| `NSURLSession` Pinning Validator | iOS 패턴 1, 2 | `ssl-pinning-bypass.md` |
| `RootBeer.isRooted` 등 | Android 패턴 1 | `root-detection-bypass.md` |
| `NSFileManager fileExistsAtPath:` | iOS 패턴 1 | `jailbreak-detection-bypass.md` |
| `Debug.isDebuggerConnected` / `ptrace` | Android 패턴 1 / Native | `anti-debug-bypass.md` |
| `SecItemAdd` / `SecItemCopyMatching` | iOS 패턴 4 | `data-storage-ios.md` |

---

## 트러블슈팅

### `Java.perform is not defined` / `ObjC is not available`

→ 대상 앱이 Native (C/C++) only 거나 Flutter / React Native 같은 비정통 런타임. `Process.enumerateModules()` 로 로드된 모듈 확인 후 `Module.enumerateExports` / `Interceptor.attach` 로 Native 후킹.

### `Failed to spawn: unable to access process with pid`

→ Frida 탐지 가능성 — `anti-debug-bypass.md` 참조. 또는 `frida-server` 가 root 로 실행 안 됨 (Android: `su -c '/data/local/tmp/frida-server &'`, iOS: `launchctl load ...`).

### 후킹은 됐는데 호출이 안 잡힘

→ (1) 클래스명 / 메서드명이 변경됐을 가능성 (난독화 — ProGuard / DexGuard / Bitcode), (2) attach 시점이 너무 늦음 → spawn 모드 (`-f`) 로 전환, (3) 실제로 그 코드 경로가 호출되지 않음.

### 난독화된 클래스명
→ 정적 분석 (`static-analysis.md`) 의 jadx / Hopper 로 원본 매핑 확인 후 후킹.

---

## 참고자료

- [Frida 공식 문서](https://frida.re/docs/home/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)
- [Frida CodeShare](https://codeshare.frida.re/)
- [Objection (Frida 래퍼)](https://github.com/sensepost/objection)
- [HackTricks - Frida Tutorial](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/frida-tutorial)
- [OWASP MASTG - Tampering and Reverse Engineering on Android](https://mas.owasp.org/MASTG/0x05c-Reverse-Engineering-and-Tampering/)
- [OWASP MASTG - Tampering and Reverse Engineering on iOS](https://mas.owasp.org/MASTG/0x06c-Reverse-Engineering-and-Tampering/)
