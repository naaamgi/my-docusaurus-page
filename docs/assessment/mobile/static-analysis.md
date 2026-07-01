---
sidebar_position: 5
title: 정적 분석 (Static Analysis)
description: 모바일 진단 - APK/IPA 디컴파일 (apktool / jadx / dex2jar / class-dump / Hopper / Ghidra) + 매니페스트 / 문자열 / 시크릿 점검
keywords: [Static Analysis, apktool, jadx, dex2jar, class-dump, Hopper, Ghidra, AndroidManifest, Info.plist, MobSF, MASVS, MASTG]
draft: false
---

# 정적 분석 (Static Analysis)

> APK / IPA 를 디컴파일해 **실행 없이 코드 / 매니페스트 / 리소스에서 결함을 찾는 단계**.
> 동적 분석 (Frida 후킹) 의 후킹 지점을 정하는 정찰 단계 + 그 자체로 결함 (하드코드 시크릿 / 평문 키 / 위험 권한) 을 발견.

## 점검 환경 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-CODE / MASVS-CRYPTO / MASVS-PRIVACY / MASTG 정적 분석 |
| **대상 OS** | Android 14 / iOS 17 표준 |
| **사전 조건** | 점검 대상 APK / IPA 확보 (`setup-android.md` / `setup-ios.md` 참조) |
| **예상 소요** | 2 ~ 8 시간 (앱 규모 / 난독화 정도에 비례) |
| **핵심 도구** | apktool, jadx, dex2jar, class-dump, Hopper, Ghidra, MobSF |

---

## 점검 목적

정적 분석은 두 가지 역할을 동시에 수행:

1. **자체 결함 탐지** — 하드코드된 API 키 / 시크릿, 평문 암호화 키, AndroidManifest / Info.plist 의 위험 설정 (debuggable, allowBackup, exported component, ATS exception 등), 내부 디버그 엔드포인트 / 주석.
2. **동적 분석 정찰** — 후킹할 클래스 / 메서드 식별, SSL Pinning 구현 위치, Root / Jailbreak 탐지 로직 위치, 데이터 저장 코드 위치.

> **다른 페이지와 영역 분리**
> - SSL Pinning 우회 실행 → `ssl-pinning-bypass.md`
> - Root / 탈옥 탐지 우회 실행 → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
> - 데이터 저장소 점검 → `data-storage-android.md`, `data-storage-ios.md`
> - 동적 후킹 (Frida) → `frida-scripts.md`

---

## Android 정적 분석

### 1. APK 구조 + 추출

```bash
# APK 는 ZIP 아카이브 — unzip 으로 직접 열기 가능
unzip -d target target.apk

target/
├── AndroidManifest.xml      ← 바이너리 XML (apktool 으로 변환 필요)
├── classes.dex / classes2.dex ...   ← Dalvik 바이트코드
├── resources.arsc           ← 컴파일된 리소스
├── res/                     ← 리소스 (이미지 / XML)
├── assets/                  ← 임의 자산 (모델 파일 / 사전 / 보안 설정 등)
├── lib/
│   ├── arm64-v8a/*.so       ← Native 라이브러리
│   └── ...
└── META-INF/                ← 서명 정보
```

### 2. apktool — 매니페스트 + 리소스 + Smali 디컴파일

```bash
# 설치
brew install apktool                            # macOS
# 또는 https://apktool.org/ 에서 직접

# 디컴파일
apktool d target.apk -o target-decoded
# target-decoded/AndroidManifest.xml  ← 사람이 읽을 수 있는 XML
# target-decoded/smali/...            ← Dalvik 바이트코드의 smali 표현
# target-decoded/res/                 ← 디코딩된 리소스

# 재패키징 (Smali 패치 후)
apktool b target-decoded -o target-patched.apk

# 재서명 (apksigner 또는 uber-apk-signer)
uber-apk-signer -a target-patched.apk
```

**왜 apktool 인지**: `AndroidManifest.xml` 의 위험 설정 (`debuggable`, `allowBackup`, `usesCleartextTraffic`, `exported` 컴포넌트, custom URL scheme 등) 은 디코딩 없이는 못 읽음. 또한 SSL Pinning 우회용 Smali 패치 작업의 표준 도구.

### 3. jadx — Java 소스 디컴파일 (가장 자주 씀)

