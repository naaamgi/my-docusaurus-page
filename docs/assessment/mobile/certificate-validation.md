---
sidebar_position: 13
title: 인증서 검증·평문 통신
description: Android와 iOS 앱의 평문 통신, 인증서 체인·호스트명 검증, TLS 협상 결과를 실제 전송 경로와 함께 확인하는 실무 노트
keywords: [Cleartext, HTTP, TLS, Certificate Validation, TrustManager, HostnameVerifier, ATS, Network Security Config, MASVS-NETWORK]
toc_max_heading_level: 3
draft: false
---

> 앱이 데이터를 암호화해서 보내는지, 접속한 서버의 인증서와 호스트명을 올바르게 검증하는지 확인한다. 정적 설정은 가능성을 찾는 자료이고, 최종 판단은 릴리스 빌드의 실제 통신 결과를 기준으로 한다.

## 사용 시점

- 로그인, 회원정보, 결제처럼 민감한 기능의 전송 경로를 확인할 때
- 프록시 연결이 되거나 되지 않는 원인을 인증서 검증 단계별로 나눌 때
- APK·IPA에서 평문 허용 설정이나 사용자 정의 TLS 코드를 발견했을 때
- API, WebView, 광고·분석 SDK, 파일 다운로드처럼 통신 주체가 여러 개일 때
- 고객사 API의 TLS 설정과 모바일 앱의 동작을 구분해야 할 때

SSL Pinning은 정상적인 인증서 검증 위에 추가하는 보호다. Pinning이 없다는 사실만으로 이 문서의 취약점이 되지는 않는다. Pinning 적용 범위와 우회 실습은 [SSL Pinning 우회](./ssl-pinning-bypass.md)에서 다룬다.

허가받은 앱, 계정, 단말, 엔드포인트에서만 진행한다. 운영 트래픽을 캡처해야 한다면 테스트 시간과 기능을 좁히고, 패킷 파일에 다른 앱의 통신이나 개인정보가 섞이지 않도록 관리한다.

## 분석 기준

분석 전에 환경을 기록한다. 같은 앱도 빌드 종류, OS 버전, 인증서 설치 상태에 따라 결과가 달라진다.

| 구분 | 기록할 내용 |
| :--- | :--- |
| 앱 | 패키지·Bundle ID, 버전, 빌드 번호, 파일 해시, release/debug 여부 |
| 단말 | Android API·`targetSdkVersion`, iOS 버전, 루팅·탈옥 여부 |
| 프록시 | 주소, 포트, 시스템·사용자 CA 설치 여부, 앱별 프록시 적용 여부 |
| 대상 | 기능, 요청 호스트, 포트, API·WebView·SDK 구분 |
| 통신 구현 | URLSession, Network.framework, OkHttp, WebView, Cronet, Flutter, native OpenSSL 등 |
| 보호 방식 | 기본 PKI, 사용자 CA 신뢰, Pinning, mTLS, 별도 서명·암호화 |
| 검증 상태 | 우회 도구·Frida 스크립트 적용 여부, 테스트 인증서 종류 |

다음 결과는 서로 다른 의미를 갖는다.

| 관찰 결과 | 기본 해석 |
| :--- | :--- |
| 신뢰한 Burp CA로 HTTPS 확인 | 일반적인 인증서 신뢰 동작일 수 있음 |
| 신뢰하지 않은 CA의 인증서 수락 | 인증서 체인 검증 결함 후보 |
| 다른 호스트명의 인증서 수락 | 호스트명 검증 결함 후보 |
| Frida 우회 후 HTTPS 확인 | 우회가 적용된 테스트 결과이며 원래 앱의 결함 증거는 아님 |
| `http://` 문자열·허용 설정 발견 | 평문 통신 가능성이 있는 정적 후보 |
| 민감 데이터의 HTTP 전송 재현 | 평문 정보 노출 확인 |
| 서버의 TLS 1.0 지원 | 서버 설정 후보이며 앱이 실제 협상했는지는 별도 확인 |

## 검증 계층

통신 보안은 한 항목으로 묶지 않고 다음 계층으로 확인한다.

