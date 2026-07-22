---
sidebar_position: 15
title: Deep Link·Intent
description: Android App Links·Custom Scheme·Intent Redirection과 iOS Universal Links·Custom URL Scheme의 검증 상태와 입력 처리 흐름을 확인하는 실무 노트
keywords: [Deep Link, Intent, Custom URL Scheme, Universal Links, Intent Redirection, App Links, Digital Asset Links, AASA, MASVS-PLATFORM]
toc_max_heading_level: 3
draft: false
---

> 외부 URL이 앱의 어느 화면과 동작으로 연결되는지 확인한다. 링크 소유권 검증, 앱 내부 입력 검증, 로그인·권한 검증은 서로 다른 계층이며 하나가 정상이라고 나머지까지 안전한 것은 아니다.

## 사용 시점

- 푸시, 이메일, QR, 광고, 웹페이지에서 앱 내부 화면을 여는 기능이 있을 때
- OAuth·SSO callback, 비밀번호 재설정, 초대·쿠폰 링크를 처리할 때
- Manifest의 `BROWSABLE` filter나 iOS URL Types·Associated Domains를 발견했을 때
- URL parameter가 WebView, 파일, 결제·송금, 내부 navigation으로 전달될 때
- Android nested Intent를 다시 실행하는 redirector 코드를 발견했을 때

Activity·Service·Receiver·Provider 자체의 권한 경계는 [Exported 컴포넌트](./exported-components.md), WebView 로딩 결과는 [WebView 보안](./webview-issues.md)에서 다룬다.

## 분석 기준

| 기준 | 기록할 내용 |
| :--- | :--- |
| 앱 | package·Bundle ID, 버전, build, 파일 hash |
| 플랫폼 | Android·iOS 버전, target SDK, simulator·실기기 |
| 링크 | scheme, host, port, path, query, fragment |
| 연결 방식 | Custom Scheme, App Links, Universal Links |
| 소유권 | `assetlinks.json`, AASA, signing fingerprint, app ID |
| Handler | Activity·Scene·App delegate, navigation route |
| 상태 | 로그아웃, 일반 사용자, 권한 사용자, 앱 cold·warm start |
| 결과 | 화면, API 요청, redirect, WebView·외부 앱 전환 |

App Links와 Universal Links는 도메인과 앱의 연결을 검증한다. 링크가 열렸다는 이유만으로 해당 사용자가 그 리소스를 사용할 권한까지 보장하지 않는다. 모든 parameter는 외부 입력으로 취급한다.

## 링크 유형

| 유형 | 소유권 검증 | 실무 판단 |
| :--- | :--- | :--- |
| Android Custom Scheme | 없음 | 다른 앱이 같은 scheme을 등록할 수 있음 |
| Android App Links | Digital Asset Links | `autoVerify`와 단말 검증 상태를 함께 확인 |
| iOS Custom URL Scheme | 없음 | 동일 scheme의 대상 앱 선택은 보장되지 않음 |
| iOS Universal Links | Associated Domains·AASA | 검증 성공 시 해당 웹 도메인과 앱 연결 |
| Android Intent Redirection | 해당 없음 | 외부 nested Intent를 앱 권한으로 재실행하는지 확인 |

Custom Scheme 자체가 항상 취약한 것은 아니다. 전달 데이터와 동작이 안전하고 collision 영향을 제한하면 정상 기능일 수 있다. 반대로 검증된 HTTPS link라도 handler가 `role`, `amount`, `url`을 그대로 신뢰하면 취약할 수 있다.

## 진단 절차

#### Step 1. 전체 링크 목록

Manifest, Info.plist, entitlements에서 scheme·host·path를 정리한다. Android는 같은 intent filter 안의 여러 `<data>` 속성이 조합될 수 있으므로 예상하지 않은 URL 조합도 계산한다.

#### Step 2. 소유권 검증

Android는 `autoVerify`, `assetlinks.json`, 단말의 domain verification state를 확인한다. iOS는 Associated Domains entitlement와 AASA의 app ID·components를 맞춘다.

#### Step 3. Handler 코드

Cold start와 warm start의 서로 다른 delegate·lifecycle 경로를 찾는다. parameter parsing, allowlist, 중복 key, percent decoding, null·type 처리를 확인한다.

