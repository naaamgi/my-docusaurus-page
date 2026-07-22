---
sidebar_position: 19
title: 암호화·키 관리
description: 모바일 앱의 암호 목적, 알고리즘, 키 생성·저장·사용·폐기와 IV·Nonce 수명주기를 확인하는 실무 노트
keywords: [Cryptography, Android Keystore, iOS Keychain, CryptoKit, AES-GCM, Key Management, PBKDF2, MASVS-CRYPTO]
toc_max_heading_level: 3
draft: false
---

> 알고리즘 이름만 찾지 않는다. **무엇을 보호하며, 키는 어디서 생겨 누구에게 묶이고, 어떤 조건에서 사용·교체·폐기되는지** 하나의 흐름으로 확인한다.

## 사용 시점

- 로컬 파일·DB·토큰을 자체 암호화할 때
- 요청 서명, 데이터 무결성, 라이선스 검증에 암호 API를 사용할 때
- 사용자 PIN·비밀번호에서 키를 유도할 때
- Keystore·Keychain·Secure Enclave 사용을 보안 통제로 제시할 때
- 기기 교체, 로그아웃, 생체 등록 변경 뒤 키 수명주기를 확인할 때

TLS 설정은 [인증서 검증·Pinning](./certificate-validation.md), 저장 위치와 백업 노출은 Android·iOS 데이터 저장 문서에서 별도로 다룬다.

## 분석 기준

암호 사용처마다 다음 항목을 한 줄로 정리한다.

| 항목 | 확인 내용 |
| --- | --- |
| 자산 | 토큰, 개인정보, PIN 검증값, 서명 키 등 |
| 목적 | 기밀성, 무결성, 인증, 키 유도 |
| 알고리즘 | AES-GCM, HMAC-SHA-256, ECDSA 등 |
| 키 출처 | 단말 생성, 서버 전달, 사용자 입력 유도, 앱 내 상수 |
| 키 보호 | Keystore, Keychain, 하드웨어 보안 수준, 접근 조건 |
| 보조값 | IV·Nonce·Salt·AAD의 생성과 저장 |
| 수명주기 | 생성, 사용, 회전, 로그아웃·삭제·복구 |

MD5·SHA-1 문자열이 있다는 사실만으로 결함은 아니다. 파일 식별이나 비보안 체크섬인지, 비밀번호 저장·전자서명·보안 무결성에 쓰이는지 목적을 먼저 확인한다. 공개키와 인증서 Pin 값도 비밀키처럼 숨겨야 하는 값은 아니다.

## 보호 모델

권장되는 일반 흐름은 검증된 플랫폼 API, 인증 암호(Authenticated Encryption), 안전한 난수, 추출이 어려운 키 저장소를 조합한다.

- 암호화와 위변조 탐지가 필요하면 AES-GCM 같은 AEAD를 우선 검토한다.
- 같은 키에서 GCM·CTR Nonce가 다시 사용되지 않도록 생성·저장 흐름을 확인한다.
- 장기 키는 Android Keystore 또는 iOS Keychain에 보관하고 사용 권한을 제한한다.
- 비밀번호 검증값은 암호화가 아니라 느린 Password Hashing으로 저장한다.
- 서버와 모든 설치본이 같은 대칭키를 공유하는 설계는 한 앱 분석이 전체 사용자에게 확장될 수 있다.
- 키를 추출할 수 없더라도 변조된 앱이 단말 안에서 키 사용을 대신 요청할 수 있는지 구분한다.

Keystore는 키 재료의 추출을 어렵게 하지만 앱 프로세스가 침해된 동안 허용된 연산을 대신 수행하는 것까지 자동으로 막지는 않는다. 사용자 인증, 목적·모드 제한, 서버 측 검증을 함께 본다.

## 진단 절차

1. 암호 API 호출과 보호 자산을 목록화한다.
2. 키 생성 지점부터 저장·조회·최종 연산까지 데이터 흐름을 연결한다.
3. 알고리즘, 모드, 패딩, 키 길이, IV·Nonce·Salt를 기록한다.
4. 동일 작업을 반복해 보조값과 암호문 변화 여부를 비교한다.
5. 로그아웃, 재설치, 백업 복원, 생체 변경 때 키 상태를 확인한다.
6. 정적으로 불명확한 값은 런타임에서 최소 범위로 관찰한다.
7. 실제 데이터의 복호화·위변조·다른 계정 재사용 가능성으로 판정한다.

