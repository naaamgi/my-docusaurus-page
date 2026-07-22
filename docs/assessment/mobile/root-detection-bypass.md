---
sidebar_position: 7
title: 루팅 탐지 우회
description: Android 루팅 단말 기준선부터 탐지 신호 식별, 최소 범위 우회, Play Integrity 구분, 결과 판정까지 이어지는 실무 흐름
keywords: [Root Detection, Bypass, Magisk, DenyList, Zygisk, RootBeer, Play Integrity, Frida, Android, MASVS-RESILIENCE]
toc_max_heading_level: 3
draft: false
---

> 루팅 단말에서 앱 실행이나 일부 기능이 차단될 때 사용한다. 목표는 루팅 흔적을 무작정 전부 숨기는 것이 아니라 **탐지 신호를 식별하고 필요한 범위만 우회해 본 점검 경로를 확보하는 것**이다.

## 사용 시점

- 루팅한 Android 단말에서 앱이 시작 직후 종료되거나 보안 안내를 표시할 때
- 로그인은 되지만 인증, 결제, 이체 같은 특정 기능만 차단될 때
- 정적 분석에서 RootBeer, `isRooted`, `su`, Magisk 또는 시스템 속성 검사가 발견됐을 때
- Frida와 프록시를 사용하기 전에 루팅 탐지와 계측 탐지를 분리해야 할 때
- Play Integrity 응답이 실제 서버 정책에 사용되는지 확인해야 할 때

루팅 단말을 동적 분석에 사용하는 것과 루팅 탐지의 보안 적정성을 평가하는 것은 별개다. 우회 성공은 **분석 환경을 확보했다는 사실**이며, 그 자체로 취약점이 확정되지는 않는다.

## 점검 원칙

- 허가된 앱, 테스트 계정, 고객사가 승인한 단말에서만 수행한다.
- 정상 단말과 루팅 단말의 같은 기능을 비교해 기준선을 남긴다.
- 처음에는 반환값을 바꾸지 않는 관찰용 후킹으로 실제 탐지 신호를 찾는다.
- 범용 스크립트보다 앱에서 확인한 클래스, 경로, 명령만 좁게 우회한다.
- 루팅 탐지, Frida 탐지, 재패키징 탐지, 서버 단말 무결성 검증을 서로 구분한다.
- 앱 실행 성공이 아니라 원래 차단됐던 **같은 기능과 서버 응답**까지 확인한다.
- 개인정보와 토큰은 로그에 그대로 남기지 않는다.

## 탐지 유형

| 유형 | 흔한 단서 | 확인 위치 | 첫 접근 |
| :--- | :--- | :--- | :--- |
| 파일·디렉터리 | `su`, Magisk, Superuser 관련 경로 | `File.exists`, `access`, `fopen` | 실제 조회 경로 관찰 |
| 패키지·프로세스 | 알려진 루트 관리 앱, Zygisk·후킹 흔적 | `PackageManager`, `/proc` | 조회 대상과 호출자 확인 |
| 명령 실행 | `su`, `which su`, `mount`, `getprop` | `Runtime.exec`, `ProcessBuilder` | 정확한 명령과 반환 처리 확인 |
| 빌드·속성 | `test-keys`, `ro.debuggable`, `ro.secure` | `Build`, `SystemProperties` | 원본 값과 판정 조건 비교 |
| 마운트·권한 | 읽기·쓰기 마운트, SELinux 상태 | `/proc/mounts`, `mount`, `getenforce` | 단말 상태와 앱 해석 분리 |
| 탐지 라이브러리 | RootBeer, 상용 RASP SDK | Java·JNI·Native 코드 | 라이브러리 버전과 래퍼 메서드 확인 |
| 단말 무결성 | Play Integrity 토큰과 verdict | 앱 요청 코드와 백엔드 응답 | 요청 결합과 서버 정책 확인 |

RootBeer처럼 Java와 JNI 검사를 함께 사용하는 라이브러리도 있다. 반대로 클래스 이름은 RootCheck여도 실제로는 한 개의 파일만 검사할 수 있으므로 이름만 보고 강도를 판단하지 않는다.

