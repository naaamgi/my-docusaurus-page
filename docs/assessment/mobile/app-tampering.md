---
sidebar_position: 10
title: 앱 위변조·재패키징
description: Android와 iOS 앱의 원본 서명부터 최소 변경, 재서명, 설치·실행, 앱 자체 무결성 및 서버 attestation 검증까지 이어지는 실무 흐름
keywords: [Repackaging, Tampering, Signature Verification, SigningInfo, APK Signature, Code Signing, Entitlements, Play Integrity, App Attest, MASVS-RESILIENCE]
toc_max_heading_level: 3
draft: false
---

> APK·IPA 또는 실행 바이너리를 최소 범위에서 변경하고 다시 서명했을 때, 운영체제·앱·서버가 각각 어떻게 반응하는지 확인한다. 목표는 단순히 패치본을 실행하는 것이 아니라 **어느 계층이 무엇을 검증하는지 분리하고 보호 대상 기능까지 결과를 연결하는 것**이다.

## 사용 시점

- SSL Pinning, root·탈옥 탐지, anti-debug 로직을 패치한 앱을 실행해야 할 때
- 앱이 자기 서명, DEX·resource·Native library checksum을 확인하는지 점검할 때
- 공식 Store가 아닌 경로에서 설치된 앱의 동작 차이를 확인할 때
- Play Integrity의 app verdict 또는 App Attest가 서버에서 사용되는지 확인할 때
- 재서명 후 설치 실패와 앱 자체 위변조 탐지를 구분해야 할 때
- 민감 기능이 변조된 클라이언트 요청을 서버에서도 허용하는지 확인할 때

재패키징 성공이나 방어 부재만으로 취약점을 확정하지 않는다. 실제 영향은 변조 가능한 기능, 배포·사용 가능성, 서버 측 통제에서 결정한다.

## 작업 원칙

- 허가된 앱, 테스트 계정, 격리된 단말·emulator에서만 수행한다.
- 전달받은 원본을 수정하지 않고 SHA-256과 확보 정보를 남긴다.
- 앱 version과 아키텍처가 같은 작업본에서 비기능 변경 하나만 적용한다.
- Android `adb uninstall`은 앱 데이터를 삭제하므로 복구 계획과 승인을 먼저 확인한다.
- iOS 재서명은 provisioning, entitlement, keychain access group에 영향을 준다.
- 설치 성공, 앱 실행, 로그인, 보호 대상 기능, 서버 응답을 별도 단계로 기록한다.
- 서명·무결성·설치 출처·attestation을 한 개의 통제로 묶지 않는다.

## 검증 계층

| 계층 | Android | iOS | 실무 판단 |
| :--- | :--- | :--- | :--- |
| 운영체제 서명 | APK signing scheme과 update certificate 일치 | 유효한 code signature와 provisioning | 설치·실행 전 플랫폼 검증 |
| 앱 자체 서명 | `SigningInfo`, certificate digest 비교 | bundle·certificate·receipt 또는 앱 전용 검사 | 클라이언트 정책 로직 |
| 파일 무결성 | DEX, resource, asset, `.so` hash | Mach-O, framework, resource hash | 검증 대상과 기준값 확인 |
| runtime 무결성 | code section, GOT·PLT, hook·memory 검사 | code page, IMP·symbol pointer, hook 검사 | [Anti-debug 우회](anti-debug-bypass.md)와 경계 |
| 설치·배포 출처 | `InstallSourceInfo`, Play licensing | App Store receipt, provisioning 환경 | 출처 신호와 진위 확인 구분 |
| 서버 attestation | Play Integrity app verdict | App Attest assertion | 요청 결합과 서버 강제 여부가 핵심 |
| 보호 도구 | RASP, 난독화·compiler protection | RASP, 난독화·compiler protection | 분석 지연과 실제 서버 통제 분리 |

