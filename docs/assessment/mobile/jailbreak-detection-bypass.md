---
sidebar_position: 8
title: 탈옥 탐지 우회
description: iOS 탈옥 단말 기준선부터 탐지 신호 식별, 최소 범위 우회, App Attest 구분, 결과 판정까지 이어지는 실무 흐름
keywords: [Jailbreak Detection, Bypass, Rootless, Rootful, Shadow, Choicy, Frida, NSFileManager, App Attest, DeviceCheck, MASVS-RESILIENCE, iOS]
toc_max_heading_level: 3
draft: false
---

> 탈옥 단말에서 앱 실행이나 특정 기능이 차단될 때 사용한다. 목표는 탈옥 흔적을 전부 숨기는 것이 아니라 **실제 탐지 신호를 찾고 필요한 범위만 우회해 분석 경로를 확보하는 것**이다.

## 사용 시점

- 탈옥한 iPhone 또는 iPad에서 앱이 시작 직후 종료될 때
- 로그인은 가능하지만 인증, 결제, 이체 같은 특정 기능만 차단될 때
- 정적 분석에서 `isJailbroken`, `fileExistsAtPath:`, `fork`, dyld 검사가 발견됐을 때
- Shadow 같은 트윅 적용 전·후 결과를 비교해야 할 때
- Frida 연결 이후에만 종료되어 탈옥 탐지와 계측 탐지를 구분해야 할 때
- DeviceCheck 또는 App Attest가 실제 서버 정책에 사용되는지 확인해야 할 때

탈옥 탐지 우회는 동적 분석을 위한 환경 구성에 가깝다. 우회 도구로 앱이 열렸다는 사실만으로 취약점을 확정하지 않는다.

## 점검 원칙

- 허가된 앱, 테스트 계정, 고객사가 승인한 단말에서만 수행한다.
- 정상 단말과 탈옥 단말에서 같은 앱 버전과 기능을 비교한다.
- jailbreak 종류, rootful·rootless 방식, tweak injection 계층을 기록한다.
- 첫 후킹은 원본 반환값을 바꾸지 않는 관찰용으로 만든다.
- 앱에서 실제 확인한 클래스, selector, 경로, Native 함수만 좁게 변경한다.
- 탈옥 탐지, Frida·디버거 탐지, 재서명 탐지, 서버 앱 무결성 검증을 구분한다.
- 앱 화면뿐 아니라 원래 차단된 기능의 서버 응답까지 재검증한다.

## 탐지 유형

| 유형 | 흔한 단서 | 확인 위치 | 첫 접근 |
| :--- | :--- | :--- | :--- |
| 파일·디렉터리 | Cydia·Sileo·apt·SSH·tweak 경로 | `NSFileManager`, `access`, `stat`, `fopen` | 실제 조회 경로 관찰 |
| sandbox 이탈 | 컨테이너 밖 파일 생성 성공 | `write`, `createFileAtPath:` | 생성·삭제 흐름과 오류 확인 |
| URL Scheme | `cydia://`, `sileo://` | `canOpenURL:`과 `Info.plist` | 등록 scheme와 원본 결과 확인 |
| 프로세스·syscall | `fork`, `getppid`, `sysctl`, process 목록 | libc·syscall 래퍼 | 호출자와 반환값 확인 |
| 로드 이미지 | Substrate, Substitute, ElleKit, Frida 관련 dylib | dyld API, 환경 변수 | 탈옥·계측 탐지 분리 |
| rootless 경로 | `/var/jb`, `/private/preboot/...` 아래 흔적 | 파일·symlink·mount 검사 | 현재 탈옥 구성 기준 확인 |
| 앱 전용 로직 | `isJailbroken`, RASP SDK 래퍼 | Objective-C·Swift·Native | 최종 boolean과 호출 시점 확인 |
| 서버 신뢰 신호 | DeviceCheck token, App Attest assertion | 앱 요청 코드와 백엔드 | challenge·검증·실패 정책 확인 |

같은 앱이 여러 신호를 하나의 래퍼에 모으거나 실행 시점마다 다른 검사를 사용할 수 있다. 클래스 이름이나 경로 하나만 보고 전체 탐지 강도를 판단하지 않는다.

---

## 진단 절차

#### Step 1. 단말 기준선

[iOS 진단 환경 구성](setup-ios.md)에 따라 다음 항목을 먼저 기록한다.

