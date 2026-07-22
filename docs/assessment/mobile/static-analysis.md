---
sidebar_position: 4
title: 정적 분석
description: APK와 IPA를 확보한 뒤 구조, 설정, 코드, 문자열을 순서대로 확인하고 동적 분석 후보를 만드는 실무 흐름
keywords: [Static Analysis, APK, IPA, apktool, jadx, Ghidra, AndroidManifest, Info.plist, MobSF, MASVS, MASTG]
toc_max_heading_level: 2
draft: false
---

> 정적 분석(Static Analysis)은 앱을 실행하기 전에 배포 파일의 구조와 설정, 코드, 문자열을 살펴보는 작업이다. 목표는 자동 도구의 경고를 모으는 것이 아니라 **확인할 코드 경로와 동적 분석 지점을 좁히는 것**이다.

## 사용 시점

- 고객사에서 APK, AAB, APKS 또는 복호화된 IPA를 전달받았을 때
- 프록시에서 보이지 않는 로직이나 보안 처리가 어디에 구현됐는지 찾아야 할 때
- 앱 권한, 외부 노출 컴포넌트, URL Scheme, ATS 예외를 먼저 정리할 때
- 하드코딩된 값과 내부 주소가 실제로 사용되는지 확인할 후보를 만들 때
- Frida로 후킹할 클래스, 메서드, 네이티브 함수의 범위를 줄일 때

정적 분석에서 발견한 문자열이나 설정 하나만으로 결함을 확정하지 않는다. 빌드 종류, 운영체제 버전, 호출 조건, 서버 측 통제와 실제 재현 결과를 함께 확인한다.

## 분석 기준 정보

전달받은 원본은 그대로 보관하고 복사본에서 분석한다. 파일명만으로 빌드를 구분하지 말고 해시와 확보 경로를 기록한다.

#### Step 1. 작업 디렉터리와 원본을 분리한다

```text
mobile-analysis/
├── original/       # 전달받은 원본, 수정하지 않음
├── work/           # 압축 해제와 디컴파일 결과
├── notes/          # 후보 위치와 재현 메모
└── evidence/       # 필요한 범위로 마스킹한 증적
```

#### Step 2. 해시와 기본 형식을 확인한다

Linux와 macOS:

```bash
sha256sum original/target.apk
file original/target.apk
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\original\target.apk
Get-Item .\original\target.apk | Select-Object Name, Length, LastWriteTime
```

기록할 항목은 파일명, SHA-256, 확보 일시, 전달 채널, 앱 버전, 패키지 또는 Bundle ID다. 이후 다른 빌드를 받으면 같은 분석 결과를 그대로 적용하지 않는다.

#### Step 3. 배포 형식을 구분한다

| 입력 파일 | 먼저 확인할 점 | 권장 시작 도구 |
| :--- | :--- | :--- |
| 단일 APK | 설치 가능한 완성 APK인지 확인 | jadx, apktool |
| AAB | 단말에 바로 설치하는 파일이 아님 | jadx, bundletool |
| APKS·XAPK·APKM | base와 split APK 구성 확인 | 압축 해제, bundletool 또는 전용 추출 도구 |
| IPA | App Store 배포본이면 실행 바이너리가 암호화됐을 수 있음 | unzip, `otool`, Ghidra·Hopper |

split APK 중 하나만 분석하면 다른 split에 포함된 리소스나 네이티브 라이브러리를 놓칠 수 있다. 실제 설치 세트와 동일한 입력인지 먼저 확인한다.

## 초기 분석 흐름

처음부터 모든 코드를 읽지 않는다. 다음 순서로 앱의 지도를 만든다.

#### Step 1. 패키지 구조와 프레임워크를 식별한다

- Android: `classes*.dex`, `lib/<ABI>/*.so`, `assets/`, `res/`, `AndroidManifest.xml`
- iOS: 주 실행 Mach-O, `Frameworks/`, `PlugIns/`, `Info.plist`, 프로비저닝과 entitlement
- Flutter, React Native, Unity, Cordova 같은 프레임워크 흔적
- 앱 자체 패키지와 외부 라이브러리의 경계

