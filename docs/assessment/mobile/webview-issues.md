---
sidebar_position: 16
title: WebView 보안
description: Android WebView와 iOS WKWebView의 URL 신뢰 경계, Native bridge, 파일 접근, JavaScript, 네트워크 설정을 실제 origin과 함께 확인하는 실무 노트
keywords: [WebView, WKWebView, JavaScript Bridge, addJavascriptInterface, WebMessage, File Access, Mixed Content, WKScriptMessageHandler, MASVS-PLATFORM]
toc_max_heading_level: 3
draft: false
---

> WebView가 로드하는 콘텐츠의 신뢰 수준과 그 콘텐츠에 부여된 Native 권한을 연결한다. 위험 설정 하나보다 `비신뢰 입력 → WebView origin → JavaScript·파일·bridge → 민감 동작`이 이어지는지가 핵심이다.

## 사용 시점

- 앱 내부 공지, 결제, 인증, 도움말 화면이 WebView로 구현됐을 때
- Deep Link·푸시·서버 응답의 URL을 WebView에 전달할 때
- Android `addJavascriptInterface`나 iOS script message handler를 발견했을 때
- local HTML, `file://`, `content://`, `loadHTMLString`을 사용할 때
- WebView에서만 인증서·HTTP·cookie 동작이 다를 때

페이지 자체의 XSS는 웹 문서에서 확인하고, 여기서는 모바일 앱이 추가한 권한과 navigation 경계를 본다. 링크 진입은 [Deep Link·Intent](./deeplink-intent.md), 인증서 처리는 [인증서 검증·평문 통신](./certificate-validation.md)과 연결한다.

## 분석 기준

WebView instance마다 설정과 콘텐츠가 다르므로 앱 전체에 한 번만 판정하지 않는다.

| 기준 | 기록할 내용 |
| :--- | :--- |
| 화면 | WebView를 생성하는 Activity·ViewController·SDK |
| 최초 콘텐츠 | remote URL, local file, HTML string, asset |
| 입력 출처 | 고정값, server, deep link, 사용자 입력 |
| origin | scheme, host, port, main frame·iframe |
| 실행 권한 | JavaScript, popup, navigation, download |
| Native 연결 | bridge 이름, handler, method, 입력 schema |
| local 접근 | file·content access, read root, asset loader |
| network | HTTPS, mixed content, TLS 오류 처리, proxy |
| 상태 | login, cookie, WebStorage, debug 가능 여부 |

`JavaScript=true`나 WebView 사용 자체는 취약점이 아니다. 신뢰하지 않는 콘텐츠가 실행되거나 민감한 Native 기능에 접근할 수 있을 때 영향이 생긴다.

## 위험 유형

| 유형 | 핵심 질문 | 실무 판단 |
| :--- | :--- | :--- |
| 임의 Navigation | 외부 입력이 목적지를 결정하는가 | 허용 scheme·host·path와 후속 권한 확인 |
| Native Bridge | 어느 frame·origin이 어떤 method를 호출하는가 | 민감 기능과 비신뢰 콘텐츠 연결 시 확정 |
| Local File | script가 앱 파일 범위를 벗어나는가 | 실제 read root와 fixture 접근 확인 |
| Script Injection | 문자열이 HTML·JavaScript 문맥에 들어가는가 | sink별 encoding과 실행 확인 |
| Network 완화 | HTTP·인증서 오류를 허용하는가 | 실제 active content 변조 가능성 확인 |
| Persistent Data | cookie·WebStorage가 오래 남는가 | token 민감도와 logout 정리 확인 |
| Remote Debug | release WebView를 외부에서 검사할 수 있는가 | 단말 조건과 접근 가능한 데이터 확인 |

`UIWebView`는 deprecated 기술이지만 문자열 발견만으로 현재 실행 경로나 취약 영향을 확정하지 않는다. 실제 사용 여부와 `WKWebView`로의 전환 상태를 기록한다.

## 진단 절차

#### Step 1. Instance 목록

WebView 생성 위치, 설정 object, URL 공급자, client·delegate, bridge 등록 위치를 묶는다. SDK가 만든 WebView도 포함한다.

#### Step 2. 최초 Load

`loadUrl`, `loadRequest`, `loadHTMLString`, `loadFileURL`의 argument를 거슬러 올라가 외부 입력 여부와 effective origin을 확인한다.

#### Step 3. Navigation 경계

