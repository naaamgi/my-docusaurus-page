---
sidebar_position: 7
title: 루팅 탐지 우회 (Root Detection Bypass / Android)
description: 모바일 진단 - Android 루팅 탐지 우회 (Magisk DenyList / Shamiko / Frida 후킹 / Smali 패치) + 점검 흐름 + 판정 기준
keywords: [Root Detection, Bypass, Magisk, DenyList, Shamiko, Zygisk, RootBeer, SafetyNet, Play Integrity, Frida, Android, MASVS-RESILIENCE]
draft: false
---

# 루팅 탐지 우회 (Root Detection Bypass / Android)

> 앱이 루팅 단말에서 실행을 거부할 때 우회. 점검자 입장에서는 **점검 환경 구성의 일부** + 점검 결과로 "Bypass-resistant 한가" 평가.
> 우회 가능 ≠ Pinning 처럼 즉시 미흡 — 단, 표준 도구로 한 번에 우회되면 MASVS-RESILIENCE 미흡.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-RESILIENCE-1 / MASTG-TEST-0027, 0028, 0029 |
| **CWE** | [CWE-693: Protection Mechanism Failure](https://cwe.mitre.org/data/definitions/693.html) |
| **영향도** | 🟡 (단독) — 다른 결함 (SSL Pinning / 안티 디버그) 과 결합 시 점검 자체가 차단됨 |
| **점검 난이도** | 하 (표준 라이브러리) ~ 상 (Native + 다중 탐지 + 무결성 검증 결합) |
| **예상 점검 시간** | 30분 ~ 2시간 |

---

## 점검 목적

루팅 탐지는 **앱 보호 (악성 분석 / 자격증명 탈취 방지)** 가 본질이고, 점검자는 (1) 탐지 적용 여부, (2) 어떤 방식인지, (3) 표준 도구로 우회 가능한지 확인한다. **자체 구현 단일 함수 (예: `File("/system/xbin/su").exists()`) 만으로 탐지** 하는 패턴은 한 줄 후킹으로 무력화되므로 미흡. **Native + 다중 신호 + 서버 사이드 Play Integrity 결합** 이 권장 패턴.

> **다른 페이지와 영역 분리**
> - iOS 탈옥 탐지 → `jailbreak-detection-bypass.md`
> - Frida / 디버거 탐지 (탐지로 인한 후킹 실패 / 즉시 종료) → `anti-debug-bypass.md`
> - SSL Pinning 우회 → `ssl-pinning-bypass.md`
> - Frida 기본 후킹 패턴 → `frida-scripts.md`
> - 정적 분석으로 탐지 코드 위치 식별 → `static-analysis.md`

---

## 유형 구분 — 흔한 루팅 탐지 신호

| 신호 | 검사 코드 예시 | 비고 |
| :--- | :--- | :--- |
| **su 바이너리 존재** | `new File("/system/xbin/su").exists()` 외 다수 경로 | 가장 흔함 — File.exists 후킹 한 줄로 우회 |
| **Magisk 흔적** | `/sbin/.magisk`, `/data/adb/magisk`, `magisk` 패키지 | Shamiko 가 이 흔적 자체를 숨김 |
| **알려진 root 앱 패키지** | `com.topjohnwu.magisk`, `eu.chainfire.supersu`, `com.koushikdutta.superuser` | PackageManager 후킹 |
| **위험 시스템 속성** | `ro.debuggable=1`, `ro.secure=0`, `ro.build.tags=test-keys` | `SystemProperties.get` 후킹 |
| **`su` 실행 시도** | `Runtime.exec("su")` → 종료 코드 검사 | `Runtime.exec` 후킹 |
| **Mount 정보** | `/proc/mounts` 에서 `/system` 이 rw 마운트 | 파일 읽기 후킹 |
| **RootBeer 라이브러리** | `RootBeer.isRooted()` 통합 검사 | 라이브러리별 표준 후킹 가능 |
| **SafetyNet / Play Integrity** | Google API 서버 사이드 검증 | 서버 검증 — 클라이언트 후킹으로 우회 불가 |

---

## 진단 절차

### Step 1. 탐지 적용 여부 확인

```
1) setup-android.md 의 루팅 단말 환경 셋업
2) 점검 대상 앱 실행
3) 결과 관찰:
   - 정상 실행                       → 탐지 미적용 또는 우회 가능
   - 실행 즉시 종료 / "보안 정책" 메시지 → 탐지 적용
   - 일부 기능만 차단 (예: 결제, 출금)  → 부분 탐지
```

### Step 2. 탐지 위치 식별 (정적 분석)

`static-analysis.md` 의 jadx 검색 키워드:

```
정적 검색 키워드:
  - "isRooted"      → RootBeer 또는 자체 구현
  - "RootBeer"      → 라이브러리 사용
  - "/system/xbin/su", "/system/bin/su", "/sbin/su"  → 경로 직접 검사
  - "magisk", "supersu", "/sbin/.magisk"             → 마지스크 검사
  - "test-keys"     → BUILD.TAGS 검사
  - "ro.debuggable", "ro.secure"                     → 시스템 속성
  - "Runtime.exec", "ProcessBuilder"                 → 명령 실행 시도
  - "SafetyNetClient", "IntegrityManager"            → 서버 사이드 검증
```

### Step 3. 우회 시도 (난이도 순)

(1) Magisk DenyList + Shamiko → (2) Objection / Frida 표준 → (3) 자체 구현 후킹 → (4) Smali 패치 → (5) 서버 사이드 (Play Integrity) 결합 시 사실상 불가.

### Step 4. 우회 후 검증

- 앱 정상 실행 + 차단된 기능 (결제 / 출금 등) 도 정상 동작
- Frida 콘솔에 우회 로그 정상 출력

---

## 페이로드 / 우회 케이스

### 케이스 1: Magisk DenyList + Zygisk + Shamiko (실무 표준, 가장 강력)

**언제 쓰는지**: Magisk 24+ 기준. 일반 앱 대부분의 root 탐지를 시스템 레벨에서 숨김 — Frida 사용 없이 우회 가능.

**적용:**

```
1) Magisk → Settings → Zygisk ON → 재부팅
2) Magisk → Settings → Enforce DenyList ON
3) Magisk → Settings → Configure DenyList → 점검 대상 앱 패키지 모두 체크
4) Shamiko 모듈 설치 (https://github.com/LSPosed/LSPosed.github.io/releases)
   - Shamiko 는 DenyList 가 활성화된 앱에 대해 모든 Zygisk 흔적 + Magisk 흔적 추가 차단
5) 재부팅
```

**판정**: 위 설정 후 점검 대상 앱 재실행 → 정상 동작이면 표준 탐지로만 구성된 케이스. 여전히 차단되면 케이스 2 ~ 4 로.

**언제 안 먹는지**: 자체 구현 탐지 (앱이 직접 `/system/xbin/su` 등 검사 — Shamiko 는 표준 Magisk 흔적만 가림), Play Integrity 서버 검증, Native 탐지.

### 케이스 2: Objection 자동 우회

**언제 쓰는지**: 점검 초기 빠른 확인. 대표 패턴 자동 적용.

```bash
objection -g com.target.app explore
> android root disable
```

→ 흔한 root 탐지 함수 (File.exists / Runtime.exec / RootBeer.isRooted) 일괄 후킹.

**판정**: 명령 적용 후 앱 정상 동작이면 표준 라이브러리 / 흔한 패턴. 안 먹으면 케이스 3 (자체 구현 후킹).

### 케이스 3: Frida 통합 스크립트 (자체 구현 + 라이브러리 일괄)

**언제 쓰는지**: Magisk DenyList + Objection 으로도 안 되고, 정적 분석에서 자체 구현 탐지가 보일 때.

```javascript
// android-root-bypass.js
Java.perform(function () {

    // 1) File.exists 후킹 — su / magisk 경로 차단
    var File = Java.use('java.io.File');
    var blockPaths = [
        '/system/xbin/su', '/system/bin/su', '/sbin/su', '/su/bin/su',
        '/system/app/Superuser.apk', '/system/app/SuperSU',
        '/sbin/.magisk', '/data/adb/magisk', '/data/adb/modules',
        '/system/etc/init.d/99SuperSUDaemon', '/dev/com.koushikdutta.superuser.daemon/',
        '/cache/su', '/data/su', '/su'
    ];
    File.exists.implementation = function () {
        var path = this.getAbsolutePath();
        for (var i = 0; i < blockPaths.length; i++) {
            if (path.indexOf(blockPaths[i]) !== -1) {
                console.log('[+] File.exists blocked: ' + path);
                return false;
            }
        }
        return this.exists();
    };

    // 2) Runtime.exec 후킹 — "su" / "which su" 차단
    var Runtime = Java.use('java.lang.Runtime');
    Runtime.exec.overload('java.lang.String').implementation = function (cmd) {
        if (cmd.indexOf('su') !== -1 || cmd.indexOf('which') !== -1) {
            console.log('[+] Runtime.exec blocked: ' + cmd);
            throw Java.use('java.io.IOException').$new('command not found');
        }
        return this.exec(cmd);
    };

    // 3) PackageManager.getPackageInfo 후킹 — Magisk / SuperSU 패키지 숨김
    var ApplicationPackageManager = Java.use('android.app.ApplicationPackageManager');
    var hidePackages = [
        'com.topjohnwu.magisk', 'eu.chainfire.supersu', 'com.koushikdutta.superuser',
        'com.noshufou.android.su', 'com.thirdparty.superuser', 'com.yellowes.su'
    ];
    ApplicationPackageManager.getPackageInfo.overload('java.lang.String', 'int').implementation = function (pkg, flags) {
        if (hidePackages.indexOf(pkg) !== -1) {
            console.log('[+] PackageInfo hidden: ' + pkg);
            throw Java.use('android.content.pm.PackageManager$NameNotFoundException').$new(pkg);
        }
        return this.getPackageInfo(pkg, flags);
    };

    // 4) SystemProperties.get 후킹 — test-keys / ro.debuggable 위장
    try {
        var SystemProperties = Java.use('android.os.SystemProperties');
        SystemProperties.get.overload('java.lang.String').implementation = function (key) {
            var val = this.get(key);
            if (key === 'ro.build.tags' && val.indexOf('test-keys') !== -1) {
                console.log('[+] ro.build.tags spoofed: release-keys');
                return 'release-keys';
            }
            if (key === 'ro.debuggable')   return '0';
            if (key === 'ro.secure')       return '1';
            return val;
        };
    } catch (e) {}

    // 5) RootBeer 라이브러리 우회
    try {
        var RootBeer = Java.use('com.scottyab.rootbeer.RootBeer');
        RootBeer.isRooted.implementation = function () {
            console.log('[+] RootBeer.isRooted spoofed: false');
            return false;
        };
    } catch (e) {}

    // 6) Build.TAGS 직접 읽기 후킹
    try {
        var Build = Java.use('android.os.Build');
        Build.TAGS.value = 'release-keys';
    } catch (e) {}

});
```

**실행:**

```bash
frida -U -f com.target.app -l android-root-bypass.js --no-pause
```

**판정**: 콘솔에 `[+] ... blocked / hidden / spoofed` 메시지 + 앱 정상 동작이면 자체 구현 탐지 우회 성공. 보고서에 우회 가능한 신호 목록 기록.

### 케이스 4: Smali 패치 (Frida 차단 환경)

**언제 쓰는지**: 앱이 Frida 도 탐지 (`anti-debug-bypass.md` 우회로 해결 안 됨) 또는 회사 정책상 Frida 미사용.

```bash
# 1) APK 디컴파일
apktool d target.apk -o target-decoded

# 2) jadx 로 탐지 함수 식별 (예: com.target.security.RootCheck.isDeviceRooted)
# 3) 해당 .smali 파일에서 메서드를 항상 false 반환으로 변경:

# target-decoded/smali/com/target/security/RootCheck.smali
.method public isDeviceRooted()Z
    .registers 2
    const/4 v0, 0x0     # false 강제 반환
    return v0
.end method

# 4) 재패키징 + 재서명
apktool b target-decoded -o target-patched.apk
uber-apk-signer -a target-patched.apk

# 5) 설치
adb uninstall com.target.app
adb install target-patched-aligned-debugSigned.apk
```

**판정**: 패치된 앱이 정상 실행 + 차단 기능 (결제 등) 도 동작. **단, 앱이 서명 검증 (Signature Check) 까지 적용** 했으면 추가 패치 필요.

### 케이스 5: SafetyNet / Play Integrity (서버 사이드)

**언제 쓰는지**: 앱이 단말 무결성을 Google API 로 검증하는 경우. 서버에서 검증되므로 클라이언트 후킹으로 우회 불가능.

**관찰만 — 우회는 제한적:**

```javascript
// SafetyNet API 호출 추적 (우회는 안 되지만 어떤 검증을 보내는지 확인)
Java.perform(function () {
    var SafetyNetClient = Java.use('com.google.android.gms.safetynet.SafetyNetClient');
    SafetyNetClient.attest.implementation = function (nonce, apiKey) {
        console.log('[+] SafetyNet attest called');
        return this.attest(nonce, apiKey);
    };
});
```

**대안**: Magisk 모듈 `Universal SafetyNet Fix` / `MagiskHidePropsConf` 로 일부 SafetyNet 검증 우회 가능. Play Integrity (Strong) 는 사실상 우회 불가 — **이런 앱은 서버 사이드 검증으로 보호되고 있다고 판단하고 보고에 명시**.

**판정**: SafetyNet / Play Integrity 가 적용된 앱 = MASVS-RESILIENCE 측면에서 우수. 보고서에 긍정 평가 + 추가 미흡 없음.

### 케이스 6: 루팅 탐지 미적용 (Negative case)

**판정**: 루팅 단말에서 정상 동작 + 정적 분석에서 탐지 코드 부재 → 탐지 미적용. 단, **앱 성격에 따라 미적용이 정상** (정보 제공 앱 / 비결제 앱). 결제 / 금융 / 의료 / 인증 앱은 미흡으로 보고.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 미흡 / 미적용:

- [ ] **루팅 탐지 미적용** — 금융 / 결제 / 의료 앱에 한정 미흡 (앱 성격 고려)
- [ ] **Magisk DenyList + Shamiko 만으로 우회 가능** — Bypass-resistant 부재
- [ ] **Frida 한 줄 (`File.exists` 후킹) 로 우회 가능** — 단일 신호 의존
- [ ] **Smali 패치 후 정상 동작** — 서명 검증 / 무결성 검증 부재
- [ ] **클라이언트 측 단일 신호만** — SafetyNet / Play Integrity 등 서버 사이드 검증 부재
- [ ] 차단 기능이 **클라이언트 검증** 만으로 보호 — 서버 API 가 단말 무결성과 무관하게 응답

**오탐 주의:**

- [ ] 정보 제공 앱 / 단순 유틸 앱은 루팅 탐지 미적용이 정상 — 회사 정책 / 위험도에 따라 판정
- [ ] 일부 앱은 루팅 단말에서 경고만 (실행은 허용) — 미흡 아닐 수 있음
- [ ] Play Integrity 적용 시 클라이언트 후킹 우회 불가 — 우수 평가

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Root Detection] Frida 단일 스크립트로 자체 구현 탐지 우회

