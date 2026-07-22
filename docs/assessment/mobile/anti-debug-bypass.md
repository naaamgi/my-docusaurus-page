---
sidebar_position: 9
title: 디버거·Frida 탐지 우회
description: Android와 iOS에서 연결 실패를 환경 문제와 탐지 로직으로 구분하고 앱 전용 디버거·Frida 탐지를 최소 범위에서 우회하는 실무 흐름
keywords: [Anti-Debug, Anti-Frida, ptrace, sysctl, TracerPid, PT_DENY_ATTACH, Frida Detection, Runtime Integrity, MASVS-RESILIENCE, Native Hook]
toc_max_heading_level: 3
draft: false
---

> 디버거나 Frida를 연결했을 때만 앱이 종료되거나 기능이 달라질 때 사용한다. 목표는 흔적을 전부 숨기는 것이 아니라 **연결 문제와 탐지 로직을 구분하고, 실제 차단 신호만 좁게 우회해 동적 분석 경로를 확보하는 것**이다.

## 사용 시점

- Frida attach·spawn 직후 앱 프로세스가 사라질 때
- 아무 동작도 하지 않는 스크립트만 로드해도 차단 문구가 나타날 때
- Android Studio, JDWP, LLDB, `debugserver` 연결 때만 동작이 달라질 때
- 정적 분석에서 `isDebuggerConnected`, `TracerPid`, `ptrace`, `sysctl`이 발견됐을 때
- Frida port, agent, thread, memory hook 흔적을 검사하는 코드가 보일 때
- 루팅·탈옥 탐지 우회는 성공했지만 Frida를 연결하면 다시 종료될 때

Frida 연결 실패만으로 anti-debug를 확정하지 않는다. USB, 권한, host·server 버전, 프로세스 선택, 앱 crash를 먼저 분리한다.

## 점검 원칙

- 허가된 앱, 테스트 계정, 승인된 단말에서만 수행한다.
- 직접 실행, attach, 빈 스크립트, 실제 스크립트의 결과를 따로 기록한다.
- 디버거 탐지와 Frida artifact 탐지를 같은 원인으로 묶지 않는다.
- 첫 스크립트는 앱 상태를 바꾸지 않는 관찰용으로 만든다.
- 전역 `read`, `open`, `connect`, `sysctl` 변조보다 앱 전용 판정 함수를 우선한다.
- Native offset은 앱 버전과 아키텍처에 종속되므로 바이너리 hash와 함께 기록한다.
- 우회 성공은 분석 경로 확보이며, 그 자체로 취약점이 확정되지는 않는다.

## 탐지 유형

| 유형 | Android 단서 | iOS 단서 | 첫 접근 |
| :--- | :--- | :--- | :--- |
| 런타임 debugger 상태 | `Debug.isDebuggerConnected()`, JDWP | `sysctl`의 `P_TRACED`, Mach exception port | 앱 전용 판정 결과 관찰 |
| attach 방지 | `ptrace(PTRACE_TRACEME)` | `ptrace(PT_DENY_ATTACH)` | 호출 시점과 caller 식별 |
| 프로세스 상태 | `/proc/self/status`의 `TracerPid` | `getppid`, process·task 정보 | 직접 실행과 debugger 실행 비교 |
| 도구 artifact | `/proc/self/maps`, 파일·프로세스·문자열 | Gadget 파일, 로드 이미지, 문자열 | agent 주입 방식과 artifact 연결 |
| 통신·IPC | Frida port, D-Bus 응답, named pipe | Frida port, D-Bus 응답, named pipe | 실제 endpoint와 probe 결과 확인 |
| thread·memory | thread 이름, agent memory string | thread 이름, executable memory | 호출자와 검사 범위 확인 |
| hook 무결성 | 함수 prologue, inline trampoline, GOT·PLT | 함수 prologue, IMP·symbol pointer | 원본 코드와 변경 지점 비교 |
| timing·반복 검사 | 지연 시간, background watchdog | 지연 시간, lifecycle 재검사 | 사용자 행동과 탐지 시각 연결 |
| RASP 래퍼 | Java·JNI boolean, SDK callback | Objective-C·Swift·Native callback | 최종 정책 메서드 우선 |

Frida의 고정 문자열, port, thread 이름은 버전과 실행 방식에 따라 달라질 수 있다. artifact 하나는 의심 신호일 뿐이며 실제 코드·메모리 변경을 증명하지 않는다.