최초 URL뿐 아니라 redirect, iframe, popup, `target=_blank`, custom scheme, download를 확인한다. URL은 문자열 prefix가 아니라 파싱된 scheme·host·port·path로 비교한다.

#### Step 4. Bridge 권한

JavaScript에 노출되는 이름과 method를 목록화한다. message origin, main frame 여부, argument type, 현재 사용자 권한, server 재검증을 확인한다.

#### Step 5. Local·Network 설정

file·content access, mixed content, HTTP, TLS 오류 처리, local read root를 실제 load와 연결한다.

#### Step 6. 최소 동적 재현

통제 도메인·test fixture·무해한 bridge method로 origin 경계를 확인한다. token 저장, 결제, 파일 외부 전송은 기본 PoC로 사용하지 않는다.

#### Step 7. 상태 정리

로그아웃 뒤 cookie, cache, WebStorage, back-forward list가 남는지 확인한다. 운영 계정의 민감 데이터는 개발자 도구 화면에 남기지 않는다.

상황별 첫 확인은 다음과 같다.

| 단서 | 첫 확인 | 다음 행동 |
| :--- | :--- | :--- |
| 외부 URL parameter | 통제 HTTPS host | redirect·bridge 유지 여부 |
| `addJavascriptInterface` | interface method 목록 | main frame·iframe과 콘텐츠 신뢰 |
| `file://` | test fixture 한 건 | same-origin·read root 경계 |
| `WKScriptMessageHandler` | 무해한 message | `frameInfo`와 body schema |
| `evaluateJavaScript` | quote·newline 포함 문자열 | 코드·데이터 문맥 분리 |
| HTTP resource | 한 화면의 network log | active script·form 변조 가능성 |
| release debugging | 별도 테스트 단말 inspect | cookie·DOM·bridge 접근 범위 |

## 실습 노트

### Android · Instance·설정

jadx에서 WebView 생성부터 설정·load까지 같은 call path로 묶는다.

```bash
rg -n 'WebView|WebSettings|WebViewClient|WebChromeClient|loadUrl\(|loadDataWithBaseURL|addJavascriptInterface|postWebMessage|setWebContentsDebuggingEnabled' jadx-output/sources
```

#### 설정 묶음

```kotlin
webView.settings.apply {
    javaScriptEnabled = true
    allowFileAccess = false
    allowContentAccess = false
    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
}
```

안전 여부는 이 코드만으로 끝나지 않는다. 실제 target SDK, load URL, bridge, 사용 중인 WebView version을 기록한다. Android 11(target API 30) 이상에서 `allowFileAccess` 기본값은 `false`지만 코드가 다시 켤 수 있다.

### Android · Navigation

`shouldOverrideUrlLoading` 존재 여부보다 최초 load와 모든 navigation에서 같은 allowlist가 적용되는지가 중요하다. callback이 없더라도 고정된 신뢰 URL만 로드한다면 즉시 취약점은 아니다.

#### URL 검증 예시

```kotlin
private fun isAllowed(uri: Uri): Boolean {
    return uri.scheme == "https" &&
        uri.host == "account.example.test" &&
        uri.port == -1 &&
        uri.path?.startsWith("/app/") == true
}
```

다음을 함께 확인한다.

- `https://account.example.test.evil.test` 같은 suffix 혼동
- userinfo, 대소문자, IDN·punycode, encoded slash
- server redirect 후 최종 host
- iframe·popup·new window의 URL
- `intent:`, `market:`, `tel:`, custom scheme 처리
- external browser로 넘길 때의 사용자 확인과 민감 query

Deep Link로 URL이 들어오면 통제 HTTPS 도메인 한 개로 목적지 변경 가능성을 먼저 확인한다.

```bash
adb shell am start -W -a android.intent.action.VIEW -d 'com.example.target://web?url=https%3A%2F%2Ftest.example.invalid%2Fprobe'
```

`.invalid`는 실제 호스팅되지 않으므로 navigation 시도 확인용이다. 콘텐츠 실행을 확인해야 한다면 승인된 테스트 도메인을 사용한다.

### Android · Native Bridge

`addJavascriptInterface` 객체는 WebView의 모든 frame에 주입된다. target API 17 이상에서는 `@JavascriptInterface`가 붙은 public method만 노출되지만, origin별 호출 권한을 자동으로 제한하지 않는다.