#### Step 4. 상태별 호출

정상 로그아웃 기능을 사용한 뒤 링크를 호출하고, 일반 사용자와 권한 사용자 상태를 비교한다. 앱 데이터를 지우는 명령은 기본 절차로 사용하지 않는다.

#### Step 5. 후속 동작

화면 표시에서 끝내지 않고 API 요청, 대상 ID, WebView URL, 파일 path, 외부 앱 전환을 확인한다. 서버의 401·403과 UI만 열린 상태를 분리한다.

#### Step 6. 링크 충돌

민감 callback처럼 실제 collision 영향이 중요한 경우에만 별도 테스트 앱으로 같은 scheme·filter를 등록한다. 테스트 계정과 무해한 code·state를 사용한다.

#### Step 7. 제한된 영향

다른 사용자 데이터 한 건, preview 동작, 허용되지 않은 host 한 개처럼 최소 증거로 판단한다. 결제·삭제·대량 요청은 기본 재현에서 제외한다.

상황별 첫 확인은 다음과 같다.

| 단서 | 첫 확인 | 결과에서 볼 항목 |
| :--- | :--- | :--- |
| `myapp://` | 로그아웃 상태의 무해한 route | 인증 이동, parameter allowlist |
| `https://` BROWSABLE | `pm get-app-links` | verified state, user selection |
| `applinks:` entitlement | AASA와 app ID | HTTPS, redirect, components |
| `url`·`redirect` parameter | 허용 host 밖의 HTTPS URL | WebView·외부 브라우저 목적지 |
| `id`·`account` parameter | 본인 테스트 ID와 없는 ID | 서버 권한 검사와 오류 차이 |
| nested Intent extra | 내부 무해 Activity | component·flag sanitization |
| OAuth callback | code·state·PKCE 흐름 | state 검증, code 재사용, redirect 고정 |

## 실습 노트

### Android · 링크 목록

배포 APK의 최종 Manifest에서 `VIEW`, `BROWSABLE`, scheme, host, path를 추출한다.

```bash
apkanalyzer manifest print app-release.apk
rg -n 'android.intent.action.VIEW|android.intent.category.BROWSABLE|android:scheme|android:host|android:path|android:autoVerify' decoded/AndroidManifest.xml
```

#### Filter 조합

같은 intent filter 안의 `<data>` 요소는 독립된 URL 한 줄이 아니라 속성이 병합되어 조합될 수 있다. scheme·host 조합을 의도대로 제한하려면 filter를 분리하는 편이 명확하다.

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="account.example.test"
        android:pathPrefix="/link/" />