- iOS 버전과 단말 모델
- 앱 버전, Bundle ID, IPA 또는 Mach-O SHA-256
- jailbreak 도구와 버전
- rootful·rootless 여부와 `/var/jb` 존재 여부
- Substrate, Substitute, ElleKit 같은 injection 계층
- Frida, Shadow, Choicy와 적용한 다른 tweak 버전

탈옥 단말에서 확인할 수 있는 최소 기준값:

```bash
uname -a
ls -ld /var/jb /private/preboot 2>/dev/null
ps aux | grep -iE 'frida|substrate|substitute|ellekit'
frida-ps -Uai
```

#### Step 2. 정상·탈옥 단말 비교

| 관찰 결과 | 현재 가설 | 다음 작업 |
| :--- | :--- | :--- |
| 두 단말 모두 정상 | 탐지 미적용 또는 해당 흐름에서 미사용 | 민감 기능과 재실행 시점 확인 |
| 탈옥 단말만 시작 차단 | 시작 구간의 로컬 탐지 또는 서버 판정 | 메시지 시각과 crash log 수집 |
| 특정 기능만 차단 | 기능 직전 재검사 또는 서버 정책 | 같은 기능의 요청·응답 비교 |
| Frida 연결 후에만 종료 | 계측·디버거 탐지 가능 | [Anti-debug 우회](anti-debug-bypass.md)로 분리 |
| 재서명본만 종료 | 서명·프로비저닝·App Attest 가능 | [앱 위변조](app-tampering.md)로 분리 |

직접 실행 상태에서 앱이 원래 정상인지 먼저 확인한다. 네트워크 장애, 만료된 테스트 계정, 호환되지 않는 iOS 버전을 탈옥 탐지로 오해하지 않는다.

#### Step 3. 로그·크래시 연결

macOS Console 또는 Xcode Devices and Simulators에서 대상 프로세스의 로그와 crash report를 확인한다. 탈옥 단말 shell을 사용할 수 있다면 앱 실행 시각과 함께 시스템 로그를 좁힌다.

```bash
log stream --style compact --predicate 'process == "TargetApp"'
```

**결과에서 볼 항목:** 차단 문구, 예외·signal, 종료를 호출한 모듈, RASP 이름, 서버 오류 코드, App Attest·DeviceCheck 오류를 확인한다. `SIGABRT`만으로 원인을 탈옥 탐지라고 결론 내리지 않는다.

#### Step 4. 정적 단서 수집

[정적 분석](static-analysis.md)에서 문자열의 사용처와 호출자를 따라간다.

```bash
rg -n 'isJailbroken|isJailBroken|Cydia|Sileo|/var/jb|/private/preboot|fileExistsAtPath|canOpenURL|fork|_dyld|AppAttest|DCDevice' work
strings -a Payload/Target.app/Target | grep -iE 'jail|cydia|sileo|/var/jb|appattest|devicecheck'
otool -L Payload/Target.app/Target
```

확인할 항목은 다음과 같다.

- 앱 자체 래퍼와 최종 boolean 반환 지점
- 검사 시점이 시작 한 번인지 민감 기능마다 반복되는지
- Objective-C selector가 남아 있는지 Swift·Native로 내려가는지
- rootful 경로만 보는지 rootless 흔적까지 포함하는지
- 차단 화면이 로컬 분기인지 서버 응답에 의한 것인지
- App Attest assertion 또는 DeviceCheck token이 어떤 요청과 연결되는지

#### Step 5. 원본 반환값 관찰

[Frida 후킹 실무](frida-scripts.md)의 순서에 따라 확인한 메서드만 attach한다. 호출 시각, 인자 형식, 원본 반환값을 기록하고 그대로 반환한다. 앱 차단과 후킹 로그의 시각이 일치해야 유효한 후보로 본다.

#### Step 6. 최소 범위 우회

| 확인된 상황 | 우선 시도 | 범위 |
| :--- | :--- | :--- |
| 흔한 artifact 검사 가능성 | Shadow 단독 비교 | 대상 앱 하나 |
| tweak 충돌 또는 injection 탐지 | Choicy로 다른 tweak 정리 | 대상 앱 하나 |
| 구현 미확인 | Objection smoke test | 한 세션 |
| 앱 전용 boolean 확인 | 해당 selector 반환값만 변경 | 단일 메서드 |
| 특정 경로 확인 | 그 경로 결과만 변경 | 정확히 일치하는 경로 |
| Native 검사 확인 | 심볼·모듈·호출자 관찰 후 전용 후킹 | 단일 함수·호출자 |
| 서버 신뢰 신호 확인 | 정상·탈옥 단말 요청 비교 | 승인된 기능·계정 |

