---
sidebar_position: 13
title: Deep Link / Intent
description: 모바일 진단 - Android Intent Redirection / Exported Components / iOS Custom URL Scheme / Universal Link / 외부 호출 컴포넌트 점검
keywords: [Deep Link, Intent, Custom URL Scheme, Universal Link, Intent Redirection, Exported Components, App Links, MASVS-PLATFORM, Android, iOS]
draft: false
---

# Deep Link / Intent
> 다른 앱 / 외부 URL 이 점검 대상 앱의 내부 화면 / 액션을 **인증 없이 직접 호출** 하거나 **파라미터를 변조** 해 인증·인가 / 비즈니스 로직 / WebView 결합 결함으로 이어지는 영역.
> 모바일에서 가장 빈번하게 발견되는 영역 중 하나 — 매니페스트 / Info.plist 만 봐도 1차 점검 가능.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-PLATFORM-1, 3 / MASTG-TEST-0025 (Android), 0062 (iOS) |
| **CWE** | [CWE-926: Improper Export of Android Application Components](https://cwe.mitre.org/data/definitions/926.html), [CWE-939: Improper Authorization in Handler for Custom URL Scheme](https://cwe.mitre.org/data/definitions/939.html) |
| **영향도** | 🔴 (인증 우회 / 임의 컴포넌트 호출 / 토큰 탈취) / 🟡 (단순 화면 호출 / 정보 노출) |
| **점검 난이도** | 하 (매니페스트 검색 + adb / xcrun) ~ 중 (Intent Redirection / Pending Intent / Universal Link 우회) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

모바일 OS 는 앱 간 호출을 위한 표준 메커니즘 (Android: Intent + Custom Scheme + App Links / iOS: Custom URL Scheme + Universal Link) 을 제공한다. 점검은 (1) **외부에서 호출 가능한 컴포넌트** 가 의도된 것인지, (2) **인증 / 인가 검증** 이 적용되는지, (3) **파라미터 검증** 이 적용되는지, (4) **다른 앱이 같은 스킴을 등록** 해 가로채기 가능한지 확인.

> **다른 페이지와 영역 분리**
> - WebView 로 외부 URL 로드 → `webview-issues.md`
> - 정적 분석 (매니페스트 / Info.plist 검색) → `static-analysis.md`
> - 환경 구축 (`adb shell am start`) → `setup-android.md`
> - iOS 외부 호출 (`xcrun simctl openurl`) → `setup-ios.md` 흐름

---

## 유형 구분

### Android

| 결함 | 핵심 |
| :--- | :--- |
| **Exported Activity / Service / Receiver / Provider (`exported="true"`)** | 다른 앱이 임의 호출 가능 |
| **Intent Redirection** | 앱이 받은 Intent 의 `extras` 내 다른 Intent 를 `startActivity` 로 그대로 실행 |
| **Custom URL Scheme (`myapp://`) 인증 우회** | 로그인 화면 건너뛰고 내부 화면 직접 진입 |
| **App Links 검증 부재 / autoVerify 누락** | 다른 앱이 동일 스킴 등록 → 가로채기 |
| **Pending Intent — `FLAG_IMMUTABLE` 누락 (Android 12 미만)** | `addFlags` 변조로 임의 인텐트 발사 |
| **Content Provider 의 `grantUriPermissions="true"` + path 검증 부재** | 임의 URI 로 컨테이너 파일 접근 |

### iOS

| 결함 | 핵심 |
| :--- | :--- |
| **Custom URL Scheme (`myapp://`) 인증 우회** | 동일 |
| **URL Scheme Hijacking** | 다른 앱이 동일 스킴 등록 → 사용자가 어느 앱을 열지 모호 |
| **Universal Link 검증 부재 / `apple-app-site-association` 미설정** | 폴백으로 Safari 로 열림 → 피싱 |
| **`application(_:open:options:)` 의 출처 검증 부재** | `sourceApplication` 검증 없이 처리 |
| **`SFSafariViewController` 의 URL 검증 부재** | 임의 URL 로드 → 피싱 |

---

## 진단 절차

### Step 1. 매니페스트 / Info.plist 점검
**Android (AndroidManifest.xml):**

```xml
<!-- exported 컴포넌트 검색 -->
<activity android:name=".LoginActivity"
          android:exported="true">                  <!-- 외부 호출 가능 -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="myapp"/>              <!-- myapp://... -->
        <data android:scheme="https"
              android:host="target.com"/>           <!-- App Links: https://target.com/... -->
    </intent-filter>
</activity>

<!-- autoVerify (App Links 검증 강제) -->
<intent-filter android:autoVerify="true">           <!-- 권장 -->
```

**iOS (Info.plist):**

```xml
<!-- Custom URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>                  <!-- myapp:// -->
        </array>
    </dict>
</array>

<!-- Universal Link (entitlements 에 정의됨) -->
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:target.com</string>
</array>
```

### Step 2. 외부 호출로 동작 관찰

**Android:**

```bash
# 1) 모든 exported 컴포넌트 목록
aapt dump xmltree target.apk AndroidManifest.xml | grep -i "exported\|scheme\|host"

# 2) 직접 호출
# Custom URL Scheme
adb shell am start -a android.intent.action.VIEW -d "myapp://open/admin"

# Activity 직접 호출
adb shell am start -n com.target.app/.AdminActivity
adb shell am start -n com.target.app/.WebActivity --es url "https://attacker.com"

# Service 호출
adb shell am startservice -n com.target.app/.BackgroundService

# Receiver 호출
adb shell am broadcast -a com.target.app.ACTION_DO_THING --es data "..."

# Provider 조회
adb shell content query --uri content://com.target.provider/users
```

**iOS:**

```bash
# 시뮬레이터
xcrun simctl openurl booted "myapp://open/admin?token=ATTACKER"

# 실기기
uiopen "myapp://open/admin?token=ATTACKER"

# 또는 다른 앱에서 호출
```

### Step 3. 인증 / 인가 / 파라미터 검증 확인

각 호출에 대해 다음 시나리오 점검:

1. **로그아웃 상태에서 내부 화면 호출** — 인증 화면으로 리다이렉트되는지
2. **다른 사용자 권한으로 진입** — 일반 사용자 토큰으로 관리자 화면 호출 시 차단되는지
3. **파라미터 변조** — `id` / `amount` / `token` 변경 시 정상 검증되는지
4. **WebView 와 결합** — `url` 파라미터로 외부 URL 로드 가능한지 (`webview-issues.md` 케이스 3)

---

## 페이로드 / 테스트 케이스

### 케이스 1 (Android): Custom URL Scheme 인증 우회

**언제 점검하는지**: 앱이 푸시 알림 / 마케팅 링크에서 딥링크를 받아 내부 화면으로 이동시키는 모든 경우.

**위험 코드:**

```java
// MainActivity.onCreate (또는 LinkHandlerActivity)
Uri uri = getIntent().getData();
if (uri != null) {
    String path = uri.getPath();
    if (path.startsWith("/payment/")) {
        startActivity(new Intent(this, PaymentActivity.class));   // ← 인증 확인 없이 결제 화면
    }
}
```

**PoC:**

```bash
# 1) 앱을 강제 로그아웃 후 종료
adb shell pm clear com.target.app

# 2) 딥링크 직접 호출
adb shell am start -a android.intent.action.VIEW -d "myapp://payment/confirm?amount=1000000"
```

**판정**: 로그아웃 상태에서 결제 / 인증 / 권한 변경 화면이 그대로 진입되면 미흡 (High). 딥링크 진입 시 **세션 검증 → 미인증이면 로그인 화면으로 리다이렉트** 가 표준.

### 케이스 2 (Android): Intent Redirection

**언제 점검하는지**: 앱이 받은 Intent 의 `extras` 에서 다른 Intent 를 꺼내 `startActivity` / `sendBroadcast` 로 그대로 실행하는 패턴.

**위험 코드:**

```java
// 받은 Intent 안에 또 다른 Intent 가 있고, 그걸 그대로 실행
Intent forwardIntent = (Intent) getIntent().getParcelableExtra("forward");
if (forwardIntent != null) {
    startActivity(forwardIntent);   // ← 임의 컴포넌트 호출 가능
}
```

**PoC:**

```bash
# 점검 대상 앱의 권한 / 컨텍스트로 임의 컴포넌트 호출
adb shell am start -n com.target.app/.RedirectActivity \
    --es forward 'intent:#Intent;component=com.target.app/.AdminActivity;end'
```

**판정**: `RedirectActivity` 의 권한 (예: 시스템 / 자사 권한) 으로 `AdminActivity` 호출됨 → 권한 우회. Critical 가능.

### 케이스 3 (Android): Exported Component + 권한 검증 부재

**언제 점검하는지**: 매니페스트에서 `exported="true"` + 권한 (`permission` 속성) 없는 컴포넌트.

**위험 매니페스트:**

```xml
<service android:name=".SmsForwardService" android:exported="true"/>        <!-- 권한 없음 -->
<receiver android:name=".AuthBroadcastReceiver" android:exported="true"/>   <!-- 권한 없음 -->
<provider android:name=".UserProvider" android:exported="true"
          android:authorities="com.target.provider"/>                       <!-- 권한 없음 -->
```

**PoC:**

```bash
# Service — 점검 대상 권한으로 임의 동작
adb shell am startservice -n com.target.app/.SmsForwardService --es to "+82-10-..."

# Receiver — 인증 처리에 영향
adb shell am broadcast -a com.target.app.ACTION_LOGIN --es token "fake_token"

# Provider — 사용자 테이블 조회 / 변조
adb shell content query --uri content://com.target.provider/users
adb shell content insert --uri content://com.target.provider/users --bind user_id:i:999 --bind role:s:admin
```

**판정**: 외부에서 임의 호출 + 인증 / 권한 / 파라미터 검증 없으면 미흡 (High ~ Critical).

### 케이스 4 (Android): App Links autoVerify 누락 → 다른 앱이 같은 스킴 등록
**언제 점검하는지**: 매니페스트의 `<intent-filter>` 에 `https://target.com/...` 가 있지만 `autoVerify="true"` 가 없을 때.

```xml
<!-- 위험 — autoVerify 없음 -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="target.com"/>
</intent-filter>
```

**시나리오:**

```
1) 공격자가 동일 host (target.com) 의 intent-filter 등록한 악성 앱 배포
2) 사용자가 https://target.com/login?... 클릭
3) Android 가 "어느 앱으로 열까요?" 선택 다이얼로그 표시 또는 잘못된 앱 자동 선택
4) 악성 앱이 token / 인증코드 파라미터 가로채기
```

**판정**: `autoVerify="true"` + `apple-app-site-association` 같은 `assetlinks.json` 검증 없이는 가로채기 가능. 인증코드 / OAuth callback 등 민감 콜백이 이 패턴이면 Critical.

### 케이스 5 (Android): Pending Intent — `FLAG_IMMUTABLE` 누락
**언제 점검하는지**: 푸시 알림 / 위젯 / 알람 등에서 Pending Intent 사용.

**위험 코드:**

```java
// FLAG_IMMUTABLE 없음 → 다른 앱이 intent 의 extras / action / data 변조 가능
PendingIntent pi = PendingIntent.getActivity(this, 0, intent, 0);
// 권장: PendingIntent.FLAG_IMMUTABLE
```

**판정**: Android 12 (API 31) 부터 `FLAG_IMMUTABLE` 또는 `FLAG_MUTABLE` 명시 필수 — 누락 시 OS 가 차단. 그러나 **targetSdk < 31** 인 앱은 여전히 취약. 점검 대상의 `targetSdk` 확인 + 변조 가능성 검토.

### 케이스 6 (iOS): Custom URL Scheme 인증 우회

**언제 점검하는지**: `application(_:open:options:)` 또는 `scene(_:openURLContexts:)` 에서 URL 처리.

**위험 코드:**

```swift
func application(_ application: UIApplication,
                 open url: URL,
                 options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    if url.host == "payment" {
        // 인증 검증 없이 결제 화면 진입
        let vc = PaymentViewController()
        vc.amount = url.queryParameter("amount")
        navigationController?.pushViewController(vc, animated: true)
    }
    return true
}
```

**PoC:**

```bash
# 시뮬레이터
xcrun simctl openurl booted "myapp://payment?amount=1000000"

# 실기기
uiopen "myapp://payment?amount=1000000"
```

**판정**: 케이스 1 (Android) 와 동일 — 미인증 상태에서 민감 화면 진입 가능 / 파라미터 변조 → High.

### 케이스 7 (iOS): URL Scheme Hijacking — 같은 스킴 등록 가능

**언제 점검하는지**: 앱이 `myapp://` 같은 짧고 흔한 커스텀 스킴 사용.

```
시나리오:
1) 공격자 앱이 동일 스킴 (myapp) 등록
2) 사용자가 myapp://oauth_callback?code=xxx 호출
3) iOS 는 같은 스킴을 가진 앱이 여러 개면 "최근 설치된 앱" 또는 "임의 앱" 선택
4) OAuth 인증코드가 공격자 앱으로 전달
```

**판정**: 인증 콜백 / OAuth / SSO 가 Custom URL Scheme 만 사용하면 가로채기 가능 → **Universal Link 로 마이그레이션 필수**.

### 케이스 8 (iOS): Universal Link `apple-app-site-association` 미설정 / 잘못된 설정

**언제 점검하는지**: Info.plist 에 `applinks:` entitlement 가 있지만 해당 도메인의 `apple-app-site-association` 가 잘못되거나 없을 때.

**점검:**

```bash
# 자사 도메인의 AASA 파일 확인
curl -s https://target.com/.well-known/apple-app-site-association | jq

# 정상 응답
{
  "applinks": {
    "details": [{
      "appIDs": ["TEAMID.com.target.app"],
      "components": [{ "/": "/payment/*" }, { "/": "/account/*" }]
    }]
  }
}
```

**판정**:

- AASA 가 404 / 잘못된 컴포넌트 → 앱이 핸들링 못하고 **Safari 로 폴백** → 피싱 가능
- `*` 와일드카드 광범위 사용 → 의도 외 URL 까지 앱에서 처리

### 케이스 9 (공통): WebView 결합 — `url` 파라미터로 외부 URL 로드

**위험 시나리오 (Android):**

```bash
# myapp://web?url=... 패턴 — webview-issues.md 의 케이스 3 과 결합
adb shell am start -a android.intent.action.VIEW -d "myapp://web?url=https://attacker.com/phish"
```

**판정**: WebView 가 `url` 파라미터를 검증 없이 로드 → 피싱 / Native 메서드 호출 결합. 가장 빈번한 결합 패턴 — `webview-issues.md` 참조.

### 그 외 — 한 줄 언급

- **iOS `SFSafariViewController` URL 검증 부재** — Custom Scheme 호출 자체보다 영향 작음 (다른 앱에서 열리지 않음). 단, 피싱 가능성은 동일
- **iOS `LSApplicationQueriesSchemes`** — `canOpenURL:` 으로 다른 앱 설치 여부 조회 가능. 정보 노출 영역. iOS 9+ 부터 화이트리스트 필요
- **Android Slice / Shortcut / App Actions** — 신규 표면. 일반 Exported 컴포넌트 점검과 동일 흐름

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약 / 미흡:

- [ ] **Android**: Custom URL Scheme / App Links 진입 시 **인증 검증 부재** → 미인증으로 민감 화면 진입
- [ ] **Android**: `exported="true"` 컴포넌트 + 권한 (`permission`) 미적용 → 외부 앱 호출 가능
- [ ] **Android**: Intent Redirection — `getParcelableExtra("intent")` 등을 그대로 `startActivity`
- [ ] **Android**: `autoVerify="true"` 없는 App Links → 다른 앱이 같은 host 등록 가능
- [ ] **Android**: `targetSdk < 31` + `FLAG_IMMUTABLE` 누락 PendingIntent
- [ ] **Android**: Content Provider `exported="true"` + path / 권한 검증 부재
- [ ] **iOS**: `application(_:open:options:)` 에서 **인증 검증 / `sourceApplication` 검증 부재**
- [ ] **iOS**: Custom URL Scheme 만으로 OAuth / SSO 콜백 처리 (Universal Link 미사용)
- [ ] **iOS**: Universal Link `apple-app-site-association` 누락 / 광범위 `/` 패턴
- [ ] **공통**: 딥링크 파라미터 (`url`, `redirect`, `next`) 가 WebView 로 검증 없이 전달

**오탐 주의:**

- [ ] `LAUNCHER` intent-filter 만 있는 Activity 는 외부 호출 불가 — `exported="true"` 정상
- [ ] `BIND_JOB_SERVICE` / `BIND_INPUT_METHOD` 등 시스템 권한이 필요한 컴포넌트는 외부 임의 호출 불가
- [ ] iOS Universal Link 가 정상 적용된 경우 다른 앱 가로채기 불가 (AASA 가 보호)

---

## 다른 페이지로 위임

- **WebView 결합 (딥링크 url 파라미터로 WebView 외부 URL 로드)** → `webview-issues.md`
- **매니페스트 / Info.plist 검색** → `static-analysis.md`
- **딥링크 호출 환경 (`adb` / `xcrun simctl`)** → `setup-android.md`, `setup-ios.md`
- **인증 결함 (딥링크 진입 시 인증 우회)** → 본 페이지 + 일반 인증 점검 (`assessment/web/authentication.md` 와 모바일 인증 결함은 별도)
- **인증 / 권한 부재로 인한 내부 API 호출 가능 여부** → `assessment/web/authorization-idor.md` 와 동일 흐름 (모바일에서는 서버 API 호출 흐름이 웹과 공통)

---

## 참고자료

- [OWASP MASTG-TEST-0025 - Deep Links (Android)](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0025/)
- [OWASP MASTG-TEST-0062 - Custom URL Schemes (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-PLATFORM/MASTG-TEST-0062/)
- [Android - App Links](https://developer.android.com/training/app-links)
- [Android - PendingIntent Mutability](https://developer.android.com/guide/components/intents-filters)
- [Android - Intent Redirection](https://support.google.com/faqs/answer/9267555)
- [Apple - Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Apple - Defining a Custom URL Scheme](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [PortSwigger - Exploiting Android Deep Links](https://portswigger.net/research/exploiting-android-deep-links)
- [HackTricks - Android Deep Links](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/exploiting-content-providers)
- [HackTricks - iOS Custom URL Schemes](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting/ios-custom-uri-handlers-deeplinks-custom-schemes)