1. `setup-android.md` 의 루팅 단말 환경 셋업 완료
2. 점검 대상 앱 (`com.target.app`) 실행 → 즉시 "보안 정책 위반" 메시지 후 종료
3. `static-analysis.md` 의 jadx 로 `com.target.security.RootCheck.isDeviceRooted` 위치 확인
4. 케이스 3 의 통합 Frida 스크립트 적용 → `File.exists` / `Runtime.exec` / `RootBeer` 후킹
5. 앱 정상 실행 + 결제 기능 정상 동작

**1차 — 우회 전 (탐지 동작):**

```
앱 실행 → 스플래시 → "본 앱은 루팅된 기기에서 실행할 수 없습니다" → 강제 종료
```

**2차 — Frida 스크립트 적용:**

```bash
$ frida -U -f com.target.app -l android-root-bypass.js --no-pause
[+] File.exists blocked: /system/xbin/su
[+] File.exists blocked: /sbin/.magisk
[+] PackageInfo hidden: com.topjohnwu.magisk
[+] Runtime.exec blocked: which su
[+] RootBeer.isRooted spoofed: false
```

**3차 — 우회 후:**

```
앱 정상 실행 → 로그인 → 결제 화면 진입 가능
( 결제 화면 ↔ 백엔드 API 통신은 ssl-pinning-bypass.md 와 결합해 점검 진행 )
```