| 계층 | 확인 질문 | 대표 결함 |
| :--- | :--- | :--- |
| 전송 암호화 | 데이터가 처음부터 TLS로 전송되는가 | HTTP, `ws://`, 평문 커스텀 소켓 |
| 인증서 체인 | 인증서가 신뢰 가능한 루트까지 연결되는가 | Trust-all, 검증 없는 custom TLS |
| 유효 기간 | 인증서가 현재 시점에 유효한가 | 만료·유효 전 인증서 수락 |
| 호스트명 | 요청 호스트가 인증서 SAN과 일치하는가 | Always-true HostnameVerifier |
| TLS 정책 | 실제 협상된 버전과 cipher가 적절한가 | TLS 1.0·1.1, 약한 cipher 협상 |
| 추가 보호 | 지정 인증서·키로 연결을 제한하는가 | Pinning 범위 누락·우회 가능성 |

인증서 체인이 정상이어도 호스트명이 다르면 연결을 거부해야 한다. 반대로 호스트명이 같아도 신뢰되지 않은 루트로 발급된 인증서는 거부해야 한다. 두 검증을 하나의 프록시 성공 여부로 판단하지 않는다.

## 진단 절차

1. 앱의 주요 기능과 호스트를 매핑하고 직접 연결 상태의 기준 트래픽을 남긴다.
2. APK·IPA에서 평문 허용 정책, 예외 도메인, 사용자 정의 검증 코드를 찾는다.
3. 프록시와 CA 상태를 바꿔 인증서 체인 검증과 Pinning을 구분한다.
4. 통제된 테스트 서버에서 호스트명·유효 기간 실패가 거부되는지 확인한다.
5. 평문 HTTP, redirect, WebSocket, 파일 다운로드를 실제 동작으로 확인한다.
6. 캡처에서 실제 협상된 TLS와 요청 주체를 확인한다.
7. 설정, 코드, 동적 결과를 연결해 앱·SDK·서버 중 책임 범위를 정리한다.

인증서 테스트는 다음 순서로 진행하면 상태 혼동을 줄일 수 있다.

| 순서 | 프록시·인증서 상태 | 기대 결과 | 확인 목적 |
| :---: | :--- | :--- | :--- |
| A | 프록시 없음 | 기능 정상 | 네트워크·계정 기준선 |
| B | 프록시 사용, Burp CA 신뢰 | 기본 PKI 앱은 연결 가능 | 캡처 가능 여부와 Pinning 경계 |
| C | 프록시 사용, Burp CA 미신뢰 | 연결 실패 | 인증서 체인 검증 |
| D | 통제 서버의 다른 호스트명 인증서 | 연결 실패 | 호스트명 검증 |
| E | 통제 서버의 만료·유효 전 인증서 | 연결 실패 | 유효 기간 검증 |

C~E는 고객사 테스트 엔드포인트나 직접 통제하는 서버에서 수행한다. 공개 테스트 사이트는 앱의 실제 API 흐름과 다르고 제3자 트래픽을 만들기 때문에 기본 절차로 사용하지 않는다.

## 실습 노트

### 트래픽·호스트 맵

먼저 기능 단위로 통신 주체를 나눈다. 로그인 API만 보면 이미지 CDN, WebView, 원격 설정, 업데이트, 분석 SDK의 평문 통신을 놓칠 수 있다.

| 기능 | 예상 호스트 | 구현 | 확인할 데이터 |
| :--- | :--- | :--- | :--- |
| 로그인 | `api.example.test` | OkHttp·URLSession | 계정, 토큰, 세션 |
| 공지 | `notice.example.test` | WebView | cookie, redirect, mixed content |
| 파일 | `download.example.test` | native downloader | URL, 서명·hash, 저장 위치 |
| 분석 | SDK vendor host | third-party SDK | 기기 식별자, 사용자 속성 |

#### 기준 트래픽 수집

1. 프록시와 우회 도구를 끈다.
2. 앱을 새로 실행하고 한 기능만 수행한다.
3. DNS, 목적지 IP, 포트, 실패 메시지와 시간을 기록한다.
4. 동일한 기능을 프록시 환경에서 반복한다.