iOS의 dyld image 열거는 Gadget이나 dyld를 통해 로드된 라이브러리에는 유효할 수 있지만, frida-server의 모든 주입 방식을 동일하게 보여주지는 않는다. 실행 방식을 기록하지 않으면 결과를 잘못 해석할 수 있다.

---

## 진단 절차

#### Step 1. 연결 환경

앱 실행 전에 host와 단말의 연결부터 확인한다.

```bash
frida --version
frida-ls-devices
frida-ps -U
frida-ps -Uai
```

Android는 ADB와 `frida-server`, iOS는 USB·SSH·`frida-server` 또는 Gadget 상태를 확인한다. host tools와 server·Gadget 버전 불일치, 잘못된 ABI, 권한 부족도 `Failed to attach`를 만든다.

#### Step 2. 실행 모드 비교

다음 네 상태를 같은 앱 버전에서 비교한다.

| 상태 | 확인 목적 |
| :--- | :--- |
| 직접 실행 | 원래 앱과 서버 기능의 기준선 |
| 실행 중 프로세스 attach | attach 시점 이후 탐지 여부 |
| 빈 스크립트 attach | agent 주입 자체의 영향 |
| 빈 스크립트 spawn | 앱 시작 구간과 조기 탐지 여부 |

`noop.js`:

```javascript
setImmediate(function () {
    console.log('[noop] pid=' + Process.id + ' arch=' + Process.arch);
});
```

```bash
# 실행 중 PID에 attach
frida -U -p 12345 -l noop.js

# 앱 시작부터 spawn
frida -U -f com.target.app -l noop.js
```

현재 Frida CLI의 spawn은 기본적으로 앱을 계속 실행한다. 오래된 자료의 `--no-pause`를 그대로 복사하지 않는다.

#### Step 3. 결과 매트릭스

| 관찰 결과 | 현재 가설 | 다음 작업 |
| :--- | :--- | :--- |
| `frida-ps`부터 실패 | 연결·server·권한 문제 | 앱 분석 전 환경 복구 |
| attach 명령 자체가 실패 | 프로세스·권한·버전 또는 attach 방지 | 오류 원문과 단말 로그 확인 |
| attach 성공 뒤 앱 종료 | debugger·agent·hook 탐지 후보 | 종료 시각과 crash log 연결 |
| noop은 정상, 실제 script만 종료 | hook 무결성·스크립트 충돌 후보 | hook를 하나씩 축소 |
| attach 정상, spawn만 종료 | 시작 시점·초기화 충돌 후보 | spawn 로그와 초기 탐지 위치 확인 |
| 특정 기능에서만 종료 | 반복 검사 또는 서버 정책 후보 | 같은 기능의 요청·응답 비교 |

#### Step 4. 로그·크래시

Android:

```bash
adb logcat -c
adb logcat | grep -iE 'debug|trace|frida|tamper|instrument|ptrace|crash'
```

Windows PowerShell:

```powershell
adb logcat -c
adb logcat | Select-String -Pattern 'debug|trace|frida|tamper|instrument|ptrace|crash'
```

iOS는 macOS Console 또는 Xcode Devices and Simulators에서 crash report와 앱 로그를 확인한다. 종료 원인이 앱의 명시적 `exit`, watchdog, uncaught exception, signal 중 무엇인지 구분한다.

#### Step 5. 정적 단서

[정적 분석](static-analysis.md)에서 문자열의 사용처와 호출자를 따라간다.

Android:

```bash
rg -n 'isDebuggerConnected|waitingForDebugger|TracerPid|ptrace|frida|gum-js|27042|PTRACE_TRACEME' work
readelf -Ws work/lib/arm64-v8a/libsecurity.so | grep -iE 'ptrace|connect|pthread|getppid'
```

iOS:

```bash
strings -a Payload/Target.app/Target | grep -iE 'ptrace|P_TRACED|frida|gadget|debugger|tamper'
nm -u Payload/Target.app/Target | grep -iE 'ptrace|sysctl|getppid|task_get_exception_ports'
otool -L Payload/Target.app/Target
```

확인할 항목은 최종 boolean·상태 코드, 검사 호출자, 시작·기능 실행·background 복귀 중 호출 시점, Java·Objective-C에서 Native로 내려가는 경계다. `sysctl`이나 `connect` 사용만으로 탐지 로직을 확정하지 않는다.

#### Step 6. 원본 결과 관찰

앱 전용 판정 함수가 있으면 그 결과를 먼저 기록한다. 시스템 함수밖에 보이지 않으면 `frida-trace`로 한 함수씩 호출 시점과 caller를 좁힌다.