</intent-filter>
```

`android:exported="true"`는 BROWSABLE Activity의 진입 조건일 뿐 handler의 parameter 안전성을 보장하지 않는다.

### Android · Custom Scheme

Custom Scheme은 소유권을 검증하지 않으므로 어떤 앱도 같은 scheme을 선언할 수 있다. Android에서는 일반적인 deep-link Intent의 신뢰할 수 있는 호출자 식별도 기대하지 않는다.

#### 직접 호출

```bash
adb shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d 'com.example.target://profile/view?id=test-account'
```

다음 순서로 값을 바꾼다.

| 값 | 첫 변형 | 확인할 것 |
| :--- | :--- | :--- |
| route | 존재하지 않는 path | 기본 route·오류 처리 |
| ID | 본인 테스트 ID·없는 ID | 서버 권한 검사·enumeration 차이 |
| 숫자 | 0, 음수, 허용 범위 경계 | client·server validation |
| 중복 key | `id=a&id=b` | parser별 first·last 처리 차이 |
| encoding | 한 번 percent encoding | decode 순서와 allowlist 적용 시점 |

앱이 열리는 것과 민감 기능 사용은 다르다. 로그아웃 상태에서 화면만 표시되고 서버가 401을 반환하면 인증 우회로 확정하지 않는다.

### Android · App Links

App Links는 `autoVerify="true"`만으로 완성되지 않는다. 서버의 `assetlinks.json`과 설치 단말의 검증 결과를 확인한다.

#### 서버 연결

```bash
curl -i https://account.example.test/.well-known/assetlinks.json
apksigner verify --print-certs app-release.apk
```

`assetlinks.json`의 `package_name`과 `sha256_cert_fingerprints`를 배포 앱과 맞춘다. Play App Signing을 사용하면 로컬 upload key가 아니라 사용자 단말에 배포되는 app signing certificate가 기준이다.

#### 단말 상태

```bash
adb shell pm get-app-links com.example.target
adb shell pm get-app-links --user cur com.example.target
```

`verified`와 사용자의 link handling 선택 상태를 분리한다. 사용자가 브라우저 열기를 선택한 결과는 domain 소유권 검증 실패와 다르다.

#### 링크 실행

```bash
adb shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d 'https://account.example.test/link/profile?id=test-account'
```

Android 12 이상에서는 검증되지 않은 일반 web link가 기본 브라우저로 갈 수 있다. 앱이 열리지 않았다는 사실만으로 악성 앱 가로채기가 재현됐다고 표현하지 않는다.

### Android · Intent Redirection

외부 Intent에서 nested Intent나 intent URI 문자열을 받아 그대로 `startActivity`, `startService`, `bindService`에 전달하는 코드를 찾는다.

```bash
rg -n 'getParcelableExtra|Intent\.parseUri|startActivity\(|startService\(|bindService\(|removeLaunchSecurityProtection|IntentSanitizer' jadx-output/sources
```

#### 위험 구조

```kotlin
val forward = intent.getParcelableExtra<Intent>("forward")
if (forward != null) {
    startActivity(forward)
}
```

문자열 extra는 Parcelable Intent가 아니므로 `adb --es`만으로 이 구조를 정확히 재현했다고 보지 않는다. 별도 PoC 앱에서 실제 nested Intent를 전달한다.

```kotlin
val nested = Intent().setClassName(
    "com.example.target",
    "com.example.target.InternalPreviewActivity"
)
val outer = Intent().setClassName(
    "com.example.target",
    "com.example.target.RedirectActivity"
).putExtra("forward", nested)

startActivity(outer)
```

component·package allowlist, data·type·category, URI grant flag 제거를 확인한다. AndroidX `IntentSanitizer`가 있어도 허용 규칙이 과도하지 않은지 본다. Android 16의 기본 launch security hardening과 `removeLaunchSecurityProtection()` 사용 여부도 기록하고 대상 OS에서 실제 결과를 확인한다.

### iOS · 링크 목록

Custom Scheme은 `Info.plist`, Universal Links는 signed entitlements에서 확인한다.

```bash
plutil -p Payload/Target.app/Info.plist
codesign -d --entitlements :- Payload/Target.app
```

주요 handler는 다음과 같다.

- `application(_:open:options:)`
- `scene(_:openURLContexts:)`
- `application(_:continue:restorationHandler:)`
- `scene(_:continue:)`
- SwiftUI `onOpenURL`

Cold start와 이미 실행 중인 상태에서 다른 method가 호출될 수 있으므로 둘 다 확인한다.

### iOS · Custom Scheme

Apple도 Custom Scheme parameter 검증을 요구하며, 동일 scheme을 여러 앱이 등록하면 대상 선택은 정의되지 않는다. reverse-DNS 형태의 긴 scheme은 충돌 가능성을 줄이지만 소유권을 보장하지 않는다.

#### Simulator 호출

```bash
xcrun simctl openurl booted 'com.example.target://profile/view?id=test-account'
```

실기기에서는 Notes·Mail·테스트 웹페이지의 링크를 눌러 cold·warm start를 비교한다. URL에 실제 token이나 개인정보를 넣지 않는다.

`sourceApplication`은 없을 수 있으므로 단독 인증 수단으로 사용하지 않는다. source가 예상 앱이어도 URL parameter와 현재 사용자 권한은 다시 검증한다.

### iOS · Universal Links

Associated Domains entitlement와 도메인의 AASA 파일이 양방향으로 일치해야 한다.

```bash
curl -i https://account.example.test/.well-known/apple-app-site-association
```

AASA는 확장자 없이 HTTPS로 제공하고 redirect를 사용하지 않는다. `appIDs`·`appID`가 Team ID·Bundle ID와 맞는지, `components`·`paths` 범위가 앱의 실제 route와 맞는지 확인한다.

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID1234.com.example.target"],
        "components": [
          { "/": "/link/profile/*" },
          { "/": "/link/reset/*" }
        ]
      }
    ]
  }
}
```