#### Step 2. 선언 설정을 읽는다

AndroidManifest와 Network Security Config, Info.plist와 entitlement를 확인한다. 이 단계에서는 **노출 후보와 후속 테스트 조건**만 적는다.

#### Step 3. 핵심 문자열에서 코드 위치로 이동한다

도메인, API 경로, 오류 문구, 저장 키 이름, 암호화 알고리즘, 인증·세션 관련 단어를 검색한다. 검색 결과의 문자열만 수집하지 말고 사용처(Find Usage)와 호출자를 따라간다.

#### Step 4. 사용자 행동과 코드 경로를 연결한다

예를 들어 로그인 버튼 → ViewModel 또는 Controller → API Client → 응답 처리 → 저장소의 흐름을 한 줄로 그린다. 이 지도가 이후 프록시 점검과 Frida 후킹 순서를 결정한다.

#### Step 5. 다음 작업으로 넘길 후보를 만든다

- 후킹할 클래스·메서드 또는 네이티브 심볼
- 실제 호출 여부를 확인할 URL과 기능
- 단말 저장소에서 확인할 파일·키 이름
- 별도 보호·우회 문서로 넘길 탐지 또는 Pinning 구현

## Android 정적 분석

### APK 구조

```bash
unzip -l target.apk
unzip -q target.apk -d work/apk-raw
```

```text
AndroidManifest.xml       # 보통 바이너리 XML
classes.dex               # Java/Kotlin 바이트코드
classes2.dex              # MultiDex 사용 시 추가
resources.arsc            # 컴파일된 리소스
res/                      # XML, 이미지 등
assets/                   # 앱이 직접 포함한 파일
lib/<ABI>/*.so            # 네이티브 라이브러리
META-INF/                 # 서명 관련 파일
```

**결과에서 볼 항목:** MultiDex 여부, 지원 ABI, 예상 밖의 설정·인증서·DB 파일, 디버그 자산, 프레임워크 흔적을 확인한다.

### apktool 선언·리소스

공식 설치 안내에 따라 wrapper와 최신 jar를 설치하거나 운영체제 패키지를 사용한다. 분석 전에 실제 옵션을 확인한다.

```bash
apktool --version
apktool d target.apk -o work/apktool
```

주요 결과:

- `work/apktool/AndroidManifest.xml`: 읽을 수 있는 매니페스트
- `work/apktool/res/xml/`: Network Security Config, FileProvider 경로 등
- `work/apktool/smali*/`: Java 디컴파일이 불완전할 때 확인할 바이트코드 표현
- `work/apktool/assets/`: 앱에 포함된 설정과 데이터 파일

단순 분석에는 재빌드와 재서명이 필요 없다. 패치가 필요한 별도 실습에서만 원본과 수정본을 구분해 수행한다.

### jadx 코드·사용처

jadx는 APK, DEX, AAB 등을 직접 열 수 있다. 모든 코드를 완벽히 복원하는 도구는 아니므로 디컴파일 오류가 있는 클래스는 Smali나 네이티브 코드와 대조한다.

```bash
jadx --version
jadx -d work/jadx target.apk
jadx-gui target.apk
```

jadx-gui에서는 다음 순서가 효율적이다.

1. 앱 패키지와 외부 라이브러리를 구분한다.
2. 로그인, 인증, 저장, 암호화, 네트워크 관련 화면에서 시작한다.
3. 문자열 검색 후 `Find Usage`로 실제 사용처를 확인한다.
4. 인터페이스 구현체와 호출자를 따라가며 동적 분석 후보를 기록한다.

검색어는 앱 기능에 맞춰 좁힌다. `password|secret|token`을 전체 출력하는 방식보다 실제 API 경로, 오류 문구, 클래스 접두사부터 찾는 편이 노이즈가 적다.

### AndroidManifest 검증 후보