```bash
# 설치
brew install jadx                               # macOS

# CLI 모드 — 전체 소스 추출
jadx -d target-src target.apk

# GUI 모드 — 인터랙티브 분석 (강력 추천)
jadx-gui target.apk
```

**jadx-gui 활용:**

- **검색 (Ctrl+Shift+F / Cmd+Shift+F)** — `password`, `apikey`, `secret`, `Bearer`, `http://`, `okhttp`, `pinning`, `RootBeer` 등 키워드로 일괄 검색.
- **클래스 트리** — 패키지 구조 탐색. 비즈니스 로직 / 보안 로직 위치 파악.
- **사용처 추적 (Find Usage)** — 메서드 / 필드의 호출 / 참조 모두 추적.
- **난독화 매핑** — Mapping 파일이 있으면 임포트해 원본 이름 복원.

**왜 jadx 인지**: dex → Java 디컴파일 결과물의 가독성이 가장 좋고 검색 / 사용처 추적이 직관적. SSL Pinning 코드 위치 / Root 탐지 로직 / 시크릿 위치를 빠르게 찾을 수 있음.

### 4. dex2jar + JD-GUI (대안)

```bash
# dex → jar
d2j-dex2jar target.apk -o target.jar

# JD-GUI 로 jar 열기
jd-gui target.jar
```

**언제 쓰는지**: jadx 가 디컴파일 실패하는 일부 클래스. 두 도구의 디컴파일 결과를 비교하면 더 명확해지는 경우 있음.

### 5. AndroidManifest.xml 점검 항목

```xml
<!-- 위험 설정 검색 -->

<application
    android:debuggable="true"                ← 위험: 프로덕션 빌드인데 디버거블
    android:allowBackup="true"               ← 위험: adb backup 으로 데이터 복사 가능 (Android 12 미만)
    android:usesCleartextTraffic="true"      ← 위험: 평문 HTTP 허용
    android:networkSecurityConfig="@xml/...">

    <!-- exported=true + intent-filter → 외부 호출 가능 -->
    <activity android:name=".AdminActivity"
              android:exported="true">       ← 점검: 외부 앱이 호출 가능한지
        <intent-filter>
            <action android:name="android.intent.action.VIEW"/>
            <data android:scheme="myapp"/>   ← Custom URL Scheme — deeplink-intent.md 영역
        </intent-filter>
    </activity>

    <!-- Provider 가 외부 노출 -->
    <provider android:name=".DataProvider"
              android:exported="true"        ← 점검: 데이터 임의 접근 가능
              android:authorities="com.target.provider"/>

</application>

<!-- 위험 권한 -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
```

**점검 체크리스트:**

- [ ] `debuggable="true"` 가 프로덕션 빌드에 있음
- [ ] `allowBackup="true"` (Android 12 미만 단말 대응 필요)
- [ ] `usesCleartextTraffic="true"` 또는 Network Security Config 가 `cleartextTrafficPermitted="true"`
- [ ] `exported="true"` 가 의도 없이 설정된 컴포넌트 (Activity / Service / Receiver / Provider)
- [ ] 사용 안 하는 권한 / 과도한 권한 (예: 점검 대상이 채팅 앱인데 `READ_CONTACTS`, `READ_SMS`, `CAMERA` 모두)

### 6. Native 라이브러리 (lib/arm64-v8a/*.so) — Ghidra / IDA

```bash
# Ghidra 로 분석 — JNI 함수 / 시크릿 / 안티 디버그
ghidraRun
# File → New Project → Import → libtarget.so
# Auto Analysis 후 Functions 검색 → "Java_com_target_app_..." JNI 함수
```

**언제 쓰는지**: 시크릿 / 키 / 안티 디버그 / SSL Pinning 이 Native 로 구현된 경우 (가장 흔한 보안 강화 패턴). Java 측 후킹만으로는 우회 불가능.

---

## iOS 정적 분석

### 1. IPA 구조

```bash
# IPA 도 ZIP — unzip
unzip -d target target.ipa

target/
└── Payload/
    └── TargetApp.app/
        ├── TargetApp                       ← Mach-O 실행 바이너리
        ├── Info.plist                      ← 메타데이터 + 권한 + URL scheme
        ├── embedded.mobileprovision        ← 코드사인 프로비저닝
        ├── _CodeSignature/                 ← 서명 정보
        └── Frameworks/                     ← 동적 라이브러리
```

### 2. Info.plist 점검 항목

