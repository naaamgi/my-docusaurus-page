---
sidebar_position: 22
title: IDA Pro 네이티브 분석
description: IDA Pro로 Android ELF·JNI와 iOS Mach-O·Objective-C·Swift 코드를 찾고 런타임 주소까지 연결하는 실무 분석 노트
keywords: [IDA Pro, Native Analysis, ELF, JNI, Mach-O, Objective-C, Swift, Frida, Hex-Rays, Reverse Engineering]
toc_max_heading_level: 3
draft: false
---

> jadx에서 흐름이 끊기는 Android `.so`와 iOS Mach-O를 IDA에서 따라간다. 목표는 바이너리 전체를 읽는 것이 아니라 현재 진단 항목과 연결된 함수, 입력, 반환값, 호출 위치를 찾는 것이다.

## 사용 시점

- Java·Kotlin 코드가 `native` 선언이나 `System.loadLibrary()`에서 끝날 때
- iOS 앱의 인증서 검증, 탈옥 탐지, 암호화, 무결성 검사가 native code에 있을 때
- 문자열·API 호출은 찾았지만 실제 분기 조건과 호출자를 모를 때
- Frida hook에 사용할 export 또는 module-relative offset이 필요할 때
- 정적 결과가 실제 실행 경로인지 최소 동적 관찰로 확인할 때

IDA는 분석 수단이다. 함수가 읽힌다는 사실만으로 취약점이 되지 않는다. 찾은 로직은 [Frida 후킹](./frida-scripts.md), [SSL Pinning 우회](./ssl-pinning-bypass.md), [루팅 탐지 우회](./root-detection-bypass.md), [탈옥 탐지 우회](./jailbreak-detection-bypass.md) 같은 실제 진단 문서로 넘긴다.

## 분석 기준

분석 파일과 실행 환경이 다르면 함수 주소와 동작이 맞지 않는다. 시작 전에 다음 정보를 고정한다.

| 기준 | 기록할 내용 |
| :--- | :--- |
| 앱 | package·Bundle ID, 버전, build, 파일 hash |
| 파일 | APK·IPA 출처, ELF·Mach-O 경로, framework·extension 여부 |
| 아키텍처 | arm64-v8a, armeabi-v7a, arm64, arm64e, simulator architecture |
| 보호 상태 | stripped symbol, 난독화, packed·encrypted 여부 |
| IDA | IDA·Decompiler 버전, processor, image base |
| 실행 | 단말 아키텍처, 로드 module 이름, runtime base |
| 목표 | 함수가 처리하는 입력, 기대 반환형, 호출 기능 |

Pseudocode는 원본 소스가 아니다. 함수 경계, 변수 타입, 구조체, calling convention이 잘못 복원될 수 있다. 분기와 메모리 접근이 중요할 때는 disassembly와 함께 확인한다.

## 파일·아키텍처

| 플랫폼 | 주요 파일 | 먼저 볼 항목 |
| :--- | :--- | :--- |
| Android | `lib/<ABI>/*.so` ELF | JNI, export, import, string, init array |
| iOS | `.app/<CFBundleExecutable>` Mach-O | Objective-C selector, Swift symbol, import, string |
| iOS framework | `.app/Frameworks/*.framework/*` | SDK·공통 보안 로직 |
| iOS extension | `.app/PlugIns/*.appex/*` | 별도 진입점과 entitlements |

동적 분석까지 이어갈 Android `.so`는 실제 단말과 같은 ABI를 선택한다. 여러 ABI가 같은 소스에서 만들어져도 compiler 최적화와 offset은 달라질 수 있다.

App Store에서 받은 iOS 실행 파일은 FairPlay 암호화 상태일 수 있다. 먼저 고객사가 제공한 분석용·개발용 build를 요청하고, 배포 바이너리만 있다면 허가된 환경에서 code section을 분석할 수 있는 상태인지 확인한다. IPA 압축 해제만으로 항상 분석 가능한 것은 아니다.

## 분석 절차

#### Step 1. 대상 함수 질문