```java
webView.addJavascriptInterface(new AppBridge(), "AppBridge");

final class AppBridge {
    @JavascriptInterface
    public String getAppVersion() {
        return BuildConfig.VERSION_NAME;
    }
}
```

#### 확인 순서

1. bridge 이름과 annotation method를 목록화한다.
2. method argument가 URL·file·account·action을 선택하는지 본다.
3. 외부 navigation과 iframe에서도 bridge가 존재하는지 확인한다.
4. 앱이 untrusted page로 이동하기 전에 `removeJavascriptInterface`를 호출하는지 본다.
5. 민감 동작이 현재 사용자 권한과 server에서 재검증되는지 확인한다.

통제 페이지에서는 method 존재와 무해한 반환만 확인한다.

```html
<!doctype html>
<meta charset="utf-8">
<pre id="result">bridge unavailable</pre>
<script>
  if (window.AppBridge?.getAppVersion) {
    document.querySelector('#result').textContent =
      `version=${window.AppBridge.getAppVersion()}`;
  }
</script>
```

WebMessage API를 사용하면 `allowedOriginRules`에 `*`나 과도한 wildcard가 있는지 확인한다. bridge 방식이 바뀌었다고 origin 검증이 자동으로 안전해지는 것은 아니다.

### Android · File·Origin

`setAllowFileAccessFromFileURLs`와 `setAllowUniversalAccessFromFileURLs`는 API 30에서 deprecated되었고 안전하지 않은 설정이다. local asset은 가능하면 `WebViewAssetLoader`의 HTTPS origin으로 제공한다.

```bash
rg -n 'setAllowFileAccess|setAllowContentAccess|setAllowFileAccessFromFileURLs|setAllowUniversalAccessFromFileURLs|WebViewAssetLoader|file://|content://' jadx-output/sources
```

#### 제한된 Fixture

테스트용 local HTML이 외부 입력으로 바뀔 수 있는 경우에만, 앱이 제공한 무해한 fixture 파일의 길이 정도로 접근 경계를 확인한다.

```javascript
fetch('file:///data/user/0/com.example.target/files/webview-fixture.txt')
  .then(response => response.text())
  .then(text => {
    document.body.textContent = `fixture-length=${text.length}`;
  })
  .catch(error => {
    document.body.textContent = `blocked=${error.name}`;
  });
```

실제 SharedPreferences·DB·token 파일을 기본 대상으로 읽거나 전송하지 않는다. 접근 성공 시 파일 범위, script 주입 경로, 외부 통신 가능성을 코드와 함께 판단한다.

### iOS · Instance·Navigation

WKWebView configuration, navigation delegate, 최초 load, popup 처리를 찾는다.

```bash
rg -n 'WKWebView|UIWebView|WKWebViewConfiguration|WKNavigationDelegate|decidePolicyFor|loadHTMLString|loadFileURL|evaluateJavaScript|isInspectable' ios-source
```

#### Navigation 판단

`decidePolicyFor`가 없다는 사실보다 외부 입력이 임의 URL을 만들 수 있는지를 본다. delegate가 있으면 다음을 확인한다.

- `navigationAction.request.url`의 scheme·host·port·path
- main frame과 subframe 구분
- redirect·popup·`createWebViewWith` 처리
- App Store·전화·custom scheme을 외부 앱으로 넘기는 범위
- authentication challenge를 별도로 우회하는 코드

`UIWebView` 발견은 deprecated 기술 후보로 기록하고 실제 참조·실행 여부를 확인한다. 취약점은 URL·script·파일·TLS 동작으로 별도 입증한다.

### iOS · Message Bridge

`WKUserContentController`에 등록한 handler 이름과 `WKScriptMessage.body` 처리 코드를 찾는다.

```swift
func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
) {
    guard message.name == "appInfo",
          message.frameInfo.isMainFrame,
          message.frameInfo.request.url?.host == "account.example.test",
          let body = message.body as? [String: String],
          body["action"] == "version" else {
        return
    }

    // 제한된 Native 동작
}
```

#### 확인 항목

- handler가 신뢰 page와 untrusted page에 동시에 등록되는지
- iframe의 message를 수락하는지
- body 강제 cast로 crash가 가능한지
- action allowlist와 argument length·type
- Keychain·파일·카메라·결제·navigation 접근
- 화면 종료 시 handler 제거와 retain 상태
- `WKContentWorld` 사용 시 page world와 격리 범위