Android에서 다른 certificate로 서명한 APK가 기존 공식 앱 위에 설치되지 않는 것은 플랫폼의 update 서명 검사다. iOS에서 유효하지 않은 서명 때문에 실행되지 않는 것도 운영체제 동작이다. 이 결과만으로 앱 자체 위변조 방어를 확인했다고 판단하지 않는다.

---

## 진단 절차

#### Step 1. 원본 기준선

원본과 작업 디렉터리를 분리한다.

```text
tampering-lab/
├── original/       # 전달받은 원본, 수정 금지
├── work/           # 디컴파일·압축 해제 결과
├── signed/         # 테스트 certificate로 서명한 결과
├── evidence/       # 마스킹한 로그와 비교 결과
└── notes/          # 변경점, hash, 실행 결과
```

Linux·macOS:

```bash
sha256sum original/target.apk
apksigner verify --verbose --print-certs original/target.apk
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\original\target.apk
apksigner verify --verbose --print-certs .\original\target.apk
```

iOS는 IPA hash를 기록하고, 원본 복사본을 `work/target-ipa`에 압축 해제한 뒤 app bundle의 현재 서명·entitlement를 기록한다.

```bash
shasum -a 256 original/target.ipa
unzip -q original/target.ipa -d work/target-ipa
codesign -dvvv --entitlements :- work/target-ipa/Payload/Target.app
```

#### Step 2. 배포 형식

| 입력 | 먼저 확인할 점 | 주의사항 |
| :--- | :--- | :--- |
| 단일 APK | 완성된 standalone APK인지 | split 전용 앱과 구분 |
| APKS·XAPK·APKM | base와 split 구성 | base 하나만 패치하면 설치·실행 실패 가능 |
| AAB | Store·bundletool용 빌드 입력 | 고객사 테스트 keystore·빌드 흐름 우선 |
| IPA | 복호화된 실행 바이너리인지 | App Store 암호화 binary는 정적 패치 전 복호화 필요 |
| 개발·Ad Hoc iOS build | profile과 등록 단말 | entitlement와 Team ID 확인 |

원본 앱이 여러 split을 사용하면 현재 설치 경로를 확인한다.

```bash
adb shell pm path com.target.app
```

#### Step 3. 최소 변경

기능 로직을 먼저 바꾸지 않는다. 앱 실행 시 확인할 수 있는 테스트 문자열 또는 별도 marker asset처럼 영향이 낮은 변경 하나를 선택한다. 변경 파일, 원래 값, 바꾼 값과 목적을 기록한다.

| 첫 변경 | 확인 목적 | 피할 변경 |
| :--- | :--- | :--- |
| 사용되는 UI 문자열 하나 | resource 재패키징 가능 여부 | 로그인·결제 결과 문구 변조 |
| marker asset 하나 | 파일 무결성 적용 범위 | 대량 resource 교체 |
| 확인한 boolean 분기 하나 | 보호 로직 영향 | 여러 Smali·Native 분기 동시 수정 |

#### Step 4. 빌드·서명 검증

Android는 `zipalign`을 서명보다 먼저 실행한다. 서명 뒤 APK를 다시 수정하면 서명이 무효화된다.

```bash
apktool d original/target.apk -o work/target-decoded
apktool b work/target-decoded -o work/target-unsigned.apk
zipalign -p -f 4 work/target-unsigned.apk work/target-aligned.apk
apksigner sign --ks work/assessment.jks --out signed/target-test.apk work/target-aligned.apk
apksigner verify --verbose --print-certs signed/target-test.apk
```

테스트 keystore가 없다면 작업 전용 key를 만든다. password와 private key를 저장소에 넣지 않는다.

```bash
keytool -genkeypair -keystore work/assessment.jks -alias assessment -keyalg RSA -keysize 2048 -validity 3650
```

#### Step 5. 설치 결과