변경을 한꺼번에 적용하지 않는다. 하나씩 적용하고 원래 상태로 되돌린 뒤 같은 행동을 반복한다.

#### Step 7. 보호 기능 재검증

- 우회 전 차단됐던 같은 화면과 기능이 우회 후 열리는가
- 후킹 로그와 기능 실행 시각이 일치하는가
- tweak 또는 스크립트를 끄면 원래 상태로 돌아가는가
- 앱 재시작, 백그라운드 복귀, 재로그인 뒤에도 결과가 같은가
- 서버가 민감 작업을 실제로 승인했는가
- 다른 인증·권한 검사가 그대로 동작하는가

---

## 우회 노트

### Shadow·Choicy

Shadow는 현대 iOS jailbreak 환경을 대상으로 하는 커뮤니티 우회 tweak다. jailbreak 종류, iOS 버전, injection library와 앱 구현에 따라 결과가 달라지며 모든 앱에서 동작한다고 가정하지 않는다.

```text
1. 현재 앱이 직접 실행되는지 기준선 기록
2. 다른 우회 tweak를 끈 상태에서 Shadow만 대상 앱에 적용
3. 앱 완전 종료 후 같은 화면과 기능 재실행
4. 성공·실패와 Shadow 설정 강도 기록
5. Shadow를 끄고 원래 차단 상태 재확인
```

Shadow 프로젝트도 여러 우회 tweak를 동시에 활성화하면 충돌할 수 있다고 안내한다. 앱별 설정을 사용하고 한 번에 하나만 비교한다. 오래된 Liberty Lite·A-Bypass 자료는 현재 단말의 rootless 지원과 최근 유지보수 상태를 확인한 뒤 참고한다. 고정된 iOS 호환 버전표를 기준으로 삼지 않는다.

Choicy는 대상 앱에 주입되는 tweak를 정리해 충돌 또는 injection 흔적을 분리할 때 사용한다.

```text
1. 대상 앱의 기본 tweak injection 상태 기록
2. Choicy에서 다른 tweak 비활성화
3. 앱 단독 실행 결과 확인
4. 필요한 경우 Shadow 하나만 허용해 비교
5. Frida는 별도 attach하여 결과 분리
```

모든 tweak를 끈 뒤 앱이 열리면 탈옥 흔적보다 특정 주입 모듈이나 충돌을 탐지했을 가능성이 있다. 이 결과는 [Anti-debug 우회](anti-debug-bypass.md) 영역과 함께 본다.

### Objection smoke test

구현을 아직 모를 때 흔한 API 검사인지 빠르게 가늠하는 용도다. 설치한 버전의 도움말과 명령을 먼저 확인한다.

```bash
objection --version
objection --help
objection -n com.target.app start
```

Objection REPL:

```text
ios jailbreak disable
```

구버전 자료에는 `objection -g com.target.app explore` 문법이 보일 수 있다. 현재 설치 버전의 도움말을 우선한다. 자동 우회로 앱이 열려도 어떤 API가 바뀌었는지 확인하지 않으면 판정 근거가 약하므로 앱 전용 탐지 위치를 계속 찾는다.

### 앱 전용 메서드

정적 분석에서 `-[JailbreakDetection isJailbroken]` 같은 Objective-C selector를 확인한 경우에만 사용한다. 먼저 원본 반환값을 출력한다.

```javascript
if (ObjC.available) {
    const JailbreakDetection = ObjC.classes.JailbreakDetection;
    const isJailbroken = JailbreakDetection['- isJailbroken'];

    if (isJailbroken) {
        Interceptor.attach(isJailbroken.implementation, {
            onLeave(retval) {
                console.log('[isJailbroken] result=' + retval.toInt32());
            }
        });
    }
}
```

```bash
frida -U -f com.target.app -l observe-jailbreak.js
```

차단 시점에 `1`이 반환되는 것을 확인한 뒤 해당 메서드가 원인인지 검증할 때만 `onLeave`에 다음 변경을 추가한다.

```javascript
retval.replace(ptr(0));
```