운영 데이터의 원문 키나 평문을 수집하지 않는다. 테스트 계정·시험 데이터를 사용하고 증적에는 해시·길이·앞뒤 일부만 남긴다.

## 실습 노트

### 암호 사용처 지도

Android 디컴파일 결과에서 JCA, Keystore, 키 유도 API를 찾는다.

```bash
rg -n "Cipher\.getInstance|SecretKeySpec|IvParameterSpec|GCMParameterSpec|MessageDigest|getInstance\(.*Hmac|KeyGenParameterSpec|PBEKeySpec|SecureRandom|java\.util\.Random" jadx-output/sources
```

iOS에서는 CryptoKit, CommonCrypto, Security framework 호출을 함께 찾는다.

```bash
rg -n "AES\.GCM|ChaChaPoly|SymmetricKey|CCCrypt|CCCryptor|SecKey|SecRandomCopyBytes|SecItem(Add|CopyMatching|Update|Delete)" ios-analysis
```

검색 결과를 호출 횟수로 세지 말고 `입력 → 키 → 연산 → 저장·전송` 경로로 묶는다. 서드파티 SDK라면 앱이 넘기는 키와 결과의 사용처까지 확인한다.

### 키 출처·하드코딩

소스, 리소스, Native 문자열에서 키 후보를 찾는다.

```bash
rg -n -i "secret|api[_-]?key|encryption[_-]?key|private[_-]?key|SecretKeySpec|BuildConfig" jadx-output resources lib
```

16·24·32바이트 상수를 모두 비밀키로 단정하지 않는다. 다음을 확인해야 한다.

- 실제 `SecretKeySpec`, HMAC, 서명 초기화로 전달되는가
- 모든 설치본·계정에서 같은 값인가
- 공개키, 인증서, 테스트 벡터, 식별자와 구분되는가
- 해당 키로 실제 보호 데이터를 복호화·위조할 수 있는가

고정 IV도 모드와 목적에 따라 영향이 다르다. CBC에서는 첫 블록의 동일성 노출과 조작 가능성을, GCM·CTR에서는 같은 키와 Nonce 조합의 재사용을 중점 확인한다.

### 알고리즘·모드

| 관찰 항목 | 확인 방향 |
| --- | --- |
| DES·3DES·RC4 | 신규 보안 설계에 부적합한 레거시 사용처 |
| AES-ECB | 반복 블록 패턴 노출과 무결성 부재 |
| AES-CBC | 예측 불가능한 IV와 별도 인증 여부 |
| AES-CTR | Nonce·Counter 유일성과 별도 인증 여부 |
| AES-GCM | 키·Nonce 조합 유일성, Tag 검증, AAD 일치 |
| RSA PKCS#1 v1.5 암호화 | OAEP 전환 가능성과 호환성 제약 |
| SHA-1·MD5 | 보안 목적과 공격 가능한 충돌·추측 시나리오 |

CBC 자체를 무조건 취약으로 보지는 않는다. 무결성 보호와 IV 생성·검증이 적절한지 확인한다. 새 구현은 실수 여지가 적은 AEAD를 우선 고려한다.

### IV·Nonce·Salt

같은 키로 동일 입력을 여러 번 암호화하고 IV·Nonce·암호문을 비교한다. 앱 재시작, 날짜 변경, 동시 요청처럼 상태가 달라지는 경우도 포함한다.

```text
run, key-id, mode, iv-or-nonce, ciphertext-hash, tag, result
01, local-v2, GCM, 8f3c..., 25b1..., 79aa..., success
02, local-v2, GCM, a912..., 0d44..., c21e..., success
```

Salt는 비밀일 필요가 없지만 레코드마다 고유해야 한다. IV·Nonce도 보통 암호문과 함께 저장할 수 있으나, 필요한 무작위성·유일성을 지켜야 한다. 하드코딩 여부만 보는 대신 생성기, 카운터 초기화, 충돌 방지 범위를 추적한다.

### Android · Keystore

Keystore 키가 비추출성, 허용 목적, 모드, 사용자 인증 조건을 실제로 갖는지 확인한다.

```kotlin
val generator = KeyGenerator.getInstance(
    KeyProperties.KEY_ALGORITHM_AES,
    "AndroidKeyStore"
)
generator.init(
    KeyGenParameterSpec.Builder(
        "local-data-v2",
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
)
val key = generator.generateKey()
```

