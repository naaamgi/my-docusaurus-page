---
sidebar_position: 14
title: Exported 컴포넌트
description: Android Activity, Service, BroadcastReceiver, ContentProvider의 외부 노출과 권한 경계를 정적 분석부터 호출자 앱 재현까지 확인하는 실무 노트
keywords: [Exported Component, Activity, Service, BroadcastReceiver, ContentProvider, Android IPC, drozer, adb, MASVS-PLATFORM, MASTG]
toc_max_heading_level: 3
draft: false
---

> Android의 Activity, Service, BroadcastReceiver, ContentProvider가 다른 앱에 열려 있는지 확인하고, 외부 입력이 민감 기능이나 데이터까지 도달하는지 검증한다. `android:exported="true"` 자체는 진입점 정보이며 취약점 확정 조건이 아니다.

## 사용 시점

- APK의 최종 Manifest에서 외부 호출 가능한 컴포넌트를 정리할 때
- 로그인 전 내부 화면, 백그라운드 작업, custom broadcast, `content://` URI를 발견했을 때
- 자사 앱끼리 공유하는 기능의 permission 보호 수준을 확인할 때
- SDK가 추가한 Activity·Service·Receiver·Provider의 적용 범위를 확인할 때
- `adb` 호출 결과를 일반 서드파티 앱의 공격 조건으로 다시 검증할 때

이 문서는 Android IPC 진입점과 호출자 권한 경계에 집중한다. Custom Scheme·App Links의 URL 파싱과 Intent Redirection은 [Deep Link·Intent](./deeplink-intent.md), 화면 진입 뒤 서버 인증·인가는 [인증 및 세션](./auth-mobile.md)에서 이어서 확인한다.

## 분석 기준

소스 Manifest가 아니라 배포 APK에 포함된 최종 merged Manifest를 기준으로 한다. Library manifest, build flavor, manifest placeholder가 컴포넌트와 permission을 추가하거나 변경할 수 있다.

| 기준 | 확인할 내용 |
| :--- | :--- |
| 앱 | package, 버전, build flavor, APK hash |
| 플랫폼 | Android 버전, API level, `targetSdkVersion` |
| 컴포넌트 | class, `enabled`, `exported`, intent filter, process |
| 권한 | application·component permission, 보호 수준, 선언 주체 |
| 입력 | action, category, data URI, MIME type, extras, Binder method |
| 동작 | 화면 표시, 파일·DB 접근, 네트워크 요청, 상태 변경 |
| 호출자 | adb shell, drozer agent, 별도 서명한 PoC 앱 |
| 상태 | 로그인 계정, 앱 foreground/background, 테스트 레코드 |

Android 12(API 31) 이상을 대상으로 하는 앱은 intent filter가 있는 Activity, Service, Receiver에 `android:exported`를 명시해야 설치할 수 있다. 구버전 target에서는 intent filter와 기본값 때문에 외부 노출 여부가 달라질 수 있다. Provider는 target API 16 이하에서 `exported` 미지정 기본값이 `true`였으므로 컴포넌트 종류와 target SDK를 함께 본다.

`adb shell`은 빠른 진입 테스트에 유용하지만 일반 앱과 UID·보유 권한이 같지 않다. 최종 판정에는 별도 서명한 최소 PoC 앱이나 drozer agent로 동일 결과를 확인한다.

## 진입점 분류

| 유형 | 외부 입력 | 먼저 볼 코드 | 확정에 필요한 결과 |
| :--- | :--- | :--- | :--- |
| Activity·Alias | Intent data·extras | `onCreate`, `onNewIntent` | 권한 없는 호출자의 민감 기능 도달 |
| Started Service | action·extras | `onStartCommand` | 외부 호출로 작업·상태 변경 |
| Bound Service | AIDL·Messenger·Binder | `onBind`, Binder method | 권한 없는 method 호출 |
| Manifest Receiver | broadcast Intent | `onReceive` | 위조 가능한 event의 민감 처리 |
| Dynamic Receiver | runtime filter | `registerReceiver` | 등록 시간 동안 외부 broadcast 수락 |
| ContentProvider | URI·CRUD 인자 | `query`, `openFile`, `call` | 권한 없는 데이터·파일 접근 또는 변경 |

Launcher, 공유 대상, OAuth callback처럼 외부 호출이 기능 요구사항인 컴포넌트도 있다. 노출 필요성, 호출자 제한, 입력 검증, 후속 인증을 함께 보고 판단한다.

