---
sidebar_position: 9
title: 디버거/Frida 탐지 우회
description: 모바일 진단 - Android/iOS 디버거 및 Frida 탐지 우회 (ptrace / sysctl / TracerPid / 27042 port / gum-js-loop)
keywords: [Anti-Debug, Anti-Frida, ptrace, sysctl, TracerPid, PT_DENY_ATTACH, Frida Detection, gum-js-loop, MASVS-RESILIENCE, Native Hook]
draft: false
---

# 디버거/Frida 탐지 우회
> 앱이 디버거 (`ptrace`, `lldb`, `gdb`) 또는 Frida 의 동작 흔적을 탐지해 후킹 자체를 차단할 때 우회.
> 우회 못 하면 SSL Pinning / Root 탐지 우회 스크립트조차 주입 안 됨 — **점검의 가장 앞단에서 풀어야 할 문제**.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-RESILIENCE-1, 2 / MASTG-TEST-0030 (Android), 0048 (iOS) |
| **CWE** | [CWE-693: Protection Mechanism Failure](https://cwe.mitre.org/data/definitions/693.html) |
| **영향도** | 🟡 (단독) — 다른 모든 동적 점검의 선행 조건 |
| **점검 난이도** | 중 ~ 상 (Native 후킹 필요한 경우가 많음) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

디버거 / Frida 탐지는 **분석 난이도 상승** 목적. 점검자는 (1) 적용 여부, (2) 탐지 신호 종류, (3) 우회 가능성을 평가. 점검 흐름상 **다른 점검을 시작하려면 먼저 이 탐지를 풀어야** 하므로, 실패 시 후속 점검이 모두 막힘.

> **다른 페이지와 영역 분리**
> - Root / 탈옥 탐지 → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
> - SSL Pinning 우회 → `ssl-pinning-bypass.md`
> - Frida 기본 후킹 패턴 → `frida-scripts.md`
> - 탐지 코드 위치 식별 → `static-analysis.md`

---

## 유형 구분 — 탐지 신호

### Android

| 신호 | 검사 코드 | 비고 |
| :--- | :--- | :--- |
| **`Debug.isDebuggerConnected()`** | `android.os.Debug.isDebuggerConnected()` | Java 한 줄 후킹 |
| **`/proc/self/status` 의 `TracerPid`** | 파일 읽기 후 0 이 아니면 디버거 attached | 파일 읽기 후킹 / Native |
| **`ptrace(PTRACE_TRACEME)` 자가 호출** | 본인이 먼저 ptrace 호출 → 디버거 attach 차단 | Native 후킹 |
| **`ApplicationInfo.FLAG_DEBUGGABLE`** | 자신이 디버거블 빌드인지 (역방향: prod 인데 debuggable) | Java 후킹 |
| **Frida TCP 포트 27042** | `connect(127.0.0.1, 27042)` 성공 = Frida 동작 중 | Native 후킹 |
| **Frida 라이브러리 검사** | `/proc/self/maps` 에서 `frida-gadget` / `frida-agent` 검색 | 파일 읽기 후킹 |
| **`gum-js-loop` / `gmain` 스레드 검사** | `pthread_getname_np` 로 Frida 스레드명 검색 | Native 후킹 |
| **`linker_soinfo` 검사** | dlopen 된 모든 라이브러리에서 Frida 시그니처 | Native 후킹 |

### iOS

| 신호 | 검사 코드 | 비고 |
| :--- | :--- | :--- |
| **`ptrace(PT_DENY_ATTACH)`** | `ptrace(31, 0, 0, 0)` — 자기 디버그 차단 | 가장 흔함, Native 후킹 |
| **`sysctl(KERN_PROC, P_TRACED)`** | 자기 프로세스가 traced 상태인지 검사 | Native 후킹 |
| **`syscall(26, ...)` 직접 호출** | ptrace 시스템 콜 번호 직접 호출 (ptrace 함수 후킹 회피) | Native syscall 후킹 |
| **`getppid()` 검사** | 부모 PID 가 launchd (1) 가 아니면 디버거 의심 | Native 후킹 |
| **`ioctl(P_TRACED)`** | 동일 — traced 상태 검사 | Native 후킹 |
| **Frida 27042 포트** | iOS 도 동일 패턴 (USB 포트 포워딩 환경) | Native 후킹 |
| **`gum-js-loop` 스레드** | `pthread_getname_np` 로 검색 | Native 후킹 |
| **dyld 검사** | `_dyld_image_count` 로 `FridaGadget.dylib` 검색 | Native 후킹 |

---

## 진단 절차

### Step 1. 탐지 적용 여부 확인

```
1) Frida attach 시도
   $ frida -U com.target.app
   → "Failed to attach: ..."  : 탐지 가능성
   → "spawn / attached"        : 탐지 없음 또는 attach 까진 허용

2) 후킹 스크립트 주입 후 앱 동작 관찰
   - 즉시 종료 / "디버거 감지" 메시지     : 탐지 적용
   - 비정상 동작 (특정 기능만 차단)        : 부분 탐지
   - 정상 동작                            : 탐지 미적용 또는 후킹 시점이 늦었음
```

### Step 2. 탐지 위치 식별
`static-analysis.md` 의 jadx / Hopper 검색 키워드:

```
Android:
  - "isDebuggerConnected", "TracerPid", "ptrace"
  - "27042"  ← Frida 기본 포트
  - "FRIDA", "frida-gadget", "frida-agent", "linjector"
  - "gum-js-loop", "gmain"

iOS:
  - "ptrace", "PT_DENY_ATTACH"
  - "sysctl", "P_TRACED", "KERN_PROC"
  - "FridaGadget", "frida-gadget.dylib"
  - "gum-js-loop"
```

### Step 3. 우회 시도

(1) Frida spawn 모드 + 조기 후킹 → (2) Native 함수 후킹 (`ptrace`, `sysctl`) → (3) syscall 직접 후킹 → (4) Magisk Hide / Stealth Frida 도구.

### Step 4. 우회 후 검증

- Frida 가 정상 attach 됨
- 다른 후킹 스크립트 (SSL Pinning / Root 우회) 가 동작
- 앱 종료 / 차단 메시지 없음

---

## 페이로드 / 우회 케이스

### 케이스 1: Android — Java 레벨 디버거 탐지 우회

**언제 쓰는지**: 정적 분석에서 `Debug.isDebuggerConnected()` / `ApplicationInfo.FLAG_DEBUGGABLE` 검사가 보일 때.

```javascript
// android-antidebug-java.js
Java.perform(function () {

    // 1) Debug.isDebuggerConnected 강제 false
    var Debug = Java.use('android.os.Debug');
    Debug.isDebuggerConnected.implementation = function () {
        console.log('[+] Debug.isDebuggerConnected spoofed: false');
        return false;
    };

    // 2) FLAG_DEBUGGABLE 검사 우회
    var ApplicationInfo = Java.use('android.content.pm.ApplicationInfo');
    Object.defineProperty(ApplicationInfo, 'flags', {
        get: function () {
            console.log('[+] ApplicationInfo.flags accessed');
            return 0;  // FLAG_DEBUGGABLE 비트 (2) 없음
        }
    });

});
```

**판정**: 콘솔에 로그 + 후속 후킹 스크립트가 동작하면 Java 레벨 탐지만 사용. 여전히 차단되면 Native 탐지 (케이스 2).

### 케이스 2: Android — Native `ptrace` / `TracerPid` 우회

**언제 쓰는지**: 정적 분석에서 `.so` 파일이 `ptrace` 호출 또는 `/proc/self/status` 읽기 패턴. Native 탐지는 spawn 시점에 즉시 동작하므로 **spawn 모드 + 조기 후킹** 필수.

```javascript
// android-antidebug-native.js
// 1) ptrace 후킹 — 본인이 PTRACE_TRACEME (0) 호출하는 경우 차단
var ptrace = Module.findExportByName(null, 'ptrace');
if (ptrace) {
    Interceptor.replace(ptrace, new NativeCallback(function (request, pid, addr, data) {
        console.log('[+] ptrace blocked: request=' + request);
        return 0;
    }, 'long', ['int', 'int', 'pointer', 'pointer']));
}

// 2) /proc/self/status 의 TracerPid 위장
//    fopen 후킹 → fake 스트림 반환은 복잡 → read 결과 변조가 간단
var fopen = Module.findExportByName(null, 'fopen');
if (fopen) {
    Interceptor.attach(fopen, {
        onEnter: function (args) {
            var path = Memory.readCString(args[0]);
            this.isStatus = path && path.indexOf('/proc/') === 0 && path.indexOf('/status') !== -1;
        }
    });
}

// 더 강력: read syscall 의 결과에서 TracerPid 라인 0 으로 치환
var read = Module.findExportByName(null, 'read');
Interceptor.attach(read, {
    onEnter: function (args) {
        this.fd = args[0].toInt32();
        this.buf = args[1];
    },
    onLeave: function (retval) {
        var n = retval.toInt32();
        if (n <= 0) return;
        try {
            var content = Memory.readCString(this.buf, n);
            if (content && content.indexOf('TracerPid:') !== -1) {
                var fixed = content.replace(/TracerPid:\s*\d+/, 'TracerPid:\t0');
                Memory.writeUtf8String(this.buf, fixed);
                console.log('[+] TracerPid spoofed to 0');
            }
        } catch (e) {}
    }
});
```

**판정**: 후킹 로그 + 앱 정상 실행 + Frida 다른 스크립트도 attach 가능.

**언제 더 강한 우회가 필요한지**: 앱이 `syscall(SYS_ptrace, ...)` 로 직접 시스템 콜을 호출하는 경우 → `ptrace` 함수 후킹 우회 불가 → `syscall` 자체 후킹 필요 (복잡 / 안정성 낮음).

### 케이스 3: Android — Frida 흔적 탐지 (27042 포트 / 라이브러리 / 스레드명) 우회

**언제 쓰는지**: 위 단계는 통과했는데 앱이 여전히 종료. Frida 자체 흔적 탐지.

```javascript
// android-antifrida.js
// 1) Frida 포트 (27042) connect 차단
var connect = Module.findExportByName(null, 'connect');
Interceptor.attach(connect, {
    onEnter: function (args) {
        // sockaddr 의 포트 검사
        var sin_port = Memory.readU16(args[1].add(2));
        var port = ((sin_port & 0xff) << 8) | ((sin_port >> 8) & 0xff);
        if (port === 27042 || port === 27043) {
            console.log('[+] connect to Frida port blocked: ' + port);
            this.block = true;
        }
    },
    onLeave: function (retval) {
        if (this.block) retval.replace(-1);
    }
});

// 2) /proc/self/maps 에서 frida 문자열 검색하는 패턴 차단
var open = Module.findExportByName(null, 'open');
Interceptor.attach(open, {
    onEnter: function (args) {
        var path = Memory.readCString(args[0]);
        if (path && path === '/proc/self/maps') {
            console.log('[+] /proc/self/maps access — should sanitize read result');
            // 실제 sanitize 는 read syscall 후킹에서 — frida-gadget / linjector 문자열 제거
        }
    }
});

// 3) pthread_getname_np 후킹 — gum-js-loop / gmain 등 스레드명 위장
var pthread_getname_np = Module.findExportByName(null, 'pthread_getname_np');
if (pthread_getname_np) {
    Interceptor.attach(pthread_getname_np, {
        onEnter: function (args) { this.buf = args[1]; this.len = args[2].toInt32(); },
        onLeave: function (retval) {
            var name = Memory.readCString(this.buf, this.len);
            if (name && (name.indexOf('gum-js-loop') !== -1 || name.indexOf('gmain') !== -1 || name.indexOf('frida') !== -1)) {
                Memory.writeUtf8String(this.buf, 'main');
                console.log('[+] pthread name spoofed: ' + name + ' -> main');
            }
        }
    });
}
```

**판정**: 콘솔 로그 + 앱 정상 실행. 추가 탐지가 있으면 케이스 4 (도구 기반).

### 케이스 4: iOS — `ptrace(PT_DENY_ATTACH)` + `sysctl` 우회

**언제 쓰는지**: iOS 점검의 가장 흔한 첫 장벽. `PT_DENY_ATTACH` 가 호출되면 부모 디버거 (lldb / Frida) 가 attach 못 함.

```javascript
// ios-antidebug.js
// 1) ptrace 후킹 — PT_DENY_ATTACH (31) 차단
var ptrace = Module.findExportByName(null, 'ptrace');
if (ptrace) {
    Interceptor.replace(ptrace, new NativeCallback(function (request, pid, addr, data) {
        if (request === 31) {  // PT_DENY_ATTACH
            console.log('[+] ptrace(PT_DENY_ATTACH) blocked');
            return 0;
        }
        var orig = new NativeFunction(ptrace, 'int', ['int', 'int', 'pointer', 'int']);
        return orig(request, pid, addr, data);
    }, 'int', ['int', 'int', 'pointer', 'int']));
}

// 2) syscall(26, ...) 직접 호출 차단 — ptrace 함수 후킹 회피용
var syscall = Module.findExportByName(null, 'syscall');
if (syscall) {
    Interceptor.attach(syscall, {
        onEnter: function (args) {
            var nr = args[0].toInt32();
            if (nr === 26) {  // SYS_ptrace on iOS
                console.log('[+] syscall(SYS_ptrace) blocked');
                this.block = true;
            }
        },
        onLeave: function (retval) {
            if (this.block) retval.replace(0);
        }
    });
}

// 3) sysctl 후킹 — KERN_PROC + P_TRACED 검사 결과 위장
var sysctl = Module.findExportByName(null, 'sysctl');
Interceptor.attach(sysctl, {
    onEnter: function (args) {
        this.oldp = args[2];
        this.oldlenp = args[3];
    },
    onLeave: function (retval) {
        if (retval.toInt32() !== 0 || this.oldp.isNull()) return;
        // kinfo_proc 구조체에서 p_flag 의 P_TRACED 비트 (0x800) 제거
        try {
            var kp_flag_offset = 32;  // kinfo_proc 의 p_flag 오프셋 (iOS arch 의존)
            var flag = Memory.readU32(this.oldp.add(kp_flag_offset));
            if (flag & 0x800) {
                Memory.writeU32(this.oldp.add(kp_flag_offset), flag & ~0x800);
                console.log('[+] sysctl P_TRACED bit cleared');
            }
        } catch (e) {}
    }
});

// 4) getppid 후킹 — 부모가 launchd (1) 가 아니면 디버거 의심하는 패턴
var getppid = Module.findExportByName(null, 'getppid');
if (getppid) {
    Interceptor.replace(getppid, new NativeCallback(function () {
        console.log('[+] getppid spoofed: 1');
        return 1;  // launchd
    }, 'int', []));
}
```

**판정**: 위 후킹 적용 + 앱 정상 실행 + Frida 다른 후킹 (SSL Pinning 등) 도 동작.

**spawn 모드 필수**:

```bash
# attach 모드는 늦음 — PT_DENY_ATTACH 가 이미 호출됨
frida -U -f com.target.app -l ios-antidebug.js --no-pause
```

### 케이스 5: 도구 기반 우회 — fridare / r2frida / Strong Stealth Frida

**언제 쓰는지**: 위 모든 케이스가 안 먹는 경우. Frida 자체를 패치해 흔적을 줄이거나, Stealth 모드로 빌드된 frida-server 사용.

```bash
# fridare — frida-server / frida-gadget 의 시그니처 무작위화
# https://github.com/suifei/fridare

# iOS 측은 frida-server 의 포트 변경 + 시그니처 패치 빌드 사용
# 점검 단말에 별도 빌드된 frida-server 설치
```

**언제 쓰는지**: 점검 대상이 상업용 RASP (Promon / Guardsquare / Build38) 적용 — 일반 Frida 시그니처 모두 탐지. 도구 자체 패치가 가장 효과적.

### 케이스 6: 디버거 탐지 미적용
**판정**: 앱이 Frida attach + 후킹 정상 동작 + 종료 / 차단 없음. 정적 분석에서 탐지 코드 부재. **결제 / 금융 / 의료 / 인증 앱은 미흡으로 보고** — 단, 일반 정보 제공 앱은 미적용이 정상.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 미흡 / 미적용:

- [ ] **디버거 / Frida 탐지 미적용** — 결제 / 금융 / 의료 앱에 한정 미흡
- [ ] **Java / ObjC 단일 함수 후킹** 만으로 우회 가능 — Native 결합 부재
- [ ] **Frida 표준 시그니처 탐지만** — 포트 변경 / 시그니처 패치 / 다중 신호 부재
- [ ] **클라이언트 단독 탐지** — 서버 사이드 무결성 검증 없음
- [ ] 우회 후 다른 모든 점검 (SSL Pinning / Root) 진행 가능 → 다층 방어 부재

---

## 다른 페이지로 위임

- **Root / 탈옥 탐지 우회** → `root-detection-bypass.md`, `jailbreak-detection-bypass.md`
- **SSL Pinning 우회** → `ssl-pinning-bypass.md`
- **Frida 기본 후킹 패턴 / spawn 모드** → `frida-scripts.md`
- **탐지 코드 위치 식별 (정적 분석)** → `static-analysis.md`

---

## 참고자료

- [OWASP MASTG - Anti-Reversing Defenses (Android)](https://mas.owasp.org/MASTG/0x05j-Testing-Resiliency-Against-Reverse-Engineering/)
- [OWASP MASTG - Anti-Reversing Defenses (iOS)](https://mas.owasp.org/MASTG/0x06j-Testing-Resiliency-Against-Reverse-Engineering/)
- [OWASP MASTG-TEST-0030 - Anti-Debugging (Android)](https://mas.owasp.org/MASTG/tests/android/MASVS-RESILIENCE/MASTG-TEST-0030/)
- [OWASP MASTG-TEST-0048 - Anti-Debugging (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-RESILIENCE/MASTG-TEST-0048/)
- [Frida Anti-Detection (CodeShare)](https://codeshare.frida.re/@netanelc305/multiple-unpinning/)
- [fridare (frida-server 패치 도구)](https://github.com/suifei/fridare)
- [r2frida](https://github.com/nowsecure/r2frida)
- [HackTricks - Anti Debugging](https://book.hacktricks.xyz/reversing/common-api-used-in-malware)
- [Promon - RASP](https://promon.co/products/shield-mobile-app-protection)