`KeyInfo.getSecurityLevel()`로 하드웨어 강제 여부를 확인할 수 있지만, 소프트웨어 Keystore라는 이유만으로 즉시 취약한 것은 아니다. 위협 모델과 단말 지원 범위를 함께 본다. `setIsStrongBoxBacked(true)`는 지원 단말에서 더 강한 격리를 제공하지만 가용성·호환성 설계가 필요하다.

### iOS · Keychain·CryptoKit

CryptoKit의 AES-GCM은 Nonce를 생략하면 안전한 새 값을 생성한다. 앱이 직접 Nonce를 넘긴다면 유일성 관리 코드를 확인한다.

```swift
let key = SymmetricKey(size: .bits256)
let sealed = try AES.GCM.seal(plaintext, using: key)
let restored = try AES.GCM.open(sealed, using: key)
```

`SymmetricKey`를 매 실행 생성하면서 암호문만 영구 저장하면 재시작 후 복호화할 수 없다. 장기 키의 Keychain 저장, 접근성 등급, `SecAccessControl`, 로그아웃 삭제 여부를 연결한다. Secure Enclave는 주로 지원되는 비대칭 키 연산에 사용되므로 모든 대칭키가 그 안에 저장된다고 표현하지 않는다.

### 비밀번호·PIN 키 유도

사용자 비밀번호를 검증하려는 경우 단순 SHA-256이나 가역 암호화 대신 Argon2id·scrypt·PBKDF2 같은 Password Hashing을 확인한다. PBKDF2 수치는 PRF와 기준 시점에 따라 달라지므로 코드에 하나의 영구 기준처럼 적지 않는다.

```kotlin
val spec = PBEKeySpec(
    password,
    perRecordSalt,
    configuredIterations,
    256
)
val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
val derived = factory.generateSecret(spec).encoded
```

현재 OWASP 기준과 서비스 성능 시험을 함께 확인한다. Salt의 레코드별 고유성, 작업 계수, 알고리즘 식별자의 저장, 향후 재해싱 전략이 핵심이다. 4~6자리 로컬 PIN은 KDF를 사용해도 추측 공간이 작으므로 Keystore·Keychain 또는 서버 측 시도 제한과 결합해야 한다.

### 난수·런타임 관찰

보안 목적 값에 `SecureRandom`·`SecRandomCopyBytes`가 쓰이는지 확인한다. `java.util.Random`이 UI 셔플이나 샘플 데이터에 쓰인 것까지 결함으로 잡지 않는다.

런타임 계측은 알고리즘과 호출 스택을 먼저 관찰하고, 키 원문 덤프는 필요한 시험 데이터에만 제한한다.

```javascript
Java.perform(function () {
    const Cipher = Java.use('javax.crypto.Cipher');
    const getInstance = Cipher.getInstance.overload('java.lang.String');

    getInstance.implementation = function (transformation) {
        console.log('[Cipher] ' + transformation);
        return getInstance.call(this, transformation);
    };
});
```

같은 키 객체가 여러 번 사용되는 것은 장기 키 설계에서 정상일 수 있다. “매번 같은 키”가 아니라, 앱 패키지에서 키 재료가 추출되는지, 계정·설치 간 부적절하게 공유되는지, Nonce와 함께 재사용되는지로 판정한다.

## 결과 판정

| 관찰 결과 | 해석 |
| --- | --- |
| 앱 패키지의 대칭키로 보호 데이터 복호화 | 하드코딩 키의 실제 영향 확인 |
| 모든 설치본이 동일 HMAC 키 사용 | 전역 위조 가능성 확인 필요 |
| AES-GCM에서 동일 키·Nonce 재사용 | 기밀성·무결성 훼손 가능 |
| AES-CBC와 무작위 IV, Encrypt-then-MAC | 레거시일 수 있으나 구조만으로 결함 아님 |
| 공개키·Pin 해시가 상수 | 비밀정보 하드코딩이 아님 |
| MD5가 파일 캐시 식별에만 사용 | 보안 목적이 아니면 일반적으로 무관 |
| Keystore 키 재료는 미추출, 임의 연산 가능 | 추출과 오용 가능성을 별도 평가 |
| 짧은 PIN에 KDF만 적용 | 오프라인·온라인 추측 통제 추가 확인 |
| 로그아웃 후 키·암호문이 계속 사용 가능 | 계정 경계와 삭제 정책 확인 |