루팅 Android 단말에서 짧은 구간만 캡처할 때는 패킷 수를 제한한다.

```bash
adb shell su -c 'tcpdump -i any -s 0 -c 500 -w /data/local/tmp/target.pcap'
adb pull /data/local/tmp/target.pcap ./target.pcap
```

`tcpdump`가 없는 단말에서는 PC 핫스팟·게이트웨이에서 Wireshark를 사용한다. 캡처 파일에는 다른 앱의 트래픽이 포함될 수 있으므로 테스트 직전에 시작하고 종료 후 보관 범위를 정리한다.

Wireshark 표시 필터는 HTTP와 TLS의 존재를 함께 보는 용도다.

```text
http || tls || tcp.port == 80 || udp.port == 443
```

`udp.port == 443`은 HTTP/3·QUIC 후보를 찾는 조건이며, UDP 443이라는 이유만으로 결함으로 판단하지 않는다.

### Android · Cleartext 정책

Android에서는 Manifest와 Network Security Configuration(NSC)을 함께 확인한다.

#### Manifest·NSC 위치

```bash
apkanalyzer manifest print app-release.apk
rg -n 'usesCleartextTraffic|networkSecurityConfig|cleartextTrafficPermitted|certificates src=' unpacked/
```

`android:networkSecurityConfig`가 가리키는 XML에서 전역 설정과 도메인 예외의 상속 관계를 확인한다.

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">legacy.example.test</domain>
    </domain-config>