“보안 함수 찾기”처럼 넓게 시작하지 않는다. 다음처럼 입력과 결과가 있는 질문으로 좁힌다.

- Java `native boolean isDeviceTrusted()`는 어느 native 함수와 연결되는가
- 특정 오류 문자열을 출력하는 분기는 어떤 조건을 검사하는가
- URLSession challenge 처리에서 최종 trust 결과를 어느 함수가 소비하는가
- 암호화 API의 key·IV는 어느 호출자에서 만들어지는가

#### Step 2. 외부 단서

jadx, Manifest, Info.plist, entitlements, strings, imports에서 class·method·library 이름을 모은다. IDA에서 바로 전체 Functions 목록을 훑기보다 외부 단서를 첫 검색어로 사용한다.

#### Step 3. 진입점

Android는 JNI export와 `JNI_OnLoad`·`RegisterNatives`, iOS는 Objective-C selector와 Swift·C++ symbol, import 호출부를 우선한다.

#### Step 4. 교차 참조

문자열이나 import에서 `X`로 caller를 거슬러 올라간다. wrapper 함수와 실제 판정 함수를 분리하고, 호출 순서를 짧게 메모한다.

#### Step 5. 타입·이름 복원

근거가 생긴 함수와 변수만 rename한다. 함수 prototype, 구조체, enum을 적용한 뒤 pseudocode를 새로 생성해 흐름이 안정되는지 본다.

#### Step 6. 런타임 관찰

export가 있으면 이름으로 먼저 찾고, 없을 때만 image base를 뺀 offset을 사용한다. 함수 진입 횟수, 인자 pointer, 반환값을 읽기 전용으로 관찰한다.

#### Step 7. 진단 항목 연결

정적 함수, runtime address, 실제 앱 기능을 하나의 표로 묶는다. 우회나 값 변경은 해당 진단 문서에서 필요한 최소 범위로 수행한다.

## 실습 노트

### Android · ELF·JNI

APK를 해제한 뒤 같은 이름의 `.so`가 ABI별로 있는지 확인한다.

#### 파일 식별

```bash
apktool d app-release.apk -o app-decoded
file app-decoded/lib/arm64-v8a/libtarget.so
llvm-readelf -h -S -d app-decoded/lib/arm64-v8a/libtarget.so
```

Windows에서는 Android NDK의 `llvm-readelf.exe`, `llvm-nm.exe`, `llvm-objdump.exe`를 사용할 수 있다. UPX·custom packer처럼 IDA에서 code section이 정상적으로 보이지 않는 경우는 먼저 runtime unpacking 여부를 확인한다.

#### Java 진입점

```bash
rg -n 'System\.loadLibrary|System\.load\(|\bnative\s+' jadx-output/sources
```

`System.loadLibrary("target")`은 일반적으로 `libtarget.so`를 로드한다. native method의 Java class, method name, signature를 기록하고 해당 ABI의 library로 이동한다.

#### 정적 JNI

Exports에서 다음 형태를 찾는다.

```text
Java_com_example_security_NativeBridge_isDeviceTrusted
```

이름이 보이면 Java method와 직접 연결하기 쉽다. overload는 JNI name encoding과 signature suffix가 붙을 수 있으므로 symbol 전체를 확인한다.

#### 동적 JNI

Android NDK는 `JNI_OnLoad()`에서 `RegisterNatives()`로 method를 등록하는 방식을 권장한다. 이 경우 실제 native 함수가 export 목록에 나타나지 않을 수 있다.

```c
static JNINativeMethod methods[] = {
    {"isDeviceTrusted", "()Z", (void *)check_device},
    {"makeToken", "([B)[B", (void *)make_token}
};
```

IDA에서 `JNI_OnLoad`의 xref와 `RegisterNatives` 호출을 찾고 `JNINativeMethod` 배열의 세 항목을 복원한다.

| 항목 | 의미 |
| :--- | :--- |
| `name` | Java·Kotlin native method 이름 |
| `signature` | JNI parameter·return signature |
| `fnPtr` | 실제 native 함수 주소 |

