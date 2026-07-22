---
sidebar_position: 6
title: SSL Pinning 우회
description: 프록시 기준선에서 Certificate Pinning을 식별하고 Android와 iOS 구현별로 최소 범위에서 우회한 뒤 결과를 판단하는 실무 흐름
keywords: [SSL Pinning, Certificate Pinning, OkHttp, TrustManager, Network Security Config, NSURLSession, ATS, Frida, Objection, MASVS-NETWORK]
toc_max_heading_level: 3
draft: false
---

> 브라우저에서는 Burp 통신이 보이는데 앱의 HTTPS 요청만 실패할 때 사용한다. 목표는 무작정 인증서 검증을 전부 끄는 것이 아니라 **막히는 지점을 식별하고 필요한 호스트와 구현만 우회해 본 점검을 계속하는 것**이다.

## 점검 목적

Certificate Pinning은 시스템이 신뢰하는 CA만으로도 통신을 가로채기 어렵게 만드는 추가 통제다. 이 문서에서는 적용 여부와 구현 위치를 확인하고, 허가된 테스트 환경에서 우회해 API 점검 경로를 확보한다. **Frida나 탈옥 단말에서 우회됐다는 사실만으로 인증서 검증 취약점을 확정하지 않는다.** 앱이 일반 사용자 환경에서도 신뢰할 수 없는 인증서나 잘못된 호스트를 허용하는지는 [인증서 검증 및 평문 통신](certificate-validation.md)에서 별도로 판단한다.

## 유형 구분

| 구현 유형 | 정적 단서 | 첫 접근 |
| :--- | :--- | :--- |
| Android Network Security Config | `networkSecurityConfig`, `<pin-set>` | 설정 범위와 만료일 확인, 테스트 빌드의 `debug-overrides` |
| Android 라이브러리 | `CertificatePinner`, `checkServerTrusted` | 실제 클래스와 overload를 찾은 뒤 대상 메서드 후킹 |
| iOS ATS Pinning | `NSPinnedDomains`, `NSPinnedCAIdentities`, `NSPinnedLeafIdentities` | 적용 도메인과 URL Loading System 사용 여부 확인 |
| iOS Delegate·라이브러리 | `didReceiveChallenge`, `TrustKit`, `ServerTrustManager` | 앱의 delegate 또는 validator만 후킹 |
| Native·크로스 플랫폼 | BoringSSL, OpenSSL, Cronet, Flutter·Rust 모듈 | 모듈과 호출자를 먼저 찾고 함수별 후킹·패치 |

같은 앱에서도 로그인 API만 Pinning하고 분석·광고 SDK는 시스템 신뢰를 사용할 수 있다. 앱 전체가 아니라 **도메인과 네트워크 스택 단위**로 기록한다.

## 진단 절차

#### Step 1. 브라우저 기준선을 먼저 확인한다

[Android 환경 구축](setup-android.md) 또는 [iOS 환경 구축](setup-ios.md)의 프록시·CA 설정을 마친 뒤 같은 단말의 Chrome이나 Safari에서 테스트 HTTPS 페이지를 연다.

| 결과 | 현재 판단 | 다음 행동 |
| :--- | :--- | :--- |
| 브라우저와 앱 모두 Burp에 보임 | 환경 정상, 해당 흐름은 Pinning 미적용 가능 | 중요한 first-party 도메인과 다른 기능도 확인 |
| 브라우저는 보이고 앱만 인증서 오류 | 사용자 CA 미신뢰 또는 Pinning 후보 | 시스템 로그와 정적 분석으로 구분 |
| 앱은 정상인데 Burp에 아무것도 없음 | 프록시 미사용, QUIC·별도 프로토콜·다른 프로세스 후보 | 네트워크 스택과 실제 목적지 확인 |
| 서버가 클라이언트 인증서를 요구 | mTLS 가능성 | 제공된 테스트 인증서와 키 확인 |
| 일부 호스트만 실패 | 도메인별 Pinning 또는 서로 다른 스택 | 성공·실패 호스트를 분리 기록 |