</network-security-config>
```

이 예시는 전역 평문을 차단하고 특정 호스트만 허용한다. 예외 설정은 취약점 확정이 아니라 실제 HTTP 사용 여부를 확인할 단서다.

- `usesCleartextTraffic`의 기본값은 target SDK에 따라 달라진다. Android 공식 문서 기준 target API 27 이하는 `true`, 28 이상은 `false`가 기본이다.
- Network Security Configuration을 사용하는 앱에서는 플랫폼·target API에 따라 Manifest 속성보다 NSC가 우선한다.
- Android 공식 문서는 target API 38 이상에서 `usesCleartextTraffic` 속성 대신 NSC 사용을 안내한다.
- 플랫폼 네트워크 구성 요소가 정책을 지켜도 raw Socket이나 일부 크로스플랫폼·native 라이브러리는 별도 동작을 할 수 있다.

#### CA 신뢰 범위

```xml
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>
```

`debug-overrides`는 `android:debuggable=true`일 때만 적용되고 release에서는 무시된다. 따라서 디버그 전용 사용자 CA 신뢰를 release 결함으로 판정하지 않는다.

반면 `<base-config>`나 `<domain-config>`의 `<certificates src="user">`는 해당 범위에서 사용자가 설치한 CA를 신뢰하도록 넓힌 설정이다. 기업 단말·사내 프록시 같은 요구사항, 적용 빌드, 대상 도메인, 실제 중간자 캡처 결과를 함께 확인한다. 설정 하나만으로 자동 판정하지 않는다.

### iOS · ATS

App Transport Security(ATS)는 URL Loading System을 사용하는 통신에 안전한 기본 정책을 적용한다. `Info.plist`에서 전역 예외와 도메인 예외를 찾는다.

#### Info.plist 확인

```bash
plutil -p Payload/Target.app/Info.plist
rg -n 'NSAppTransportSecurity|NSAllowsArbitraryLoads|NSExceptionDomains|NSExceptionAllowsInsecureHTTPLoads|NSExceptionMinimumTLSVersion' Payload/
```

Windows에서는 바이너리 plist를 XML로 변환할 수 있는 도구를 준비한 뒤 동일한 키를 검색한다.

```powershell
plistutil -i .\Payload\Target.app\Info.plist -o .\Info.xml
Select-String -Path .\Info.xml -Pattern 'NSAppTransportSecurity|NSAllowsArbitraryLoads|NSExceptionDomains'
```

주요 후보는 다음과 같다.

| 키 | 확인 내용 |
| :--- | :--- |
| `NSAllowsArbitraryLoads` | URL Loading System의 전역 ATS 예외 여부 |
| `NSExceptionDomains` | 예외 호스트와 하위 도메인 포함 범위 |
| `NSExceptionAllowsInsecureHTTPLoads` | 특정 도메인의 HTTP 허용 여부 |
| `NSExceptionMinimumTLSVersion` | 낮춘 최소 TLS 버전과 호환성 사유 |
| `NSAllowsArbitraryLoadsInWebContent` | WebView 콘텐츠 범위의 예외 여부 |
| `NSAllowsLocalNetworking` | 로컬 장치 통신 요구와 대상 주소 범위 |

ATS 예외도 정적 후보로 취급한다. 로컬 장치 검색·제어처럼 합리적인 사용 사례가 있을 수 있으며, 실제 호스트와 전송 데이터가 판단의 중심이다. Network.framework, CFNetwork의 별도 사용 방식, embedded TLS stack은 ATS 키만으로 동작을 단정하지 않는다.

### 인증서 Chain

인증서 체인 검증은 서버 인증서가 신뢰 가능한 루트까지 이어지는지, 유효 기간과 정책을 만족하는지 확인하는 과정이다.

#### Android 코드 후보

```java
TrustManager[] trustAll = new TrustManager[] {
    new X509TrustManager() {
        public void checkClientTrusted(X509Certificate[] chain, String authType) {}
        public void checkServerTrusted(X509Certificate[] chain, String authType) {}
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }
};
```

빈 `checkServerTrusted`는 인증서 경로를 검증하지 않는 대표 후보다. 실제 호출 경로, build flavor, 적용 호스트를 따라가고 CA 미신뢰 조건에서 연결 성공을 재현한다.

#### iOS 코드 후보

```swift
func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
) {
    completionHandler(.useCredential, URLCredential(trust: challenge.protectionSpace.serverTrust!))
}
```

모든 challenge에 검증 없이 `.useCredential`을 반환하면 기본 서버 신뢰 평가를 우회할 수 있다. challenge의 인증 방식과 호스트를 제한하고, `SecTrustEvaluateWithError` 같은 플랫폼 신뢰 평가 결과를 확인하는지 본다. 특별한 요구가 없다면 기본 처리에 맡기는 편이 안전하다.

#### 실패 조건 분리

- 알 수 없는 루트 또는 자체 서명 인증서
- 중간 인증서 누락 등 불완전한 체인
- 만료되었거나 아직 유효하지 않은 인증서
- 인증서 용도·정책이 서버 인증과 맞지 않는 경우

모바일 플랫폼의 폐지 확인(revocation) 동작은 네트워크 상태와 API에 따라 달라질 수 있다. OCSP 응답이 없다는 사실만으로 앱 결함을 단정하지 않는다.

### Hostname 검증

호스트명 검증은 요청한 호스트가 인증서의 Subject Alternative Name(SAN)과 일치하는지 확인한다. 신뢰 가능한 CA가 발급한 인증서라도 다른 호스트용이면 거부해야 한다.

#### Android 코드 후보

```java
HostnameVerifier verifier = (hostname, session) -> true;
HttpsURLConnection.setDefaultHostnameVerifier(verifier);
```

항상 `true`를 반환하는 구현과 `ALLOW_ALL_HOSTNAME_VERIFIER`를 찾는다. `SSLSession.isValid()`는 세션 유효 상태를 나타낼 뿐 호스트명 검증을 대신하지 않는다.

#### 동적 확인

1. 통제한 테스트 호스트에 다른 SAN의 인증서를 제시한다.
2. 정상 CA 체인 여부와 호스트명 불일치 조건을 따로 기록한다.
3. 앱이 연결을 거부하는지와 사용자에게 재시도·무시 선택을 제공하는지 확인한다.
4. 성공하면 해당 요청을 만든 코드와 적용 범위를 찾는다.

iOS에서 수동 trust를 처리한다면 challenge의 `host`, 인증 방식, `serverTrust`를 함께 제한하는지 확인한다. 인증서 체인만 평가하고 요청 호스트 정책을 빠뜨리지 않도록 본다.

### Custom stack·WebView

API 통신과 WebView·SDK 통신이 서로 다른 TLS 구현을 사용할 수 있다.

| 구현 | 확인 지점 |
| :--- | :--- |
| OkHttp | `sslSocketFactory`, `trustManager`, `hostnameVerifier`, `CertificatePinner` |
| WebView | `onReceivedSslError`, `SslErrorHandler.proceed()`, mixed content |
| Cronet | public key pin 설정, QUIC, proxy 적용 여부 |
| Flutter·React Native | Dart·JavaScript 계층과 native plugin의 실제 socket 구현 |
| native OpenSSL | `SSL_CTX_set_verify`, verify callback, bundled CA store |
| third-party SDK | 별도 세션·인증서 저장소와 초기화 옵션 |

WebView의 다음 구현은 인증서 오류를 모두 무시하는 대표 후보다.

```java
@Override
public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
    handler.proceed();
}
```

실제 WebView 화면에서 CA 미신뢰·호스트명 불일치 조건을 각각 재현한다. 상세 WebView 설정은 [WebView 보안](./webview-issues.md)과 연결한다.

### TLS·mTLS·QUIC

프록시에 요청이 보이지 않는다고 바로 Pinning으로 결론 내리지 않는다.

- HTTP/3·QUIC로 UDP 443을 사용하는 경우
- 클라이언트 인증서가 필요한 mTLS인 경우
- 프록시 설정을 사용하지 않는 native·custom socket인 경우
- VPN, 사설 DNS, IPv6, 별도 네트워크 인터페이스를 사용하는 경우
- 앱이 프록시·루팅·디버깅 상태를 감지한 경우

#### TLS 협상 확인

앱 캡처나 프록시의 연결 정보에서 실제 협상된 TLS 버전과 cipher를 기록한다. 엔드포인트를 직접 확인할 때는 SNI를 지정하고 고객사에서 허가한 호스트에만 연결한다.

```bash
openssl s_client -connect api.example.test:443 -servername api.example.test -tls1_2 -brief
```

서버가 오래된 TLS를 지원한다는 결과와 앱이 해당 버전을 실제로 협상한 결과는 다르다. 서버 설정 이슈는 엔드포인트 범위로, 앱이 약한 프로토콜을 강제·허용한 이슈는 호출 코드와 협상 증거를 함께 남긴다. 일반적인 인터넷 API는 TLS 1.2 이상을 기준으로 보고 가능하면 TLS 1.3을 사용한다.

mTLS 연결 실패는 서버 인증서 검증 실패와 구분한다. client certificate 요청, 키체인·KeyStore 접근, 인증서 선택 로그를 함께 본다.

### Redirect·다운로드

HTTPS로 redirect되더라도 최초 요청이 HTTP면 URL, query, header가 평문으로 노출될 수 있다. 앱이 처음부터 HTTPS URL을 사용하는지 확인한다.

#### 확인 대상

- 로그인 전후 API와 딥링크 처리 과정의 HTTP redirect
- `ws://` WebSocket과 평문 MQTT·custom TCP
- 이미지·동영상·WebView의 mixed content
- 원격 설정, 플러그인, 모델, 앱 업데이트 파일 다운로드
- 분석·광고 SDK의 식별자와 사용자 속성