`RegisterNatives`가 직접 import되지 않았다면 `JNIEnv` function table의 간접 호출, wrapper, 문자열 xref를 함께 본다.

### iOS · Mach-O·Objective-C

`Info.plist`의 `CFBundleExecutable`로 main executable을 확인하고 Frameworks와 PlugIns도 별도 파일로 취급한다.

#### Mach-O 상태

```bash
file Payload/Target.app/Target
otool -hv Payload/Target.app/Target
otool -l Payload/Target.app/Target
```

`LC_ENCRYPTION_INFO` 또는 `LC_ENCRYPTION_INFO_64`의 `cryptid`와 code section 상태를 확인한다. IDA에서 실행 함수 대부분이 의미 없는 데이터로 보이면 잘못된 architecture, 불완전한 추출, 암호화 상태를 먼저 의심한다.

#### Objective-C 진입점

Objective-C metadata가 남아 있으면 다음 형태의 method와 selector를 찾을 수 있다.

```text
-[SecurityManager evaluateDeviceState]
+[CertificateValidator validateTrust:forHost:]
```

문자열·selector에서 xref를 따라 method implementation으로 이동한다. `objc_msgSend` 자체가 아니라 직전에 준비되는 receiver와 selector, ARM64 argument register를 함께 읽는다.

| ARM64 register | 일반적인 의미 |
| :--- | :--- |
| `x0` | receiver·첫 번째 C 인자 |
| `x1` | selector·두 번째 C 인자 |
| `x2` 이후 | method·함수의 추가 인자 |
| `x0` | 정수·pointer 반환값 |

Compiler 최적화와 calling convention에 따라 달라질 수 있으므로 prototype과 call site로 확인한다.

### Swift·C++ Symbol

Swift와 C++ 이름은 mangled symbol로 보일 수 있다. IDA의 demangle 결과가 부족하면 외부 도구로 의미를 확인한다.

```bash
nm -m Payload/Target.app/Target
xcrun swift-demangle '$s6Target15SecurityManagerC13evaluateStateSbyF'
```

Swift method가 모두 Objective-C runtime에 노출되는 것은 아니다. 다음 단서를 함께 사용한다.

- error·log·endpoint·file path 문자열
- imported Security·CryptoKit·CommonCrypto 함수
- protocol conformance와 metadata accessor
- caller·callee의 argument와 반환값 사용 방식
- bridge되는 `@objc` selector와 Objective-C wrapper

C++는 demangled class·namespace, virtual table, RTTI, constructor xref가 진입점이 된다.

### 문자열·교차 참조

현재 증상과 가까운 문자열부터 찾는다. `root`, `jailbreak` 같은 한 단어보다 화면 오류, log format, API path처럼 고유한 문자열이 유리하다.

#### IDA 순서

1. Strings에서 고유 문자열을 찾는다.
2. 문자열의 xref(`X`)로 사용 위치를 연다.
3. 해당 함수의 caller xref를 확인한다.
4. 성공·실패 분기와 반환값 소비 위치를 표시한다.
5. 같은 문자열을 쓰는 unrelated SDK 코드를 제외한다.

문자열이 runtime에 복호화되면 import, constant, Java·Objective-C caller, Frida trace로 진입점을 바꾼다.

### 함수·타입 복원

Pseudocode가 읽히지 않을 때는 decompiler 탓으로 끝내지 않고 입력 정보를 보완한다.

#### 복원 순서

- 함수 경계와 code·data 구분
- 호출 함수 prototype과 return type
- JNI·Objective-C·C 구조체 타입
- 숫자 표현을 enum·offset·hex 중 의미 있는 형태로 변경
- 함수·변수 rename과 짧은 comment
- caller의 인자 전달과 반환값 사용 재확인

`F5`는 현재 함수를 decompile하고 `Tab`은 pseudocode와 disassembly를 전환한다. Pseudocode는 타입을 바꾼 뒤 자동으로 항상 갱신되지 않으므로 다시 `F5`로 갱신한다.

### 주소·Offset