| 선언 후보 | 정적 분석에서 확인할 내용 | 다음 검증 |
| :--- | :--- | :--- |
| `debuggable="true"` | 배포 빌드인지, manifest 병합 결과인지 | 실제 디버거 연결 가능 여부 |
| `allowBackup="true"` | 대상 Android 버전과 데이터 추출 규칙 | 실제 백업 범위와 민감정보 포함 여부 |
| `usesCleartextTraffic="true"` | Network Security Config의 도메인별 예외 | 실제 기능에서 HTTP가 사용되는지 |
| `exported="true"` | 컴포넌트 종류, permission, intent-filter | 비정상 호출과 권한 검증 여부 |
| URL Scheme·App Link | 허용 host/path와 입력 처리 | [딥링크 및 Intent](deeplink-intent.md) 점검 |
| 과도해 보이는 권한 | 기능상 필요성과 런타임 요청 시점 | 거부했을 때 기능 제한과 데이터 접근 |

`exported="true"`나 Custom URL Scheme 자체는 결함이 아니다. 외부 입력을 신뢰하거나 권한 확인 없이 민감 기능을 실행하는지까지 확인해야 한다.

### Native 라이브러리 연계

```bash
find work/apk-raw/lib -type f -name '*.so'
file work/apk-raw/lib/arm64-v8a/libtarget.so
strings work/apk-raw/lib/arm64-v8a/libtarget.so | head
```

Windows에서는 파일 목록을 먼저 확인한다.

```powershell
Get-ChildItem -Recurse .\work\apk-raw\lib -Filter *.so
```

Ghidra, IDA, radare2 등의 분석 도구에서는 JNI 등록부, `Java_<package>_<class>_<method>` 형태의 함수, Java 쪽 `System.loadLibrary()` 호출을 서로 연결한다. 문자열이 발견됐다는 사실보다 **어떤 함수가 언제 사용하는지**가 중요하다.

### 보조 디컴파일러

jadx가 특정 클래스에서 실패했을 때만 다른 디컴파일 결과와 비교한다.

```bash
d2j-dex2jar target.apk -o work/target.jar
```

결과가 서로 다르면 Java처럼 보이는 의사 코드만 믿지 말고 Smali의 분기와 호출을 확인한다. 난독화된 이름을 임의로 의미 있는 이름처럼 해석하지 않는다.

## iOS 정적 분석

### IPA 분석 상태

IPA는 ZIP 형식이지만 App Store에서 확보한 실행 바이너리는 FairPlay 암호화 상태일 수 있다. 복호화된 테스트 빌드를 요청하거나 허가된 단말에서 확보하는 절차는 [iOS 진단 환경 구성](setup-ios.md)의 IPA 확보 절차를 따른다.

```bash
unzip -q target.ipa -d work/ipa
find work/ipa/Payload -maxdepth 2 -type f
```

Windows에서는 7-Zip 같은 ZIP 호환 도구로 같은 구조를 추출할 수 있다.

```powershell
7z x .\target.ipa -o.\work\ipa
```

주 실행 파일을 찾은 뒤 암호화 상태를 확인한다.

```bash
otool -l work/ipa/Payload/Target.app/Target | grep -A5 LC_ENCRYPTION_INFO
```

`cryptid 1`이면 해당 바이너리의 코드 분석이 제한된다. 이 상태에서 디컴파일 결과가 비어 있다고 도구 오류로 단정하지 않는다.

### Info.plist·Entitlement

macOS:

```bash
plutil -p work/ipa/Payload/Target.app/Info.plist
codesign -d --entitlements :- work/ipa/Payload/Target.app/Target
```

Linux에서 `libplist` 도구를 사용하는 경우:

```bash
plistutil -i work/ipa/Payload/Target.app/Info.plist -o work/Info.plist.xml
```

| 선언 후보 | 정적 분석에서 확인할 내용 | 다음 검증 |
| :--- | :--- | :--- |
| ATS 예외 | 전체 허용인지 특정 도메인 예외인지 | 실제 평문 통신과 전송 데이터 |
| `CFBundleURLTypes` | Scheme와 처리 진입점 | [딥링크 및 Intent](deeplink-intent.md) 점검 |
| Associated Domains | applinks 도메인과 entitlement 일치 | AASA 범위와 앱의 입력 검증 |
| 파일 공유 관련 키 | 어떤 문서가 사용자에게 노출되는지 | 실제 공유 컨테이너의 민감정보 |
| 권한 설명 키 | 기능과 일치하는지 | 권한 거부 시 동작과 최소 권한 |

