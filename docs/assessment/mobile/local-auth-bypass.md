---
sidebar_position: 18
title: 로컬·생체 인증
description: Android BiometricPrompt·Keystore와 iOS LocalAuthentication·Keychain의 로컬 인증 보호 경계를 확인하는 실무 노트
keywords: [BiometricPrompt, LocalAuthentication, CryptoObject, Android Keystore, iOS Keychain, Face ID, Touch ID, MASVS-AUTH]
toc_max_heading_level: 3
draft: false
---

> 생체 인증 화면을 띄웠다는 사실보다 **성공 이벤트 뒤에서 무엇이 실제로 보호되는지** 확인한다. 화면 전환만 막는 구조와 키 사용을 잠그는 구조는 판정이 다르다.

## 사용 시점

- 앱 실행, 민감 화면 진입, 저장된 계정 해제에 지문·Face ID를 요구할 때
- 결제·이체·개인정보 변경 전에 로컬 재인증을 수행할 때
- 서버 인증과 별개로 단말 안의 토큰·비밀정보를 보호한다고 설명할 때
- 생체 정보 추가, 잠금 방식 변경, 백그라운드 복귀 후 동작을 확인할 때

로컬 인증은 주로 분실·도난·공유 단말과 런타임 변조 환경을 다룬다. 다만 우회 후 기존 서버 세션으로 민감 API를 호출할 수 있다면 영향 범위는 단말 화면에만 머물지 않는다.

## 분석 기준

먼저 보호하려는 자산과 인증 경계를 연결한다.

| 확인 대상 | 핵심 질문 |
| --- | --- |
| 서버 인증 | 서버가 자격 증명·토큰을 새로 검증하는가 |
| 이벤트 기반(Event-bound) | 성공 콜백만으로 화면이나 기능이 열리는가 |
| 키 기반(Key-bound) | 인증된 상태에서만 Keystore·Keychain 키를 사용할 수 있는가 |
| Fallback | 생체 실패 후 단말 암호나 앱 비밀번호를 허용하는가 |
| 재사용 | 인증 결과나 키 사용 권한이 얼마 동안 유지되는가 |

`CryptoObject`가 없다는 이유만으로 곧바로 취약한 것은 아니다. 낮은 민감도의 편의 기능일 수 있다. 반대로 `CryptoObject`가 보여도 반환된 암호 객체를 실제 복호화·서명에 사용하지 않으면 키 기반 보호로 볼 수 없다.

## 보호 모델

이벤트 기반 구현은 `onAuthenticationSucceeded`나 `evaluatePolicy` 결과를 앱 로직이 소비한다. 런타임에서 이 결과를 바꾸면 UI 게이트는 열릴 수 있다.

키 기반 구현은 인증과 암호 연산을 연결한다. Android에서는 사용자 인증이 필요한 Keystore 키와 `CryptoObject`를 함께 사용하고, iOS에서는 Keychain 항목에 `SecAccessControl` 정책을 설정한다. 여기서도 다음 조건을 함께 확인한다.

- 키가 플랫폼 보안 저장소에서 생성·관리되는지
- 인증 필요 속성과 허용 인증 수단이 의도와 일치하는지
- 성공 후 전달된 암호 객체로 최종 연산을 수행하는지
- 평문·캐시·별도 API 같은 우회 경로가 없는지
- 등록 변경과 단말 암호 Fallback이 서비스 정책과 일치하는지

## 진단 절차

1. 보호 화면, 데이터, API와 기대 재인증 시점을 기록한다.
2. 정상 성공·실패·취소·Fallback 흐름을 각각 실행한다.
3. 정적 분석으로 프롬프트, 키 생성, Keychain 접근 코드를 연결한다.
4. 런타임에서 인증 호출과 앱의 성공 처리 지점을 관찰한다.
5. 허가된 테스트 환경에서 이벤트 결과를 변조하고 실제 자산 접근까지 확인한다.
6. 백그라운드, 프로세스 재시작, 인증 유효 시간, 생체 등록 변경을 확인한다.
7. UI 변화가 아니라 데이터 복호화·민감 API 실행 결과로 판정한다.

생체 등록을 변경하는 시험은 전용 단말에서만 수행한다. 기존 키가 무효화되면 복구 절차가 필요할 수 있으므로 테스트 계정과 복원 방법을 먼저 준비한다.