ASLR 때문에 IDA에 보이는 주소와 runtime address는 보통 다르다. module 기준 상대 offset으로 연결한다.

```text
module_offset = IDA_function_address - IDA_image_base
runtime_address = runtime_module_base + module_offset
```

예를 들어 IDA image base가 `0x0`, 함수가 `0x1A2B3`이면 offset은 `0x1A2B3`이다. IDA를 runtime base로 rebase했다면 차이를 다시 더하지 않는다.

#### 검증 항목

- 분석 파일과 runtime module의 hash·UUID·Build ID 일치
- 같은 ABI·architecture 여부
- offset이 executable segment 안에 포함되는지
- export·DebugSymbol 결과와 계산 주소가 같은 함수인지
- wrapper·PLT stub가 아닌 실제 implementation인지

주소가 맞는지 확인하기 전 값을 변경하거나 함수를 replace하지 않는다.

### Frida 연동

현재 Frida JavaScript API에서는 `Process.getModuleByName()`으로 module 객체와 base를 얻을 수 있다. export 이름이 있으면 offset보다 export 조회를 우선한다.

#### Offset 관찰

```javascript
const module = Process.getModuleByName('libtarget.so');
const offset = ptr('0x1A2B3');
const target = module.base.add(offset);
const range = Process.findRangeByAddress(target);

console.log(JSON.stringify({
  module: module.name,
  base: module.base.toString(),
  target: target.toString(),
  protection: range?.protection ?? 'unmapped'
}));

Interceptor.attach(target, {
  onEnter(args) {
    console.log(`arg0=${args[0]} arg1=${args[1]}`);
  },
  onLeave(retval) {
    console.log(`retval=${retval}`);
  }
});
```

`range`가 없거나 executable 권한이 없으면 attach하지 않고 binary·offset을 다시 확인한다. Pointer는 유효 길이와 type을 모르는 상태에서 바로 문자열로 읽지 않는다.

#### 지연 로드 Library

앱 시작 시 module이 아직 없으면 module observer를 사용한다.

```javascript
const observer = Process.attachModuleObserver({
  onAdded(module) {
    if (module.name === 'libtarget.so') {
      console.log(`loaded ${module.name} @ ${module.base}`);
    }
  }
});
```

실제 hook 설치 코드는 중복 설치를 막는 flag와 함께 사용한다. 상세 실행 방식과 Java·Objective-C hook은 [Frida 후킹](./frida-scripts.md)에서 다룬다.

## 결과 정리

IDA 분석 결과는 다음 진단으로 넘길 수 있는 형태로 남긴다.

| 항목 | 기록 예시 |
| :--- | :--- |
| 기능 | 인증서 chain 결과를 최종 boolean으로 변환 |
| 정적 위치 | `libnetwork.so`, IDA `sub_1A2B3` |
| 근거 | 오류 문자열 xref, Security API caller, 분기 |
| 입력 | `SecTrustRef`, host string 후보 |
| 반환 | `0` 실패, `1` 성공 후보 |
| runtime | module offset `0x1A2B3`, 호출 1회 확인 |
| 다음 작업 | 반환값 소비 caller 확인, Pinning 문서 연계 |

함수 이름이나 pseudocode만으로 의미를 확정하지 않는다. 실제 기능을 한 번 실행해 호출 여부와 입력·반환값을 연결하면 `후보`에서 `확인`으로 올린다.

## 증적·노트

- 원본 파일 hash와 추출 경로
- architecture, ELF Build ID·Mach-O UUID
- IDA database 이름과 image base
- rename 전 원래 symbol·주소
- 문자열·import·caller xref 경로
- 적용한 function prototype과 구조체
- module-relative offset과 runtime base
- Frida 적용 version과 관찰 시점
- 호출 기능, 입력 요약, 반환값
- 미확정 가정과 다음 확인 항목

IDB·I64에는 분석 정보가 누적되므로 원본과 별도로 보관한다. 팀 공유 시 rename 규칙과 comment 근거를 함께 남긴다.

## 트러블슈팅

#### `F5` Decompile 실패