Pinning을 끄기 전에 직접 연결 상태에서 기능이 정상인지 확인한다. 서버 장애나 단말 시각 오류를 Pinning으로 오해하지 않는다.

#### Step 2. 시스템 로그에서 실패 원인을 좁힌다

Android:

```bash
adb logcat | grep -iE 'pin|certificate|trust anchor|handshake|sslpeer'
```

Windows PowerShell:

```powershell
adb logcat | Select-String -Pattern 'pin|certificate|trust anchor|handshake|sslpeer'
```

iOS는 macOS Console 또는 허가된 단말 로그에서 `server trust`, `certificate`, `challenge`, `TLS` 관련 메시지를 확인한다. 로그에 인증서 오류가 없고 앱이 정상 동작한다면 프록시 경로 자체를 사용하지 않을 가능성도 검토한다.

#### Step 3. 정적 분석으로 구현과 도메인을 연결한다

Android 디컴파일 결과:

```bash
rg -n 'CertificatePinner|checkServerTrusted|verifyChain|networkSecurityConfig|<pin-set|Cronet' work
```

iOS 추출 결과:

```bash
rg -n 'NSPinnedDomains|didReceiveChallenge|SecTrustEvaluate|TrustKit|ServerTrustManager' work
```

[정적 분석](static-analysis.md)에서 문자열의 사용처와 호출자를 따라간다. 클래스 이름을 찾는 데서 끝내지 말고 실패한 호스트가 어느 네트워크 클라이언트를 사용하는지 연결한다.

#### Step 4. 가장 좁은 우회부터 선택한다

| 확인된 상황 | 우선 시도 | 이유 |
| :--- | :--- | :--- |
| 구현을 아직 모름 | Objection으로 짧은 smoke test | 표준 API 사용 여부를 빠르게 가늠 |
| OkHttp `CertificatePinner` 확인 | 해당 overload와 호스트만 Frida 후킹 | 다른 TLS 검증에 미치는 영향 축소 |
| 앱 전용 TrustManager 확인 | 해당 클래스만 Frida 후킹 | 전역 `SSLContext` 교체 방지 |
| NSC `<pin-set>` 확인 | 테스트 빌드의 `debug-overrides` 또는 제한된 패치 | 선언형 Pinning만 분리 확인 |
| iOS delegate 확인 | 해당 클래스와 호스트만 후킹 | Security.framework 전체 변조 방지 |
| Native·크로스 플랫폼 | 모듈·심볼·호출자 관찰 후 전용 후킹 | 범용 스크립트의 오탐과 충돌 방지 |

#### Step 5. 우회 성공을 기능과 트래픽으로 확인한다

- 우회 전에는 실패하고 우회 후에는 같은 기능이 정상 완료되는가
- Burp에 실패했던 **같은 호스트**의 요청과 응답이 나타나는가
- 끈 스크립트를 다시 적용하지 않으면 원래 실패 상태로 돌아가는가
- 출력된 후킹 로그와 실제 HTTP 요청 시간이 일치하는가
- 다른 호스트의 검증까지 불필요하게 비활성화되지 않았는가

증적에는 토큰과 개인정보 전체를 넣지 않는다. 호스트, 경로, 기능명, 응답 코드, 마스킹한 필드만 남긴다.

## 우회 노트

### 1. Objection 표준 API

구현을 아직 모를 때 한 번 시도한다. 설치된 버전에서 명령을 지원하는지 먼저 확인한다.

```bash
objection --version
objection --help
objection -g com.target.app explore
```

Android REPL:

```text
android sslpinning disable
```

iOS REPL:

```text
ios sslpinning disable
```

**확인할 것:** 성공 메시지가 아니라 실패했던 호스트의 요청이 Burp에 나타나는지 확인한다. 메시지는 출력되지만 트래픽이 여전히 실패하면 API가 후킹됐을 뿐 실제 네트워크 스택은 다른 구현일 수 있다.

### 2. Android · OkHttp