```bash
frida-trace -U -f com.target.app -i 'ptrace'
frida-trace -U -f com.target.app -i 'sysctl'
frida-trace -U -f com.target.app -i 'connect'
```

세 함수를 동시에 추적하지 않는다. 탐지 시점의 함수 하나와 사용자 행동 하나만 연결한다.

#### Step 7. 최소 범위 우회

| 확인된 상황 | 우선 시도 | 범위 |
| :--- | :--- | :--- |
| Android Java boolean | 해당 overload 반환값 | 단일 Java 메서드 |
| 앱 전용 Native 검사 | wrapper의 최종 결과 | 단일 symbol·offset |
| iOS Objective-C·Swift 래퍼 | selector·함수 결과 | 단일 메서드 |
| 조기 `PT_DENY_ATTACH` | spawn과 앱 전용 분기 패치 | 시작 구간 한 곳 |
| Frida artifact 검사 | 탐지 래퍼의 결과 | 확인한 artifact 하나 |
| 상용 RASP | 고객사 제공 테스트 정책·빌드 우선 | 승인된 앱 버전 |

#### Step 8. 후속 기능 재검증

- 우회 전 종료됐던 같은 시점에서 앱이 유지되는가
- 우회 로그와 탐지 시각이 일치하는가
- script를 끄면 원래 상태로 돌아가는가
- SSL Pinning, 루팅·탈옥 탐지 등 다음 후킹이 실제로 동작하는가
- 민감 기능의 서버 응답과 인증·권한 검사가 그대로 유지되는가

---

## 우회 노트

### Android · Java debugger

정적 분석에서 `android.os.Debug.isDebuggerConnected()` 호출을 확인한 경우에만 사용한다. 첫 실행은 원본 반환값을 유지한다.

```javascript
Java.perform(function () {
    const Debug = Java.use('android.os.Debug');
    const isDebuggerConnected = Debug.isDebuggerConnected.overload();

    isDebuggerConnected.implementation = function () {
        const originalResult = isDebuggerConnected.call(this);
        console.log('[isDebuggerConnected] result=' + originalResult);
        return originalResult;
    };
});
```

차단 시점에 `true`가 반환되고 앱 분기와 연결되는 것을 확인한 뒤 마지막 줄만 다음과 같이 바꾼다.

```javascript
return false;
```

`ApplicationInfo.flags` 전체를 `0`으로 만드는 방식은 다른 flag까지 제거하므로 사용하지 않는다. 앱이 `FLAG_DEBUGGABLE`을 자체 판정에 사용한다면 해당 래퍼 메서드만 관찰한다. manifest의 `android:debuggable` 설정 자체는 [앱 위변조](app-tampering.md)의 빌드 설정과 구분한다.

### Android · TracerPid

`TracerPid`는 현재 process를 추적하는 PID를 보여준다. 먼저 앱 PID와 원본 상태를 직접 확인한다.

```bash
adb shell pidof com.target.app
adb shell cat /proc/12345/status
```

`TracerPid: 0`은 그 시점에 tracer가 없다는 뜻이다. 앱이 `/proc/self/status`를 읽는지 확인할 때는 함수 하나만 추적한다.

```bash
frida-trace -U -f com.target.app -i 'fopen'
```

생성된 handler에서 `/proc/self/status`만 출력해 호출 시각과 caller를 찾는다. 모든 `read()` buffer에서 문자열을 바꾸면 로그, 네트워크, 파일 처리까지 손상될 수 있으므로 기본 우회로 사용하지 않는다.

최종적으로 `TracerPid`를 해석하는 앱 전용 boolean 함수나 JNI wrapper를 찾고 그 결과만 변경한다.

### Android · Native wrapper

정적 분석에서 `libsecurity.so` 안의 `check_debugger` 같은 함수나 빌드별 offset을 확인한 경우에 사용한다.

```javascript
const securityModule = Process.getModuleByName('libsecurity.so');
const checkDebugger = securityModule.base.add(0x1234); // 현재 빌드에서 확인한 offset

Interceptor.attach(checkDebugger, {
    onLeave(retval) {
        console.log('[check_debugger] result=' + retval.toInt32());
    }
});
```

차단 시점의 반환값과 연결된 뒤에만 `onLeave`에 다음 줄을 추가한다.

```javascript
retval.replace(ptr(0));
```