- 해당 architecture용 Hex-Rays Decompiler license를 확인한다.
- cursor가 함수 내부인지, 함수 경계가 올바른지 확인한다.
- code를 data로 잘못 인식했거나 tail이 다른 함수에 붙었는지 본다.

#### Export·Symbol 부족

- stripped binary에서는 정상적인 현상일 수 있다.
- JNI 동적 등록, string, import, init array, caller pattern으로 전환한다.
- Android의 다른 ABI에 symbol이 더 남아 있는지 비교하되 offset은 재사용하지 않는다.

#### JNI 함수 식별 실패

- `JNI_OnLoad`, `RegisterNatives`, `JNINativeMethod` signature 문자열을 찾는다.
- library가 실행 중 늦게 로드되거나 다른 `.so`가 bridge 역할을 하는지 확인한다.
- `dlsym()`과 encrypted string 사용 여부를 본다.

#### Mach-O Code 식별 실패

- `CFBundleExecutable`과 실제 파일을 다시 맞춘다.
- framework·extension·simulator binary를 main executable로 오인하지 않았는지 본다.
- encryption load command와 architecture slice를 확인한다.

#### IDA·Runtime 주소 불일치

- image base를 두 번 더하지 않았는지 확인한다.
- 실행 중인 module과 분석 파일의 hash·UUID·ABI를 비교한다.
- ASLR slide, PLT stub, thunk, rebased database를 확인한다.

#### ARM32 Thumb 오프셋

- 32-bit ARM의 수동 계산 주소는 ARM·Thumb 상태가 맞아야 한다.
- symbol API가 반환한 pointer를 우선하고, 수동 주소의 최하위 bit와 IDA segment register를 확인한다.
- arm64에는 같은 방식의 Thumb bit를 적용하지 않는다.

#### Hook 직후 Crash

- 함수 시작 주소와 calling convention을 재확인한다.
- 너무 자주 호출되는 함수의 과도한 logging을 줄인다.
- pointer를 type·길이 확인 없이 읽지 않는다.
- 관찰 hook으로 기준선을 만든 뒤 필요한 변경만 추가한다.

## 빠른 단축키

| 목적 | 단축키·메뉴 | 사용 시점 |
| :--- | :--- | :--- |
| Pseudocode | `F5` | 현재 함수 decompile·갱신 |
| View 전환 | `Tab` | pseudocode·disassembly 비교 |
| Graph 전환 | `Space` | branch와 basic block 확인 |
| Cross reference | `X` | 문자열·함수 caller 추적 |
| Rename | `N` | 근거가 생긴 함수·변수 이름 |
| Type 변경 | `Y` | function prototype·변수 type 보정 |
| Strings | `Shift+F12` | 고유 오류·경로·endpoint 검색 |
| 함수 이동 | `G` | 주소·offset으로 이동 |
| Comment | `;` | 판단 근거와 미확정 가정 기록 |

## 관련 문서

- [정적 분석](./static-analysis.md)
- [Frida 후킹](./frida-scripts.md)
- [루팅 탐지 우회](./root-detection-bypass.md)
- [탈옥 탐지 우회](./jailbreak-detection-bypass.md)
- [디버거·Frida 탐지 우회](./anti-debug-bypass.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)

## 참고자료

#### 공식 문서

- [Hex-Rays - IDA Subviews](https://docs.hex-rays.com/ida-9.2/user-guide/user-interface/subviews)
- [Hex-Rays - Decompiler Interactive Operation](https://docs.hex-rays.com/user-guide/decompiler/interactive)
- [Hex-Rays - Segments and Rebase](https://docs.hex-rays.com/9.1/user-guide/user-interface/menu-bar/edit/segments)
- [Frida - JavaScript API](https://frida.re/docs/javascript-api/)
- [Android Developers - JNI Tips](https://developer.android.com/ndk/guides/jni-tips)

#### 점검 가이드

- [OWASP MASTG - Disassembling Android Native Code](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0018/)
- [OWASP MASTG - Disassembling iOS Native Code](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0068/)
- [OWASP MASTG - Exploring the iOS App Package](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0058/)