## 실습 노트

### Android · Prompt

디컴파일 결과에서 신형·구형 API와 앱 자체 콜백 구현을 찾는다.

```bash
rg -n "BiometricPrompt|FingerprintManager|AuthenticationCallback|setAllowedAuthenticators" jadx-output/sources
```

`setAllowedAuthenticators`의 `BIOMETRIC_STRONG`, `BIOMETRIC_WEAK`, `DEVICE_CREDENTIAL` 조합을 기록한다. 낮은 위험의 편의 잠금은 약한 생체를 허용할 수 있지만, 키 사용이나 고위험 재인증은 더 강한 인증 등급이 기대된다.

런타임에서는 먼저 호출 흐름만 관찰한다. 프레임워크 내부 필드명에 의존해 성공 콜백을 임의 생성하는 범용 스크립트는 AndroidX 버전에 따라 쉽게 깨진다. 앱이 구현한 `AuthenticationCallback` 하위 클래스와 성공 후 호출되는 메서드를 찾은 뒤 그 지점을 시험한다.

```bash
frida-trace -U -f com.example.app -j '*!*Authentication*' -j '*!*Biometric*'
```

### Android · CryptoObject

키 생성과 프롬프트 호출이 한 흐름에 있는지 확인한다.

```bash
rg -n "CryptoObject|setUserAuthenticationRequired|setUserAuthenticationParameters|Cipher\.init|Signature\.initSign" jadx-output/sources
```

인증 1회당 키 사용을 요구하는 구현의 핵심 형태는 다음과 같다.

```kotlin
val spec = KeyGenParameterSpec.Builder(
    alias,
    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setUserAuthenticationRequired(true)
    .setUserAuthenticationParameters(
        0,
        KeyProperties.AUTH_BIOMETRIC_STRONG
    )
    .build()

biometricPrompt.authenticate(
    promptInfo,
    BiometricPrompt.CryptoObject(cipher)
)
```

성공 콜백에서는 새 `Cipher`를 만들지 않고 `result.cryptoObject?.cipher`를 최종 복호화에 사용하는지 추적한다. 키 생성 속성, 프롬프트, 콜백, 암호 연산 중 하나라도 끊기면 후보로 남긴다.

### Android · 유효 시간·Fallback

인증 유효 시간이 0이면 일반적으로 매 키 사용마다 인증을 요구한다. 양수이면 지정한 시간 동안 키가 풀릴 수 있으므로 민감 기능의 기대 재인증 간격과 비교한다.

```kotlin
keyBuilder.setUserAuthenticationParameters(
    60,
    KeyProperties.AUTH_BIOMETRIC_STRONG or
        KeyProperties.AUTH_DEVICE_CREDENTIAL
)
```

60초 자체가 안전하거나 취약한 기준은 아니다. 같은 유효 시간 안에 앱을 백그라운드로 보냈다가 복귀하고, 다른 민감 작업을 연속 실행해 실제 재사용 범위를 확인한다. API 30 이전의 `setUserAuthenticationValidityDurationSeconds`도 함께 검색한다.

### Android · 등록 변경

`setInvalidatedByBiometricEnrollment`와 `KeyPermanentlyInvalidatedException` 처리 경로를 찾는다.

```bash
rg -n "setInvalidatedByBiometricEnrollment|KeyPermanentlyInvalidatedException|UnrecoverableKeyException" jadx-output/sources
```

생체가 추가된 뒤 기존 키가 계속 동작하는 것이 항상 결함은 아니다. 단말 암호 Fallback과 계정 복구 정책을 포함해 판단한다. 고위험 비밀을 현재 등록된 생체 집합에 묶는 설계라면 등록 변경 시 키 무효화와 안전한 재등록 흐름이 기대된다.

### iOS · LAContext

`LAContext.evaluatePolicy`는 인증 결과 이벤트를 앱에 전달한다. 이 결과만으로 화면을 열면 이벤트 기반 보호다.

```bash
rg -n "LAContext|evaluatePolicy|deviceOwnerAuthentication|localizedFallbackTitle|touchIDAuthenticationAllowableReuseDuration" ios-analysis
```