offset은 APK 버전, ABI, ASLR 기준에 따라 달라진다. 다른 빌드에 그대로 사용하지 않는다. `ptrace`나 `syscall` 전체를 교체하면 앱 내부의 다른 진단·crash 처리까지 바뀔 수 있으므로 wrapper 우회를 우선한다.

### Android · Frida artifact

noop script에서도 종료되고 debugger 상태 검사는 호출되지 않을 때 확인한다.

앱 PID 기준 memory map:

```bash
adb shell pidof com.target.app
adb shell cat /proc/12345/maps
```

정적 분석과 trace에서 확인할 후보:

- `/proc/self/maps`, `/proc/self/task`, process 목록 접근
- 특정 port connect와 D-Bus probe
- named pipe, agent·Gadget 파일·문자열
- `pthread_getname_np`와 thread 열거
- 함수 prologue와 executable memory 검사

port `27042`, `gum-js-loop`, `frida-agent` 같은 한 문자열만 현재 환경의 절대 기준으로 삼지 않는다. 실행 방식과 버전에 따라 artifact가 달라질 수 있다.

`connect()` 반환값을 사후에 `-1`로 바꾸거나 thread 이름 전체를 `main`으로 덮는 범용 스크립트는 정상 통신과 thread 관리까지 바꾼다. 우선 artifact를 모아 최종 `isInstrumentationDetected()` 같은 앱 전용 정책 함수를 찾는다.

```javascript
Java.perform(function () {
    const Guard = Java.use('com.target.security.RuntimeGuard');
    const isInstrumentationDetected = Guard.isInstrumentationDetected.overload();

    isInstrumentationDetected.implementation = function () {
        const originalResult = isInstrumentationDetected.call(this);
        console.log('[isInstrumentationDetected] result=' + originalResult);
        return originalResult;
    };
});
```

클래스와 메서드명은 예시다. 실제 APK에서 확인한 이름으로 바꾸고, 원인을 검증한 뒤에만 `false`를 반환한다.

### iOS · PT_DENY_ATTACH

`PT_DENY_ATTACH`는 이후 debugger attach를 막고, 이미 traced 상태에서 호출되면 프로세스 종료를 유발할 수 있다. iOS 공개 SDK API가 아니므로 앱이 `dlsym`으로 `ptrace`를 찾는 경우도 함께 확인한다.

```bash
strings -a Payload/Target.app/Target | grep -iE 'ptrace|PT_DENY_ATTACH'
nm -u Payload/Target.app/Target | grep -i ptrace
frida-trace -U -f com.target.app -i 'dlsym'
frida-trace -U -f com.target.app -i 'ptrace'
```

시작 초기에 호출되면 attach는 이미 늦을 수 있으므로 spawn 결과와 비교한다.

```bash
frida -U -f com.target.app -l observe-antidebug.js
```

가장 안정적인 우회 지점은 `ptrace` 전체가 아니라 `denyDebugger()` 또는 `isDebuggerPresent()` 같은 앱 전용 wrapper다. wrapper의 원본 결과와 호출 시점을 확인한 뒤 분기 하나만 바꾼다.

직접 syscall 번호를 하드코딩하거나 모든 `ptrace` 요청에 성공을 반환하는 방식은 iOS 버전·아키텍처와 다른 호출에 영향을 줄 수 있어 기본 예시로 사용하지 않는다.

### iOS · sysctl·getppid

`sysctl`은 다양한 시스템 정보를 조회하므로 import 존재만으로 anti-debug를 확정하지 않는다. `KERN_PROC_PID` 조회와 `P_TRACED` 해석까지 연결해야 한다. `getppid()`도 실행 방식과 환경에 따라 달라질 수 있다.

```bash
frida-trace -U -f com.target.app -i 'sysctl'
frida-trace -U -f com.target.app -i 'getppid'
```

한 함수씩 추적해 caller를 찾고, 정적 분석에서 최종 정책 메서드로 이동한다. `kinfo_proc`의 `p_flag` offset을 특정 숫자로 고정해 memory를 쓰는 예시는 구조체와 아키텍처 차이로 crash를 만들 수 있다.

Objective-C wrapper 예시:

```javascript
if (ObjC.available) {
    const Guard = ObjC.classes.RuntimeGuard;
    const debuggerDetected = Guard['- debuggerDetected'];

    if (debuggerDetected) {
        Interceptor.attach(debuggerDetected.implementation, {
            onLeave(retval) {
                console.log('[debuggerDetected] result=' + retval.toInt32());
            }
        });
    }
}
```

실제 클래스와 selector를 확인한 뒤 차단 원인 검증 단계에서만 `retval.replace(ptr(0))`를 추가한다.