Android에서 기존 공식 앱과 테스트 APK의 certificate가 다르면 `adb install -r`은 정상적으로 거부된다. 이 오류는 앱 자체 탐지가 아니다.

```text
INSTALL_FAILED_UPDATE_INCOMPATIBLE
```

패치본 설치를 위해 공식 앱을 제거하면 앱 데이터가 삭제된다. 테스트 단말 snapshot, 계정 재등록, MFA·인증서 복구 방안을 확인한 뒤 승인된 경우에만 진행한다.

```bash
adb uninstall com.target.app
adb install signed/target-test.apk
```

#### Step 6. 실행·기능 비교

| 단계 | 확인할 결과 |
| :--- | :--- |
| 설치 | 운영체제 서명·profile·split 검증 통과 여부 |
| 첫 실행 | crash, 명시적 위변조 문구, 초기화 실패 |
| 로그인 | keychain·keystore·단말 등록 영향 |
| 보호 대상 기능 | 변조한 분기의 실제 영향 |
| 서버 요청 | app verdict·assertion 누락·실패 처리 |
| 재실행 | lifecycle·background 반복 검사 |

#### Step 7. 검증 위치

[정적 분석](static-analysis.md)에서 최종 정책 메서드와 호출자를 찾는다.

Android:

```bash
rg -n 'SigningInfo|GET_SIGNING_CERTIFICATES|GET_SIGNATURES|signatures|getInstallSourceInfo|getInstallerPackageName|CRC32|MessageDigest|IntegrityManager' work
```

iOS:

```bash
rg -n 'SecCode|SecStaticCode|embedded.mobileprovision|AppAttest|DCAppAttestService|receipt|CodeResources' work
strings -a work/target-ipa/Payload/Target.app/Target | grep -iE 'integrity|signature|tamper|attest|receipt'
```

#### Step 8. 최소 우회·서버 확인

앱 자체 검증이 확인되면 certificate·file API 전체를 바꾸기보다 최종 boolean 또는 상태 코드 하나를 관찰한다. 변경 후에는 앱 화면뿐 아니라 보호 대상 서버 기능이 승인되는지 확인한다.

---

## 실습 노트

### Android · 원본·서명

`apksigner` 출력에서 원본과 테스트 APK의 certificate digest와 signing scheme을 비교한다.

```bash
apksigner verify --verbose --print-certs original/target.apk
apksigner verify --verbose --print-certs signed/target-test.apk
```

**결과에서 볼 항목:** v1·v2·v3·v4 검증 결과, signer certificate SHA-256, warning, minSdk 기준 검증 여부를 확인한다. APK를 서명한 뒤 한 byte라도 바꾸면 다시 서명해야 한다.

앱 코드에서 `PackageInfo.signatures`와 `GET_SIGNATURES`가 보이면 legacy 구현이다. Android 9(API 28) 이상 코드에서는 `SigningInfo`, `GET_SIGNING_CERTIFICATES`, certificate rotation history와 multiple signer 처리도 확인한다. 첫 certificate 하나만 비교하는 로직은 key rotation에서 정상 앱을 잘못 차단할 수 있다.

### Android · 최소 재패키징

최초 실습은 resource 문자열 하나처럼 기능에 영향을 적게 주는 변경으로 진행한다.

```text
원본: 설정 화면의 "앱 정보"
변경: 설정 화면의 "앱 정보 [TEST]"
목적: resource 변경과 재패키징 반응 확인
```

변경한 문자열이 실제 화면에 나타나는지 확인한다. 사용되지 않는 resource를 바꾸면 패치본과 원본을 눈으로 구분하기 어렵다.