ATS 예외나 파일 공유 설정도 사용 맥락과 실제 데이터 범위를 확인한 뒤 판단한다.

### Mach-O·Framework 구성

```bash
file work/ipa/Payload/Target.app/Target
otool -L work/ipa/Payload/Target.app/Target
nm -m work/ipa/Payload/Target.app/Target | head -50
find work/ipa/Payload/Target.app/Frameworks -maxdepth 2 -type f
```

`otool`, `nm`, `codesign`은 주로 macOS에서 사용한다. Windows나 Linux에서는 Ghidra, radare2, LLVM 계열 도구로 Mach-O를 열 수 있지만 Apple 전용 메타데이터 확인은 macOS 결과와 대조하는 편이 안정적이다.

Objective-C 이름이 남아 있으면 클래스와 selector가 좋은 시작점이다. Swift나 심볼이 제거된 바이너리는 문자열의 cross-reference, 함수 호출 그래프, 정적 오프셋을 이용해 후보를 좁힌다. `class-dump`는 Objective-C 메타데이터가 충분히 남은 바이너리에서만 보조적으로 사용한다.

```bash
class-dump work/ipa/Payload/Target.app/Target -o work/headers
```

고정 주소를 메모하지 말고 **파일 해시 + 모듈명 + 함수명 또는 모듈 기준 오프셋**을 기록한다. ASLR과 빌드 변경으로 실행 주소가 달라질 수 있다.

## 문자열·시크릿 후보

### 범위 제한 검색

```bash
rg -n -i --glob '!**/build/**' \
  'api[_-]?key|client[_-]?secret|authorization|bearer|password|https?://' \
  work/jadx work/apktool
```

Mach-O와 네이티브 라이브러리에서는 먼저 문자열 파일을 만들고 필요한 범위만 찾는다.

```bash
strings work/ipa/Payload/Target.app/Target > work/target.strings.txt
rg -n -i 'token|secret|password|https?://' work/target.strings.txt
```

#### 결과를 판단하는 순서

1. 값의 종류를 구분한다. 공개 식별자, 테스트 값, 실제 인증 가능한 비밀은 다르다.
2. 코드 사용처와 빌드 변형을 확인한다. 주석이나 미사용 리소스일 수 있다.
3. 허가된 범위에서 최소 요청으로 유효성을 확인한다.
4. 증적에는 전체 값을 남기지 않고 앞뒤 일부와 길이만 기록한다.
5. 폐기·교체가 필요한 값이면 담당자와 안전한 전달 경로를 사용한다.

Secret scanner는 놓친 패턴을 찾는 보조 수단이다.

```bash
trufflehog filesystem work/jadx
detect-secrets scan work/jadx
```

탐지 결과를 그대로 공유하지 말고 오탐과 실제 사용 여부를 수동으로 확인한다.

## MobSF 보조 분석

```bash
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest
```

브라우저에서 `http://localhost:8000`에 접속해 허가된 파일만 업로드한다. 고객사 자료를 외부 서비스에 업로드하지 않고 로컬 실행 정책과 보관 기준을 먼저 확인한다.

MobSF 결과는 다음 용도로 적합하다.

- 권한, 선언 설정, 인증서, 라이브러리의 빠른 목록화
- 수동 분석에서 빠뜨린 파일과 문자열 후보 확인
- 동일 빌드의 반복 분석 기준점

점수나 경고 개수는 결함 수가 아니다. 도구가 앱의 업무 맥락과 서버 측 통제를 알 수 없으므로 각 항목을 원본 파일과 실제 동작으로 재검증한다.

## 후속 작업 연계