## 진단 절차

#### Step 1. 단말 기준선

[Android 진단 환경 구성](setup-android.md)에 따라 앱 버전, 패키지명, Android 버전, 단말 모델, 루팅 방식과 Magisk 버전을 기록한다. 가능하면 같은 빌드를 정상 단말과 루팅 단말에서 각각 실행한다.

| 관찰 결과 | 현재 가설 | 다음 작업 |
| :--- | :--- | :--- |
| 두 단말 모두 정상 | 탐지 미적용 또는 현재 흐름에서 미사용 | 민감 기능과 다른 실행 시점 확인 |
| 루팅 단말만 시작 차단 | 시작 구간의 로컬 탐지 또는 서버 판정 | 메시지 시각과 로그 수집 |
| 특정 기능만 차단 | 기능 직전 재검사 또는 서버 정책 | 같은 요청의 전후 응답 비교 |
| Frida 연결 후에만 종료 | 루팅보다 계측·디버거 탐지 가능 | [Anti-debug 우회](anti-debug-bypass.md)로 분리 |

#### Step 2. 메시지·로그 연결

앱 화면의 정확한 문구와 발생 시각을 적고, 그 직전부터 Android 로그를 수집한다.

```bash
adb logcat -c
adb logcat | grep -iE 'root|magisk|integrity|security|tamper|zygisk'
```

Windows PowerShell:

```powershell
adb logcat -c
adb logcat | Select-String -Pattern 'root|magisk|integrity|security|tamper|zygisk'
```

**결과에서 볼 항목:** 앱 프로세스 종료 원인, 예외 클래스, RASP 또는 탐지 라이브러리 이름, Play Integrity 오류, 차단 직전 호출된 Activity·Service를 확인한다. 일반 시스템 로그의 `root` 문자열만으로 앱 탐지라고 단정하지 않는다.

#### Step 3. 정적 단서 수집

[정적 분석](static-analysis.md)에서 문자열의 사용처와 호출자를 따라간다.

```bash
rg -n 'isRooted|RootBeer|/system/.*/su|magisk|test-keys|ro\.debuggable|ro\.secure|Runtime\.exec|ProcessBuilder|IntegrityManager' work
```

확인할 항목은 다음과 같다.

- 앱 자체 래퍼 클래스와 최종 boolean 반환 지점
- 검사가 앱 시작 시 한 번인지, 민감 기능마다 반복되는지
- Java 코드에서 끝나는지 JNI 또는 Native 함수로 내려가는지
- 차단 화면만 로컬에서 결정하는지 서버 응답이 결정하는지
- Play Integrity 토큰이 어느 요청과 함께 전송되는지

#### Step 4. 원본 반환값 관찰

[Frida 후킹 실무](frida-scripts.md)의 대상 선정 순서에 따라 앱에서 확인한 메서드만 후킹한다. 먼저 인자와 원본 반환값을 출력하고 그대로 반환한다. 우회 전 로그가 차단 시각과 일치해야 해당 메서드를 유효한 후보로 볼 수 있다.

#### Step 5. 최소 범위 우회

| 확인된 상황 | 우선 시도 | 범위 |
| :--- | :--- | :--- |
| Magisk 환경 노출 여부만 빠르게 비교 | DenyList 적용 전·후 비교 | 대상 패키지와 관련 프로세스 |
| 흔한 Java 탐지 여부 확인 | Objection smoke test | 한 세션 |
| RootBeer 래퍼 확인 | 확인한 메서드 반환값만 변경 | 단일 클래스·overload |
| 특정 파일 경로 확인 | 해당 경로의 결과만 변경 | 일치 경로만 |
| Native 검사 확인 | 함수·모듈·호출자 관찰 후 전용 후킹 | 단일 심볼 또는 호출자 |
| 서버 verdict 확인 | 정상·루팅 단말 요청 비교 | 승인된 기능과 계정 |

한 번에 여러 신호를 바꾸면 실제 차단 조건을 알 수 없다. 변경 하나마다 앱을 원래 상태로 되돌린 뒤 같은 행동을 반복한다.