심각도는 약한 요소의 존재가 아니라 공격자가 얻는 자산과 확장 범위로 정한다. 한 사용자 단말의 로컬 데이터만 복호화되는 경우와 전 사용자 요청을 위조할 수 있는 공통키는 영향이 다르다.

## 증적 항목

- 앱 빌드·해시, OS·단말, 분석 파일 해시
- 보호 자산과 암호 목적, 호출 스택
- 알고리즘·모드·패딩·키 길이
- 키 출처·별칭·저장 위치·하드웨어 보안 수준
- IV·Nonce·Salt·AAD의 생성·저장·재사용 결과
- 계정·설치·재시작·로그아웃별 키 식별 결과
- 변조된 암호문과 Tag 오류 처리
- 복호화·서명·위조로 확인한 실제 영향

키와 평문은 전체를 캡처하지 않는다. 재현에 필요한 식별자, 길이, 해시, 마스킹된 일부만 보관한다.

## 트러블슈팅

#### 암호 문자열만 보이고 호출 위치가 없음

리플렉션, Native 라이브러리, 서드파티 SDK를 확인한다. 런타임에서 `Cipher.getInstance`나 CommonCrypto 호출 스택을 좁힌다.

#### Keystore 키 바이트가 보이지 않음

비추출형 키의 정상 특성일 수 있다. 키 원문 대신 허용된 연산, 별칭, `KeyInfo`, 입력·출력 흐름을 확인한다.

#### 매 실행 암호문이 같음

평문, 키, 모드, IV·Nonce를 분리한다. 결정적 암호가 의도된 특수 설계인지도 확인하되 일반 비밀 데이터 암호화라면 패턴 노출을 검토한다.

#### GCM 복호화가 항상 실패함

Nonce, Tag, AAD, 결합 형식과 바이트 순서를 확인한다. 앱이 `ciphertext || tag` 또는 CryptoKit `combined` 형식을 쓰는지 구분한다.

#### PBKDF2 반복 수가 기준과 다름

PRF, 기준 문서 날짜, 대상 단말 성능, 처리 시간을 함께 기록한다. 과거 숫자 하나만으로 판정하지 않는다.

#### iOS 키가 재실행 후 사라짐

메모리에서만 생성한 키인지, Keychain 저장이 실패했는지 확인한다. `SecItemAdd` 상태 코드와 접근성 옵션을 본다.

#### 하드웨어 보안 수준이 단말마다 다름

StrongBox·Secure Enclave 지원 여부와 Fallback 정책을 분리한다. 지원하지 않는 단말의 제품 요구사항을 확인한다.

#### 로그아웃 뒤 복호화가 계속됨

암호문 삭제와 키 삭제를 따로 확인한다. 공유 계정, 오프라인 기능, 복구 정책이 의도한 동작인지 비교한다.

## 빠른 명령어 참조

```bash
# Android 암호·키 사용처
rg -n "Cipher\.getInstance|KeyGenParameterSpec|SecretKeySpec|GCMParameterSpec|PBEKeySpec|SecureRandom" jadx-output/sources

# iOS CryptoKit·Security·CommonCrypto 사용처
rg -n "AES\.GCM|SymmetricKey|SecItem|SecKey|SecRandomCopyBytes|CCCrypt" ios-analysis

# Android 런타임 호출 좁히기
frida-trace -U -f com.example.app -j 'javax.crypto.Cipher!*' -j 'java.security.MessageDigest!*'
```

## 관련 문서

- [Android 데이터 저장](./data-storage-android.md)
- [iOS 데이터 저장](./data-storage-ios.md)
- [로컬·생체 인증](./local-auth-bypass.md)
- [인증서 검증·Pinning](./certificate-validation.md)
- [정적 분석](./static-analysis.md)
- [IDA Pro 네이티브 분석](./ida-pro-analysis.md)
- [Frida 스크립트](./frida-scripts.md)

## 참고자료

#### 공식 문서

- [Android Developers · Cryptography](https://developer.android.com/privacy-and-security/cryptography)
- [Android Developers · Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
- [Android Developers · KeyGenParameterSpec](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec)
- [Apple Developer · AES.GCM](https://developer.apple.com/documentation/cryptokit/aes/gcm)
- [Apple Developer · SecRandomCopyBytes](https://developer.apple.com/documentation/security/secrandomcopybytes(_:_:_:))
- [NIST SP 800-38D · GCM and GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final)

#### 점검 기준

- [OWASP MASVS-CRYPTO](https://mas.owasp.org/MASVS/06-MASVS-CRYPTO/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