`.deviceOwnerAuthenticationWithBiometrics`는 생체만, `.deviceOwnerAuthentication`은 조건에 따라 단말 암호 Fallback을 허용한다. 취소·실패·Fallback 선택 때 동일한 민감 기능으로 진입하지 않는지 확인한다.

### iOS · Keychain AccessControl

Keychain 항목 검색 시 시스템 인증이 성공해야 데이터가 반환되는 구조인지 확인한다.

```swift
var error: Unmanaged<CFError>?
let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
    .biometryCurrentSet,
    &error
)

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "protected-secret",
    kSecAttrAccessControl as String: access as Any,
    kSecValueData as String: secretData
]
```

`.biometryCurrentSet`은 등록 생체 집합이 바뀌면 항목 접근을 무효화한다. `.biometryAny`는 새 생체 등록 후에도 접근할 수 있고, `.userPresence`는 생체 또는 단말 암호를 허용할 수 있다. 어느 하나를 무조건 정답으로 두지 말고 자산 민감도와 복구 정책에 맞는지 확인한다.

### iOS · 등록 변경·Fallback

다음 상태를 분리해 시험한다.

- 생체 실패 후 단말 암호 또는 앱 비밀번호 Fallback
- 새 지문·얼굴 등록 후 기존 Keychain 항목 접근
- 생체 제거, 단말 암호 해제, 재설정 후 복구
- 인증 취소와 시스템 오류 뒤의 앱 상태

`evaluatedPolicyDomainState`는 생체 도메인 변경 감지에 활용할 수 있지만 값 자체는 불투명하다. 민감 항목 보호라면 변경 감지만 믿기보다 Keychain 접근 제어와 함께 확인한다.

### 공통 · 재인증·Background

정상 인증 직후, 유효 시간 종료 직전·직후, 백그라운드 복귀, 프로세스 재시작 순으로 반복한다. 다음 작업이 이전 성공 상태를 잘못 재사용하는지 본다.

```text
인증 성공 → 민감 화면 → Background → 복귀 → 다른 민감 작업
인증 성공 → 앱 종료 → 재실행 → 보호 데이터 접근
인증 실패·취소 → 화면 회전·딥링크 → 보호 화면 접근
```

iOS의 인증 재사용 시간과 Android 키 유효 시간은 UI 타이머와 다를 수 있다. 화면이 다시 잠겨도 키가 풀려 있거나, 화면은 열려도 키 사용은 거부되는 상황을 각각 기록한다.

## 결과 판정

| 관찰 결과 | 해석 |
| --- | --- |
| 성공 이벤트 변조 후 화면만 열림 | 이벤트 기반 UI 게이트 우회 후보 |
| 보호 평문·로컬 비밀·민감 API까지 사용 가능 | 실제 영향 확인 |
| 기존 서버 세션으로 고위험 API 실행 | 로컬 재인증 우회로 판정 가능 |
| 변조한 성공 이벤트 뒤 암호 연산 실패 | 키 기반 보호가 유지된 정황 |
| `CryptoObject`는 있으나 반환 객체를 미사용 | 구현 단절 후보 |
| 설정된 유효 시간 안에서 재사용 | 정책과 일치하면 정상 동작 |
| 새 생체 등록 후 키·항목 무효화 | 현재 등록 집합에 결합된 동작 |
| 단말 암호 Fallback 성공 | 허용 정책과 자산 민감도로 판단 |
| 후킹 도구가 탐지되어 시험 중단 | 보호 확인이 아닌 미판정 |

`BiometricPrompt`에 `CryptoObject`가 없거나 Keychain에 `.biometryCurrentSet`이 없다는 사실만으로 결론내리지 않는다. 보호 자산, 우회 경로, 최종 작업 성공을 함께 증명한다.

## 증적 항목

- 앱 빌드·해시, OS·단말, 루팅·탈옥·계측 상태
- 등록된 생체와 단말 암호 상태, 허용 인증 등급
- 프롬프트 정책, Fallback, 재사용·유효 시간
- Android 키 별칭·인증 속성·등록 변경 무효화 설정
- iOS Keychain 접근성·`SecAccessControl` 플래그
- 성공·실패·취소·Background별 화면과 로그
- 우회 전후 접근한 데이터, 로컬 비밀, API 요청·응답
- 이벤트 변조 뒤 실제 암호 연산의 성공·실패

