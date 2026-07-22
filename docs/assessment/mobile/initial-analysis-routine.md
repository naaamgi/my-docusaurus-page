---
sidebar_position: 3.5
title: 초기 정보 탐색 루틴
description: 모바일 앱을 처음 받았을 때 기준 정보, 실행 기준선, 주요 파일, 보호기법 분기, 본 점검 후보를 빠르게 정리하는 초반 분석 흐름
keywords: [Mobile Initial Triage, AndroidManifest, Info.plist, APK, IPA, Root Detection, Jailbreak Detection, SSL Pinning, Frida, MASVS, MASTG]
toc_max_heading_level: 3
draft: false
---

> 앱을 처음 받았을 때 30~60분 안에 기준선과 다음 점검 방향을 잡기 위한 문서다. 상세 분석은 각 항목 문서에서 진행하고, 여기서는 **무엇을 먼저 보고 어디로 분기할지**를 정리한다.

## 사용 시점

- APK, AAB, APKS, IPA 또는 설치된 앱을 처음 받았을 때
- 실행은 되지만 Burp, Frida, 루팅·탈옥 환경에서 어디가 막히는지 아직 모를 때
- 정적 분석을 시작하기 전에 봐야 할 파일과 검색어를 정리해야 할 때
- 상세 진단 문서로 넘어가기 전에 보호기법과 본 점검 후보를 분리해야 할 때

이 문서는 취약점을 확정하는 문서가 아니다. 초반에 기준 정보를 모으고, 보호기법 때문에 막히는지, 실제 기능 점검으로 넘어갈 수 있는지 판단하는 네비게이션 문서다.

## 초반 루틴

처음부터 모든 코드를 읽지 않는다. 다음 순서로 앱의 지도를 만든다.

| 순서 | 할 일 | 결과물 |
| :--- | :--- | :--- |
| 1 | 대상 파일과 앱 식별 | 패키지명·Bundle ID, 버전, 해시, 확보 경로 |
| 2 | 정상 실행 기준선 | 정상 단말·분석 단말에서 앱 실행 결과 |
| 3 | 프록시 기준선 | 브라우저와 앱의 Burp 노출 여부 |
| 4 | 주요 파일 빠른 확인 | Manifest·Info.plist, 설정, 리소스, 라이브러리 |
| 5 | 보호기법 분기 | 루팅·탈옥, Pinning, Frida·디버거 탐지 후보 |
| 6 | 본 점검 후보 정리 | 저장소, 인증, API, WebView, 딥링크, 암호화 후보 |

보호기법 우회는 목적이 아니다. 본 점검 경로를 확보하기 위해 필요한 범위만 확인한다.

## 기준 정보 기록

분석 전에 같은 앱을 보고 있는지 확인할 기준을 남긴다. 빌드가 바뀌면 정적 분석 결과와 후킹 지점도 달라질 수 있다.

여기서 앱 식별자는 이후 모든 명령의 기준이 된다. Android는 `com.example.app` 같은 package name을 쓰고, iOS는 Bundle ID를 쓴다. 파일 해시는 같은 이름의 앱이라도 실제 빌드가 같은지 확인하기 위한 값이다.

| 항목 | Android | iOS |
| :--- | :--- | :--- |
| 앱 식별자 | package name | Bundle ID |
| 버전 | `versionName`, `versionCode` | `CFBundleShortVersionString`, `CFBundleVersion` |
| 파일 기준 | APK/APKS/AAB 파일명, SHA-256 | IPA 파일명, SHA-256, 암호화 여부 |
| 실행 환경 | Android 버전, API, ABI, 루팅 여부 | iOS 버전, SoC, 탈옥 여부 |
| 분석 도구 | jadx, apktool, Frida 버전 | Frida, class-dump 계열, Hopper·Ghidra 등 |

Android 패키지명 확인:

```bash
adb shell pm list packages | grep -i 'keyword'
adb shell dumpsys package com.example.app | grep -E 'versionName|versionCode'
```

PowerShell:

```powershell
adb shell pm list packages | Select-String 'keyword'
adb shell dumpsys package com.example.app | Select-String 'versionName|versionCode'
```

iOS는 확보한 IPA의 `Info.plist`와 단말의 설치 앱 목록을 대조한다. 추출 방식과 탈옥 여부는 [iOS 환경 구축](setup-ios.md)에 맞춰 기록한다.

## 실행 기준선

앱을 분석 환경에 올리기 전에 원래 동작을 먼저 본다. 정상 동작을 모르면 보호기법 차단, 서버 오류, 환경 문제를 구분하기 어렵다.