jadx에서 `okhttp3.CertificatePinner`와 `check(String, List)` 사용을 확인했을 때 사용한다. 앱과 OkHttp 버전에 따라 메서드명이나 overload가 달라질 수 있으므로 [Frida 후킹 실무](frida-scripts.md)의 열거 패턴으로 실제 시그니처를 먼저 확인한다.

```javascript
// android-okhttp-pin.js
var TARGET_HOST = "api.example.test";

Java.perform(function () {
    var CertificatePinner = Java.use("okhttp3.CertificatePinner");
    var check = CertificatePinner.check.overload(
        "java.lang.String",
        "java.util.List"
    );

    check.implementation = function (hostname, peerCertificates) {
        console.log("[*] CertificatePinner.check host=" + hostname);

        if (hostname === TARGET_HOST) {
            console.log("[+] bypass target host=" + hostname);
            return;
        }

        return check.call(this, hostname, peerCertificates);
    };
});
```

```bash
frida -U -f com.target.app -l android-okhttp-pin.js
```

**확인할 것:** 대상 호스트에서만 `[+]` 로그가 나타나고, 다른 호스트는 원본 검증을 계속 수행해야 한다. `check`가 없고 `check$okhttp` 같은 이름만 보이면 현재 라이브러리의 실제 메서드를 다시 열거한다.

### 3. Android · 전용 TrustManager

정적 분석에서 앱 패키지 아래의 `PinnedTrustManager` 같은 구현 클래스를 찾았을 때 사용한다. 아래 클래스명은 실제 이름으로 교체한다.

```javascript
// android-custom-trust.js
Java.perform(function () {
    var TargetTrustManager = Java.use("com.target.app.network.PinnedTrustManager");
    var checkServerTrusted = TargetTrustManager.checkServerTrusted.overload(
        "[Ljava.security.cert.X509Certificate;",
        "java.lang.String"
    );

    checkServerTrusted.implementation = function (chain, authType) {
        console.log("[+] app TrustManager bypass authType=" + authType + " chainLength=" + chain.length);
        return;
    };
});
```

```bash
frida -U -f com.target.app -l android-custom-trust.js
```

이 패턴은 해당 클래스의 모든 호출에 영향을 준다. 클래스가 여러 호스트에서 공용으로 사용된다면 호출자를 더 좁히거나 테스트 빌드 방식을 우선한다. `SSLContext.init`을 전역 교체하는 예시는 다른 라이브러리와 mTLS까지 바꿀 수 있어 기본값으로 사용하지 않는다.

### 4. Android · NSC

소스 또는 진단용 빌드를 받을 수 있다면 `debug-overrides`에 사용자 CA를 추가한다. 이 설정은 `android:debuggable="true"`인 빌드에서만 동작하며 배포 설정과 분리할 수 있다.

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" overridePins="true" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>
```

`overridePins="true"`는 해당 CA로 서명된 체인에 NSC Pinning을 적용하지 않게 한다. 평문 HTTP 허용과는 관계가 없으므로 Pinning 우회를 위해 `cleartextTrafficPermitted="true"`를 추가하지 않는다.

바이너리만 있는 경우에는 apktool로 실제 NSC를 확인하고, 분석 복사본에서 대상 `<pin-set>` 제거와 사용자 CA 신뢰를 함께 적용할 수 있다. 이 경우 재서명과 재설치가 필요하며 원본 앱 데이터가 삭제될 수 있다. 수정·재서명 탐지가 발생하면 [앱 위변조 / 재패키징 점검](app-tampering.md)으로 분리한다.

### 5. iOS · `URLSessionDelegate`

[정적 분석](static-analysis.md) 또는 [Frida 후킹 실무](frida-scripts.md)에서 실제 delegate 클래스와 selector를 확인한 뒤 사용한다. 아래 클래스와 호스트는 대상 값으로 바꾼다.

```javascript
// ios-urlsession-pin.js
var TARGET_CLASS = "TargetSessionDelegate";
var TARGET_HOST = "api.example.test";
var pendingBlocks = new Set();