민감한 토큰·개인정보는 원문 전체를 남기지 않고 필요한 부분만 마스킹한다.

## 트러블슈팅

#### 프롬프트가 표시되지 않음

등록된 생체, 단말 암호, 앱의 허용 인증 등급을 확인한다. 이전 성공 상태나 키 유효 시간이 남아 프롬프트가 생략될 수도 있다.

#### 콜백 클래스가 검색되지 않음

난독화된 앱 구현, Kotlin 람다, AndroidX 내부 전달 경로를 함께 본다. `frida-trace`로 호출을 좁힌 뒤 앱 패키지의 실제 하위 클래스를 지정한다.

#### `CryptoObject`가 null로 관찰됨

해당 화면이 단순 UI 게이트인지, 다른 단계에서 키를 사용하는지 추적한다. 다른 오버로드나 Credential Manager 경로도 확인한다.

#### 키가 영구 무효화됨

생체 등록 변경이나 단말 잠금 설정 변경을 확인한다. 테스트 계정의 정상 복구·키 재생성 흐름을 먼저 검증한다.

#### iOS Keychain 상호작용 오류

앱이 백그라운드이거나 UI 표시가 불가능하면 `errSecInteractionNotAllowed`가 발생할 수 있다. 포그라운드 상태와 인증 컨텍스트 전달 여부를 확인한다.

#### Fallback이 예상과 다름

프롬프트 정책, OS 버전, 허용 인증 수단, 실패 횟수를 함께 기록한다. 앱 자체 PIN과 시스템 단말 암호를 구분한다.

#### 복귀 후 재인증이 생략됨

앱 타이머뿐 아니라 Android 키 유효 시간과 iOS 재사용 시간을 확인한다. 프로세스가 유지된 경우와 재시작된 경우를 분리한다.

#### 시뮬레이터 결과가 실제 단말과 다름

시뮬레이션된 생체 이벤트는 보안 하드웨어와 등록 변경 동작을 완전히 재현하지 못한다. 최종 판정은 전용 실제 단말에서 확인한다.

## 빠른 명령어 참조

```bash
# Android 생체 서비스와 앱 로그
adb shell dumpsys biometric
adb logcat -s BiometricService BiometricPrompt Keystore2

# Android 정적 검색
rg -n "BiometricPrompt|CryptoObject|setUserAuthenticationRequired|setUserAuthenticationParameters" jadx-output/sources

# iOS LocalAuthentication 관련 통합 로그
log stream --predicate 'eventMessage CONTAINS[c] "LocalAuthentication"'
```

## 관련 문서

- [인증·세션 관리](./auth-mobile.md)
- [암호화·키 관리](./crypto-keys.md)
- [Android 데이터 저장](./data-storage-android.md)
- [iOS 데이터 저장](./data-storage-ios.md)
- [Frida 스크립트](./frida-scripts.md)
- [안티 디버깅·무결성 우회](./anti-debug-bypass.md)

## 참고자료

#### 공식 문서

- [Android Developers · Show a biometric authentication dialog](https://developer.android.com/identity/sign-in/biometric-auth)
- [Android Developers · KeyProtection.Builder](https://developer.android.com/reference/android/security/keystore/KeyProtection.Builder)
- [Android Developers · BiometricPrompt.CryptoObject](https://developer.android.com/reference/android/hardware/biometrics/BiometricPrompt.CryptoObject)
- [Apple Developer · LocalAuthentication](https://developer.apple.com/documentation/localauthentication)
- [Apple Developer · Accessing Keychain items with Face ID or Touch ID](https://developer.apple.com/documentation/localauthentication/accessing-keychain-items-with-face-id-or-touch-id)
- [Apple Developer · SecAccessControlCreateFlags](https://developer.apple.com/documentation/security/secaccesscontrolcreateflags)

#### 점검 기준

- [OWASP MASVS-AUTH](https://mas.owasp.org/MASVS/07-MASVS-AUTH/)
- [OWASP MASTG · Android Event-Bound Biometric Authentication](https://mas.owasp.org/MASTG-TEST-0327/)
- [OWASP MASTG · Cryptographic Binding](https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0036/)
- [OWASP MASTG · iOS Biometric Enrollment Changes](https://mas.owasp.org/MASTG/tests/ios/MASVS-AUTH/MASTG-TEST-0270/)