**확인 사항:**
- 클라이언트 단일 신호 기반 탐지 — 표준 Frida 스크립트 단일 실행으로 모두 우회 가능
- Bypass-resistant 부재 (Native 결합 / 무결성 검증 / 서버 사이드 검증 모두 없음)
- 우회 후 결제 / 인증 기능 동작 → 루팅 단말 + 우회 환경에서 자격증명 / 결제 정보 노출 가능
- 권장: SafetyNet / Play Integrity 도입 + Native 탐지 + 다중 신호 결합

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🟡 — 루팅 탐지 우회 자체는 직접 영향 없음. 우회 환경에서 다른 점검 (Frida 후킹 / 데이터 추출) 이 가능해지는 게 본질
- **무결성 (Integrity)**: 🟡 — 우회 후 메모리 변조 / 앱 동작 변경 가능
- **추가 위협**:
  - 루팅 탐지 미흡 + SSL Pinning 우회 가능 + 평문 데이터 저장 결합 → 자격증명 / 결제 정보 탈취
  - 악성 앱이 루팅 단말에서 점검 대상 앱의 메모리 / 데이터 접근 → 광범위 영향
  - Play Integrity 부재 → 자동화된 봇 / 매크로 / 부정 거래 자동화 용이

**비즈니스 임팩트:**
루팅 탐지는 단독 결함이 아니라 **다른 결함 + 악성 사용자 / 분석가 환경 차단** 의 방어 레이어. 결제 / 금융 / 인증 앱에서 탐지가 미흡하면 부정 거래 / 자동화 봇 / 자격증명 탈취의 가능성이 크게 올라간다. **서버 사이드 Play Integrity + 클라이언트 다중 신호 결합** 이 권장 패턴.