if (typeof ObjC === "undefined" || !ObjC.available) {
    throw new Error("Objective-C runtime is not available");
}

var targetClass = ObjC.classes[TARGET_CLASS];
var method = targetClass["- URLSession:didReceiveChallenge:completionHandler:"];

Interceptor.attach(method.implementation, {
    onEnter: function (args) {
        var challenge = new ObjC.Object(args[3]);
        var protectionSpace = challenge.protectionSpace();
        var host = protectionSpace.host().toString();

        console.log("[*] server trust challenge host=" + host);
        if (host !== TARGET_HOST) {
            return;
        }

        var completion = new ObjC.Block(args[4]);
        var original = completion.implementation;
        pendingBlocks.add(completion);

        completion.implementation = function (disposition, credential) {
            var serverTrust = protectionSpace.serverTrust();
            if (serverTrust === null) {
                pendingBlocks.delete(completion);
                return original(disposition, credential);
            }

            var trustedCredential = ObjC.classes.NSURLCredential
                .credentialForTrust_(serverTrust);

            console.log("[+] use test credential host=" + host);
            var result = original(0, trustedCredential);
            pendingBlocks.delete(completion);
            return result;
        };
    }
});
```

```bash
frida -U -f com.target.app -l ios-urlsession-pin.js
```

`0`은 `NSURLSessionAuthChallengeUseCredential`이다. 대상 호스트가 아닌 challenge는 원래 delegate 처리를 그대로 통과한다. 클래스가 없거나 selector가 호출되지 않으면 ATS Pinning, TrustKit·Alamofire, Network.framework 또는 네이티브 TLS 스택을 다시 확인한다.

iOS의 `NSPinnedDomains`가 확인된 테스트 빌드는 해당 도메인의 `NSPinnedCAIdentities`·`NSPinnedLeafIdentities`를 진단 구성에서 분리하는 방식이 가장 명확하다. 배포 IPA를 수정하면 코드 서명과 프로비저닝 조건이 바뀌므로 원본과 동일한 환경이라고 간주하지 않는다.

### 6. 재패키징

Frida를 사용할 수 없고 진단용 빌드도 제공받지 못했을 때 분석 복사본을 수정한다.

```bash
apktool d target.apk -o target-decoded
apktool b target-decoded -o target-patched.apk
uber-apk-signer -a target-patched.apk
```

NSC 방식이면 실제 `network_security_config.xml`에서 대상 `<pin-set>`을 제거하고 사용자 CA를 신뢰하도록 수정한다. 코드 기반 Pinning이면 jadx에서 확인한 분기와 Smali를 대조해 해당 검증만 변경한다. 원본과 수정본의 SHA-256과 변경 위치를 남긴다.

기존 앱과 서명이 다르면 덮어쓰기 설치가 되지 않는다. 삭제 후 설치하면 앱 데이터가 사라지므로 별도 테스트 프로필이나 초기화 가능한 단말에서 진행한다. 앱이 실행되지 않으면 네트워크 문제보다 서명·무결성 탐지를 먼저 확인한다.

### 7. Native·크로스 플랫폼

전역 `SSL_CTX_set_verify`를 바로 교체하지 않는다. 앱에 포함된 BoringSSL·OpenSSL이 심볼을 숨기거나 이름을 바꿀 수 있고, 같은 프로세스의 다른 통신까지 영향을 줄 수 있다.

```javascript
Process.enumerateModules()
    .filter(function (module) {
        return /ssl|crypto|cronet|flutter|boring/i.test(module.name);
    })
    .forEach(function (module) {
        console.log(module.name + " base=" + module.base + " size=" + module.size);
    });
```

후보 모듈을 정한 뒤 export와 symbol을 좁혀 본다.

```javascript
var targetModule = Process.getModuleByName("libtarget.so");

targetModule.enumerateExports()
    .filter(function (item) {
        return /verify|cert|trust|pin/i.test(item.name);
    })
    .slice(0, 50)
    .forEach(function (item) {
        console.log(item.type + " " + item.name + " @ " + item.address);
    });