## 진단 절차

#### Step 1. 최종 Manifest 목록

Activity뿐 아니라 `activity-alias`, application 기본 permission, Provider의 authority와 read·write permission까지 기록한다. `exported` 미지정은 target SDK와 intent filter를 적용해 해석한다.

#### Step 2. Permission 해석

컴포넌트의 `android:permission` 문자열만 보지 않고 해당 `<permission>` 선언의 `protectionLevel`을 찾는다. `normal`은 설치 시 자동 부여되고 `dangerous`는 서드파티 앱이 요청할 수 있으므로, 자사 앱 전용 경계에는 일반적으로 `signature`가 적합하다.

#### Step 3. 입력 소비 지점

jadx에서 컴포넌트 class를 열고 실제로 읽는 action, URI, extra key, Binder method를 정리한다. 입력 누락, 타입 차이, 허용 목록, 호출자 UID 검사, 로그인 상태 검증을 함께 본다.

#### Step 4. 저위험 호출

조회·미리보기·상태 확인처럼 되돌릴 필요가 없는 입력부터 사용한다. 결제, 삭제, 대량 동기화, 메시지 전송 같은 동작은 기본 예시로 호출하지 않는다.

#### Step 5. 일반 앱 경계

adb에서 성공한 호출을 별도 서명한 PoC 앱에서 반복한다. `SecurityException`, permission 거부, package visibility 차이, background 실행 제한을 기록한다.

#### Step 6. 제한된 영향

테스트 계정·fixture 한 건으로 데이터 읽기, 서버 요청, 로컬 상태 변경 여부를 확인한다. 화면이 열렸다는 사실과 인증·인가 우회를 구분한다.

상황별 첫 확인은 다음과 같다.

| 현재 단서 | 첫 확인 | 다음 행동 |
| :--- | :--- | :--- |
| 내부 Activity가 exported | 로그인 전 직접 실행 | 화면 뒤 API·기능 권한 확인 |
| action을 처리하는 Service | benign action 호출 | `onStartCommand`·`onBind` 분기 확인 |
| custom action Receiver | 명시적 broadcast | sender permission과 입력 검증 확인 |
| `registerReceiver` 발견 | exported flag와 등록 시점 | 해당 화면에서 외부 broadcast 재현 |
| Provider authority 발견 | 알려진 테스트 URI 조회 | read·write permission과 URI matcher 확인 |
| signature permission 발견 | 선언 주체와 서명 범위 | 별도 서명 PoC 앱에서 거부 확인 |

## 실습 노트

### Manifest·Runtime 목록

정적 분석으로 전체 후보를 만들고 설치 단말의 package manager 상태로 교차 확인한다.

#### 배포 APK 확인

```bash
apkanalyzer manifest print app-release.apk
aapt2 dump xmltree app-release.apk --file AndroidManifest.xml
```

디코딩한 XML에서는 컴포넌트, permission, provider authority를 함께 검색한다.

```bash
rg -n '<application|<permission|<activity|<activity-alias|<service|<receiver|<provider|android:exported|android:permission|android:authorities' decoded/AndroidManifest.xml
```

`aapt2` 원시 출력의 boolean `true`는 `0xffffffff`로 보일 수 있다. 사람이 읽을 때는 `apkanalyzer`나 apktool로 디코딩한 XML이 편하다.

#### 설치 상태 확인

```bash
adb shell dumpsys package com.example.target
```

Resolver table은 intent filter와 resolve 결과를 보는 자료다. Manifest에 선언된 모든 class와 민감 동작을 자동으로 판정해 주지는 않는다.

drozer를 사용할 수 있다면 공격 표면을 빠르게 비교한다.

```text
dz> run app.package.attacksurface com.example.target
dz> run app.activity.info -a com.example.target
dz> run app.service.info -a com.example.target
dz> run app.broadcast.info -a com.example.target
dz> run app.provider.info -a com.example.target
```

drozer 결과도 permission의 실제 보호 수준과 코드 동작을 별도로 확인한다.

### Permission 경계

컴포넌트 permission은 `<application>`의 기본값을 상속하거나 component에서 별도로 지정할 수 있다. Provider는 `permission`, `readPermission`, `writePermission`, `path-permission`이 서로 다른 범위를 보호할 수 있다.

#### Manifest 예시