| 관찰 결과 | 현재 판단 | 다음 문서 |
| :--- | :--- | :--- |
| 정상 단말과 분석 단말 모두 실행 | 기본 실행 가능 | 정적 분석과 프록시 기준선으로 진행 |
| 루팅 Android에서만 차단 | 루팅 탐지 후보 | [루팅 탐지 우회](root-detection-bypass.md) |
| 탈옥 iOS에서만 차단 | 탈옥 탐지 후보 | [탈옥 탐지 우회](jailbreak-detection-bypass.md) |
| Frida 연결 후에만 종료 | Frida·디버거 탐지 후보 | [디버거·Frida 탐지 우회](anti-debug-bypass.md) |
| 재서명·패치 후 실행 실패 | 위변조·서명 검증 후보 | [앱 위변조 / 재패키징 점검](app-tampering.md) |
| 특정 기능에서만 차단 | 기능 직전 재검사 또는 서버 정책 | 해당 기능의 요청·로그와 함께 보호기법 문서로 분기 |

실행 기준선은 화면 문구, 발생 시각, 앱 종료 여부, 같은 동작의 반복성을 함께 기록한다.

## 프록시 기준선

Burp가 보이지 않는다고 바로 SSL Pinning으로 단정하지 않는다. 단말 프록시, 사용자 CA, 앱의 네트워크 스택, 별도 프로토콜을 먼저 분리한다.

브라우저 기준선은 "단말 프록시와 CA 설정이 정상인가"를 확인하는 단계다. 브라우저 HTTPS는 Burp에 보이는데 앱만 실패한다면, 그때부터 앱 내부의 인증서 검증이나 Pinning을 의심한다.

| 결과 | 현재 판단 | 다음 작업 |
| :--- | :--- | :--- |
| 브라우저와 앱 모두 Burp에 보임 | 프록시 환경 정상 | 본 기능 API 점검 |
| 브라우저는 보이고 앱만 실패 | Pinning 또는 사용자 CA 미신뢰 후보 | [SSL Pinning 우회](ssl-pinning-bypass.md), [인증서 검증](certificate-validation.md) |
| 앱은 정상인데 Burp에 요청 없음 | 프록시 미사용, QUIC, 별도 프로세스, Native 스택 후보 | 정적 분석에서 네트워크 라이브러리와 호스트 확인 |
| 일부 호스트만 실패 | 도메인별 Pinning 또는 다른 클라이언트 | 실패 호스트와 성공 호스트를 분리 기록 |
| mTLS 오류 또는 클라이언트 인증서 요구 | 상호 TLS 가능성 | 고객사 제공 인증서·테스트 조건 확인 |

기준선 확인 후에만 Pinning 우회 여부를 판단한다. 우회 성공 자체는 분석 경로 확보이며, 인증서 검증 취약점 확정은 별도 판단이 필요하다.

## Android 빠른 확인

APK를 열면 아래 위치를 먼저 본다. 파일 하나에서 결론을 내리지 말고, 확인한 단서를 다음 행동으로 연결한다.

APK는 앱 코드와 리소스를 묶은 패키지다. 처음에는 `AndroidManifest.xml`로 앱의 입구를 찾고, `classes.dex`에서 실제 Java·Kotlin 코드 흐름을 따라간다. `res/`와 `assets/`는 화면 문구, 설정, 포함 파일을 찾는 곳이고, `lib/<ABI>/`는 네이티브 코드가 있을 때 보는 위치다.

| 파일·위치 | 먼저 볼 것 | 다음 분기 |
| :--- | :--- | :--- |
| `AndroidManifest.xml` | package, launch Activity, permission, `exported`, `allowBackup`, `debuggable`, `usesCleartextTraffic` | [정적 분석](static-analysis.md), [Exported 컴포넌트](exported-components.md), [딥링크](deeplink-intent.md) |
| `res/xml/network_security_config.xml` | cleartext 허용, trust-anchors, `pin-set`, `debug-overrides` | [인증서 검증](certificate-validation.md), [SSL Pinning 우회](ssl-pinning-bypass.md) |
| `res/values/strings.xml` | API host, 오류 문구, 기능명, 저장 키 이름 | jadx 검색어와 Find Usage 후보 |
| `assets/` | 설정 JSON, 인증서, DB, JS bundle, Flutter asset, WebView 자산 | [데이터 저장소](data-storage-android.md), [WebView](webview-issues.md), [암호화 키](crypto-keys.md) |
| `lib/<ABI>/*.so` | JNI, 암호화, SSL, anti-debug, RASP, packer 흔적 | [IDA Pro 네이티브 분석](ida-pro-analysis.md), [디버거·Frida 탐지 우회](anti-debug-bypass.md) |
| `classes.dex`, `classes2.dex` | Application, MainActivity, 로그인, 네트워크, 저장소, 탐지 래퍼 | [정적 분석](static-analysis.md), [Frida 후킹 실무](frida-scripts.md) |
| `META-INF/`, APK signature | 서명 방식, 재패키징 영향 | [앱 위변조 / 재패키징 점검](app-tampering.md) |