Swift symbol이 제거됐거나 클래스가 보이지 않으면 selector 이름을 추측해 반복하지 않는다. Mach-O의 함수와 문자열 참조, 호출자 또는 RASP 래퍼를 다시 찾는다.

### 파일 경로 검사

앱에서 실제로 조회한 경로만 대상으로 삼는다. 다음 예시는 두 경로의 원본 결과를 기록하며 값을 바꾸지 않는다.

```javascript
if (ObjC.available) {
    const fileExists = ObjC.classes.NSFileManager['- fileExistsAtPath:'];
    const observedPaths = new Set([
        '/Applications/Cydia.app',
        '/var/jb'
    ]);

    Interceptor.attach(fileExists.implementation, {
        onEnter(args) {
            this.path = new ObjC.Object(args[2]).toString();
            this.isTarget = observedPaths.has(this.path);
        },
        onLeave(retval) {
            if (this.isTarget) {
                console.log('[fileExistsAtPath] path=' + this.path +
                    ' result=' + retval.toInt32());
            }
        }
    });
}
```

정확히 일치한 경로가 차단 원인인지 확인할 때만 `onLeave` 안에서 다음 줄을 추가한다.

```javascript
if (this.isTarget) retval.replace(ptr(0));
```

`path.includes('jail')`처럼 부분 문자열로 정상 파일까지 숨기지 않는다. rootless jailbreak는 `/var/jb` 또는 `/private/preboot/...` 아래 경로를 사용할 수 있으므로 과거 Cydia 경로 목록만 복사하지 말고 현재 단말과 앱 조회값을 연결한다.

### URL Scheme

`canOpenURL:` 검사는 앱의 `Info.plist`에 있는 `LSApplicationQueriesSchemes`와 iOS 정책의 영향을 받는다. `false`가 반환됐다는 사실만으로 해당 앱이 설치되지 않았다고 단정하지 않는다.

```bash
plutil -p Payload/Target.app/Info.plist | grep -A 20 LSApplicationQueriesSchemes
```

정적 분석에서 `cydia://` 또는 `sileo://` 사용을 확인한 뒤 해당 URL만 관찰한다.

```javascript
if (ObjC.available) {
    const canOpenURL = ObjC.classes.UIApplication['- canOpenURL:'];

    Interceptor.attach(canOpenURL.implementation, {
        onEnter(args) {
            this.url = new ObjC.Object(args[2]).absoluteString().toString();
            this.isTarget = this.url.startsWith('cydia://');
        },
        onLeave(retval) {
            if (this.isTarget) {
                console.log('[canOpenURL] url=' + this.url +
                    ' result=' + retval.toInt32());
            }
        }
    });
}
```

원본 결과와 차단 시점이 연결된 뒤에만 대상 URL의 반환값을 `0`으로 바꿔 영향 범위를 확인한다.

### Native 탐지

Objective-C 후킹 로그 없이 차단되거나 Mach-O에서 `access`, `stat`, `lstat`, `fopen`, `fork`, dyld API가 보이면 Native 검사를 의심한다.

```bash
frida-trace -U -f com.target.app -i 'access'
frida-trace -U -f com.target.app -i 'fork'
frida-trace -U -f com.target.app -i '_dyld_get_image_name'
```

한 번에 함수 하나를 추적하고 생성된 handler에서 경로와 호출자를 좁힌다. `open`, `fopen`, `fork`를 전역 교체하면 정상 기능과 라이브러리 초기화를 깨뜨릴 수 있다. 특히 `open()` 실패는 `-1`과 적절한 `errno`가 필요하므로 반환값만 `0`으로 바꾸는 범용 예시는 사용하지 않는다.

dyld에서 Frida, Substrate, ElleKit 같은 모듈을 찾는 로직은 탈옥 탐지와 계측 탐지가 겹친 영역이다. Frida attach 전에도 차단되는지 비교한 뒤 [Anti-debug 우회](anti-debug-bypass.md)로 분리한다.

### 바이너리 패치

시작 시점이 너무 빠르거나 후킹이 허용되지 않을 때만 제한적으로 검토한다. 복호화된 IPA와 원본을 분리하고 탐지 분기 하나만 변경한다.

```bash
otool -L Payload/Target.app/Target
codesign -d --entitlements - Payload/Target.app/Target
```