파일이 HTTP로 내려와도 영향은 내용과 후속 검증에 따라 달라진다. 실행·설정에 사용되는 파일이라면 전자서명, 신뢰된 hash, 적용 전 검증 여부를 [앱 변조](./app-tampering.md)와 함께 확인한다. 공개 이미지와 인증 토큰을 같은 수준으로 분류하지 않는다.

## 결과 판정

설정과 동적 결과를 분리하고, 실제 데이터와 공격 조건을 기준으로 판단한다.

| 확인 결과 | 판정 방향 |
| :--- | :--- |
| 민감 데이터의 HTTP·평문 소켓 전송 재현 | 평문 정보 노출 확인 |
| HTTP URL·허용 설정만 존재 | 동적 확인이 필요한 후보 |
| HTTP에서 HTTPS로 redirect | 최초 요청의 데이터 노출 여부 확인 |
| CA 미신뢰 상태의 프록시 인증서 수락 | 인증서 체인 검증 결함 확인 |
| 다른 SAN의 인증서 수락 | 호스트명 검증 결함 확인 |
| 신뢰한 Burp CA로 캡처 성공 | 정상 PKI 동작일 수 있으며 단독 취약점 아님 |
| Pinning 미적용 | 기본 인증서 검증이 정상이면 이 항목의 취약점 아님 |
| debug 전용 사용자 CA 신뢰 | release에 적용되지 않으면 일반적으로 제외 |
| release의 사용자 CA 신뢰 확대 | 요구사항·도메인 범위·실제 재현을 확인할 후보 |
| 서버의 TLS 1.0·1.1 지원 | 서버 설정 후보, 앱의 실제 협상과 분리 |
| 앱의 약한 TLS 협상 재현 | 앱 설정과 서버 설정의 공동 증거 필요 |
| 공개 정적 리소스의 HTTP 전송 | 기밀성·무결성·주입 가능성에 따라 영향 산정 |