| 결과 | 현재 판단 | 다음 작업 |
| :--- | :--- | :--- |
| 빌드 실패 | apktool·resource 문제 | framework·aapt 오류 확인 |
| 서명 검증 실패 | 패키징 순서 문제 | zipalign 후 재서명 |
| 기존 앱 위 설치 실패 | certificate 불일치 | 데이터 복구 계획 후 별도 설치 |
| 첫 실행 crash | resource·split·SDK·무결성 후보 | crash log로 구분 |
| 명시적 위변조 문구 | 앱 자체 탐지 후보 | 검증 method와 caller 식별 |
| 앱 정상·서버 기능 차단 | 서버 attestation 후보 | verdict·request binding 확인 |

### Android · 자체 서명 검사

`ApplicationPackageManager.getPackageInfo()` 전체를 변조하지 않는다. 앱 전용 `verifySignature()` 같은 최종 메서드를 확인한 뒤 원본 반환값부터 기록한다.

```javascript
Java.perform(function () {
    const IntegrityChecker = Java.use('com.target.app.security.IntegrityChecker');
    const verifySignature = IntegrityChecker.verifySignature.overload();

    verifySignature.implementation = function () {
        const originalResult = verifySignature.call(this);
        console.log('[verifySignature] result=' + originalResult);
        return originalResult;
    };
});
```

클래스와 메서드명은 예시다. 실제 APK에서 확인한 이름과 overload로 바꾼다. 재서명본에서 `false`가 반환되고 차단 시점과 연결된 뒤에만 마지막 줄을 다음과 같이 바꾼다.

```javascript
return true;
```

앱 실행 성공만으로 끝내지 않는다. 앱 시작·로그인·민감 기능마다 검사가 반복되는지, 서버가 테스트 certificate의 요청을 별도로 거부하는지 확인한다.

### Android · 설치 출처

Android 11(API 30) 이상에서는 `PackageManager.getInstallSourceInfo()`가 설치 출처 정보를 제공한다. `getInstallerPackageName()`은 API 30부터 deprecated다.

| 값 | 의미 | 주의사항 |
| :--- | :--- | :--- |
| initiating package | 실제 설치를 요청한 package 후보 | 설치 앱 제거·권한에 따라 null 가능 |
| installing package | installer of record | 변경될 수 있음 |
| originating package | 설치 파일의 원 출처 후보 | 제공 값이며 항상 검증된 정보는 아님 |
| package source | Store, local file, downloaded file 등 | API 33 이상 |

설치 출처는 배포 경로 신호이지 앱 binary의 진위를 단독으로 증명하지 않는다. Store package name 하나를 반환하도록 전역 hook하기보다 앱이 출처를 해석하는 최종 정책 메서드를 관찰한다.

```bash
rg -n 'getInstallSourceInfo|getInstallerPackageName|getInstallingPackageName|getInitiatingPackageName|getPackageSource' work
```

ADB sideload 때문에 출처가 `null`이거나 local file로 보이는 것은 예상된 기준선이다. 이 조건에서 앱이 안내만 하는지, 민감 기능을 서버에서 제한하는지 구분한다.

### Android · 파일·Native 무결성

checksum API 이름만 찾지 말고 검증 대상 파일과 기준값의 출처를 연결한다.

```bash
rg -n 'CRC32|Adler32|MessageDigest|SHA-256|classes\.dex|resources\.arsc|lib/.*\.so' work
readelf -Ws work/lib/arm64-v8a/libsecurity.so | grep -iE 'integrity|verify|checksum|digest'
strings -a work/lib/arm64-v8a/libsecurity.so | grep -iE 'classes.dex|resources.arsc|tamper|integrity'
```

| 확인 항목 | 질문 |
| :--- | :--- |
| 대상 | APK 전체, DEX, resource, asset, `.so`, memory 중 무엇인가 |
| 기준값 | 코드 상수, 암호화된 asset, 서버 응답 중 어디에 있는가 |
| 시점 | 시작, 로그인, 민감 기능, background 복귀 중 언제인가 |
| 결과 | 종료, 경고, 기능 제한, 서버 거부 중 무엇인가 |