```xml
<permission
    android:name="com.example.target.permission.INTERNAL_IPC"
    android:protectionLevel="signature" />

<service
    android:name=".PartnerSyncService"
    android:exported="true"
    android:permission="com.example.target.permission.INTERNAL_IPC" />
```

이 구성은 동일 서명 앱 간 연동 의도에 맞는 예시다. 실제로는 permission 이름 오타, 다른 패키지의 선점, build variant별 선언 차이도 확인한다.

#### 코드 검사 후보

```bash
rg -n 'enforceCallingPermission|checkCallingPermission|checkCallingOrSelfPermission|Binder.getCallingUid|getPackagesForUid|checkSignatures' jadx-output/sources
```

호출자가 전달한 package name 문자열만 신뢰하지 않는다. UID와 서명 검증이 실제 허용 대상에 맞는지, Binder identity를 지우는 `clearCallingIdentity()` 전후에 검사가 배치됐는지 확인한다.

### Activity·Alias

Launcher Activity나 공개 share target은 정상적으로 exported일 수 있다. 내부 설정, 관리자, 결제 결과, 디버그 화면처럼 외부 공개가 필요 없는 Activity를 우선한다.

#### 최소 호출

```bash
adb shell am start -W -n com.example.target/.InternalActivity
adb shell am start -W -n com.example.target/.PreviewActivity --es mode preview --ez readonly true
```

`-W` 결과의 `Status`, `Activity`, `TotalTime`과 앱 화면·logcat을 함께 본다. extra 이름과 타입은 jadx에서 확인한 뒤 테스트 값만 넣는다.

#### 결과 해석

| 결과 | 해석 |
| :--- | :--- |
| `Permission Denial`·`SecurityException` | 플랫폼 permission으로 차단된 상태 |
| Activity 미존재·resolve 실패 | class 이름, alias, package, 설치 버전 재확인 |
| 화면만 표시되고 로그인 이동 | 외부 진입은 되지만 인증 우회는 미확정 |
| 화면 표시 후 API 401·403 | 서버 권한 경계가 동작하며 영향 제한 |
| 테스트 계정의 민감 조회·동작 성공 | 외부 진입과 후속 권한 검증 결함 연결 |
| 즉시 crash | 입력 누락 가능성; 일반 앱 재현과 사용자 영향 확인 |

`activity-alias`는 target Activity와 별도로 `exported`, permission, intent filter를 가질 수 있다. alias가 열려 있으면 target의 설정만 보고 제외하지 않는다.

### Service·Binder

Started Service와 Bound Service는 진입 방식이 다르다. `adb shell am startservice`는 `onStartCommand` 경로를 확인하지만 AIDL·Messenger·custom Binder method까지 호출하지 못한다.

#### Started Service

상태 조회나 dry-run처럼 코드에 존재하는 비파괴 action을 사용한다.

```bash
adb shell am startservice -n com.example.target/.SyncService --es action status --ez dry_run true
```

Android의 background 실행 제한 때문에 exported여도 shell에서 시작이 거부될 수 있다. 이때 `start-foreground-service`로 무조건 우회하지 말고 앱이 의도한 호출 방식과 foreground 조건을 확인한다.

#### Bound Service

다음 항목을 정적 분석한다.

- `onBind()`가 반환하는 Binder·Messenger·AIDL interface
- method별 permission·UID·signature 검사
- caller가 지정하는 파일 경로, 계정 ID, URL, callback
- `clearCallingIdentity()` 전에 수행되는 접근 통제
- 반환되는 object·Parcel의 민감 데이터

구조화된 Binder message는 drozer module이나 최소 PoC 앱으로 한 method씩 호출한다. 동기화·삭제처럼 상태를 바꾸는 method 대신 version·status·test fixture 조회부터 시작한다.

### Manifest Receiver

Manifest Receiver는 앱이 실행 중이 아니어도 호출될 수 있다. custom action, component permission, `onReceive()`의 후속 작업을 연결한다.

#### 명시적 Broadcast

```bash
adb shell am broadcast -n com.example.target/.EventReceiver -a com.example.target.ACTION_TEST --es event preview --ez verified false
```

출력의 `result=0`은 broadcast가 민감 동작을 수행했다는 뜻이 아니다. 앱 로그, 네트워크 요청, 테스트 상태를 함께 확인한다.

시스템이 보호하는 broadcast와 앱의 custom action을 구분한다. 시스템 action을 문자열만 같게 만들어 보낸 결과로 취약점을 단정하지 않는다.

#### Receiver 입력