### 앱 전용 탐지 래퍼

여러 artifact 검사 결과를 하나의 RASP callback이나 정책 함수가 모으는 경우가 많다. 각 시스템 함수를 전부 속이기 전에 최종 상태 코드와 반응 지점을 찾는다.

| 확인 위치 | 기록할 항목 | 변경 후보 |
| :--- | :--- | :--- |
| Java·Kotlin | boolean, enum, callback | 앱 자체 overload 하나 |
| JNI·Native | symbol, module offset, caller | 최종 wrapper 반환값 |
| Objective-C | class, selector, 호출 시점 | 해당 IMP의 반환값 |
| Swift | symbol·offset, bridge method | 빌드별 함수 또는 branch |
| 서버 응답 | 위험 코드, 기능 제한 | 테스트 정책·서버 검증 확인 |

탐지 결과를 바꿨는데 앱이 계속 종료되면 다른 반복 검사, watchdog, hook 무결성 또는 서버 정책이 남아 있는지 확인한다. 모든 signal을 한 스크립트에서 동시에 바꾸지 않는다.

### 패치·테스트 빌드

상용 RASP나 시작 전 탐지 때문에 안정적인 동적 분석이 어렵다면 고객사에 탐지 정책을 완화한 테스트 빌드나 허용 정책을 먼저 요청하는 것이 가장 재현 가능하다. 제공받은 테스트 빌드도 운영 빌드와 version, 기능, API 환경이 같은지 확인한다.

직접 패치가 승인된 경우에는 최종 탐지 branch 하나만 변경하고 원본과 작업본을 분리한다.

```bash
# Android Native 라이브러리와 symbol
readelf -Ws work/lib/arm64-v8a/libsecurity.so

# iOS Mach-O와 entitlement
otool -L Payload/Target.app/Target
codesign -d --entitlements - Payload/Target.app/Target
```

재패키징·재서명은 다른 무결성 검사를 유발한다. [앱 위변조](app-tampering.md)와 분리해 기록한다.

stealth·patched Frida 배포본은 공식 Frida가 아닌 커뮤니티 빌드다. 출처, 변경 코드, version 호환성과 바이너리 신뢰를 검토해야 하며 고객사 단말의 기본 도구로 사용하지 않는다.

---

## 결과 판정

| 관찰 결과 | 판단 | 다음 확인 |
| :--- | :--- | :--- |
| `frida-ps` 실패 | 환경 문제 가능성 높음 | server·권한·버전 복구 |
| noop attach 뒤 종료 | agent·debugger 탐지 후보 | crash 시각과 탐지 caller 확인 |
| 실제 hook 뒤에만 종료 | hook 무결성·script 오류 후보 | hook 하나씩 축소 |
| 앱 전용 boolean 하나로 실행 유지 | 단일 클라이언트 통제 후보 | 반복 검사와 민감 기능 영향 확인 |
| 운영 빌드만 탐지, 테스트 빌드 정상 | 정책 차이 | 빌드 동등성과 운영 통제 확인 |
| artifact 변경만으로 실행 유지 | 알려진 artifact 의존 후보 | 실제 보호 기능과 서버 통제 확인 |
| 후킹 뒤 화면만 열림 | 로컬 반응 우회 | 서버가 민감 작업도 승인하는지 확인 |

다음 조건을 함께 만족할 때 보호 통제의 약점을 후보로 남긴다.

- 위협 모델이나 고객사 요구사항상 runtime 분석 방어가 필요한 기능이다.
- 최소한의 앱 전용 변경으로 탐지가 반복 우회된다.
- 민감 로직이나 서버 기능까지 실제로 접근 가능하다.
- 추가 앱 무결성·서버 통제가 없거나 실효성이 없다.

anti-debug나 Frida 탐지가 없다는 사실만으로 취약점을 확정하지 않는다. 분석 난이도 상승을 위한 복원력 통제이며, 영향도는 보호 대상 데이터·기능과 후속 통제에서 결정한다.

## 증적 항목

- 앱 version, package·Bundle ID, APK·IPA·binary SHA-256
- 단말 모델, Android·iOS version, 루팅·탈옥 방식
- Frida host tools와 server·Gadget version
- 직접 실행, attach, noop attach, spawn 결과
- 오류 원문, 차단 메시지, 발생 시각, crash log
- 탐지 클래스·selector·Native module·offset
- 원본 반환값과 변경한 값 하나
- script 적용 전·후 같은 기능과 서버 응답
- 운영·테스트 빌드 차이와 적용된 RASP 정책