#### Step 6. 보호 기능 재검증

- 우회 전 차단됐던 같은 화면과 기능이 우회 후 열리는가
- 우회 로그의 시각과 기능 실행 시각이 일치하는가
- 스크립트를 제거하면 원래 차단 상태로 돌아가는가
- 서버가 민감 작업을 실제로 승인했는가
- 다른 인증·권한 검사가 그대로 동작하는가
- 앱 재시작, 백그라운드 복귀, 재로그인 뒤에도 결과가 같은가

## 우회 노트

### Magisk DenyList

Magisk의 DenyList는 선택한 프로세스에서 Magisk 변경을 되돌리는 기능이다. 최신 Magisk는 별도의 완전한 루팅 은닉을 제공하지 않으므로 `DenyList 적용 = 모든 루팅 흔적 제거`로 이해하지 않는다.

GUI 기준 흐름:

```text
1. Magisk 설정에서 현재 Zygisk와 DenyList 상태 기록
2. Configure DenyList에서 대상 앱과 별도 프로세스 확인
3. Enforce DenyList 활성화
4. 단말 재부팅
5. 앱 데이터 초기화 여부를 기록한 뒤 같은 동작 재현
```

승인된 테스트 단말의 shell에서 현재 상태를 확인할 수도 있다.

```bash
su -c 'magisk -v'
su -c 'magisk --denylist status'
su -c 'magisk --denylist ls'
```

**결과에서 볼 항목:** 대상 패키지의 보조 프로세스가 누락됐는지, 적용 전·후 차단 지점이 달라졌는지, 앱 캐시나 서버 상태가 결과에 영향을 주는지 확인한다.

Shamiko 같은 추가 모듈은 Magisk 공식 기능이 아닌 커뮤니티 도구다. Magisk·Zygisk 버전 호환성과 출처를 별도로 확인해야 하며, 고객사 기준 단말의 기본 구성으로 가정하지 않는다. 모듈을 추가했다면 이름, 버전, 출처와 변경 전·후 결과를 기록한다.

### Objection smoke test

구현을 아직 모를 때 흔한 Java 탐지인지 빠르게 가늠하는 용도다. 설치한 버전의 도움말에서 문법을 먼저 확인한다.

```bash
objection --version
objection --help
objection -n com.target.app start
```

Objection REPL:

```text
android root disable
```

구버전 자료에는 `objection -g com.target.app explore` 문법이 보일 수 있다. 현재 설치 버전의 도움말을 우선한다. 자동 우회가 성공해도 어떤 API가 바뀌었는지 모르면 판정 근거가 약하므로, 이후 앱 전용 탐지 위치를 확인한다.

### RootBeer

정적 분석에서 `com.scottyab.rootbeer.RootBeer`와 `isRooted()` 호출을 확인한 경우에만 사용한다. 첫 실행은 반환값을 바꾸지 않는다.

```javascript
Java.perform(function () {
    const RootBeer = Java.use('com.scottyab.rootbeer.RootBeer');
    const isRooted = RootBeer.isRooted.overload();

    isRooted.implementation = function () {
        const originalResult = isRooted.call(this);
        console.log('[RootBeer.isRooted] result=' + originalResult);
        return originalResult;
    };
});
```

차단 시점에 `true`가 반환되는 것을 확인한 뒤, 해당 메서드가 원인인지 검증할 때만 마지막 줄을 다음과 같이 바꾼다.

```javascript
return false;
```

```bash
frida -U -f com.target.app -l rootbeer-check.js
```

**결과에서 볼 항목:** 래퍼가 `isRooted()` 대신 개별 검사 메서드를 호출하는지, Native 검사 결과가 별도로 사용되는지, 앱 시작 뒤에도 반복 호출되는지 확인한다.

### 파일 경로 검사

jadx 또는 관찰 로그에서 실제 경로를 확인한 뒤 그 경로만 대상으로 삼는다. 다음 예시는 두 경로의 조회 여부를 기록하며 원본 결과를 유지한다.