`MessageDigest` 전체를 정상값으로 바꾸지 않는다. 앱 전용 `verifyDexIntegrity()` 또는 Native wrapper의 원본 결과를 확인하고 한 파일·한 분기만 변경한다. Native 함수 분석은 [IDA Pro 분석](ida-pro-analysis.md)과 연결한다.

### iOS · 서명·entitlement

iOS는 누락되거나 유효하지 않은 code signature의 앱 실행을 운영체제에서 거부한다. valid signature로 재서명했는데도 실행되지 않는다면 앱 자체 탐지 전에 provisioning과 entitlement부터 비교한다.

복사본에서 IPA를 압축 해제한 뒤 확인한다.

```bash
unzip -q original/target.ipa -d work/target-ipa
codesign -dvvv --entitlements :- work/target-ipa/Payload/Target.app
security cms -D -i work/target-ipa/Payload/Target.app/embedded.mobileprovision
```

확인할 항목:

- application identifier, Team ID, keychain access groups
- App Groups, associated domains, push, App Attest environment
- embedded framework, extension, watch app 같은 nested code
- 배포 profile의 등록 단말과 만료일
- App Store 암호화 binary 여부

가능하면 고객사가 제공한 개발·Ad Hoc 테스트 build와 Xcode signing 흐름을 사용한다. 수동 재서명은 nested code를 안쪽부터 서명하고 main app을 마지막에 서명해야 하며, entitlement 불일치가 앱 자체 위변조 탐지처럼 보일 수 있다.

```bash
codesign --verify --deep --strict --verbose=4 work/target-ipa/Payload/Target.app
```

탈옥 단말에서 실행됐다는 사실만으로 일반 사용자 단말에서도 재서명 앱이 실행되는 것은 아니다. 설치·배포 가능성과 앱 자체 방어를 구분한다.

### Android · Play Integrity

Play Integrity의 `appIntegrity`는 재서명·변조된 build를 Store가 인식한 앱과 구분하는 신호를 제공할 수 있다.

| 항목 | 확인 내용 |
| :--- | :--- |
| `requestDetails` | package, `requestHash`·nonce, timestamp가 원 요청과 일치하는가 |
| `appRecognitionVerdict` | `PLAY_RECOGNIZED`, `UNRECOGNIZED_VERSION`, `UNEVALUATED` 중 무엇인가 |
| certificate digest | 서버가 기대한 signing certificate와 비교하는가 |
| version code | 보호 대상 요청의 앱 version과 일치하는가 |
| 서버 정책 | 재서명 build에서 민감 기능을 실제로 제한하는가 |

표준 요청은 보호 대상 API의 중요 값을 digest한 `requestHash`와 결합해야 한다. 토큰을 앱에서 요청하는 것만으로는 충분하지 않으며 백엔드가 복호화·검증하고 원 요청과 비교해야 한다.

정상 Store build와 재서명 build에서 같은 테스트 기능을 수행해 서버 응답을 비교한다. 로컬 경고 화면만 우회한 뒤 서버가 요청을 거부한다면 서버 통제는 남아 있는 상태다.

### iOS · App Attest

App Attest는 앱 인스턴스가 정당한 앱인지 서버가 검증할 수 있도록 key, attestation, assertion을 제공한다. iOS code signature 자체와 같은 계층은 아니다.

확인 흐름:

1. 서버가 일회성 challenge를 발급하는가
2. 앱이 `clientDataHash`에 보호 대상 요청을 결합하는가
3. 서버가 attestation·assertion과 counter를 검증하는가
4. Bundle ID·Team ID·App Attest environment가 기대값과 일치하는가
5. 재서명 build의 assertion 실패 때 민감 기능을 제한하는가

```bash
rg -n 'DCAppAttestService|generateKey|attestKey|generateAssertion|clientDataHash' work
```

DeviceCheck의 단말별 두 bit는 서비스가 정의하는 상태 저장 기능이다. App Attest assertion이나 iOS code signature 검증과 동일한 것으로 기록하지 않는다.