```bash
# Binary plist → XML 변환
plutil -convert xml1 -o - target/Payload/TargetApp.app/Info.plist | less
```

**위험 설정 검색:**

```xml
<!-- ATS (App Transport Security) 우회 -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>                                  ← 위험: 모든 도메인 평문 HTTP 허용
    <key>NSExceptionDomains</key>
    <dict>
        <key>example.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>                          ← 위험: 특정 도메인 평문 허용
        </dict>
    </dict>
</dict>

<!-- URL Schemes (deeplink-intent.md 영역) -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>           ← myapp:// 로 외부 호출 가능
        </array>
    </dict>
</array>

<!-- Universal Links (Associated Domains) -->
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:example.com</string>   ← https://example.com/... 로 외부 호출 가능
</array>

<!-- 권한 사용 설명 (사용자에 노출) -->
<key>NSCameraUsageDescription</key>
<key>NSMicrophoneUsageDescription</key>
<key>NSLocationWhenInUseUsageDescription</key>
<key>NSContactsUsageDescription</key>
```

**점검 체크리스트:**

- [ ] `NSAllowsArbitraryLoads = true` (전체 평문 HTTP 허용)
- [ ] `NSExceptionDomains` 의 `NSExceptionAllowsInsecureHTTPLoads = true` (특정 도메인 평문)
- [ ] 사용 안 하는 / 과도한 권한 사용 설명
- [ ] `UIFileSharingEnabled = true` 또는 `LSSupportsOpeningDocumentsInPlace = true` (앱 컨테이너 외부 노출)
- [ ] Custom URL Scheme / Universal Link 정의 → `deeplink-intent.md` 와 결합 점검

### 3. class-dump — Objective-C 클래스 / 메서드 enumeration

```bash
brew install class-dump

# 복호화된 Mach-O 에서 모든 ObjC 클래스 / 메서드 추출
class-dump target/Payload/TargetApp.app/TargetApp -o target-headers/
ls target-headers/
# LoginManager.h
# SessionManager.h
# CryptoUtils.h
# ...
```

**언제 쓰는지**: iOS 점검의 첫 정찰 단계. 후킹할 클래스명 / 메서드 시그니처를 한 번에 파악. **Swift 클래스는 제한적** (mangling 영향) — Frida `Module.enumerateExports` 로 보완.

⚠️ **암호화된 IPA 는 추출 안 됨** — App Store 배포 IPA 는 FairPlay 암호화 상태. `frida-ios-dump` 로 복호화된 IPA 를 먼저 얻어야 함 (`setup-ios.md` Step 5).

### 4. Hopper / Ghidra / IDA — Mach-O 디스어셈블 + 디컴파일

```
Hopper Disassembler 또는 Ghidra 로 TargetApp 바이너리 열기
  → File → Read Executable to Disassemble → TargetApp
  → 자동 분석 후 Procedures 탭에서 함수 검색
```

**점검 활용:**

- 시크릿 / 하드코드 키 (Strings 탭에서 키워드 검색)
- SSL Pinning / 탈옥 탐지 함수의 어셈블리 분석 → 후킹 지점 확정
- Swift 함수 (mangling 된 이름) 의 원본 식별 + 주소 확보

### 5. otool / nm — 바이너리 메타데이터 (macOS 표준)

```bash
# 의존 라이브러리
otool -L TargetApp

# 모든 심볼
nm TargetApp | head -50

# 코드사인 정보
codesign -dv --verbose=4 TargetApp

# 실행 가능한 아키텍처
file TargetApp
# TargetApp: Mach-O 64-bit executable arm64
```

---

## 공용 — 시크릿 / 하드코드 자격증명 탐지

### 1. `strings` + `grep` 으로 빠른 정찰

```bash
# Android — APK 전체 / 특정 dex
strings target.apk | grep -iE 'api[_-]?key|secret|token|password|bearer|http'

# iOS — Mach-O 바이너리
strings TargetApp | grep -iE 'api[_-]?key|secret|token|password|bearer|http'

# 자주 발견되는 패턴
- "https://internal.<company>.com/..."   (내부 API 노출)
- "AWS_ACCESS_KEY_ID=AKIA..."             (AWS 자격증명)
- "Bearer eyJ..."                         (하드코드된 JWT)
- "sk_live_..."                            (Stripe 라이브 시크릿)
- "AIza..."                                (Google API Key)
```

### 2. `trufflehog` / `gitleaks` 식 스캐너

