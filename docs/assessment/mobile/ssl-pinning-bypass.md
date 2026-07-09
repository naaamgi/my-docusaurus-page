---
sidebar_position: 6
title: SSL Pinning 우회
description: 모바일 진단 - Android/iOS SSL Pinning 우회 (Frida 스크립트 / Objection / Smali 패치 / SSL Kill Switch) + 판정 기준
keywords: [SSL Pinning, Certificate Pinning, OkHttp, TrustManager, NSURLSession, TrustKit, Frida, Objection, Smali Patch, MASVS-NETWORK]
draft: false
---

# SSL Pinning 우회
> 앱이 자체적으로 인증서 / 공개키를 검증해 **Burp 의 시스템 CA 신뢰만으로는 HTTPS 캡처가 안 되는 상황** 을 우회.
> 점검 결과로서는 "Pinning 적용 여부 / 우회 가능 여부 / 우회 후 평문 노출 항목" 세 가지를 모두 보고.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-NETWORK-2 / MASTG-TEST-0024, 0036 |
| **CWE** | [CWE-295: Improper Certificate Validation](https://cwe.mitre.org/data/definitions/295.html) (역으로 — 우회 가능하면 Pinning 의 보호 효과가 무력화) |
| **영향도** | 🟡 (Pinning 자체는 방어책) — 우회 시 점검 대상 앱의 통신 평문 가시화 → 후속 점검 가능 |
| **점검 난이도** | 하 (Frida 표준 스크립트) ~ 상 (Native Pinning / 자체 구현 / TrustKit Strict) |
| **예상 점검 시간** | 30분 ~ 2시간 (앱당) |

---

## 점검 목적

SSL Pinning 은 **MITM 방어** 가 본질이지만, 점검자 입장에선 (1) 점검 대상 앱이 Pinning 을 적용했는지, (2) 어떤 방식으로 적용했는지, (3) 표준 우회 기법으로 우회 가능한지 확인. **우회 가능 = Pinning 의 보호 효과 부분 상실** 이지만, 진단 보고서에선 "Pinning 적용은 됐으나 우회 가능" 도 미흡으로 기록 (Bypass-resistant Pinning 권장).

> **다른 페이지와 영역 분리**
> - 환경 구축 (Burp CA 시스템 신뢰) → `setup-android.md`, `setup-ios.md`
> - Frida 기본 후킹 패턴 → `frida-scripts.md`
> - Root / 탈옥 탐지로 인한 앱 종료 → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
> - 정적 분석으로 Pinning 코드 위치 식별 → `static-analysis.md`

---

## 유형 구분

| 구현 방식 | 핵심 | 우회 난이도 |
| :--- | :--- | :--- |
| **OkHttp `CertificatePinner`** (Android) | OkHttp Builder 에 핀 등록 | 하 — Frida 표준 스크립트 |
| **`X509TrustManager` 자체 구현** (Android) | `checkServerTrusted` 에서 직접 검증 | 하 ~ 중 |
| **Network Security Config `<pin-set>`** (Android) | XML 정책 기반 | 하 — 매니페스트 패치 또는 Frida |
| **`NSURLSession` `urlSession:didReceiveChallenge:`** (iOS) | 챌린지 핸들러에서 비교 | 하 ~ 중 |
| **TrustKit** (iOS) | 인기 Pinning 라이브러리 | 중 — 전용 후킹 필요 |
| **AFNetworking SecurityPolicy** (iOS) | 라이브러리 정책 객체 | 중 |
| **Native Pinning** (Android/iOS) | C/C++/Rust + BoringSSL/OpenSSL 직접 | **상** — Native 후킹 / 패치 |

---

## 진단 절차

### Step 1. Pinning 적용 여부 확인

```
1) setup-android.md / setup-ios.md 의 시스템 CA 신뢰까지 정상 셋업
2) 점검 대상 앱 실행
3) Burp 의 Proxy History 확인:
   - HTTPS 트래픽이 정상 캡처됨    → Pinning 미적용 또는 비활성
   - 앱이 즉시 에러 / 통신 실패     → Pinning 가능성 높음
   - 일부 트래픽만 캡처됨           → 부분 Pinning (특정 도메인만)
```

### Step 2. 구현 위치 식별
`static-analysis.md` 의 jadx / Hopper / class-dump 로 다음 키워드 검색:

```
Android (Java):
  - "CertificatePinner"          → OkHttp 표준
  - "X509TrustManager"           → 자체 TrustManager
  - "checkServerTrusted"         → TrustManager 의 핵심 메서드
  - "pin-set", "pinning"         → Network Security Config
  - "TrustKit"                   → TrustKit Android (드물게 사용)

iOS (Objective-C / Swift):
  - "URLSession", "didReceiveChallenge"  → 표준 챌린지 핸들러
  - "SecTrustEvaluate"                    → 인증서 평가
  - "TrustKit", "TSKPinningValidator"     → TrustKit
  - "AFSecurityPolicy"                    → AFNetworking
  - "SSLPinning", "PinningMode"           → 다양한 라이브러리
```

### Step 3. 표준 우회 시도
(1) Objection 자동 → (2) Frida 표준 스크립트 → (3) 라이브러리 전용 스크립트 → (4) Smali 패치 / Native 후킹.

### Step 4. 우회 후 검증

- Burp 에서 평문 캡처 확인
- 평문에서 노출되는 정보 (인증 토큰 / 시크릿 / 개인정보 / 내부 API URL) 보고서 정리

---

## 페이로드 / 우회 케이스

### 케이스 1: Objection 자동 우회
**언제 쓰는지**: 점검 초기 / 표준 라이브러리 (OkHttp, TrustKit, AFNetworking) 사용 시.

```bash
# Android
objection -g com.target.app explore
> android sslpinning disable

# iOS
objection -g com.target.app explore
> ios sslpinning disable
```

**판정**: 명령 실행 후 Burp 에서 평문 캡처되면 표준 라이브러리 사용 → Pinning 우회 가능.

**한계**: 자체 구현 / Native Pinning / TrustKit Strict 모드는 자동 명령으로 우회 불가 → 케이스 2~5 로.

### 케이스 2: Frida 통합 스크립트
**언제 쓰는지**: 어떤 라이브러리를 쓰는지 모를 때 / 여러 라이브러리 혼용. 점검 표준 첫 시도.

```javascript
// android-pinning-bypass.js
// HTTPToolkit / Frida CodeShare 의 통합 스크립트 기반
Java.perform(function () {

    // 1) OkHttp v3 / v4 — CertificatePinner.check
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function () {
            console.log('[+] OkHttp CertificatePinner.check bypassed');
            return;
        };
    } catch (e) {}

    // 2) TrustManagerImpl (Conscrypt / 일반 X509)
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.verifyChain.implementation = function (untrustedChain) {
            console.log('[+] TrustManagerImpl.verifyChain bypassed');
            return untrustedChain;
        };
    } catch (e) {}

    // 3) 자체 X509TrustManager
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        var TrustManager = Java.registerClass({
            name: 'com.bypass.TrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function () {},
                checkServerTrusted: function () {},
                getAcceptedIssuers: function () { return []; }
            }
        });
        SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom'
        ).implementation = function (km, tm, sr) {
            console.log('[+] SSLContext.init replaced with custom TrustManager');
            this.init(km, [TrustManager.$new()], sr);
        };
    } catch (e) {}

});
```

**실행:**

```bash
frida -U -f com.target.app -l android-pinning-bypass.js --no-pause
```

**판정**: 콘솔에 `[+] ... bypassed` 메시지가 보이고 Burp 에서 평문 캡처되면 우회 성공. 메시지가 없으면 다른 구현 → 케이스 3 (정적 분석 후 자체 구현 후킹) 또는 케이스 4 (Smali 패치).

### 케이스 3: Frida 통합 스크립트
**언제 쓰는지**: iOS 표준 라이브러리 / TrustKit / AFNetworking 일괄 우회 시도.

```javascript
// ios-pinning-bypass.js (ssl-kill-switch 와 별개, iOS 17 호환)
if (ObjC.available) {
    var resolver = new ApiResolver('objc');

    // 1) NSURLSession 챌린지 핸들러 후킹
    try {
        var NSURLSessionDelegate = ObjC.protocols.NSURLSessionDelegate;
    } catch (e) {}

    // 2) SecTrustEvaluate / SecTrustEvaluateWithError 후킹 (iOS 12+)
    var SecTrustEvaluate = Module.findExportByName('Security', 'SecTrustEvaluate');
    if (SecTrustEvaluate) {
        Interceptor.replace(SecTrustEvaluate, new NativeCallback(function (trust, result) {
            console.log('[+] SecTrustEvaluate bypassed');
            Memory.writeU32(result, 1);  // kSecTrustResultProceed
            return 0;
        }, 'int', ['pointer', 'pointer']));
    }
    var SecTrustEvaluateWithError = Module.findExportByName('Security', 'SecTrustEvaluateWithError');
    if (SecTrustEvaluateWithError) {
        Interceptor.replace(SecTrustEvaluateWithError, new NativeCallback(function (trust, error) {
            console.log('[+] SecTrustEvaluateWithError bypassed');
            return 1;  // true
        }, 'bool', ['pointer', 'pointer']));
    }

    // 3) TrustKit 의 TSKPinningValidator
    try {
        var TSKPinningValidator = ObjC.classes.TSKPinningValidator;
        if (TSKPinningValidator) {
            Interceptor.attach(TSKPinningValidator['- evaluateTrust:forHostname:'].implementation, {
                onLeave: function (retval) {
                    console.log('[+] TSKPinningValidator bypassed');
                    retval.replace(0x1);  // TSKTrustEvaluationSuccess
                }
            });
        }
    } catch (e) {}

    // 4) AFNetworking AFSecurityPolicy
    try {
        var AFSecurityPolicy = ObjC.classes.AFSecurityPolicy;
        if (AFSecurityPolicy) {
            AFSecurityPolicy['- evaluateServerTrust:forDomain:'].implementation =
                ObjC.implement(AFSecurityPolicy['- evaluateServerTrust:forDomain:'], function () {
                    console.log('[+] AFSecurityPolicy bypassed');
                    return 1;
                });
        }
    } catch (e) {}
}
```

**실행:**

```bash
frida -U -f com.target.app -l ios-pinning-bypass.js --no-pause
```

**판정**: 케이스 2 와 동일 — 메시지 + Burp 평문 캡처.

⚠️ **iOS 17 노트**: 옛 SSL Kill Switch 2 는 iOS 17 의 BoringSSL / 코드사인 변경으로 부분 동작. **위 Frida 스크립트가 더 안정적**.

### 케이스 4: Smali 패치 (재패키징) — Frida 가 차단되는 경우

**언제 쓰는지**: 앱이 Frida 를 탐지해 즉시 종료 (`anti-debug-bypass.md` 우회도 안 먹는 경우) / 점검 단말 정책상 Frida 사용 불가.

```bash
# 1) APK 디컴파일
apktool d target.apk -o target-decoded

# 2) Network Security Config 변경
# target-decoded/AndroidManifest.xml 의 networkSecurityConfig 가
# 가리키는 XML 파일을 수정 — pin-set 제거, 디버그 신뢰 추가:

# target-decoded/res/xml/network_security_config.xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>           <!-- 사용자 CA 신뢰 -->
        </trust-anchors>
    </base-config>
</network-security-config>

# 3) 코드 내 CertificatePinner 호출 부분 Smali 직접 수정
#    
# 4) 재패키징 + 재서명
apktool b target-decoded -o target-patched.apk
uber-apk-signer -a target-patched.apk

# 5) 단말에 설치
adb uninstall com.target.app
adb install target-patched.apk-aligned-debugSigned.apk
```

**판정**: 재패키징 앱 실행 후 Burp 에서 평문 캡처되면 우회 성공. **단, 일부 앱은 재서명 탐지 (Signature 검증) 까지 적용** — 별도 패치 필요.

### 케이스 5: Native Pinning — `SSL_CTX_set_verify` 후킹

**언제 쓰는지**: 위 4가지가 모두 안 먹는 경우. 앱이 BoringSSL / OpenSSL 을 직접 호출해 Native 레벨에서 Pinning.

```javascript
// SSL_CTX_set_verify / SSL_set_custom_verify 후킹
var SSL_CTX_set_verify = Module.findExportByName(null, 'SSL_CTX_set_verify');
if (SSL_CTX_set_verify) {
    Interceptor.replace(SSL_CTX_set_verify, new NativeCallback(function (ctx, mode, cb) {
        console.log('[+] SSL_CTX_set_verify forced to NONE');
        // SSL_VERIFY_NONE = 0
        var orig = new NativeFunction(SSL_CTX_set_verify, 'void', ['pointer', 'int', 'pointer']);
        orig(ctx, 0, NULL);
    }, 'void', ['pointer', 'int', 'pointer']));
}
```

**판정**: Native 후킹은 라이브러리 / 컴파일 옵션에 따라 함수명이 달라짐 (`Module.enumerateExports` 로 후보 검색). 가장 까다로운 케이스 — 정적 분석 (`static-analysis.md`) 으로 정확한 진입점 식별 필수.

### 케이스 6: SSL Pinning 미적용
**판정**: setup 만 마친 상태에서 점검 대상 앱이 정상 통신 + Burp 에 평문 캡처 → Pinning 미적용. **이 경우는 보고서에 "MASVS-NETWORK-2 미적용 — Pinning 부재" 로 미흡 보고**. (단, 단순 Web 앱 / Hybrid 앱은 Pinning 필수가 아닐 수도 있음 — 회사 정책 / 위험도에 따라 판단)

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 미흡 / 취약:

- [ ] **SSL Pinning 미적용** — 시스템 CA 신뢰만으로 트래픽 캡처 가능 (단, 회사 정책 / 앱 성격에 따라 판정)
- [ ] **표준 Frida 스크립트로 우회 가능** — Bypass-resistant 하지 않음
- [ ] **Objection 한 줄로 우회 가능** — 기본 라이브러리 / 일반 패턴
- [ ] Pinning 은 적용됐으나 **일부 도메인 / 일부 통신만** (인증은 Pinning, 그 외 평문)
- [ ] Pinning 우회 후 **민감 정보 (토큰 / 개인정보 / 내부 API) 가 평문 노출**

**오탐 주의:**

- [ ] 시스템 CA 신뢰가 안 된 상태에서 캡처 실패한 것을 "Pinning 적용" 으로 오판 — `setup-*.md` Step 4 검증 필수
- [ ] 단말 시각 / 인증서 만료 문제로 인한 핸드셰이크 실패는 Pinning 무관
- [ ] Hybrid 앱 (Cordova / Capacitor) 의 WebView 통신은 별도 흐름

---

## 다른 페이지로 위임

- **환경 구축 (시스템 CA 신뢰)** → `setup-android.md`, `setup-ios.md`
- **Frida 기본 후킹 패턴** → `frida-scripts.md`
- **Frida 탐지로 인한 후킹 차단** → `anti-debug-bypass.md`
- **Root / 탈옥 탐지로 앱 종료** → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
- **Pinning 코드 위치 식별 (정적 분석)** → `static-analysis.md`
- **재패키징 시 서명 검증 추가 패치** → `static-analysis.md` + `anti-debug-bypass.md`

---

## 참고자료

- [OWASP MASTG - Testing Network Communication](https://mas.owasp.org/MASTG/0x04f-Testing-Network-Communication/)
- [OWASP MASTG-TEST-0024 - Testing Custom Certificate Stores and SSL Pinning (Android)](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0024/)
- [OWASP MASTG-TEST-0036 - Testing Custom Certificate Stores and SSL Pinning (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-NETWORK/MASTG-TEST-0036/)
- [Frida CodeShare - android-ssl-pinning-bypass](https://codeshare.frida.re/@pcipolloni/universal-android-ssl-pinning-bypass-with-frida/)
- [Frida CodeShare - ios-ssl-bypass](https://codeshare.frida.re/@machoreverser/ios-ssl-bypass/)
- [HTTPToolkit - frida-android-unpinning](https://github.com/httptoolkit/frida-android-unpinning)
- [Objection - SSL Pinning Bypass](https://github.com/sensepost/objection/wiki/Disabling-SSL-Pinning-for-Android)
- [TrustKit (iOS / Android Pinning library)](https://github.com/datatheorem/TrustKit)
- [Android Network Security Configuration](https://developer.android.com/training/articles/security-config)
- [HackTricks - SSL Pinning Bypass](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/spoofing-your-location-in-play-store)