| 발견한 후보 | 기록할 최소 정보 | 다음 행동 |
| :--- | :--- | :--- |
| 외부 노출 컴포넌트 | 컴포넌트명, permission, intent-filter | 실제 외부 호출과 권한 확인 |
| 인증·검증 메서드 | 클래스, 시그니처, 호출자 | [Frida 후킹 실무](frida-scripts.md)에서 관찰 |
| Pinning·환경 탐지 | 구현 클래스와 호출 시점 | 해당 보호·우회 문서에서 별도 실습 |
| 저장 키·파일명 | 생성·조회 코드와 데이터 종류 | Android·iOS 저장소 문서에서 단말 확인 |
| 내부 URL·시크릿 후보 | 마스킹한 값, 사용처, 빌드 해시 | 최소 범위 유효성 검증 |
| 네이티브 함수 | 모듈명, 심볼 또는 오프셋, 호출자 | 런타임 모듈 기준으로 후킹 |

정적 분석 노트에는 “발견”과 “확인 완료”를 구분한다. 예를 들어 `usesCleartextTraffic=true 발견`과 `로그인 요청이 HTTP로 전송됨 확인`은 증거 수준이 다르다.

## 트러블슈팅

### apktool 리소스 디코딩 실패

```bash
apktool --version
apktool d --no-res target.apk -o work/apktool-no-res
```

최신 안정 버전인지 먼저 확인한다. 제조사 프레임워크가 필요한 APK라면 해당 프레임워크를 별도 작업 디렉터리에 등록하고, `--no-res` 결과는 리소스가 빠진 제한된 결과임을 메모한다.

### jadx 디컴파일 불완전

- jadx의 디컴파일 오류 표시와 로그를 확인한다.
- `simple` 또는 `fallback` 모드 결과와 Smali를 대조한다.
- 앱 패키지의 다른 DEX와 split APK가 빠지지 않았는지 확인한다.
- 런타임에 로드되는 DEX나 네이티브 구현이면 [Frida 후킹 실무](frida-scripts.md)로 확인한다.

### IPA 코드 식별 실패

- `cryptid`로 암호화 상태를 확인한다.
- 주 실행 파일을 올바르게 선택했는지 확인한다.
- Swift 심볼 제거와 난독화를 도구 실패와 구분한다.
- 같은 빌드의 복호화된 테스트 산출물을 요청한다.

### 검색 결과 과다

외부 라이브러리와 생성 코드를 제외하고 앱 패키지부터 본다. 기능 화면에서 보이는 오류 문구나 API path처럼 고유한 문자열로 시작해 호출 그래프를 넓힌다.

## 빠른 명령어 참조

```bash
# Android
apktool d target.apk -o work/apktool
jadx -d work/jadx target.apk
jadx-gui target.apk

# iOS (macOS)
unzip -q target.ipa -d work/ipa
plutil -p work/ipa/Payload/Target.app/Info.plist
otool -L work/ipa/Payload/Target.app/Target

# 공통 검색
rg -n -i 'token|secret|password|https?://' work
```

## 관련 문서

- [Android 진단 환경 구성](setup-android.md)
- [iOS 진단 환경 구성](setup-ios.md)
- [Frida 후킹 실무](frida-scripts.md)
- [SSL Pinning 우회](ssl-pinning-bypass.md)
- [Root 탐지 우회](root-detection-bypass.md)
- [탈옥 탐지 우회](jailbreak-detection-bypass.md)
- [Android 데이터 저장](data-storage-android.md)
- [iOS 데이터 저장](data-storage-ios.md)

## 참고자료

### 공식 문서와 프로젝트

- [OWASP MASTG - Static Analysis on Android](https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0014/)
- [OWASP MASTG - Static Analysis on iOS](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0066/)
- [OWASP MASTG - Testing Tools](https://mas.owasp.org/MASTG/tools/)
- [jadx](https://github.com/skylot/jadx)
- [Apktool 설치 문서](https://apktool.org/docs/install/)
- [Ghidra](https://ghidra-sre.org/)
- [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF)

### 커뮤니티 참고자료

- [class-dump](https://github.com/nygard/class-dump)
- [HackTricks - Android Application Pentesting](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting)
- [HackTricks - iOS Pentesting](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting)