패치와 재서명은 provisioning profile, entitlement, keychain access group, App Attest 환경에 영향을 준다. 재서명본 설치·실행 실패를 탈옥 탐지 실패로 해석하지 말고 [앱 위변조](app-tampering.md)에서 별도로 확인한다.

### App Attest·DeviceCheck

두 기능을 탈옥 판정 API로 묶지 않는다.

| 기능 | 실제 역할 | 점검 핵심 |
| :--- | :--- | :--- |
| App Attest | 앱 인스턴스가 정당한 앱인지 서버가 검증할 수 있도록 key, attestation, assertion 제공 | 일회성 challenge, `clientDataHash`, assertion 검증과 민감 요청 결합 |
| DeviceCheck | 앱이 Apple 서버에 단말별 두 개의 bit 상태를 저장·조회 | bit의 업무 의미, token 서버 검증, 실패·초기 상태 처리 |

App Attest는 `isJailbroken` 같은 verdict를 직접 반환하지 않는다. 서버가 발급한 일회성 challenge를 attestation 또는 assertion에 결합하고, 서버가 객체·counter·앱 식별 정보를 검증해야 의미가 있다. DeviceCheck의 두 bit 값도 Apple이 자동으로 설정하는 탈옥 상태가 아니라 서비스가 정의하고 관리하는 상태다.

정적 분석 키워드:

```text
DCAppAttestService
generateKeyWithCompletionHandler:
attestKey:clientDataHash:completionHandler:
generateAssertion:clientDataHash:completionHandler:
DCDevice
generateTokenWithCompletionHandler:
```

승인된 정상 단말과 탈옥 단말에서 같은 민감 기능을 수행하고 다음을 비교한다.

1. 서버 challenge의 일회성과 만료 처리
2. assertion과 실제 API 요청 데이터의 결합
3. assertion 누락·오류 때 서버의 차단 또는 제한 처리
4. 정상 단말과 탈옥 단말의 서버 응답 차이
5. unsupported·네트워크 오류 때 fallback 범위

클라이언트에서 `DCAppAttestService` 호출을 찾은 것만으로 서버 검증을 확정하지 않는다. 화면 분기를 후킹해 열었다고 해서 App Attest assertion 검증이나 서버 정책을 우회한 것도 아니다.

---

## 결과 판정

| 관찰 결과 | 판단 | 다음 확인 |
| :--- | :--- | :--- |
| 탈옥 단말에서도 정상 실행 | 탐지 미적용 가능 | 요구사항과 보호 대상 기능 확인 |
| Shadow 적용 뒤 앱 실행 | 알려진 신호 우회 가능성 | 실제 바뀐 검사와 민감 기능 영향 식별 |
| 앱 전용 boolean 하나로 화면 차단 해제 | 단일 클라이언트 통제 후보 | 서버가 민감 작업도 승인하는지 확인 |
| Native hook 뒤 화면만 열림 | 로컬 분기 우회 | 인증·권한·서버 정책 확인 |
| App Attest 코드 존재 | 서버 검증 후보 | challenge, assertion, 요청 결합 확인 |
| assertion 오류에도 민감 API 승인 | 서버 검증 미적용 후보 | 테스트 조건과 fallback 정책 재확인 |
| Frida 연결 때만 종료 | 계측 탐지 후보 | 탈옥 탐지와 분리 점검 |

다음 조건을 함께 만족할 때 보호 통제 약점을 구체적인 후보로 남긴다.

- 고객사 요구사항이나 위협 모델상 해당 기능에 단말·앱 무결성 통제가 필요하다.
- 최소한의 클라이언트 변경으로 통제가 해제된다.
- 서버가 민감 기능을 그대로 승인하거나 후속 통제가 없다.
- 정상·탈옥 단말과 변경 전·후 결과가 반복 재현된다.

탈옥 탐지 부재, Shadow 적용, Frida 후킹 또는 바이너리 패치 성공만으로 등급을 정하지 않는다. 일반 정보 조회 앱과 금융 거래 앱의 요구 수준은 다르며 실제 영향은 보호 대상 기능과 서버 통제에서 결정한다.

## 증적 항목

- 앱 버전, Bundle ID, IPA·Mach-O SHA-256
- 단말 모델, iOS 버전, jailbreak 종류와 버전
- rootful·rootless 방식과 injection library
- Shadow·Choicy·Frida 등 적용 도구 버전
- 정상 단말과 탈옥 단말의 같은 기능 결과
- 차단 메시지, 발생 시각, crash·system log
- 확인한 클래스·selector·Native 모듈과 원본 반환값
- 적용한 변경 하나와 변경 전·후 결과
- 보호 대상 API의 마스킹된 요청·응답과 서버 처리
- App Attest challenge·assertion 또는 DeviceCheck 사용 흐름