bridge 이름을 안다는 것만으로 영향이 생기지 않는다. 비신뢰 콘텐츠에서 실제 method 호출과 제한된 결과를 연결한다.

### iOS · File·Script

`loadFileURL(_:allowingReadAccessTo:)`의 두 번째 URL이 local page가 읽을 수 있는 root다. 앱 sandbox 밖 다른 앱 데이터까지 읽는다고 단정하지 않고, 허용된 앱 내부 범위를 확인한다.

```swift
let fileURL = Bundle.main.url(
    forResource: "help",
    withExtension: "html"
)!
let readRoot = fileURL.deletingLastPathComponent()
webView.loadFileURL(fileURL, allowingReadAccessTo: readRoot)
```

`/`, container root, `Documents` 전체처럼 넓은 read root와 변경 가능한 HTML·script가 결합되는지 본다. KVC로 `allowFileAccessFromFileURLs`나 `allowUniversalAccessFromFileURLs` 같은 비공개 설정을 켠 코드도 찾는다.

#### JavaScript 문자열

```swift
let script = "renderText(" + userControlledValue + ")"
webView.evaluateJavaScript(script)
```

문자열 연결로 데이터가 JavaScript 코드 문맥에 들어가면 quote·newline·backslash 처리를 확인한다. 가능하면 `WKScriptMessageHandler`나 JSON serialization처럼 코드와 데이터를 분리한다.

### 공통 · Network·상태

Android의 `MIXED_CONTENT_ALWAYS_ALLOW`, 무조건 `SslErrorHandler.proceed()`, iOS의 `NSAllowsArbitraryLoadsInWebContent`를 정적 후보로 찾는다.

```bash
rg -n 'MIXED_CONTENT_ALWAYS_ALLOW|onReceivedSslError|handler\.proceed|NSAllowsArbitraryLoadsInWebContent|setWebContentsDebuggingEnabled|isInspectable' SOURCE
```

실제 화면에서 HTTP active content, 인증서 오류 수락, bridge 유지 여부를 확인한다. iOS WKWebView는 ATS 예외가 있어도 WebKit의 active mixed-content 정책이 별도로 동작할 수 있으므로 설정만으로 결과를 단정하지 않는다.

로그아웃 전후에 cookie, LocalStorage, IndexedDB, cache가 남는지는 [Android 데이터 저장](./data-storage-android.md)과 [iOS 데이터 저장](./data-storage-ios.md)에서 민감도와 함께 판단한다.

Release WebView debugging도 실제 inspect 가능 조건과 노출되는 DOM·cookie·bridge 범위를 확인한다. debug build 설정을 release 결함으로 옮기지 않는다.

## 결과 판정

| 확인 결과 | 판정 방향 |
| :--- | :--- |
| JavaScript 활성 | 기능 설정이며 단독 취약점 아님 |
| 외부 입력으로 임의 HTTPS URL load | navigation 경계 결함 후보 |
| 비신뢰 origin에서 민감 bridge 호출 | Native bridge 노출 확정 |
| bridge 존재·고정 신뢰 콘텐츠만 load | 콘텐츠 변조·XSS 경로 추가 확인 |
| file access 설정 활성 | local content와 script 입력 연결 전 후보 |
| fixture가 허용 root 밖에서 읽힘 | local file 경계 이탈 확인 |
| `onReceivedSslError` 무조건 진행 | WebView 인증서 검증 결함 확인 |
| mixed content 설정만 발견 | 실제 HTTP active content 확인 필요 |
| HTTP script 변조로 privileged page 변경 | network·WebView 결합 영향 확인 |
| `UIWebView` 문자열만 발견 | 실제 실행 여부 확인 전 유지보수 후보 |
| 넓은 iOS read root·고정 trusted HTML | 변경 가능성과 민감 파일 범위 확인 |
| release inspect 가능 | 접근 조건과 실제 민감 데이터 노출 확인 |
| logout 뒤 민감 WebStorage 유지 | 재접근 조건과 token 유효성 확인 |

영향은 콘텐츠를 제어할 수 있는 주체, 필요한 사용자 동작, bridge method 권한, 읽을 수 있는 데이터, 서버 재검증을 기준으로 정한다. WebView라는 이유만으로 일반 XSS보다 항상 높은 심각도를 부여하지 않는다.

## 증적 항목