### Android 실행 흐름

JADX에서는 시작 Activity만 보지 말고 초기화 지점을 함께 본다. Android 앱은 화면이 열리기 전에 `Application`이나 `ContentProvider`에서 SDK와 보호 로직을 먼저 실행할 수 있다.

처음에는 "앱 전체 초기화", "첫 화면 진입", "사용자 행동 이후 실행"으로 나눠서 보면 된다.

| 위치 | 확인할 내용 |
| :--- | :--- |
| `Application.attachBaseContext()` | 앱 코드가 본격 실행되기 전 단계다. packer, MultiDex, RASP, Frida 탐지 조기 실행 후보 |
| `Application.onCreate()` | 앱 전체 초기화 지점이다. 전역 SDK, 루팅 탐지, Pinning 설정, 로깅·분석 SDK 확인 |
| `MainActivity.onCreate()` | 첫 화면 진입 지점이다. 시작 화면 분기, 탐지 결과 처리, 로그인 전 차단 확인 |
| `ContentProvider` | Activity보다 먼저 실행될 수 있다. SDK 자동 초기화나 RASP 초기화 후보 |
| 버튼 handler·ViewModel·Controller | 사용자가 버튼을 누른 뒤 실행된다. 입력 검증, API 요청, 저장소 접근 흐름 확인 |

검색어는 기능과 증상에 맞춰 좁힌다.

```text
root, rooted, su, magisk, test-keys
frida, gum, gadget, ptrace, debugger, tracerpid
ssl, tls, pin, certificate, trust, hostname, okhttp
token, session, jwt, password, secret, encrypt, decrypt
webview, javascriptinterface, deeplink, intent
```

## iOS 빠른 확인

IPA 또는 앱 번들을 확보했다면 아래 위치부터 본다. App Store 배포본은 실행 바이너리가 암호화되어 있을 수 있으므로 분석 가능 상태를 먼저 확인한다.

iOS에서는 `Info.plist`가 앱 설정의 출발점이다. Entitlements는 앱이 OS에서 허용받은 권한 목록에 가깝고, `Frameworks/`는 앱이 사용하는 외부·자체 라이브러리를 확인하는 위치다. 실행 파일과 Framework를 보면 Pinning, 탈옥 탐지, 네이티브 로직이 어디에 있을지 가늠할 수 있다.

| 파일·위치 | 먼저 볼 것 | 다음 분기 |
| :--- | :--- | :--- |
| `Info.plist` | Bundle ID, URL Scheme, ATS, 권한 문구, `LSApplicationQueriesSchemes` | [정적 분석](static-analysis.md), [딥링크](deeplink-intent.md), [인증서 검증](certificate-validation.md) |
| Entitlements | Keychain group, Associated Domains, App Groups, iCloud | [데이터 저장소 iOS](data-storage-ios.md), [인증 및 세션](auth-mobile.md) |
| `embedded.mobileprovision` | Team ID, App ID, 배포 프로필 | 빌드 출처와 테스트 권한 확인 |
| `Payload/<App>.app/<실행파일>` | 암호화 여부, linked framework, symbol, 문자열 | [정적 분석](static-analysis.md), [IDA Pro 네이티브 분석](ida-pro-analysis.md) |
| `Frameworks/` | Alamofire, TrustKit, Firebase, RASP SDK, 자체 Framework | [SSL Pinning 우회](ssl-pinning-bypass.md), [디버거·Frida 탐지 우회](anti-debug-bypass.md) |
| `PlugIns/` | Extension, share extension, notification service | 데이터 공유, 인증 흐름, 개인정보 흐름 |
| `Localizable.strings` | 오류 문구, 기능명, API 힌트 | 문자열 검색과 사용처 추적 |
| `Assets.car`, 번들 리소스 | 민감 이미지, 인증서, 설정 파일 | [개인정보 흐름·노출](privacy-leakage.md), [암호화 키](crypto-keys.md) |

### iOS 실행 흐름

iOS는 앱 구조에 따라 시작 지점이 다르다. Android의 `Application`이나 `MainActivity`처럼 하나만 보면 끝나는 구조가 아니라, 앱 생명주기와 화면 구조에 따라 여러 지점에서 초기화 코드가 실행될 수 있다.

처음에는 아래 위치를 "앱이 켜질 때 실행되는 코드", "화면이 열릴 때 실행되는 코드", "네트워크 인증서 검증이 실행되는 코드"로 나눠서 보면 된다.