---

## 대응방안

### 개발자 관점

1. **서버 사이드 Play Integrity API** — 클라이언트 후킹으로 우회 불가능한 유일한 방법.

   ```kotlin
   val integrityManager = IntegrityManagerFactory.create(applicationContext)
   val nonce = generateNonce()   // 서버에서 발급
   val integrityTokenResponse = integrityManager.requestIntegrityToken(
       IntegrityTokenRequest.builder().setNonce(nonce).build()
   )
   // integrityToken 을 서버로 전송 → 서버에서 Google API 로 검증
   ```

2. **클라이언트 다중 신호 결합** — 단일 함수 후킹으로 우회되지 않도록:
   - File 시스템 검사 + Runtime.exec + PackageManager + SystemProperties + Build.TAGS + Native 검사
   - **각 신호의 결과를 XOR / 해시 결합** → 단일 후킹으로 무력화 안 되도록

3. **Native (C/C++) 로 검사 + 무결성 검증** — Java 후킹만으로 안 되도록.

4. **앱 서명 검증 (Tamper Detection)** — 재패키징 차단:

   ```kotlin
   val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
   val signature = info.signatures[0].toCharsString()
   if (signature != EXPECTED_SIGNATURE_HASH) {
       // 변조됨
   }
   ```
   ⚠️ 이 검사 자체도 Frida 로 후킹되므로 Native + 다중 검증 결합.