전체 path 허용은 routing 범위가 넓다는 뜻이지 자동 취약점은 아니다. 앱 handler의 allowlist와 인증을 확인한다. AASA 실패로 Safari에 열리는 정상 fallback도 단독 피싱 취약점으로 판정하지 않는다.

### 공통 · 입력·후속 동작

링크 route를 파악한 뒤 입력이 도달하는 sink를 기준으로 테스트한다.

| 입력 | 위험한 sink | 최소 확인 |
| :--- | :--- | :--- |
| `url`, `redirect`, `next` | WebView·외부 browser | scheme·host allowlist 밖 URL 한 개 |
| `file`, `path` | file API·ContentProvider | test fixture의 상위 path 거부 |
| `id`, `account`, `order` | API resource selector | 본인 ID와 없는 ID의 차이 |
| `amount`, `role`, `mode` | 업무 상태·권한 분기 | 허용 범위 경계와 서버 재검증 |
| `code`, `token`, `state` | OAuth·SSO·reset | URL 노출, state·PKCE, 1회성 |
| nested Intent | Android component launch | target·flag allowlist |

#### WebView 연결

외부 URL이 앱 내부 origin의 WebView에 들어가는지, JavaScript bridge·cookie가 붙는지 확인한다. 상세 판정은 [WebView 보안](./webview-issues.md)으로 넘긴다.

#### OAuth·SSO Callback

Custom Scheme 사용만으로 Critical로 판정하지 않는다. 다음을 함께 확인한다.

- redirect URI가 client 등록값과 정확히 일치하는지
- authorization request와 callback의 `state`가 연결되는지
- public native client에 PKCE가 적용되는지
- code가 짧은 시간의 1회성이고 다른 client에서 교환되지 않는지
- code·token이 log, analytics, clipboard에 남지 않는지
- 가능하면 claimed HTTPS redirect(App Links·Universal Links)를 사용하는지

테스트 계정의 무효 code나 자체 발급한 state로 흐름만 확인하고 실제 token을 문서·명령 기록에 남기지 않는다.

## 결과 판정

| 확인 결과 | 판정 방향 |
| :--- | :--- |
| Custom Scheme 선언 | 외부 입력면이며 단독 취약점 아님 |
| Android HTTPS filter에 `autoVerify` 없음 | unverified link 설정 확인, 실제 영향 산정 필요 |
| `autoVerify` 존재·단말 state 미검증 | 서버·fingerprint·단말 결과 확인 전 후보 |
| App Links state `verified` | 도메인 연결 검증 성공, handler 검증은 별도 |
| AASA 누락·불일치 | Universal Link 연결 실패, fallback 영향 확인 |
| 동일 Custom Scheme 테스트 앱이 callback 수신 | link collision 재현 확인 |
| 링크로 민감 화면만 표시 | 서버 요청·권한 결과 확인 전 후보 |
| 로그아웃·타 권한에서 민감 API 성공 | 인증·인가 우회 확정 |
| 외부 URL이 privileged WebView로 로드 | WebView 결합 영향 확인 |
| nested Intent로 private component 기능 도달 | Intent Redirection 확정 |
| Custom Scheme OAuth + PKCE·state 정상 | collision 영향이 제한될 수 있어 code 교환까지 검토 |
| URL에 장기 token·개인정보 포함 | log·전달 경로 노출과 재사용 가능성 확인 |

영향은 민감 parameter, 사용자 동작 필요성, 앱 설치 조건, 서버 검증, token 재사용, WebView bridge 권한을 기준으로 정한다. 단순히 앱이 열리거나 브라우저로 fallback되는 현상만으로 높은 심각도를 부여하지 않는다.

## 증적 항목

- 앱 hash, 버전, Android target SDK·iOS version
- 전체 scheme·host·path·query 목록
- Manifest filter와 iOS entitlements
- assetlinks package·fingerprint와 단말 verification state
- AASA app ID·components·HTTP 상태·redirect 여부
- handler class·method와 cold·warm start 경로
- 변형한 parameter와 예상·실제 route
- 로그인·권한 상태와 후속 API status
- 별도 collision·nested Intent PoC 앱의 package·서명
- 마스킹한 callback·request ID
- 확정·후보·보류와 영향 상승 조건