심각도는 `High` 같은 고정값으로 시작하지 않는다. 전송 데이터의 민감도, 동일 네트워크·악성 AP 등 필요한 공격 위치, 인증 여부, 변조가 후속 기능에 미치는 영향을 연결한다.

## 증적 항목

- 앱 파일 해시, 버전, build flavor, package·Bundle ID
- OS 버전, Android API·target SDK, 단말 상태
- 프록시와 VPN 상태, CA 설치 위치와 신뢰 여부
- 우회 도구·Frida 스크립트 적용 여부
- 기능, 요청 시각, host·port·protocol, 통신 구현 주체
- 인증서 Subject, Issuer, SAN, serial, fingerprint, 유효 기간
- 제시한 테스트 인증서 종류와 기대 실패 조건
- 앱 화면 오류, logcat·Console 로그, 예외 stack trace
- 실제 협상 TLS 버전과 cipher, HTTP/2·HTTP/3 여부
- 마스킹한 요청·응답 또는 필요한 구간만 남긴 패킷
- 설정 파일 경로, 관련 코드 호출부, 적용 도메인
- 앱·SDK·서버 중 원인과 조치 주체

토큰, cookie, 계정, 개인정보는 증적에 그대로 남기지 않는다. 재현에 필요하지 않은 body와 다른 앱의 패킷은 제외한다.

## 트러블슈팅

#### 프록시의 무응답

- 직접 연결 기준선에서 DNS와 API 기능이 정상인지 확인한다.
- UDP 443, IPv6, VPN, native socket 등 프록시 밖 경로를 확인한다.
- Pinning, mTLS, 프록시 탐지, 인증 실패를 로그로 구분한다.

#### 브라우저와 앱의 결과 차이

- 브라우저와 앱은 CA 저장소·proxy·TLS stack이 다를 수 있다.
- 동일 host와 인증서를 사용했는지 확인한다.
- 앱 내 WebView와 외부 브라우저 결과도 분리한다.

#### CA 설치 후 연결 실패

- Android의 target SDK와 NSC trust anchor를 확인한다.
- iOS에서 인증서 설치와 전체 신뢰 설정을 구분한다.
- Pinning이나 bundled CA store 사용 여부를 확인한다.

#### 미신뢰 인증서 수락

- 프록시 CA가 다른 저장소에 이미 신뢰되어 있지 않은지 확인한다.
- Frida·Objection·재패키징된 네트워크 설정이 남아 있지 않은지 확인한다.
- 재현 후 TrustManager·URLSession delegate의 실제 호출 경로를 찾는다.

#### 패킷의 앱 식별

- 한 기능과 짧은 시간 구간으로 캡처를 제한한다.
- DNS 시각, 목적지 IP, 앱 로그의 request ID를 맞춘다.
- CDN 공유 IP만으로 앱 트래픽을 단정하지 않는다.

#### HTTP/3 트래픽

- UDP 443을 확인하고 테스트 환경에서 QUIC 비활성화 가능 여부를 검토한다.
- TCP fallback 결과와 실제 운영 기본 경로를 구분한다.
- QUIC을 볼 수 있는 캡처·키 로그 환경이 없다면 관찰 한계를 기록한다.