| 위치 | 확인할 내용 |
| :--- | :--- |
| `AppDelegate` | 앱 전체 시작점에 가깝다. 인증 SDK, 탈옥 탐지, URL 처리 같은 전역 초기화 후보 |
| `SceneDelegate` | 화면 세션 단위의 시작점이다. 앱이 foreground로 돌아오거나 deeplink로 열릴 때 확인 |
| SwiftUI `App` | SwiftUI 앱의 진입점이다. `@main`이 붙은 구조체와 초기 화면 구성을 확인 |
| `viewDidLoad`·`viewWillAppear` | 개별 화면이 열릴 때 실행된다. 로그인 전후 검사, 화면별 차단 로직 확인 |
| URL loading delegate | 네트워크 인증서 검증 지점이다. TLS challenge, Pinning, mTLS 처리 확인 |

검색어는 Objective-C selector, Swift symbol, 문자열을 함께 본다.

```text
jailbreak, cydia, sileo, substrate, frida, ptrace, sysctl
NSURLSession, didReceiveChallenge, SecTrust, TrustKit
keychain, UserDefaults, pasteboard, deeplink, universal link
token, session, password, encrypt, decrypt
```

## 보호기법 분기

초반 분석에서 막힘이 보이면 증상 중심으로 분기한다.

| 증상 | 먼저 의심할 것 | 확인할 문서 |
| :--- | :--- | :--- |
| 앱 시작 직후 보안 안내 후 종료 | 루팅·탈옥 탐지, RASP 초기화 | [루팅 탐지 우회](root-detection-bypass.md), [탈옥 탐지 우회](jailbreak-detection-bypass.md) |
| Frida attach·spawn 후 종료 | Frida artifact, debugger, anti-tamper | [디버거·Frida 탐지 우회](anti-debug-bypass.md) |
| Burp에서 앱 HTTPS만 실패 | Certificate Pinning, 사용자 CA 미신뢰 | [SSL Pinning 우회](ssl-pinning-bypass.md) |
| 패치·재서명 후 실행 실패 | 서명 검증, 무결성 검증, installer 확인 | [앱 위변조 / 재패키징 점검](app-tampering.md) |
| 특정 민감 기능에서만 차단 | 기능 직전 재검사 또는 서버 verdict | 관련 보호기법 문서와 API 응답 비교 |
| Native 함수에서만 판정 | JNI, Swift/ObjC bridge, RASP SDK | [IDA Pro 네이티브 분석](ida-pro-analysis.md) |

처음부터 여러 우회를 동시에 적용하지 않는다. 하나의 증상에 대해 하나의 가설을 세우고, 원본 동작과 변경 후 동작을 비교한다.

## 본 점검 후보

보호기법을 통과하거나 해당 흐름에 보호기법이 없다는 기준선이 잡히면 본 점검 후보를 정리한다.

| 관찰 단서 | 본 점검 후보 | 이동할 문서 |
| :--- | :--- | :--- |
| SharedPreferences, SQLite, files, KeyStore | 민감정보 저장, 토큰 저장, 암호화 키 관리 | [Android 데이터 저장소](data-storage-android.md), [암호화 키](crypto-keys.md) |
| Keychain, UserDefaults, App Group container | iOS 저장소와 공유 컨테이너 | [iOS 데이터 저장소](data-storage-ios.md) |
| 로그인·토큰·세션 갱신 코드 | 인증, 세션, 만료, 재사용 | [인증 및 세션](auth-mobile.md) |
| BiometricPrompt, LAContext | 로컬 인증 우회 가능성 | [로컬 인증](local-auth-bypass.md) |
| exported Activity·Service·Receiver | 외부 호출과 권한 검증 | [Exported 컴포넌트](exported-components.md) |
| Scheme, App Link, Universal Link | deeplink 입력 처리와 인증 상태 | [딥링크 및 Intent](deeplink-intent.md) |
| WebView, JS bridge, file access | WebView 설정과 bridge 노출 | [WebView](webview-issues.md) |
| 로그, analytics, crash report | 개인정보 흐름, 과도한 수집 | [개인정보 흐름·노출](privacy-leakage.md) |

후보는 `확정`이 아니라 다음 점검의 입구다. 실제 판정은 재현, 서버 응답, 사용자 권한, 데이터 민감도와 함께 판단한다.

## 초반 메모 형식

현장에서 빠르게 남길 때는 아래 정도면 충분하다.

```text
대상:
- 앱 식별자:
- 버전/빌드:
- 파일 SHA-256:
- 단말/OS:

기준선:
- 정상 실행:
- 분석 단말 실행:
- Burp 기준선:
- Frida 기준선:

초기 파일 확인:
- Manifest/Info.plist:
- 네트워크 설정:
- 주요 문자열:
- Native/Framework:

보호기법 후보:
- 루팅/탈옥:
- SSL Pinning:
- Frida/디버거:
- 위변조:

본 점검 후보:
- 저장소:
- 인증/세션:
- 딥링크/플랫폼:
- WebView:
- 개인정보:
```

## 참고자료

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG](https://mas.owasp.org/MASTG/)
- [Frida 공식 문서](https://frida.re/docs/home/)