## 트러블슈팅

#### Android 링크의 Browser 전환

- `pm get-app-links`의 domain state와 user selection을 확인한다.
- `DEFAULT`·`BROWSABLE`, scheme, host, path filter를 다시 맞춘다.
- Android 12 전후의 web intent 동작 차이를 기록한다.

#### App Links `legacy_failure`

- `assetlinks.json`의 HTTPS 상태와 JSON 형식을 확인한다.
- package와 배포 signing fingerprint를 맞춘다.
- 테스트 단말에서 re-verification 후 충분히 기다린다.

#### iOS Universal Link의 Safari 전환

- entitlement와 AASA의 Team ID·Bundle ID를 맞춘다.
- AASA가 HTTPS·무redirect로 제공되는지 확인한다.
- 같은 도메인 내 Safari navigation과 Notes 등 외부 출발 링크를 비교한다.
- 설치 후 association cache 갱신 시간을 고려한다.

#### Custom Scheme 무반응

- scheme·host·path 구분과 percent encoding을 확인한다.
- 앱 cold·warm state의 handler method를 각각 본다.
- 다른 앱이 같은 scheme을 등록했는지 확인한다.

#### Intent Redirection 재현 실패

- handler가 Parcelable Intent, URI 문자열, Bundle 중 무엇을 읽는지 맞춘다.
- Android 16 launch hardening과 target OS를 확인한다.
- component가 private인지보다 redirector 권한으로 기능에 도달하는지 본다.

#### 로그아웃 상태의 자동 로그인

- SSO cookie, Keychain·Keystore token, refresh token이 남아 있는지 확인한다.
- 앱 데이터 삭제 대신 정상 로그아웃과 별도 테스트 계정을 사용한다.
- 링크가 인증을 우회한 것인지 정상 session 복원인지 구분한다.

## 빠른 명령어 참조

본문 명령을 반복하지 않고 검증 상태 초기화·후속 관찰 명령만 모았다.

| 목적 | 명령 | 주의사항 |
| :--- | :--- | :--- |
| Android 재검증 | `adb shell pm verify-app-links --re-verify com.example.target` | 테스트 단말에서 비동기 완료 대기 |
| Activity 로그 | `adb logcat -s ActivityTaskManager ActivityManager` | resolve package와 permission 확인 |
| iOS AASA 응답 | `curl -v https://HOST/.well-known/apple-app-site-association` | TLS, redirect, content type 확인 |
| iOS 앱 식별자 | `codesign -dvvv Payload/Target.app` | TeamIdentifier·Authority 확인 |
| URL 문자열 | `rg -n '://|onOpenURL|openURLContexts|continueUserActivity' SOURCE` | sample·test URL 구분 |

App Links state를 완전히 reset하는 명령은 사용자 선택도 바꿀 수 있으므로 별도 테스트 단말에서만 사용한다.

## 관련 문서

- [Exported 컴포넌트](./exported-components.md)
- [WebView 보안](./webview-issues.md)
- [인증 및 세션](./auth-mobile.md)
- [정적 분석](./static-analysis.md)
- [Android 분석 환경](./setup-android.md)
- [iOS 분석 환경](./setup-ios.md)

## 참고자료

#### 공식 문서

- [Android Developers - About App Links](https://developer.android.com/training/app-links/about)
- [Android Developers - Verify App Links](https://developer.android.com/training/app-links/verify-applinks)
- [Android Developers - Intent Redirection](https://developer.android.com/privacy-and-security/risks/intent-redirection)
- [Apple Developer - Supporting Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [Apple Developer - Debugging Universal Links](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)
- [Apple Developer - Custom URL Schemes](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [IETF RFC 8252 - OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)

#### 점검 가이드

- [OWASP MASTG - Unverified App Links](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0393/)
- [OWASP MASTG - Android Custom Scheme Input](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0394/)
- [OWASP MASTG - iOS Custom URL Schemes](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-PLATFORM/MASTG-KNOW-0079/)
- [OWASP MASTG - iOS Universal Links](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-PLATFORM/MASTG-KNOW-0080/)