#### TLS 결과 불일치

- `openssl` 결과는 직접 연결한 client profile이고 앱의 협상 결과가 아니다.
- SNI, CDN edge, IPv4·IPv6, 프록시 TLS 종료 위치를 맞춘다.
- 서버 지원 버전과 앱 사용 버전을 별도 증적으로 남긴다.

#### 설정과 동작의 불일치

- 분석한 APK·IPA와 설치된 앱 버전·flavor가 같은지 확인한다.
- NSC 도메인 상속과 ATS 예외 범위를 다시 확인한다.
- custom stack이나 third-party SDK가 플랫폼 정책을 우회하는지 본다.

## 빠른 명령어 참조

본문과 같은 명령을 반복하지 않고, 후속 확인에 자주 쓰는 명령만 모았다.

| 목적 | 명령·필터 | 결과에서 볼 항목 |
| :--- | :--- | :--- |
| APK target SDK | `apkanalyzer manifest target-sdk app-release.apk` | 기본 cleartext 정책 해석 기준 |
| 인증서 목록 | `keytool -printcert -jarfile app-release.apk` | APK 서명 인증서이며 서버 TLS 인증서와 혼동 금지 |
| 원격 인증서 | `openssl s_client -connect HOST:443 -servername HOST -showcerts` | chain, SAN, issuer, verify return code |
| HTTP 흔적 | `rg -n 'http://|ws://' SOURCE_DIR` | 실제 호출부, 상수, sample·test 코드 구분 |
| Android 로그 | `adb logcat -v threadtime` | SSLHandshakeException, CertPathValidatorException, host |
| Wireshark HTTP | `http.request || tcp.port == 80` | 요청 URL, header, body의 민감 정보 |
| Wireshark TLS | `tls.handshake || quic` | SNI, 인증서, TLS 버전, QUIC 여부 |

서버 전체 cipher 열거 도구는 승인된 엔드포인트와 점검 시간에만 사용한다. 결과를 앱 결함으로 그대로 옮기지 말고 앱이 실제로 협상한 값과 구분한다.

## 관련 문서

- [Android 분석 환경](./setup-android.md)
- [iOS 분석 환경](./setup-ios.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)
- [WebView 보안](./webview-issues.md)
- [앱 변조](./app-tampering.md)
- [개인정보 노출](./privacy-leakage.md)

## 참고자료

#### 공식 문서

- [Android Developers - Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Android Developers - application element (`usesCleartextTraffic`)](https://developer.android.com/guide/topics/manifest/application-element.html)
- [Android Developers - Unsafe TrustManager](https://developer.android.com/privacy-and-security/risks/unsafe-trustmanager)
- [Android Developers - Unsafe HostnameVerifier](https://developer.android.com/privacy-and-security/risks/unsafe-hostname)
- [Apple Developer - App Transport Security](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity)
- [Apple Developer - Preventing Insecure Network Connections](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)
- [Apple Developer - Performing Manual Server Trust Authentication](https://developer.apple.com/documentation/foundation/performing-manual-server-trust-authentication)

#### 점검 가이드

- [OWASP MASVS-NETWORK](https://mas.owasp.org/MASVS/08-MASVS-NETWORK/)
- [OWASP MASTG - Testing for Cleartext Traffic](https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0236/)
- [OWASP MASTG - Testing for Cleartext Traffic on iOS](https://mas.owasp.org/MASTG/tests/ios/MASVS-NETWORK/MASTG-TEST-0322/)
- [OWASP MASWE-0052 - Insecure Certificate Validation](https://mas.owasp.org/MASWE/MASVS-NETWORK/MASWE-0052/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

#### 관련 도구

- [Wireshark Documentation](https://www.wireshark.org/docs/)
- [OpenSSL s_client](https://docs.openssl.org/master/man1/openssl-s_client/)
- [Burp Proxy Documentation](https://portswigger.net/burp/documentation/desktop/tools/proxy)
- [testssl.sh](https://testssl.sh/)