```javascript
Java.perform(function () {
    const File = Java.use('java.io.File');
    const exists = File.exists.overload();
    const rootPaths = new Set([
        '/system/bin/su',
        '/system/xbin/su'
    ]);

    exists.implementation = function () {
        const path = this.getAbsolutePath();
        const originalResult = exists.call(this);

        if (rootPaths.has(path)) {
            console.log('[File.exists] path=' + path + ' result=' + originalResult);
        }
        return originalResult;
    };
});
```

일치한 경로가 실제 차단 원인인지 검증할 때만 반환 부분을 다음과 같이 제한한다.

```javascript
return rootPaths.has(path) ? false : originalResult;
```

`path.includes('su')`처럼 부분 문자열로 모든 파일을 숨기면 정상 리소스까지 영향을 받을 수 있다. 앱에서 조회하지 않은 긴 경로 목록을 먼저 넣지 않는다.

### 명령·속성 검사

`Runtime.exec`, `ProcessBuilder`, `SystemProperties.get`은 overload가 많고 앱의 정상 기능에서도 사용된다. 전역 변조 전에 정적 분석과 호출 로그로 정확한 명령 또는 key를 확인한다.

단말 기준값:

```bash
adb shell getprop ro.build.tags
adb shell getprop ro.debuggable
adb shell getprop ro.secure
adb shell which su
adb shell mount
adb shell getenforce
```

**결과에서 볼 항목:** 단말의 실제 값, 앱이 기대하는 값, 값 하나가 바뀔 때 차단 여부를 구분한다. `Runtime.exec` 전체에 예외를 던지거나 모든 시스템 속성을 정상값으로 바꾸는 범용 후킹은 기본 예시로 사용하지 않는다.

### Native 탐지

Java 후킹 로그 없이 차단되거나 `lib/<ABI>/*.so`에서 `access`, `stat`, `fopen`, `open`, `readlink` 호출이 보이면 Native 검사를 의심한다.

```bash
rg -n 'System\.loadLibrary|native ' work
frida-trace -U -f com.target.app -i 'access' -i 'fopen'
```

`frida-trace`는 대상 프로세스에서도 호출량이 많을 수 있다. 한 번에 심볼 하나를 추적하고, 생성된 handler에서 루팅 후보 경로만 출력한다. 앱 자체 모듈과 호출자를 확인한 뒤 [Frida 후킹 실무](frida-scripts.md)의 Native 관찰 방식으로 범위를 좁힌다.

### APK 패치

후킹이 허용되지 않거나 시작 시점이 너무 빨라 동적 검증이 어려울 때 제한적으로 검토한다. 원본과 작업본을 분리하고 탐지 메서드 하나만 변경한다.

```bash
apktool d target.apk -o work/target-decoded
apktool b work/target-decoded -o work/target-patched.apk
apksigner verify --verbose work/target-patched.apk
```

재패키징과 서명은 앱 서명 검증, 배포 형식, split APK, 서버의 앱 무결성 정책에 영향을 준다. 패치본 설치 실패를 루팅 탐지 실패로 해석하지 말고 [앱 위변조](app-tampering.md)에서 별도로 확인한다. 원본 앱을 곧바로 제거하지 않고 테스트 단말의 복구 방법을 먼저 준비한다.

### Play Integrity

Play Integrity는 로컬 boolean 검사와 다른 계층이다. 표준 요청에서는 앱이 중요한 요청 값의 digest를 `requestHash`에 넣고 무결성 토큰을 백엔드로 전송한다. 백엔드는 토큰을 복호화·검증하고 원래 요청과 `requestHash`, 패키지, 시각, 필요한 verdict를 비교해야 한다.

확인할 주요 영역:

| 영역 | 확인 항목 |
| :--- | :--- |
| `requestDetails` | 패키지명, `requestHash`, 시각과 원 요청의 결합 |
| `appIntegrity` | Google Play가 인식한 앱과 인증서 상태 |
| `deviceIntegrity` | `MEETS_BASIC_INTEGRITY`, `MEETS_DEVICE_INTEGRITY`, 선택적인 `MEETS_STRONG_INTEGRITY` |
| 서버 정책 | 어떤 기능에서 어떤 verdict를 요구하고 실패 시 어떻게 처리하는지 |