## 트러블슈팅

#### Shadow 적용 후 차단

- 다른 bypass tweak를 모두 끄고 Shadow 하나만 적용한다.
- jailbreak와 injection library가 Shadow의 현재 릴리스와 호환되는지 확인한다.
- rootless 경로와 앱이 실제 조회하는 경로가 맞는지 확인한다.
- 앱 캐시와 서버의 단말 위험 상태가 이전 결과를 유지하는지 확인한다.

#### 앱 시작 직후 종료

- Frida를 연결하지 않은 직접 실행 결과와 비교한다.
- crash report의 exception type, termination reason, faulting module을 확인한다.
- 탈옥 탐지보다 anti-debug, dylib 검사, 서명 검증이 먼저 실행되는지 분리한다.

#### Objective-C 클래스 부재

- 프로세스와 attach 시점이 맞는지 확인한다.
- Swift 전용 구현, stripped symbol, C++·Native RASP 가능성을 확인한다.
- `ObjC.enumerateLoadedClassesSync()` 전체 출력보다 정적 단서와 모듈을 먼저 좁힌다.

#### Native 로그 과다

- `access`, `stat`, `open`을 동시에 추적하지 않는다.
- 한 함수와 한 사용자 행동만 재현한다.
- handler에서 확인한 경로나 호출자만 출력하고 토큰·개인정보는 남기지 않는다.

#### App Attest 오류

- 테스트 빌드의 entitlement와 App Attest environment를 확인한다.
- 단말 지원 여부, 네트워크, 서버 challenge 만료를 확인한다.
- 클라이언트 API 오류와 백엔드 assertion 검증 실패를 구분한다.
- 재서명본에서만 실패하면 원본과 entitlement·Team ID·Bundle ID를 비교한다.

#### 재서명본 실행 실패

- provisioning profile, entitlement, keychain access group을 원본과 비교한다.
- 암호화된 App Store Mach-O를 그대로 패치하지 않았는지 확인한다.
- 설치 성공 뒤 종료된다면 서명·무결성 검사를 [앱 위변조](app-tampering.md)로 분리한다.

## 빠른 명령어 참조

```bash
# 단말·도구 기준 정보
uname -a
ls -ld /var/jb /private/preboot 2>/dev/null
frida --version
frida-ps -Uai

# 정적 단서
strings -a Payload/Target.app/Target | grep -iE 'jail|cydia|sileo|appattest|devicecheck'
otool -L Payload/Target.app/Target
plutil -p Payload/Target.app/Info.plist

# 동적 분석
frida -U -f com.target.app -l observe-jailbreak.js
frida-trace -U -f com.target.app -m '-[JailbreakDetection isJailbroken]'
objection -n com.target.app start
```

## 관련 문서

- [iOS 진단 환경 구성](setup-ios.md): 탈옥 단말, SSH, Frida 환경
- [정적 분석](static-analysis.md): Mach-O, selector, Native 모듈 식별
- [Frida 후킹 실무](frida-scripts.md): 관찰용 후킹과 대상 범위 축소
- [SSL Pinning 우회](ssl-pinning-bypass.md): 네트워크 분석 경로 확보
- [Anti-debug 우회](anti-debug-bypass.md): Frida·디버거·로드 이미지 탐지 분리
- [앱 위변조](app-tampering.md): 재서명과 앱 무결성 검증
- [루팅 탐지 우회](root-detection-bypass.md): Android 대응 영역

## 참고자료

공식·테스트 가이드:

- [OWASP MASTG - Jailbreak Detection](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-RESILIENCE/MASTG-KNOW-0084/)
- [OWASP MASTG - Bypassing Jailbreak Detection](https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0152/)
- [Apple - DeviceCheck](https://developer.apple.com/documentation/devicecheck)
- [Apple - 단말별 상태 조회·수정](https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data)
- [Apple - App Attest 서버 검증](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)
- [Frida 공식 문서](https://frida.re/docs/)

커뮤니티 도구:

- [Shadow](https://github.com/jjolano/shadow)
- [Objection](https://github.com/sensepost/objection)