- action allowlist와 unexpected action 처리
- extras null·type·range 검증
- sender permission과 protection level
- 서버 재검증이 필요한 event 처리
- `goAsync()` 이후 실행되는 network·database 작업

외부 broadcast 한 번으로 결제·권한 같은 상태를 바꾸는 예시를 기본 재현으로 사용하지 않는다. 코드 흐름을 확인한 뒤 테스트 전용 event나 되돌릴 수 있는 상태로 제한한다.

### Dynamic Receiver

동적 Receiver는 Manifest에 나타나지 않으며 특정 화면·Service가 살아 있는 동안만 등록될 수 있다.

#### 등록 코드 검색

```bash
rg -n 'registerReceiver\(|RECEIVER_EXPORTED|RECEIVER_NOT_EXPORTED|sendBroadcast\(' jadx-output/sources
```

Android 13(API 33) 계열에서는 등록 overload와 `RECEIVER_EXPORTED`·`RECEIVER_NOT_EXPORTED` flag를 확인한다. AndroidX `ContextCompat.registerReceiver`도 포함한다.

#### 재현 순서

1. Receiver가 등록되는 화면이나 기능에 진입한다.
2. 앱 로그나 hook으로 등록 action을 확인한다.
3. 명시적·암시적 broadcast 중 코드가 기대하는 형태를 보낸다.
4. 화면을 닫은 뒤 같은 호출이 더는 처리되지 않는지 비교한다.
5. 외부 수신이 불필요하면 `RECEIVER_NOT_EXPORTED` 적용 여부를 확인한다.

고권한 시스템 앱이 보내는 일부 broadcast를 받아야 하는 Receiver는 exported가 필요할 수 있다. 내부 custom broadcast와 한 Receiver에 섞지 않았는지 본다.

### ContentProvider

Provider는 `exported`뿐 아니라 authority, URI path, read·write permission, 임시 URI grant를 함께 분석한다.

#### URI 목록

```bash
rg -n 'content://|UriMatcher|addURI\(|query\(|insert\(|update\(|delete\(|openFile\(|openAssetFile\(|call\(' jadx-output/sources
```

drozer는 정적 분석에서 놓친 URI 후보를 찾는 보조 도구로 사용한다.

```text
dz> run app.provider.finduri com.example.target
```

#### 제한된 조회

알고 있는 테스트 계정이나 fixture URI에 필요한 column만 요청한다.

```bash
adb shell content query --uri content://com.example.target.profile/profiles/test-account --projection _id:display_name
adb shell content read --uri content://com.example.target.files/public/test-fixture.txt
```

목록 전체, 다른 사용자 레코드, 내부 DB schema를 기본 조회 대상으로 사용하지 않는다. `insert`, `update`, `delete`, `call`은 method 의미와 rollback 방법을 확인한 뒤 별도 승인된 테스트 데이터에만 사용한다.

#### 코드 확인

- `UriMatcher`의 path별 접근 범위
- `query()`의 projection allowlist와 parameterized selection
- `openFile()`의 canonical path·허용 root 검증
- `call()`의 method allowlist와 caller permission
- read·write permission의 분리와 path permission 우선순위
- cursor·file에 포함되는 field의 민감도

SQL Injection이나 Path Traversal은 광범위한 dump보다 fixture 한 건의 범위 이탈로 확인한다. 저장 데이터의 민감도는 [Android 데이터 저장](./data-storage-android.md)과 연결한다.

### URI Grant

`android:grantUriPermissions="true"`는 Provider를 전체 공개하는 설정이 아니다. `exported="false"`인 FileProvider도 특정 앱에 특정 URI를 임시 공유하기 위해 사용할 수 있다.

#### 확인 항목

| 항목 | 안전한 방향 |
| :--- | :--- |
| Provider 노출 | 일반적으로 `exported="false"` |
| 공유 범위 | 필요한 path와 파일 한 건 |
| 권한 종류 | 읽기 우선, 쓰기는 실제 필요 시만 |
| 수신자 | 명시적 package·component 또는 사용자가 선택한 대상 |
| 수명 | task·activity 종료 또는 명시적 revoke까지 |
| URI 구성 | `content://` 사용, 실제 filesystem path 비노출 |

Intent의 `FLAG_GRANT_READ_URI_PERMISSION`, `FLAG_GRANT_WRITE_URI_PERMISSION`, `ClipData`, `revokeUriPermission()` 호출을 따라간다. 디렉터리 전체나 민감 root가 grant 가능한지, 다른 Intent로 URI가 재전달되는지 확인한다.

