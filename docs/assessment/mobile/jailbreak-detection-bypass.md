---
sidebar_position: 8
title: 탈옥 탐지 우회
description: 모바일 진단 - iOS 탈옥 탐지 우회 (Liberty Lite / A-Bypass / Shadow / Frida 후킹) + 흔한 탐지 항목 + 판정 기준
keywords: [Jailbreak Detection, Bypass, Liberty Lite, A-Bypass, Shadow, Choicy, Frida, NSFileManager, dlopen, fork, MASVS-RESILIENCE, iOS]
draft: false
---

# 탈옥 탐지 우회
> 앱이 탈옥 단말에서 실행을 거부할 때 우회. 점검자 입장에선 **점검 환경의 일부** + 점검 결과로 "탐지 적용 여부 + 우회 가능성" 평가.
> Android 의 루팅 탐지와 동일한 구조 — 단일 신호 의존 / 클라이언트만 검증은 미흡.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-RESILIENCE-1 / MASTG-TEST-0049, 0058 |
| **CWE** | [CWE-693: Protection Mechanism Failure](https://cwe.mitre.org/data/definitions/693.html) |
| **영향도** | 🟡 (단독) — 다른 결함과 결합 시 점검 자체가 차단됨 |
| **점검 난이도** | 하 (표준 트윅) ~ 상 (Native 다중 + 무결성 + DeviceCheck/AppAttest 결합) |
| **예상 점검 시간** | 30분 ~ 2시간 |

---

## 점검 목적

iOS 탈옥 탐지는 (1) 적용 여부, (2) 어떤 신호를 쓰는지, (3) 표준 트윅 / Frida 로 우회 가능한지 확인. **`NSFileManager fileExistsAtPath:` 한 함수만 검사**하는 패턴은 단일 후킹으로 무력화 → MASVS-RESILIENCE 미흡. **DeviceCheck / App Attest (서버 사이드)** + Native 다중 신호가 권장.

> **다른 페이지와 영역 분리**
> - Android 루팅 탐지 우회 → `root-detection-bypass.md`
> - Frida / 디버거 탐지 → `anti-debug-bypass.md`
> - SSL Pinning 우회 → `ssl-pinning-bypass.md`
> - Frida 기본 후킹 패턴 → `frida-scripts.md`
> - 탐지 코드 위치 식별 (Hopper / class-dump) → `static-analysis.md`

---

## 유형 구분 — 흔한 탈옥 탐지 신호

| 신호 | 검사 코드 예시 | 비고 |
| :--- | :--- | :--- |
| **탈옥 흔적 파일 존재** | `[NSFileManager fileExistsAtPath:@"/Applications/Cydia.app"]` | 가장 흔함 — 한 줄 후킹 우회 |
| **`/etc/apt`, `/private/var/lib/apt` 디렉토리** | 동일 | 동일 |
| **시스템 파일 쓰기 가능** | `/private/jbtest.txt` 에 쓰기 시도 | NSFileManager 후킹 |
| **`fork()` 성공 여부** | 탈옥 단말은 `fork()` 가 성공 (sandbox 우회) | Native 후킹 필요 |
| **dyld 로 의심 라이브러리 검사** | `_dyld_image_count`, `_dyld_get_image_name` | Native 후킹 |
| **`/usr/sbin/sshd` 같은 바이너리 존재** | NSFileManager + access(2) 검사 | 동일 |
| **URL Scheme 검사** | `cydia://`, `sileo://` 가 열리는지 (`canOpenURL:`) | UIApplication 후킹 |
| **Process / dyld 모듈 검사** | `dyld_image_count` 로 MobileSubstrate 등 검사 | Native 후킹 |
| **DeviceCheck / App Attest** | Apple API 서버 사이드 검증 | 서버 검증 — 클라이언트 후킹 불가 |

---

## 진단 절차

### Step 1. 탐지 적용 여부 확인

```
1) setup-ios.md 의 탈옥 단말 환경 셋업
2) 점검 대상 앱 실행
3) 결과:
   - 정상 실행                        → 탐지 미적용 또는 우회 가능
   - 즉시 종료 / "탈옥된 기기" 메시지   → 탐지 적용
   - 일부 기능만 차단                  → 부분 탐지
```

### Step 2. 탐지 위치 식별
`static-analysis.md` 의 class-dump / Hopper 검색 키워드:

```
정적 검색 키워드:
  - "isJailbroken", "isJailBroken", "jailbreak", "jailbroken"
  - "Cydia", "Sileo", "MobileSubstrate", "Substitute"
  - "fileExistsAtPath:", "@/Applications/Cydia.app"
  - "@/etc/apt", "@/private/var/lib/apt"
  - "fork", "_dyld", "dlopen"
  - "canOpenURL:", "cydia://", "sileo://"
  - "DeviceCheck", "AppAttest"             ← 서버 사이드 검증 (강력)
```

### Step 3. 우회 시도
(1) Liberty Lite / A-Bypass / Shadow → (2) Choicy 로 트윅 비활성 → (3) Objection / Frida 표준 → (4) 자체 구현 후킹 → (5) Native 후킹 → (6) DeviceCheck / App Attest 결합 시 사실상 불가.

### Step 4. 우회 후 검증

- 앱 정상 실행 + 차단된 기능도 동작
- Frida 콘솔에 우회 로그 정상 출력

---

## 페이로드 / 우회 케이스

### 케이스 1: Liberty Lite / A-Bypass / Shadow
**언제 쓰는지**: 점검 초기 / 일반 앱. 시스템 레벨에서 탈옥 흔적을 숨겨 앱 후킹 없이 우회.

| 트윅 | 호환 iOS | 비고 |
| :--- | :--- | :--- |
| **Liberty Lite** | iOS 11 ~ 14 | 옛 표준, iOS 15+ 부분 동작 |
| **A-Bypass** | iOS 14 ~ 15 | rootless 미지원 |
| **Shadow** (오픈소스) | iOS 11 ~ 17 | rootless 호환, 가장 광범위 |
| **Choicy** | 전 버전 | 트윅 자체를 앱별로 비활성 (일부 탈옥 탐지가 트윅 유무를 검사할 때) |

**Shadow 적용 (iOS 17 권장):**

```
1) Sileo → Sources → Add → https://ios.jjolano.me
2) Shadow 설치
3) 설정 → Shadow → 점검 대상 앱 활성화
4) 앱 재실행
```

**판정**: Shadow 적용 후 앱 정상 동작이면 표준 신호 (파일 존재 / canOpenURL) 만 사용 → 미흡 보고. 여전히 차단되면 케이스 2 ~ 4 로.

### 케이스 2: Choicy 로 트윅 자체 무력화
**언제 쓰는지**: 일부 앱은 **트윅의 존재 자체** 를 검사 (`MobileSubstrate.dylib` 가 로드됐는지). Shadow / Liberty 가 오히려 탐지될 수 있음 — Choicy 로 점검 대상 앱에 트윅 미적용 → 그 후 Frida 만으로 진행.

```
1) Sileo → Choicy 설치
2) 설정 → Choicy → 점검 대상 앱 → "Tweak Injection" Disabled
3) 그 후 Frida 만으로 우회 (케이스 3)
```

### 케이스 3: Objection 자동 우회

```bash
objection -g com.target.app explore
> ios jailbreak disable
```

→ 흔한 탈옥 탐지 함수 (`fileExistsAtPath:`, `canOpenURL:`, `fork`) 일괄 후킹.

**판정**: 적용 후 앱 정상 동작이면 표준 패턴. 안 먹으면 케이스 4 (자체 구현 후킹).

### 케이스 4: Frida 통합 스크립트
**언제 쓰는지**: Shadow + Objection 으로도 안 되는 케이스. 정적 분석에서 자체 구현 탐지 / Native 탐지 보임.

```javascript
// ios-jailbreak-bypass.js
if (ObjC.available) {

    // 1) NSFileManager fileExistsAtPath: — 흔적 파일 검사 차단
    var NSFileManager = ObjC.classes.NSFileManager;
    var blockPaths = [
        '/Applications/Cydia.app', '/Applications/Sileo.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/usr/sbin/sshd', '/usr/bin/ssh', '/etc/apt',
        '/private/var/lib/apt', '/private/var/lib/cydia',
        '/private/var/stash', '/bin/bash', '/bin/sh',
        '/usr/libexec/cydia/firmware.sh', '/var/cache/apt',
        '/var/log/syslog', '/var/tmp/cydia.log',
        '/private/var/mobile/Library/SBSettings/Themes',
        '/Library/MobileSubstrate', '/Library/PreferenceLoader/Preferences',
        '/Library/PreferenceBundles', '/usr/lib/libsubstrate.dylib',
        '/usr/lib/libsubstitute.dylib', '/usr/lib/TweakInject.dylib'
    ];

    Interceptor.attach(NSFileManager['- fileExistsAtPath:'].implementation, {
        onEnter: function (args) {
            var path = ObjC.Object(args[2]).toString();
            this.shouldHide = blockPaths.some(function (p) { return path.indexOf(p) !== -1; });
            if (this.shouldHide) {
                console.log('[+] fileExistsAtPath blocked: ' + path);
            }
        },
        onLeave: function (retval) {
            if (this.shouldHide) retval.replace(0x0);
        }
    });

    // 2) UIApplication canOpenURL: — cydia:// / sileo:// 차단
    var UIApplication = ObjC.classes.UIApplication;
    var blockSchemes = ['cydia:', 'sileo:', 'undecimus:', 'activator:'];
    Interceptor.attach(UIApplication['- canOpenURL:'].implementation, {
        onEnter: function (args) {
            var url = ObjC.Object(args[2]).absoluteString().toString();
            this.shouldHide = blockSchemes.some(function (s) { return url.indexOf(s) === 0; });
            if (this.shouldHide) {
                console.log('[+] canOpenURL blocked: ' + url);
            }
        },
        onLeave: function (retval) {
            if (this.shouldHide) retval.replace(0x0);
        }
    });

    // 3) access(2) Native 후킹 — fileExistsAtPath 우회 회피용 백업 검사 차단
    var access = Module.findExportByName(null, 'access');
    Interceptor.attach(access, {
        onEnter: function (args) {
            var path = Memory.readCString(args[0]);
            this.shouldHide = blockPaths.some(function (p) { return path && path.indexOf(p) !== -1; });
            if (this.shouldHide) {
                console.log('[+] access(2) blocked: ' + path);
            }
        },
        onLeave: function (retval) {
            if (this.shouldHide) retval.replace(-1);
        }
    });

    // 4) stat / lstat / fopen 후킹 (위와 동일 원리)
    ['stat', 'lstat', 'fopen', 'open'].forEach(function (fn) {
        var addr = Module.findExportByName(null, fn);
        if (!addr) return;
        Interceptor.attach(addr, {
            onEnter: function (args) {
                var path = Memory.readCString(args[0]);
                this.shouldHide = blockPaths.some(function (p) { return path && path.indexOf(p) !== -1; });
                if (this.shouldHide) console.log('[+] ' + fn + ' blocked: ' + path);
            },
            onLeave: function (retval) {
                if (this.shouldHide) {
                    if (fn === 'fopen' || fn === 'open') retval.replace(ptr(0));
                    else retval.replace(-1);
                }
            }
        });
    });

    // 5) fork() — 탈옥 단말은 fork 성공 (sandbox 우회). 강제 -1 반환
    var fork = Module.findExportByName(null, 'fork');
    if (fork) {
        Interceptor.replace(fork, new NativeCallback(function () {
            console.log('[+] fork() forced to -1');
            return -1;
        }, 'int', []));
    }

    // 6) dyld 검사 — _dyld_image_count / _dyld_get_image_name 후킹
    //    탈옥 흔적 dylib (MobileSubstrate / Substitute) 을 enumeration 결과에서 숨김
    var hideDylibs = ['MobileSubstrate', 'libsubstrate', 'libsubstitute', 'TweakInject', 'libcycript'];
    var dyld_get_image_name = Module.findExportByName(null, '_dyld_get_image_name');
    if (dyld_get_image_name) {
        Interceptor.attach(dyld_get_image_name, {
            onLeave: function (retval) {
                var name = Memory.readCString(retval);
                if (name && hideDylibs.some(function (d) { return name.indexOf(d) !== -1; })) {
                    console.log('[+] dyld image hidden: ' + name);
                    // 단순화 — 실제로는 다른 정상 dylib 이름으로 교체
                    retval.replace(Memory.allocUtf8String('/usr/lib/libSystem.B.dylib'));
                }
            }
        });
    }
}
```

**실행:**

```bash
frida -U -f com.target.app -l ios-jailbreak-bypass.js --no-pause
```

**판정**: 콘솔에 `[+] ... blocked / hidden` 메시지 + 앱 정상 동작이면 우회 성공.

### 케이스 5: DeviceCheck / App Attest
**언제 쓰는지**: 앱이 Apple 의 DeviceCheck (iOS 11+) 또는 App Attest (iOS 14+) 로 단말 무결성을 서버에서 검증.

**관찰만 — 우회 제한적:**

```javascript
// DCAppAttestService API 호출 추적
if (ObjC.available) {
    var DCAppAttestService = ObjC.classes.DCAppAttestService;
    if (DCAppAttestService) {
        Interceptor.attach(DCAppAttestService['- attestKey:clientDataHash:completionHandler:'].implementation, {
            onEnter: function () { console.log('[+] App Attest attestKey called'); }
        });
    }
}
```

**판정**: App Attest 가 적용된 앱은 클라이언트 우회만으로 거래 불가 — MASVS-RESILIENCE 측면 우수. 보고서에 긍정 평가.

### 케이스 6: 탈옥 탐지 미적용
**판정**: 탈옥 단말에서 정상 동작 + 정적 분석에서 탐지 코드 부재 → 미적용. 결제 / 금융 / 의료 / 인증 앱은 미흡으로 보고.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 미흡 / 미적용:

- [ ] **탈옥 탐지 미적용** — 결제 / 금융 / 의료 앱에 한정 미흡
- [ ] **Shadow / Liberty / A-Bypass 만으로 우회 가능** — Bypass-resistant 부재
- [ ] **Frida 한 줄 (`fileExistsAtPath:` 후킹) 로 우회 가능** — 단일 신호 의존
- [ ] **클라이언트 단일 신호만** — DeviceCheck / App Attest 등 서버 사이드 검증 부재
- [ ] **차단 기능이 클라이언트 검증** 만으로 — 서버 API 가 단말 무결성과 무관

**오탐 주의:**

- [ ] 정보 제공 앱 / 단순 유틸은 미적용이 정상
- [ ] 일부 앱은 탈옥 단말에서 경고만 (실행 허용) — 미흡 아닐 수 있음
- [ ] App Attest 적용 시 클라이언트 우회 불가 — 우수 평가

---

## 다른 페이지로 위임

- **Android 루팅 탐지 우회** → `root-detection-bypass.md`
- **Frida / 디버거 탐지로 후킹 자체 차단** → `anti-debug-bypass.md`
- **SSL Pinning 우회** → `ssl-pinning-bypass.md`
- **Frida 기본 후킹 패턴** → `frida-scripts.md`
- **탐지 코드 위치 식별 (정적 분석)** → `static-analysis.md`

---

## 참고자료

- [OWASP MASTG - iOS Anti-Reversing Defenses](https://mas.owasp.org/MASTG/0x06j-Testing-Resiliency-Against-Reverse-Engineering/)
- [OWASP MASTG-TEST-0049 - Jailbreak Detection (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-RESILIENCE/MASTG-TEST-0049/)
- [Shadow (오픈소스 탈옥 우회)](https://github.com/jjolano/shadow)
- [Liberty Lite](https://repo.theninjaprawn.com/)
- [A-Bypass](https://repo.akemin.dev/)
- [Apple - DeviceCheck](https://developer.apple.com/documentation/devicecheck)
- [Apple - App Attest](https://developer.apple.com/documentation/devicecheck/dcappattestservice)
- [Frida CodeShare - ios-jailbreak-bypass](https://codeshare.frida.re/@dki/ios10-jailbreak-detection-bypass/)
- [Objection - iOS Jailbreak Bypass](https://github.com/sensepost/objection/wiki/Disabling-Jailbreak-Detection)
- [HackTricks - iOS Jailbreak Detection Bypass](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting/ios-jailbreak-detection)