```bash
# trufflehog 으로 디컴파일된 소스 스캔
trufflehog filesystem target-decoded/

# detect-secrets
detect-secrets scan target-decoded/
```

**언제 쓰는지**: 수동 grep 으로 놓치는 패턴 (정규식 기반 카드 번호 / 키 형식 등) 자동 탐지.

### 3. MobSF (자동화 종합 분석) — 옵션

```bash
# Docker 로 가장 빠르게
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest

# 브라우저: http://localhost:8000
# APK / IPA 업로드 → 자동 분석 리포트 (매니페스트 / 권한 / 시크릿 / 위험 API 호출 / 안티 분석 등)
```

**언제 쓰는지**: 빠른 1차 스캔 / 보고서 기초 자료. 단, 자동화 도구의 한계 — **결과는 참고용** 이고, 실제 결함 판정은 수동 검증 필수.

---

## 점검 산출물 (보고 시 포함)

- [ ] AndroidManifest 위험 설정 목록 + 위치 (Activity 명 등)
- [ ] Info.plist 위험 설정 목록 + 위치
- [ ] 발견된 하드코드 시크릿 (마스킹 + 위치 + 종류)
- [ ] SSL Pinning / Root 탐지 / 탈옥 탐지 구현 위치 (있으면 우회 페이지로 연계)
- [ ] 사용된 외부 라이브러리 + 버전 (CVE 매칭)
- [ ] 디버그 / 테스트 엔드포인트 / 주석 (`http://dev.`, `// TODO: remove`, `Log.d` 의 민감 데이터)

---

## 트러블슈팅

### apktool 디컴파일 실패 — "Could not decode arsc file"

```bash
# 최신 apktool 사용 + 프레임워크 설치
apktool if framework-res.apk        # 시스템 프레임워크 등록
apktool d --no-res target.apk       # 리소스 무시 (Smali / Manifest 만)
```

### jadx 가 일부 클래스 디컴파일 실패

→ dex2jar + JD-GUI 또는 Bytecode Viewer 같은 멀티 디컴파일러로 보완. 일부 클래스는 obfuscator (DexGuard, Allatori) 로 복호화 어려움 — 동적 분석 (`frida-scripts.md` 패턴 5) 으로 클래스명 enumeration.

### IPA 가 암호화 상태 (`cryptid 1`)

```bash
# 확인
otool -arch arm64 -l TargetApp | grep -A4 LC_ENCRYPTION_INFO
# cryptid 1   ← 암호화됨 (App Store 배포 IPA)
# cryptid 0   ← 복호화됨 (탈옥 단말 메모리 덤프 결과)
```

→ `frida-ios-dump` 로 복호화된 IPA 추출 (`setup-ios.md` Step 5).

### Native (.so) 안티 디스어셈블 / 패킹

→ UPX / 자체 패커 사용 시 Ghidra 가 디컴파일 실패. **메모리 덤프** (`frida` `Process.enumerateRanges()` + `Memory.readByteArray`) 로 언패킹된 영역 추출 후 분석.

---

## 다른 페이지로 위임

- **Frida 후킹 패턴 / 정찰 스크립트** → `frida-scripts.md`
- **SSL Pinning 우회 (코드 위치 식별 후 우회)** → `ssl-pinning-bypass.md`
- **Root / 탈옥 탐지 우회** → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
- **데이터 저장소 결함 (저장 위치 / 평문 / Keychain Access Control)** → `data-storage-android.md`, `data-storage-ios.md`
- **Custom URL Scheme / Universal Link / Intent** → `deeplink-intent.md`
- **WebView 결함 (manifest / Info.plist 의 WebView 설정)** → `webview-issues.md`

---

## 참고자료

- [OWASP MASTG - Android Reverse Engineering](https://mas.owasp.org/MASTG/0x05c-Reverse-Engineering-and-Tampering/)
- [OWASP MASTG - iOS Reverse Engineering](https://mas.owasp.org/MASTG/0x06c-Reverse-Engineering-and-Tampering/)
- [apktool](https://apktool.org/)
- [jadx](https://github.com/skylot/jadx)
- [class-dump](https://github.com/nygard/class-dump)
- [Hopper Disassembler](https://www.hopperapp.com/)
- [Ghidra](https://ghidra-sre.org/)
- [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF)
- [HackTricks - Android Static Analysis](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting#static-analysis)
- [HackTricks - iOS Static Analysis](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting#static-analysis)