### 호출자 PoC

adb 결과가 모호하거나 signature·UID 경계를 확인해야 할 때 별도 package와 서명 키를 사용하는 최소 앱으로 재현한다. 대상 앱의 permission을 요청하지 않은 상태를 기준선으로 남긴다.

#### Kotlin 예시

```kotlin
val target = Intent().apply {
    setClassName(
        "com.example.target",
        "com.example.target.InternalActivity"
    )
    putExtra("mode", "preview")
    putExtra("readonly", true)
}

runCatching { startActivity(target) }
    .onFailure { Log.e("IPC-POC", "activity blocked", it) }
```

Provider는 알려진 fixture URI와 최소 projection으로 확인한다.

```kotlin
val uri = Uri.parse(
    "content://com.example.target.profile/profiles/test-account"
)

runCatching {
    contentResolver.query(
        uri,
        arrayOf("_id", "display_name"),
        null,
        null,
        null
    )?.use { cursor ->
        Log.i("IPC-POC", "rows=${cursor.count}")
    }
}.onFailure { Log.e("IPC-POC", "provider blocked", it) }
```

값 자체보다 호출 성공 여부와 행 개수만 먼저 기록한다. PoC 앱에서 거부되고 adb에서만 성공한다면 shell 특권에 의한 결과인지 확인하고 보류한다.

## 결과 판정

Exported 상태, 접근 통제, 민감 동작을 연결해 판정한다.

| 확인 결과 | 판정 방향 |
| :--- | :--- |
| 내부 컴포넌트가 `exported=true` | 외부 진입 후보이며 단독 취약점 아님 |
| Launcher·share·callback 진입점 | 기능 요구사항과 입력·권한 검증 확인 |
| 별도 서명 앱에서 민감 Activity 기능 사용 | 외부 진입을 통한 권한 우회 확정 |
| Activity 화면만 표시·API 401/403 | 화면 노출 영향만 분리, 인증 우회 미확정 |
| 외부 Service·Receiver 호출로 민감 작업 수행 | 권한 없는 IPC 기능 노출 확정 |
| Provider에서 민감 fixture 읽기 | 권한 없는 데이터 접근 확정 |
| Provider의 테스트 레코드 변경 | 쓰기 권한 경계 결함 확정 |
| `signature` permission으로 PoC 앱 거부 | 의도한 same-signer 경계가 동작 |
| `normal` permission만 요구 | 일반 앱이 획득 가능하므로 민감 기능 보호에 불충분 |
| `grantUriPermissions=true`만 발견 | 정상 기능일 수 있으며 실제 URI 범위 확인 |
| adb에서만 성공 | 일반 앱 재현 전까지 보류 |
| malformed input으로 한 번 crash | 일반 앱 반복 재현과 사용자 영향 확인 후 제한적으로 판단 |

영향은 다음 조건에서 올라간다.

- 로그인·역할 검증 없이 서버 요청이나 민감 기능까지 도달
- 대상 계정·파일·URL을 외부 입력으로 선택 가능
- 대상 앱이 보유한 permission을 대리 사용
- token, 개인정보, 내부 파일을 외부 호출자에게 반환
- 사용자 동작 없이 백그라운드에서 재현 가능

대량 호출이나 반복 crash로 가용성 영향을 키우지 않는다. 한 번의 안전한 재현과 코드 경로로 충분한지 우선 판단한다.

## 증적 항목

- APK hash, package, 버전, build flavor, target SDK
- Android 버전과 단말·에뮬레이터 상태
- merged Manifest의 component·alias·permission 선언
- permission 선언 주체와 `protectionLevel`
- component의 action, authority, path, 입력 key·type
- jadx class와 실제 입력 소비 method
- adb·drozer·PoC 앱 중 사용한 호출자와 package·서명 상태
- 호출 전후 로그인·테스트 데이터 상태
- `SecurityException`, ActivityManager, 앱 로그
- 마스킹한 응답, 행 개수, network request ID
- 앱·Library·SDK 중 컴포넌트 추가 주체
- 확정·후보·보류와 영향 상승 조건

## 트러블슈팅

#### adb `Permission Denial`

- component와 application permission을 모두 확인한다.
- permission의 선언 package와 protection level을 찾는다.
- shell만 거부되는 경우 PoC 앱에 필요한 정상 permission을 부여한 조건과 비교한다.