- 앱 hash, 버전, build type, OS·WebView version
- WebView instance를 만든 class와 화면
- 최초 URL·effective origin·최종 redirect host
- 입력 출처와 allowlist 코드
- JavaScript·file·content·mixed-content 설정
- bridge·handler 이름, method, frame·origin, argument schema
- local read root와 사용한 fixture
- TLS 오류·HTTP resource·proxy 상태
- release debugging 재현 조건
- 로그인 전후 cookie·WebStorage 상태
- 마스킹한 network request·DOM·console 결과
- 확정·후보·보류와 영향 상승 조건

## 트러블슈팅

#### WebView 화면 식별 실패

- SDK·hybrid framework가 wrapper를 사용하는지 확인한다.
- runtime class와 URL load API를 hook해 instance를 찾는다.
- Custom Tabs·SFSafariViewController를 WebView로 오인하지 않는다.

#### 외부 URL Load 실패

- Deep Link parameter가 실제 URL까지 전달되는지 확인한다.
- allowlist, DNS, ATS·NSC, certificate, redirect를 분리한다.
- `.invalid`는 navigation 시도만 보고 실제 콘텐츠 검증에는 통제 서버를 사용한다.

#### Android Bridge 미노출

- JavaScript 활성화 시점과 page reload 여부를 확인한다.
- interface 이름, annotation, target SDK를 확인한다.
- bridge가 특정 route에서만 등록되거나 navigation 전에 제거되는지 본다.

#### iOS Handler 무응답

- handler name, content world, frame, configuration instance를 맞춘다.
- 같은 WKWebView가 아니라 새 instance가 생성됐는지 확인한다.
- body type mismatch와 delegate lifecycle을 확인한다.

#### Local File 접근 실패

- page origin, target URL, Android settings, iOS read root를 맞춘다.
- file access와 network universal access를 구분한다.
- 접근 차단 결과 자체를 취약점 없음으로 일반화하지 않는다.

#### Proxy 트래픽 누락

- QUIC, custom network stack, WebView process, VPN 경로를 확인한다.
- WebView와 native API client의 CA trust·Pinning 차이를 구분한다.

#### Release Inspect 실패

- Android WebView debugging flag와 app debuggable 상태를 확인한다.
- iOS `isInspectable` 적용 version과 대상 WKWebView instance를 확인한다.
- 단말 연결·신뢰·개발자 모드 문제를 앱 결함과 구분한다.

## 빠른 명령어 참조

본문과 같은 검색을 반복하지 않고 runtime 확인 명령만 모았다.

| 목적 | 명령 | 확인할 항목 |
| :--- | :--- | :--- |
| Android WebView package | `adb shell dumpsys webviewupdate` | provider package·version |
| Android Chrome inspect | `chrome://inspect/#devices` | release WebView 노출 여부 |
| WebView process | `adb shell "ps -A -o PID,NAME | grep com.example.target"` | sandboxed renderer process |
| Android network log | `adb logcat -s chromium cr_WebViewClient` | navigation·console 오류 |
| iOS WebKit log | `log stream --predicate 'subsystem CONTAINS "WebKit"'` | navigation·process 오류 |

## 관련 문서

- [Deep Link·Intent](./deeplink-intent.md)
- [인증서 검증·평문 통신](./certificate-validation.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)
- [Android 데이터 저장](./data-storage-android.md)
- [iOS 데이터 저장](./data-storage-ios.md)
- [정적 분석](./static-analysis.md)

## 참고자료

#### 공식 문서

- [Android Developers - WebView Native Bridges](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)
- [Android Developers - Unsafe File Inclusion](https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion)
- [Android Developers - WebSettings](https://developer.android.com/reference/android/webkit/WebSettings)
- [Android Developers - WebView](https://developer.android.com/reference/android/webkit/WebView)
- [Apple Developer - WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)
- [Apple Developer - WKScriptMessage](https://developer.apple.com/documentation/webkit/wkscriptmessage)

#### 점검 가이드

- [OWASP MASTG - Android WebViews](https://mas.owasp.org/MASTG/knowledge/android/MASVS-PLATFORM/MASTG-KNOW-0018/)
- [OWASP MASTG - iOS WebViews](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-PLATFORM/MASTG-KNOW-0076/)
- [OWASP MASTG - Validate WebView Input](https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0034/)
- [OWASP MASTG - iOS File Origin Access](https://mas.owasp.org/MASTG/tests/ios/MASVS-PLATFORM/MASTG-TEST-0335/)