승인된 정상 단말과 루팅 단말에서 같은 기능을 수행하고 다음을 비교한다.

1. 무결성 토큰 요청 시점과 보호 대상 API 요청의 연결
2. 토큰 누락, 만료, 재사용 또는 요청 불일치 때 서버 응답
3. verdict가 다른 단말에서 서버가 실제로 제한하는 기능
4. 안내, 제한, 추가 인증 등 단계별 처리 정책

클라이언트에서 `IntegrityManager` 호출을 발견한 것만으로 서버 검증을 확정할 수 없다. 반대로 앱 화면을 후킹해 열었다고 해서 서명된 verdict나 서버 정책을 우회한 것도 아니다. SafetyNet Attestation은 레거시 구현을 분석할 때만 별도로 기록하고 신규 기준은 Play Integrity를 우선한다.

## 결과 판정

| 관찰 결과 | 판단 | 다음 확인 |
| :--- | :--- | :--- |
| 루팅 단말에서도 정상 실행 | 탐지 미적용 가능 | 요구사항과 보호 대상 기능 확인 |
| 로컬 반환값 하나로 화면 차단 해제 | 단일 클라이언트 통제 후보 | 서버가 민감 작업도 승인하는지 확인 |
| 자동 도구로 실행만 가능 | 분석 경로 확보 | 실제 바뀐 API와 기능 영향 식별 |
| 패치본에서 화면만 열림 | 로컬 UI 우회 | 서명·서버 무결성 및 API 권한 확인 |
| Play Integrity 호출 존재 | 서버 검증 후보 | 요청 결합, verdict 검증, 실패 처리 확인 |
| 루팅 verdict에도 민감 API 승인 | 서버 정책 미적용 후보 | 테스트 조건과 요구 verdict 재확인 |
| Frida 연결 때만 종료 | 계측 탐지 후보 | 루팅 탐지와 분리 점검 |

다음 조건을 함께 만족할 때 보호 통제의 약점을 구체적인 후보로 남긴다.

- 고객사 요구사항이나 위협 모델상 해당 기능에 단말 무결성 통제가 필요하다.
- 최소한의 클라이언트 변경으로 통제가 해제된다.
- 서버가 민감 기능을 그대로 승인하거나 후속 통제가 없다.
- 정상·루팅 단말과 변경 전·후 결과가 반복 재현된다.

루팅 탐지 부재, DenyList 적용, Frida 후킹 또는 Smali 패치 성공만으로 등급을 정하지 않는다. 일반 정보 조회 앱과 금융 거래 앱의 요구 수준은 다르며, 영향도는 실제로 보호하려던 기능과 서버 통제에서 결정한다.

## 증적 항목

- 앱 버전, 패키지명, APK SHA-256
- 단말 모델, Android 버전, 보안 패치 수준
- 루팅 방식, Magisk·Zygisk·추가 모듈 버전
- 정상 단말과 루팅 단말의 같은 기능 결과
- 탐지 메시지, 발생 시각, 관련 로그
- 확인한 클래스·메서드·Native 모듈과 원본 반환값
- 적용한 변경 하나와 변경 전·후 결과
- 보호 대상 API의 마스킹된 요청·응답과 서버 처리
- Play Integrity 요청 유형, 확인한 verdict, 요청 결합 방식

## 트러블슈팅

#### DenyList 적용 후 차단

- 대상 앱의 보조 프로세스와 Google Play services 관련 흐름을 혼동하지 않았는지 확인한다.
- Magisk 버전과 실제 DenyList enforcement 상태를 기록한다.
- 커뮤니티 모듈을 모두 추가하기 전에 로컬 탐지와 Play Integrity를 먼저 구분한다.
- 앱 데이터, 서버의 위험 상태, 단말 등록 상태가 이전 결과를 유지하는지 확인한다.

#### 앱 시작 직후 종료