#### Activity resolve 실패

- fully qualified class와 `activity-alias` 이름을 확인한다.
- split APK·dynamic feature 설치 상태를 확인한다.
- `enabled=false`, component enable setting, user profile 차이를 확인한다.

#### Service 시작 제한

- Started Service와 Bound Service를 구분한다.
- background 실행 제한과 foreground 요구사항을 확인한다.
- 단순히 `start-foreground-service`로 바꾸기 전에 앱의 정상 호출 흐름을 재현한다.

#### Receiver 무반응

- dynamic Receiver가 실제로 등록된 시점인지 확인한다.
- action, category, package, component, required permission을 맞춘다.
- ordered broadcast의 result code만으로 내부 처리 여부를 단정하지 않는다.

#### Provider URI 오류

- Manifest authority와 `UriMatcher.addURI()` path를 맞춘다.
- user profile, direct boot, 앱 초기화 여부를 확인한다.
- `Unknown URI`와 permission 거부를 구분한다.

#### drozer 연결 실패

- agent 실행, port forwarding, Python·drozer 버전을 확인한다.
- 도구 설치에 시간을 쓰기보다 Manifest, adb, 최소 PoC 앱으로 같은 항목을 진행한다.

#### adb·PoC 결과 차이

- shell UID의 권한과 PoC package의 requested permission을 비교한다.
- signature permission, package visibility, user profile을 확인한다.
- 실제 공격 조건과 가까운 별도 서명 앱 결과를 우선한다.

## 빠른 명령어 참조

본문 명령을 반복하지 않고 환경 식별과 로그 수집에 필요한 명령만 모았다.

| 목적 | 명령 | 확인할 항목 |
| :--- | :--- | :--- |
| APK 경로 | `adb shell pm path com.example.target` | base·split APK 위치 |
| target SDK | `apkanalyzer manifest target-sdk app-release.apk` | 기본 exported 규칙 해석 |
| 설치 permission | `adb shell dumpsys package com.example.target` | requested·granted permission |
| 앱 초기화 | `adb shell am force-stop com.example.target` | 재호출 전 lifecycle 기준선 |
| Activity 로그 | `adb logcat -s ActivityTaskManager ActivityManager` | resolve·permission·start 결과 |
| 앱 프로세스 | `adb shell pidof com.example.target` | 호출 전후 process 기동 여부 |
| Windows APK hash | `Get-FileHash .\app-release.apk -Algorithm SHA256` | 분석 대상 고정 |

## 관련 문서

- [정적 분석](./static-analysis.md)
- [Android 분석 환경](./setup-android.md)
- [Deep Link·Intent](./deeplink-intent.md)
- [인증 및 세션](./auth-mobile.md)
- [Android 데이터 저장](./data-storage-android.md)
- [WebView 보안](./webview-issues.md)

## 참고자료

#### 공식 문서

- [Android Developers - `android:exported`](https://developer.android.com/privacy-and-security/risks/android-exported)
- [Android Developers - Permission-based Access Control to Exported Components](https://developer.android.com/privacy-and-security/risks/access-control-to-exported-components)
- [Android Developers - Intents and Intent Filters](https://developer.android.com/guide/components/intents-filters)
- [Android Developers - Broadcasts Overview](https://developer.android.com/develop/background-work/background-tasks/broadcasts)
- [Android Developers - Provider Manifest Element](https://developer.android.com/guide/topics/manifest/provider-element)
- [Android Developers - Custom Permissions](https://developer.android.com/privacy-and-security/risks/custom-permissions)

#### 점검 가이드

- [OWASP MASTG - Restrict Access to Android App Components](https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0052/)
- [OWASP MASTG - Exported Activities](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0364/)
- [OWASP MASTG - Exported Services](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0365/)
- [OWASP MASTG - Exported Broadcast Receivers](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0366/)
- [OWASP MASTG - Unauthorized ContentProvider Access](https://mas.owasp.org/MASTG/tests/android/MASVS-PLATFORM/MASTG-TEST-0356/)
- [OWASP MASTG - Restrict Exported Content Providers](https://mas.owasp.org/MASTG/best-practices/MASTG-BEST-0049/)

#### 관련 도구

- [OWASP MASTG - drozer](https://mas.owasp.org/MASTG/tools/android/MASTG-TOOL-0015/)
- [WithSecureLabs - drozer](https://github.com/WithSecureLabs/drozer)