## 트러블슈팅

#### frida-ps 연결 실패

- USB·ADB·usbmuxd, SSH와 단말 신뢰 상태를 확인한다.
- host tools와 server·Gadget version을 맞춘다.
- 단말 ABI와 server binary, 실행 권한을 확인한다.
- 이 단계에서는 앱 탐지로 판단하지 않는다.

#### attach 직후 프로세스 종료

- noop script와 실제 script 결과를 비교한다.
- 앱의 명시적 종료인지 crash인지 로그에서 구분한다.
- attach 전에도 재현되는 루팅·탈옥 탐지와 분리한다.
- 이미 실행된 조기 검사라면 spawn으로 비교한다.

#### spawn 상태 차이

- 현재 CLI의 spawn 기본 동작과 `--pause` 사용 여부를 확인한다.
- 앱 시작에 필요한 timeout, provider·extension·보조 process를 확인한다.
- PID와 package·Bundle ID가 실제 대상 process인지 다시 확인한다.

#### Java·ObjC 런타임 부재

- `Java.available`, `ObjC.available`과 process를 확인한다.
- Native·Flutter·Unity·Swift 전용 구현 가능성을 확인한다.
- 너무 이른 시점이면 runtime 초기화 이후 관찰 코드를 예약한다.

#### Native offset crash

- 앱 build, ABI, module base와 offset을 다시 확인한다.
- Thumb·ARM64 명령 경계와 함수 시작 위치를 확인한다.
- 여러 hook을 모두 끄고 관찰용 hook 하나만 남긴다.

#### 과도한 로그·성능 저하

- `read`, `open`, `connect`를 동시에 trace하지 않는다.
- 한 함수와 한 사용자 행동만 재현한다.
- handler에서 대상 path·port·caller만 출력한다.

#### RASP 반복 차단

- 시작, foreground 복귀, 민감 기능 직전의 반복 검사를 구분한다.
- client callback과 서버 위험 응답을 함께 확인한다.
- 고객사 제공 테스트 정책이나 분석용 build 가능 여부를 검토한다.

## 빠른 명령어 참조

```bash
# 연결·대상
frida --version
frida-ls-devices
frida-ps -U
frida-ps -Uai

# attach·spawn
frida -U -p 12345 -l noop.js
frida -U -f com.target.app -l noop.js

# 단일 함수 trace
frida-trace -U -f com.target.app -i 'ptrace'
frida-trace -U -f com.target.app -i 'sysctl'

# Android process 상태
adb shell pidof com.target.app
adb shell cat /proc/12345/status

# iOS 정적 단서
strings -a Payload/Target.app/Target | grep -iE 'ptrace|P_TRACED|frida|debugger'
nm -u Payload/Target.app/Target | grep -iE 'ptrace|sysctl|getppid'
```

Windows 로그 필터:

```powershell
adb logcat | Select-String -Pattern 'debug|trace|frida|tamper|instrument|ptrace|crash'
```

## 관련 문서

- [Frida 후킹 실무](frida-scripts.md): 연결, attach·spawn, 관찰용 hook
- [정적 분석](static-analysis.md): 탐지 클래스, selector, Native 함수 식별
- [루팅 탐지 우회](root-detection-bypass.md): Android 루팅 신호 분리
- [탈옥 탐지 우회](jailbreak-detection-bypass.md): iOS 탈옥·tweak 신호 분리
- [SSL Pinning 우회](ssl-pinning-bypass.md): 분석 경로 확보 후 네트워크 후킹
- [앱 위변조](app-tampering.md): 재패키징·재서명·runtime 무결성

## 참고자료

공식·테스트 가이드:

- [OWASP MASTG - Android Reverse Engineering Tool Detection](https://mas.owasp.org/MASTG-KNOW-0030/)
- [OWASP MASTG - iOS Anti-Debugging Detection](https://mas.owasp.org/MASTG-KNOW-0085/)
- [OWASP MASTG - iOS Reverse Engineering Tools Detection](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-RESILIENCE/MASTG-KNOW-0087/)
- [Android - `Debug` API](https://developer.android.com/reference/android/os/Debug)
- [Frida CLI](https://frida.re/docs/frida-cli/)
- [Frida `frida-trace`](https://frida.re/docs/frida-trace/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)

커뮤니티 도구:

- [r2frida](https://github.com/nowsecure/r2frida)
- [fridare](https://github.com/suifei/fridare)