- spawn 시점의 로그와 native crash tombstone을 확인한다.
- 루팅 탐지보다 Frida·디버거·재패키징 탐지가 먼저 실행되는지 분리한다.
- 다중 프로세스 앱이면 실제 차단 로직이 실행되는 프로세스를 찾는다.

#### 후킹 로그 부재

- 클래스명, overload, ClassLoader와 프로세스가 맞는지 확인한다.
- 앱 시작 전에 호출되는 메서드는 spawn으로, 이후 기능은 attach로 비교한다.
- Java가 아닌 JNI·Native 또는 서버 응답에서 차단하는지 확인한다.

#### Play Integrity 실패

- 테스트 빌드와 Play Console에 등록된 앱·인증서가 일치하는지 확인한다.
- 단말의 Google Play services, Play Store 상태와 네트워크 시각을 확인한다.
- `MEETS_STRONG_INTEGRITY`가 선택적 label인지와 Android 버전·보안 패치 조건을 확인한다.
- 클라이언트 오류와 백엔드의 verdict 거부를 구분한다.

#### 재패키징 설치 실패

- 원본과 패치본의 서명, package ID, versionCode를 비교한다.
- split APK 일부만 재패키징하지 않았는지 확인한다.
- 기존 앱의 데이터 보존이 필요하면 임의로 uninstall하지 않는다.
- 설치 성공 뒤 발생한 서명 검증 실패는 [앱 위변조](app-tampering.md)로 분리한다.

## 빠른 명령어 참조

```bash
# 단말과 앱 기준 정보
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.security_patch
adb shell pm path com.target.app

# 루팅 환경 기준값
adb shell getprop ro.build.tags
adb shell getprop ro.debuggable
adb shell which su
adb shell getenforce

# 로그
adb logcat -c
adb logcat | grep -iE 'root|magisk|integrity|security|tamper|zygisk'

# Magisk 상태
su -c 'magisk -v'
su -c 'magisk --denylist status'
su -c 'magisk --denylist ls'

# 동적 분석
frida-ps -Uai
frida -U -f com.target.app -l root-check.js
objection -n com.target.app start
```

Windows 로그 필터:

```powershell
adb logcat | Select-String -Pattern 'root|magisk|integrity|security|tamper|zygisk'
```

## 관련 문서

- [Android 진단 환경 구성](setup-android.md): 루팅 단말, ADB, Frida 환경
- [정적 분석](static-analysis.md): 탐지 클래스와 Native 모듈 식별
- [Frida 후킹 실무](frida-scripts.md): 관찰용 후킹과 대상 범위 축소
- [SSL Pinning 우회](ssl-pinning-bypass.md): 네트워크 분석 경로 확보
- [Anti-debug 우회](anti-debug-bypass.md): Frida·디버거 탐지 분리
- [앱 위변조](app-tampering.md): 재패키징과 서명·무결성 검증
- [탈옥 탐지 우회](jailbreak-detection-bypass.md): iOS 대응 영역

## 참고자료

공식·표준 자료:

- [OWASP MASTG - Root Detection](https://mas.owasp.org/MASTG-KNOW-0027/)
- [OWASP MASTG - Bypassing Root Detection](https://mas.owasp.org/MASTG-TECH-0144/)
- [OWASP MASTG - RootBeer](https://mas.owasp.org/MASTG/tools/android/MASTG-TOOL-0146/)
- [Google - Play Integrity 개요](https://developer.android.com/google/play/integrity/overview)
- [Google - Play Integrity 표준 요청](https://developer.android.com/google/play/integrity/standard)
- [Google - Play Integrity verdict](https://developer.android.com/google/play/integrity/verdicts)
- [Magisk 공식 문서](https://topjohnwu.github.io/Magisk/)
- [Magisk 도구 문서](https://topjohnwu.github.io/Magisk/tools.html)
- [RootBeer 공식 저장소](https://github.com/scottyab/rootbeer)
- [Frida 공식 문서](https://frida.re/docs/)

커뮤니티 도구:

- [Objection](https://github.com/sensepost/objection)
- [Shamiko 릴리스 안내](https://github.com/LSPosed/LSPosed.github.io/releases)