5. **차단 기능은 서버에서 차단** — 클라이언트가 "차단" 을 결정하지 말고, 서버 API 가 `integrity_token` 을 검증하지 않으면 거래 거부. 클라이언트는 단지 토큰을 함께 보낼 뿐.

### 운영자 관점

1. **Play Integrity 검증 로그 모니터링** — 비정상 비율이 갑자기 올라가면 우회 도구 보급 / 캠페인 가능성.
2. **위험도 기반 인증 (Risk-based Auth)** — 루팅 단말 + 신규 디바이스 + 비정상 위치 등 결합 시 추가 인증 / 차단.

### 안전 / 위험 코드 비교

**위험 — 단일 함수 검사:**

```java
public static boolean isRooted() {
    return new File("/system/xbin/su").exists();   // ← 한 줄 후킹으로 우회
}
```

**안전 — 다중 신호 + Native + 서버 검증:**

```kotlin
// 클라이언트: 다중 신호 (Java + Native)
val rootSignals = listOf(
    checkSuBinary(),               // Java
    checkMagiskInstalled(),        // Java
    checkSystemProperties(),       // Java
    nativeRootCheck(),             // C/C++ JNI
    rootBeer.isRooted              // 라이브러리
)
// 단순 boolean 이 아닌 점수 / 신뢰도 결합

// 서버 사이드: Play Integrity 토큰 검증 (필수)
suspend fun verifyIntegrity(token: String): VerdictResult {
    return playIntegrityServer.verify(token)   // Google API
}
```