```

내보낸 이름이 없으면 [IDA Pro 네이티브 분석](ida-pro-analysis.md)에서 동일 빌드의 호출 흐름과 모듈 기준 오프셋을 찾는다. 먼저 `Interceptor.attach`로 호출 여부와 반환값을 관찰하고, 실제 Pinning 판정 함수임을 확인한 다음 최소 변경한다.

### 8. 범용 스크립트 검토

HTTP Toolkit, Frida CodeShare 같은 통합 스크립트는 빠른 참고가 되지만 여러 Trust API를 동시에 바꿀 수 있다. 실행 전에 다음을 확인한다.

- 현재 Frida와 Android·iOS 버전에서 사용하는 API인지
- 어떤 클래스와 네이티브 함수를 replace하는지
- 모든 호스트를 우회하는지 대상 호스트만 우회하는지
- 요청 본문이나 인증서를 외부로 전송하는 코드가 없는지
- 우회 전후를 구분할 로그가 있는지

원본 URL과 확인한 commit 또는 파일 해시를 작업 노트에 남긴다.

---

## 우회 매트릭스

| 관찰 증상 | 가능한 원인 | 다음 확인 |
| :--- | :--- | :--- |
| 브라우저와 앱이 모두 실패 | 프록시·CA 설치 문제 | 환경 구축 문서의 브라우저 기준선 재확인 |
| 브라우저만 성공하고 앱은 `Trust anchor` 오류 | Android 앱이 사용자 CA를 신뢰하지 않음 | NSC와 target SDK, 테스트 빌드 구성 확인 |
| `pin verification failed`가 명확함 | NSC·OkHttp 등 Pinning | 도메인과 구현을 연결해 대상 후킹 |
| Objection 로그는 나오지만 통신은 실패 | 자체 구현, 다른 overload, Native 스택 | 정적 분석과 클래스·모듈 열거 |
| 앱은 정상인데 Burp에 요청이 없음 | 프록시 우회, QUIC, 별도 프로토콜·프로세스 | 실제 소켓·모듈·목적지 확인 |
| 일부 도메인만 보임 | 도메인별 Pinning 또는 여러 클라이언트 | first-party 호스트별 결과표 작성 |
| TLS 단계에서 클라이언트 인증서를 요구 | mTLS | 고객사 테스트 인증서와 키 확보 |
| Frida attach·spawn 후 앱 종료 | Frida·탈옥·루팅 탐지 | 보호·우회 문서에서 별도 확인 |
| 재패키징 앱만 실행되지 않음 | 서명·무결성 검증 | 위변조 점검으로 분리 |

## 결과 판정 기준

| 판정 | 필요한 근거 |
| :--- | :--- |
| **Pinning 적용 확정** | 직접 연결은 정상이고 신뢰된 Burp CA 연결은 거부되며, 로그·정적 위치 또는 대상 우회 결과가 같은 호스트에서 일치 |
| **Pinning 미적용 확정** | 개발자 통제하의 중요 first-party 호스트가 신뢰된 Burp CA를 통해 캡처되고 다른 Pinning 구현도 확인되지 않음 |
| **부분 적용** | 같은 앱의 중요 first-party 호스트 중 일부만 Pinning하며 적용 정책과 실제 트래픽 범위가 불일치 |
| **후보·보류** | 브라우저 기준선 실패, 서버 장애, 사용자 CA 미신뢰, mTLS, 프록시 우회 가능성을 분리하지 못함 |
| **우회 성공** | 특정 후킹이나 패치 적용 전후가 재현되고 실패했던 동일 호스트의 기능과 트래픽이 정상화됨 |

MASVS-NETWORK-2 또는 고객사 L2 기준에서 중요한 first-party endpoint에 Pinning이 없으면 통제 미적용으로 판단할 수 있다. 광고·분석 SDK처럼 개발자가 통제하지 않는 제3자 도메인은 이름만 보고 동일하게 판정하지 않는다.

다음 항목은 Pinning 부재와 별개의 인증서 검증 문제다.

- 계측이나 패치 없이 신뢰할 수 없는 자체 서명 인증서를 허용함
- 호스트 이름이 다른 인증서를 허용함
- 배포 코드에 trust-all `TrustManager`나 무조건 성공하는 delegate가 있음
- 민감 기능이 평문 HTTP로 전송됨

이 경우에는 [인증서 검증 및 평문 통신](certificate-validation.md)에서 취약 여부를 확정한다. 반대로 Frida·Objection·재서명 앱에서 Pinning을 우회했다는 사실만으로 CWE-295를 부여하지 않는다.

Pinning 구현 품질도 함께 본다.

- Android NSC pin의 만료일이 지났거나 곧 만료되는가
- 인증서·CA 교체를 위한 backup pin이 있는가
- iOS ATS의 CA·leaf identity가 실제 first-party 도메인과 일치하는가
- 앱 업데이트 없이 인증서 교체가 필요한 상황에서 복구 경로가 있는가

## 증적 항목

- 앱 버전과 APK·IPA SHA-256
- 단말·운영체제, Frida·Objection 버전
- 직접 연결, 프록시 연결, 우회 후 연결의 결과
- 성공·실패 호스트와 기능명
- 확인한 클래스·selector·모듈과 적용한 스크립트
- 마스킹한 경로와 응답 코드

## 빠른 명령어 참조

```bash
# 연결과 대상 확인
frida-ps -Uai