---

## 결과 판정

| 관찰 결과 | 판단 | 다음 확인 |
| :--- | :--- | :--- |
| Android update 설치 실패 | 플랫폼 certificate 불일치 | 앱 자체 탐지와 구분 |
| iOS 설치·launch 실패 | code signing·profile 후보 | entitlement와 nested code 확인 |
| valid 재서명본에서 명시적 경고 | 앱 자체 무결성 후보 | 검증 메서드와 기준값 식별 |
| 앱 전용 boolean 하나로 실행 | 단일 클라이언트 통제 후보 | 반복 검사와 서버 기능 확인 |
| 앱은 실행, 민감 API는 거부 | 서버 attestation 후보 | verdict·assertion 검증 확인 |
| 재서명본의 민감 API 승인 | 서버 통제 부재 후보 | 요구사항과 실제 영향 확인 |
| 설치 출처만 바꾸면 통과 | 출처 신호 의존 후보 | certificate·attestation 통제 확인 |

다음 조건을 함께 만족할 때 위변조 보호 약점을 구체적인 후보로 남긴다.

- 고객사 요구사항이나 위협 모델상 변조 클라이언트 통제가 필요한 기능이다.
- 최소한의 패치로 보호 로직이 반복 우회된다.
- 변조된 앱에서 민감 로직 또는 유료·거래 기능이 실제로 달라진다.
- 서버가 해당 요청을 승인하고 별도 무결성·권한 통제가 없다.

재패키징·재서명 성공, 앱 실행 성공 또는 로컬 검사 우회만으로 등급을 정하지 않는다. Store 외 배포 가능성, 사용자 설치 장벽, 보호 대상 기능과 서버 통제를 함께 본다.

## 증적 항목

- 원본·작업본 파일명과 SHA-256
- 앱 version, package·Bundle ID, versionCode·build number
- 원본·테스트 signing certificate digest
- APK signing scheme 또는 iOS profile·entitlement
- split·AAB·IPA와 지원 ABI 정보
- 변경한 파일·값 하나와 변경 목적
- 빌드, zipalign, 서명 검증 결과
- 설치·실행·로그인·민감 기능 단계별 결과
- 명시적 위변조 문구와 crash·system log
- 검증 클래스·selector·Native module·offset
- Play Integrity verdict 또는 App Attest 서버 처리

## 트러블슈팅

#### apktool 빌드 실패

- framework resource와 apktool version을 확인한다.
- decode 결과에서 자동 변경된 resource를 diff로 확인한다.
- split APK 또는 framework APK를 standalone APK로 오해하지 않았는지 확인한다.
- 먼저 `--no-src` 또는 resource만 변경하는 기준선을 검토한다.

#### APK 서명 검증 실패

- `zipalign`을 서명 전에 실행했는지 확인한다.
- 서명 뒤 APK를 다시 수정하지 않았는지 확인한다.
- `apksigner verify --verbose --print-certs`의 warning과 minSdk를 확인한다.

#### Android update 설치 실패

- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`이면 기존 앱과 certificate가 다른 상태다.
- 공식 앱 제거 전 데이터·MFA·단말 등록 복구 계획을 확인한다.
- package 이름만 바꾸면 provider authority, deep link, 서버 등록도 달라질 수 있다.

#### split APK 설치 실패

- `adb shell pm path`로 원본 split 구성을 확인한다.
- base와 config split의 version·certificate를 맞춘다.
- AAB가 제공됐다면 고객사 test build 또는 bundletool 흐름을 우선한다.

#### 패치본 첫 실행 crash

- resource 오류, ABI 누락, multidex, 서명 검사, RASP를 로그로 구분한다.
- 비기능 변경 하나만 남겨 원인을 축소한다.
- Frida를 연결하지 않은 직접 실행 결과부터 확인한다.

#### iOS 설치·launch 실패

- profile 만료, 등록 단말, Team ID, application identifier를 확인한다.
- nested framework·extension 서명과 DER entitlement를 확인한다.
- App Store 암호화 binary 또는 keychain access group 변화를 확인한다.
- valid code signature 실패와 앱 자체 탐지 메시지를 구분한다.

#### attestation 서버 거부

- Play Integrity의 `requestHash`·certificate digest·versionCode를 확인한다.
- App Attest challenge, environment, assertion counter를 확인한다.
- 서버 거부를 로컬 위변조 검사 우회 실패로 오해하지 않는다.

## 빠른 명령어 참조

Android:

```bash
sha256sum original/target.apk
apksigner verify --verbose --print-certs original/target.apk
apktool d original/target.apk -o work/target-decoded
apktool b work/target-decoded -o work/target-unsigned.apk
zipalign -p -f 4 work/target-unsigned.apk work/target-aligned.apk
apksigner sign --ks work/assessment.jks --out signed/target-test.apk work/target-aligned.apk
apksigner verify --verbose --print-certs signed/target-test.apk
adb shell pm path com.target.app
adb install signed/target-test.apk
```

Windows hash:

```powershell
Get-FileHash -Algorithm SHA256 .\original\target.apk
```

iOS:

```bash
shasum -a 256 original/target.ipa
unzip -q original/target.ipa -d work/target-ipa
codesign -dvvv --entitlements :- work/target-ipa/Payload/Target.app
codesign --verify --deep --strict --verbose=4 work/target-ipa/Payload/Target.app
security cms -D -i work/target-ipa/Payload/Target.app/embedded.mobileprovision
```

## 관련 문서

- [정적 분석](static-analysis.md): package 구조, manifest·entitlement, 검증 코드의 정적 탐색
- [IDA Pro 분석](ida-pro-analysis.md): Native 무결성 함수와 비교 분기 분석
- [Frida 후킹 실무](frida-scripts.md): 확인한 앱 전용 메서드의 반환값·호출 시점 관찰
- [루팅 탐지 우회](root-detection-bypass.md): Android 환경 탐지와 위변조 검사의 경계
- [탈옥 탐지 우회](jailbreak-detection-bypass.md): iOS 환경 탐지와 code signing 문제의 경계
- [Anti-debug 우회](anti-debug-bypass.md): debugger·hook·runtime 무결성 탐지
- [SSL Pinning 우회](ssl-pinning-bypass.md): 패치·재서명이 필요한 인증서 검증 흐름
- [인증서 검증 및 평문 통신](certificate-validation.md): 전송 구간 검증과 다운로드 무결성

## 참고자료

공식 문서와 테스트 가이드:

- [OWASP MASTG - Runtime Integrity Verification](https://mas.owasp.org/MASTG/knowledge/android/MASVS-RESILIENCE/MASTG-KNOW-0032/)
- [OWASP MASTG - Repackaging and Re-Signing](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0039/)
- [OWASP MASTG - Patching Android Apps](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0038/)
- [OWASP MASTG - Patching iOS Apps](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0147/)
- [Android Developers - apksigner](https://developer.android.com/tools/apksigner)
- [Android Developers - SigningInfo](https://developer.android.com/reference/android/content/pm/SigningInfo)
- [Android Developers - InstallSourceInfo](https://developer.android.com/reference/android/content/pm/InstallSourceInfo)
- [Android Developers - Play Integrity overview](https://developer.android.com/google/play/integrity/overview)
- [Android Developers - Standard API requests](https://developer.android.com/google/play/integrity/standard)
- [Apple Developer - Code Signing Services](https://developer.apple.com/documentation/security/code-signing-services)
- [Apple Developer - Using the latest code signature format](https://developer.apple.com/documentation/xcode/using-the-latest-code-signature-format)
- [Apple Developer - Establishing your app's integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)

보조 도구:

- [Apktool](https://apktool.org/)