---

## 다른 페이지로 위임

- **iOS 탈옥 탐지 우회** → `jailbreak-detection-bypass.md`
- **Frida / 디버거 탐지로 후킹 자체 차단** → `anti-debug-bypass.md`
- **SSL Pinning 우회** → `ssl-pinning-bypass.md`
- **Frida 기본 후킹 패턴** → `frida-scripts.md`
- **탐지 코드 위치 식별 (정적 분석)** → `static-analysis.md`
- **재패키징 / 서명 검증 우회** → `static-analysis.md` + 본 페이지 케이스 4

---

## 참고자료

- [OWASP MASTG - Testing Resiliency Against Reverse Engineering](https://mas.owasp.org/MASTG/0x04j-Testing-Resiliency-Against-Reverse-Engineering/)
- [OWASP MASTG-TEST-0027 - Root Detection (Android)](https://mas.owasp.org/MASTG/tests/android/MASVS-RESILIENCE/MASTG-TEST-0027/)
- [Magisk](https://github.com/topjohnwu/Magisk)
- [Shamiko (Magisk 모듈)](https://github.com/LSPosed/LSPosed.github.io/releases)
- [RootBeer (탐지 라이브러리)](https://github.com/scottyab/rootbeer)
- [Google - Play Integrity API](https://developer.android.com/google/play/integrity)
- [Objection - Root Detection Bypass](https://github.com/sensepost/objection/wiki/Bypassing-Root-Detection)
- [Frida CodeShare - Root Detection Bypass](https://codeshare.frida.re/@dzonerzy/fridantiroot/)
- [HackTricks - Android Root Detection Bypass](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting/bypass-biometric-authentication-android)