# Android 로그
adb logcat | grep -iE 'pin|certificate|trust anchor|handshake|sslpeer'

# 대상별 Frida 스크립트
frida -U -f com.target.app -l android-okhttp-pin.js
frida -U -f com.target.app -l ios-urlsession-pin.js

# 재패키징이 필요한 경우
apktool d target.apk -o target-decoded
apktool b target-decoded -o target-patched.apk
```

## 관련 문서

- [Android 환경 구축](setup-android.md)
- [iOS 환경 구축](setup-ios.md)
- [정적 분석](static-analysis.md)
- [Frida 후킹 실무](frida-scripts.md)
- [루팅 탐지 우회](root-detection-bypass.md)
- [탈옥 탐지 우회](jailbreak-detection-bypass.md)
- [디버거·Frida 탐지 우회](anti-debug-bypass.md)
- [앱 위변조 / 재패키징 점검](app-tampering.md)
- [인증서 검증 및 평문 통신](certificate-validation.md)

## 참고자료

### 공식 및 테스트 가이드

- [OWASP MASVS-NETWORK](https://mas.owasp.org/checklists/MASVS-NETWORK/)
- [OWASP MASTG-TEST-0242 - Missing Certificate Pinning in Network Security Configuration](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0242/)
- [OWASP MASTG-TEST-0243 - Expired Certificate Pins in the Network Security Configuration](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0243/)
- [OWASP MASTG-TEST-0244 - Missing Certificate Pinning in Network Traffic](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0244/)
- [OWASP MASTG-TEST-0385 - Missing Certificate Pinning in ATS](https://mas.owasp.org/MASTG/tests/ios/MASVS-NETWORK/MASTG-TEST-0385/)
- [OWASP MASTG - Bypassing Certificate Pinning on Android](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0012/)
- [OWASP MASTG - Bypassing Certificate Pinning on iOS](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0064/)
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Apple - NSPinnedDomains](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nspinneddomains)
- [OkHttp - CertificatePinner](https://square.github.io/okhttp/4.x/okhttp/okhttp3/-certificate-pinner/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)

### 도구 및 커뮤니티 참고자료

- [Objection](https://github.com/sensepost/objection)
- [HTTP Toolkit - Frida Android Unpinning](https://github.com/httptoolkit/frida-android-unpinning)
- [Frida CodeShare](https://codeshare.frida.re/)
- [TrustKit](https://github.com/datatheorem/TrustKit)
