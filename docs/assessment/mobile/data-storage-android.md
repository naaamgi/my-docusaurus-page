---
sidebar_position: 11
title: Android 데이터 저장
description: Android 앱의 저장 위치를 사용자 동작과 연결하고 Preferences, SQLite, 파일, Keystore, 외부 저장소, 백업과 부수 노출을 검증하는 실무 흐름
keywords: [Android Data Storage, SharedPreferences, DataStore, SQLite, Room, SQLCipher, Android Keystore, Scoped Storage, Auto Backup, Clipboard, Logcat, MASVS-STORAGE]
toc_max_heading_level: 3
draft: false
---

> 앱 화면에서 입력하거나 서버에서 받은 값이 단말의 어디에, 얼마나 오래, 어떤 보호 상태로 남는지 확인한다. 핵심은 평문 문자열 검색이 아니라 **사용자 동작과 저장 변화를 연결하고 실제 접근 경로와 재사용 가능성을 확인하는 것**이다.

## 사용 시점

- 로그인·자동 로그인 후 access token과 refresh token의 저장 위치를 찾을 때
- 개인정보, 신분증, 거래 내역, 메시지 또는 첨부파일이 단말에 남는지 확인할 때
- 앱이 `SharedPreferences`, DataStore, Room, SQLite 또는 자체 파일 저장소를 사용할 때
- 자체 암호화가 Android Keystore와 올바르게 연결되는지 확인할 때
- 로그아웃·계정 전환·앱 삭제 전후에 민감 데이터가 정리되는지 확인할 때
- 외부 저장소, Auto Backup, 클립보드 또는 logcat을 통한 부수 노출을 점검할 때

루팅 단말에서 파일이 보인다는 사실만으로 취약점을 확정하지 않는다. 앱 sandbox, 단말 잠금 상태, backup 규칙, 공격자에게 필요한 권한과 데이터의 실제 재사용 가능성을 함께 본다.

## 분석 기준

같은 앱도 Android version, `targetSdk`, 배포 build와 단말 상태에 따라 저장소 접근 조건이 달라진다. 다음 정보를 먼저 기록한다.

```bash
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.crypto.type
adb shell "dumpsys package com.target.app | grep -E 'versionName|versionCode|targetSdk|debuggable'"
```

| 기준 | 확인 내용 | 판단 영향 |
| :--- | :--- | :--- |
| build | 운영·개발 build, `debuggable` | `run-as`, 로그와 백업 결과 차이 |
| 단말 | 실기기·emulator, root, 화면 잠금 | 컨테이너 접근과 Keystore 조건 |
| 사용자 상태 | 신규 설치, 로그인, 로그아웃, 계정 전환 | 잔존 데이터와 사용자 간 분리 |
| 데이터 | 비밀번호, token, 개인정보, 캐시, 단순 설정 | 필요한 보호 수준 |
| 위협 모델 | 다른 일반 앱, 물리 접근, root·malware, cloud backup | 취약 후보의 성립 조건 |
| 서버 | token 만료·폐기, 단말 바인딩, 재인증 | 추출 데이터의 실제 영향 |

테스트 계정과 허가된 데이터만 사용한다. 원본 단말을 초기화하거나 앱 데이터를 삭제하기 전에 복구 가능 여부를 확인한다.

## 저장 위치

| 위치 | 대표 경로·API | 먼저 볼 항목 |
| :--- | :--- | :--- |
| credential-protected 내부 저장소 | `/data/user/0/<pkg>/` | unlock 이후 사용하는 기본 앱 데이터 |
| device-protected 저장소 | `/data/user_de/0/<pkg>/` | Direct Boot 전에 필요한 최소 데이터 |
| Preferences·DataStore | `shared_prefs/*.xml`, `files/datastore/*` | token, 사용자 식별자, 기능 상태 |
| SQLite·Room | `databases/*`, WAL·SHM | 메시지, 거래, 캐시와 삭제 레코드 |
| 내부 파일·cache | `files/`, `cache/`, `no_backup/` | JSON, 이미지, 임시 응답, 자체 로그 |
| 앱 전용 외부 저장소 | `/sdcard/Android/data/<pkg>/` | Android version별 타 앱 접근 차이 |
| 공유 저장소 | `Download`, `Pictures`, `MediaStore`, SAF | 사용자·다른 앱에 공개되는 파일 |
| Android Keystore | `AndroidKeyStore` provider | key 비추출성, 용도·인증 조건 |
| Auto Backup·D2D | manifest와 backup XML | cloud·단말 이전 포함·제외 규칙 |
| 부수 채널 | clipboard, logcat, keyboard cache | 앱 컨테이너 밖으로 나간 민감 데이터 |

`/data/data/<pkg>`는 보통 `/data/user/0/<pkg>`를 가리키는 호환 경로다. WebView cookie와 LocalStorage는 [WebView 보안](webview-issues.md), 암호 알고리즘 자체는 [암호화·키 관리](crypto-keys.md)에서 이어서 본다.

## 진단 절차

#### Step 1. 앱·단말 기준선

앱 version, Android API, `targetSdk`, 단말 잠금과 root 상태를 기록한다. 신규 설치 상태에서 시작하되 앱 삭제가 기존 테스트 데이터를 지울 수 있음을 먼저 확인한다.

#### Step 2. 컨테이너 접근

개발·테스트 build가 `debuggable`이면 `run-as`를 우선한다.

```bash
adb shell
run-as com.target.app
pwd
find . -type f
```

`run-as: package not debuggable`이면 정상 운영 build에서 예상되는 결과다. 허가된 root 단말에서는 다음과 같이 별도 shell에서 접근한다.

```bash
adb shell
su
cd /data/user/0/com.target.app
find . -type f
```

접근 실패를 저장 취약점 부재로 판단하지 않는다. [Android 환경 구축](setup-android.md)의 테스트 build, rooted emulator·단말 또는 고객사 제공 추출본으로 전환한다.

#### Step 3. 정적 저장 API

APK에서 저장 API와 backup 설정을 먼저 좁힌다.

```bash
apkanalyzer manifest print target.apk > evidence/AndroidManifest.xml
rg -n 'SharedPreferences|DataStore|RoomDatabase|SQLiteDatabase|SQLCipher|getFilesDir|getCacheDir|getExternalFilesDir|MediaStore|AndroidKeyStore|createDeviceProtectedStorageContext' work
rg -n 'allowBackup|fullBackupContent|dataExtractionRules|requestLegacyExternalStorage|MANAGE_EXTERNAL_STORAGE' evidence/AndroidManifest.xml work
```

API 이름만으로 보호 여부를 결정하지 않는다. 실제 file name, key name, table과 호출 기능을 연결하는 단서로 사용한다.

#### Step 4. 사용자 동작·파일 변화

한 번에 한 동작만 수행하고 파일 목록과 수정 시각을 전후 비교한다.

```text
신규 설치 → 기준선 A
로그인 → 기준선 B
개인정보 조회·다운로드 → 기준선 C
로그아웃 → 기준선 D
계정 전환 → 기준선 E
```

```powershell
adb exec-out run-as com.target.app ls -lR . > evidence\before-login.txt
# 앱에서 로그인 수행
adb exec-out run-as com.target.app ls -lR . > evidence\after-login.txt
Compare-Object (Get-Content evidence\before-login.txt) (Get-Content evidence\after-login.txt)
```

Linux·macOS에서는 같은 두 파일을 `diff`로 비교한다.

```bash
diff -u evidence/before-login.txt evidence/after-login.txt
```

파일 목록이 같아도 기존 XML·DB 내용이나 크기가 바뀔 수 있다. 변경 후보는 수정 시각, hash, WAL과 앱 로그를 함께 비교한다.

#### Step 5. 선택 파일 분석

컨테이너 전체를 보고서나 채팅에 복사하지 않는다. 먼저 파일명만 검색하고, 필요한 파일과 테스트 계정 레코드만 확인한다.

```bash
rg -l -i 'access[_-]?token|refresh[_-]?token|password|passwd|authorization|card|account|resident|ssn' evidence/container
file evidence/container/databases/*
```

binary 추출은 source와 host의 SHA-256이 같은지 확인한다. Windows에서 redirection으로 DB가 변형되면 Android Studio Device Explorer 또는 검증된 binary-safe 방법을 사용한다.

#### Step 6. 종료·복원 동작

로그아웃 후 token·개인정보가 삭제되거나 무효화되는지 확인한다. 다음 로그인, 계정 전환, backup 복원 후에도 이전 사용자 데이터가 다시 나타나는지 비교한다.

#### Step 7. 실제 영향

추출 값은 마스킹한 상태로 종류·길이·만료 시각을 기록한다. 승인된 테스트 계정에서만 token 만료, 서버 폐기, 단말 바인딩과 재인증 여부를 확인한다. 원문 token이나 개인정보 전체는 증적에 남기지 않는다.

## 실습 노트

### 1. 컨테이너 변화

**이럴 때 사용:** 로그인이나 문서 열람 뒤 무엇이 저장됐는지 모를 때 가장 먼저 사용한다.

`run-as` shell 안에서 현재 구조를 확인한다.

```bash
pwd
find shared_prefs databases files cache no_backup -type f 2>/dev/null
du -a shared_prefs databases files cache no_backup 2>/dev/null
```

| 관찰 | 먼저 볼 위치 | 다음 행동 |
| :--- | :--- | :--- |
| 로그인 직후 작은 XML 변경 | `shared_prefs` | key 이름과 값 종류 확인 |
| DB와 `-wal` 동시 증가 | `databases` | WAL 포함 복사 후 schema 확인 |
| 문서 열람 후 cache 증가 | `cache`, `files` | 로그아웃·만료 후 잔존 확인 |
| 재부팅 전에도 데이터 사용 | `/data/user_de/0` 후보 | Direct Boot 필요성과 민감도 확인 |
| 다운로드 후 `/sdcard` 생성 | 외부·공유 저장소 | 타 앱·사용자 접근 조건 확인 |

수정 시각만으로 기능을 확정하지 않는다. 같은 동작을 두 번 반복해 재현성을 확인한다.

### 2. Preferences·DataStore

`SharedPreferences` XML은 작은 설정과 문자열을, Preferences DataStore는 보통 `files/datastore/*.preferences_pb`를 사용한다. 둘 다 저장 API 자체가 민감 값을 자동 암호화하는 것은 아니다.

```bash
find shared_prefs files/datastore -type f 2>/dev/null
grep -o 'name="[^"]*"' shared_prefs/session.xml
```

다음 순서로 읽는다.

1. key 이름으로 기능을 추정한다.
2. 값이 token·비밀번호인지 단순 UI 설정인지 구분한다.
3. 로그아웃·만료 후 값이 삭제 또는 갱신되는지 확인한다.
4. backup 대상인지 확인한다.
5. server에서 재사용 가능한 값인지 제한적으로 검증한다.

`EncryptedSharedPreferences`가 보이면 암호문 여부, Android Keystore master key와 backup 제외 규칙을 확인한다. 이 API는 `security-crypto` 1.1.0에서 deprecated됐지만, deprecated 자체를 취약점으로 판단하지 않는다. 기존 구현의 migration·restore 실패 가능성과 실제 key 관리가 확인 대상이다.

```bash
rg -n 'EncryptedSharedPreferences|MasterKey|security-crypto|preferencesDataStore|DataStoreFactory' work
rg -n 'sharedpref|exclude|include' work/res/xml
```

### 3. SQLite·Room·SQLCipher

DB를 열기 전에 원본, `-wal`, `-shm`을 같은 시점에 확보한다. WAL에 최근 레코드나 삭제 전 값이 남을 수 있다.

```bash
file evidence/main.db
xxd -l 32 evidence/main.db
sqlite3 evidence/main.db ".tables"
sqlite3 evidence/main.db "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index');"
sqlite3 evidence/main.db "PRAGMA table_info(users);"
```

처음부터 `SELECT *`로 전체 테이블을 출력하지 않는다. column 이름과 row 수를 본 뒤 테스트 계정 한 건의 값 존재 여부·길이만 확인한다.

```bash
sqlite3 evidence/main.db "SELECT count(*) FROM users;"
sqlite3 evidence/main.db "SELECT id, length(access_token), expires_at FROM users WHERE id='<TEST_ID>' LIMIT 1;"
```

`SQLite format 3` header가 없으면 SQLCipher 후보이지만 암호화를 확정하지는 않는다. 압축, custom format 또는 손상 파일도 같은 모습일 수 있다. library와 open path를 정적으로 확인한다.

```bash
rg -n 'net\.sqlcipher|SupportFactory|SQLiteDatabase|Room\.databaseBuilder|openOrCreateDatabase' work
```

SQLCipher password가 앱 실행 중 메모리에 전달되는 것 자체는 정상 동작일 수 있다. 고정 문자열·resource·일반 파일에서 얻는지, 사용자 secret이나 Android Keystore key로 보호되는지, backup 복원 뒤 어떤 동작을 하는지가 판단 기준이다.

### 4. 내부 파일·cache

`files`는 지속 데이터, `cache`는 재생성 가능한 임시 데이터, `no_backup`은 Auto Backup 제외 데이터에 사용된다. 폴더 이름만 믿지 말고 실제 lifecycle을 확인한다.

```bash
find files cache no_backup -type f -exec ls -l {} \; 2>/dev/null
file files/* cache/* no_backup/* 2>/dev/null
```

| 파일 후보 | 확인할 값 | 정리 시점 |
| :--- | :--- | :--- |
| 인증 상태 JSON | refresh token, 사용자 ID | 로그아웃·계정 전환 |
| API response cache | 개인정보, 계좌·거래 내용 | cache 만료·로그아웃 |
| 이미지·PDF | 신분증, 명세서, 영수증 | 화면 종료·다운로드 삭제 |
| crash·debug log | header, request body, 오류 객체 | production build에서 미생성 |
| 임시 복호화 파일 | 원문 문서·attachment | 사용 직후 삭제 |

내부 저장소는 일반 앱에서 격리된다. 따라서 평문 발견만으로 끝내지 않고 `debuggable`, exported component, backup, root·malware 위협 모델과 server 재사용 가능성을 연결한다.

### 5. 외부·공유 저장소

앱 전용 외부 저장소와 사용자 공유 저장소를 구분한다.

```bash
adb shell ls -la /sdcard/Android/data/com.target.app/files
adb shell ls -la /sdcard/Download
adb shell ls -la /sdcard/Pictures
```

Android 11 이상에서는 다른 앱이 타 앱의 `/sdcard/Android/data/<pkg>`에 접근하지 못한다. 반면 `Download`, `Pictures`, `MediaStore` 또는 Storage Access Framework로 공개한 파일은 사용자 선택과 platform 권한에 따라 다른 앱이 읽을 수 있다. Android 10 이하 target의 legacy 동작은 별도로 재현한다.

```bash
rg -n 'requestLegacyExternalStorage|MANAGE_EXTERNAL_STORAGE|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_|MediaStore|ACTION_CREATE_DOCUMENT|getExternalFilesDir' evidence/AndroidManifest.xml work
```

**결과에서 볼 항목:** 실제 Android API·`targetSdk`, 저장 위치, 다른 일반 앱에서의 접근 가능성, 파일 잔존 기간과 변조 파일을 앱이 신뢰하는지를 함께 기록한다. `requestLegacyExternalStorage`는 Android 11을 target하는 앱에서 무시되므로 flag 하나만으로 판정하지 않는다.

### 6. Keystore·암호화

Android Keystore는 key material을 non-exportable 상태로 사용할 수 있게 한다. 그러나 Keystore 호출이 보인다는 사실만으로 저장 데이터 전체가 보호되는 것은 아니다.

```bash
rg -n 'AndroidKeyStore|KeyGenParameterSpec|KeyProtection|setUserAuthenticationRequired|setUserAuthenticationParameters|setUnlockedDeviceRequired|setIsStrongBoxBacked|getSecurityLevel|isInsideSecurityHardware' work
rg -n 'Cipher\.getInstance|SecretKeySpec|IvParameterSpec|GCMParameterSpec|PBKDF2|HKDF' work
```

| 확인 항목 | 질문 |
| :--- | :--- |
| key 출처 | Android Keystore 생성, 서버 전달, password 파생, hard-coded 중 무엇인가 |
| 보호 대상 | 어느 preference·column·file을 암복호화하는가 |
| 용도 제한 | encrypt·decrypt·sign 중 필요한 purpose만 허용하는가 |
| 사용자 인증 | 거래·서명처럼 사용자 presence가 필요한 key인가 |
| 잠금 상태 | Direct Boot 또는 background 처리가 정말 필요한가 |
| hardware | TEE·StrongBox가 요구사항인가, fallback은 무엇인가 |
| lifecycle | 로그아웃, 생체정보 변경, 앱 재설치 때 key·ciphertext가 어떻게 되는가 |

`setUserAuthenticationRequired(true)`와 StrongBox는 모든 key의 필수 조건이 아니다. background 동기화용 key에 사용자 인증을 강제하면 기능이 깨질 수 있고, StrongBox는 지원 알고리즘·성능·동시 작업 제약이 있다. 보호 대상과 위협 모델에 맞지 않는 경우에만 후보로 남긴다.

앱 process가 탈취되면 공격자가 key를 export하지 못하더라도 앱을 통해 암복호화 연산을 요청할 수 있다. 그래서 key 비추출성과 runtime 오용 방지는 별도 항목으로 기록한다.

### 7. Backup·복원

`allowBackup="true"`만 보고 취약점을 확정하지 않는다. 실제 포함 파일과 복원 후 영향을 확인한다.

```bash
rg -n 'allowBackup|fullBackupContent|dataExtractionRules|backupAgent|killAfterRestore|restoreAnyVersion' evidence/AndroidManifest.xml work
rg -n '<include|<exclude|cloud-backup|device-transfer|disableIfNoEncryptionCapabilities|requireFlags' work/res/xml
```

| 환경 | 확인할 설정 | 주의사항 |
| :--- | :--- | :--- |
| Android 11 이하 | `fullBackupContent` | legacy XML도 계속 지원 필요 |
| Android 12 이상·target 31+ | `dataExtractionRules` | cloud와 device transfer 규칙 분리 |
| 기본 Auto Backup | preferences, files, DB, external app files | cache·code cache·`no_backup`은 기본 제외 |
| D2D 이전 | device-transfer 규칙 | 일부 제조사는 `allowBackup=false`여도 동작 차이 가능 |
| `EncryptedSharedPreferences` | 명시적 exclude | 복원 단말에 원래 key가 없어 실패 가능 |

`adb backup`은 Android 12부터 제한되며 운영 build 검증의 기본 방법으로 사용하지 않는다. 가능하면 고객사 테스트 build의 backup test, Android 공식 backup test 도구와 실제 restore 흐름을 사용한다. 단순히 `.ab` 파일이 생성됐다는 결과보다 테스트 계정의 민감 파일이 포함되고 다른 설치에서 복원·재사용되는지가 중요하다.

### 8. Clipboard·logcat·입력 캐시

클립보드에는 실제 테스트 값만 복사한다. Android version에 따라 background 접근, 미리보기와 자동 정리 동작이 다르다.

```bash
rg -n 'setPrimaryClip|clearPrimaryClip|EXTRA_IS_SENSITIVE|android\.content\.extra\.IS_SENSITIVE' work
```

다음 hook은 내용 자체를 출력하지 않고 item 수와 sensitive flag 후보만 관찰한다.

```javascript
Java.perform(function () {
    const ClipboardManager = Java.use('android.content.ClipboardManager');
    const setPrimaryClip = ClipboardManager.setPrimaryClip.overload('android.content.ClipData');

    setPrimaryClip.implementation = function (clip) {
        const description = clip.getDescription();
        const extras = description.getExtras();
        let sensitive = false;

        if (extras !== null) {
            sensitive = extras.getBoolean('android.content.extra.IS_SENSITIVE', false);
        }

        console.log('[clipboard] items=' + clip.getItemCount() + ', sensitive=' + sensitive);
        return setPrimaryClip.call(this, clip);
    };
});
```

logcat은 앱을 실행하기 전부터 수집하고 PID로 범위를 줄인다. 기존 system log를 지우지 않는다.

```bash
adb shell pidof com.target.app
adb logcat --pid=<PID> -d
```

비밀번호·token·개인정보가 production log에 그대로 남는지 확인한다. Android 4.1 이후 일반 앱의 전체 logcat 접근은 제한되지만 privileged app, USB debugging, vendor 환경과 지원 로그 수집 경로가 남아 있을 수 있다.

비밀번호·PIN 입력란은 keyboard 학습과 자동 완성도 확인한다. 입력값을 강제로 수집하지 말고 `inputType`, autofill 설정과 테스트 문자열의 추천 노출 여부만 검증한다.

## 결과 판정

| 관찰 결과 | 현재 판단 | 추가 확인 |
| :--- | :--- | :--- |
| 내부 sandbox에 단순 설정 평문 | 일반 동작 | 민감도와 외부 접근 경로 |
| 내부 sandbox에 token 평문 | 조건부 후보 | backup, `debuggable`, 만료·단말 바인딩 |
| 비밀번호·복구 secret 지속 저장 | 취약 후보 | 저장 필요성, 접근 경로, 실제 재사용 |
| 공유 저장소에 민감 문서 노출 | 취약 후보 | Android version과 타 앱·사용자 접근 |
| 로그아웃 후 유효 token 잔존 | 취약 후보 | 서버 폐기 여부와 계정 전환 영향 |
| backup에 민감 파일 포함 | 조건부 후보 | cloud·D2D 복원과 암호화 조건 |
| hard-coded key로 로컬 데이터 암호화 | 취약 후보 | key 추출과 복호화 재현 |
| Keystore key에 사용자 인증 없음 | 요구사항 확인 | 사용자 presence가 필요한 기능인지 |
| StrongBox 미사용 | 보류 | 물리 공격 위협과 제품 요구사항 |
| SQLCipher password가 runtime 인자로 전달 | 일반 동작 가능 | 고정 저장·파생·Keystore 연결 여부 |
| production log에 원문 자격증명 | 취약 후보 | 수집 가능 환경과 재사용 가능성 |

취약점을 확정하려면 다음을 연결한다.

- 보호 대상 데이터가 실제 테스트 동작에서 생성됐다.
- 공격자 모델에서 접근 가능한 위치·backup·부수 채널에 남았다.
- 암호화가 없거나 key가 같은 경로에서 함께 확보됐다.
- 로그아웃·만료 후에도 값이 남거나 서버에서 사용할 수 있다.
- 단순 식별자나 마스킹된 cache가 아닌 실제 민감 값이다.

심각도는 데이터 종류만으로 정하지 않는다. 접근에 필요한 권한, 단말 잠금, 사용자 상호작용, server-side 만료·재인증과 노출 범위를 함께 본다.

## 증적 항목

- 앱 version, Android API, `targetSdk`, build 유형
- 단말 root·화면 잠금·FBE 상태
- 사용자 동작과 변경된 file·table·key 매핑
- 저장 경로, owner·permission, SHA-256
- 민감 값 종류, 마스킹된 앞·뒤 일부, 길이와 만료 시각
- 로그아웃·계정 전환·재부팅 전후 잔존 결과
- backup rule과 cloud·D2D 포함 여부
- key alias, algorithm, purpose, auth와 hardware security level
- 접근에 사용한 권한과 전제 조건
- 추출 값의 제한된 server 재사용 결과

## 트러블슈팅

#### `run-as` 접근 거부

- 운영 build의 `debuggable=false`면 정상 결과다.
- package 이름과 work profile·다중 사용자 ID를 확인한다.
- 허가된 test build, rooted emulator 또는 고객사 추출본으로 전환한다.
- 접근 실패를 안전한 저장의 증거로 기록하지 않는다.

#### binary 추출 hash 불일치

- DB와 WAL·SHM을 같은 시점에 확보했는지 확인한다.
- 앱 process를 종료할 수 있는 테스트 조건인지 먼저 확인한다.
- Windows redirection이 binary를 변환하지 않았는지 확인한다.
- source와 host SHA-256이 같을 때만 분석을 계속한다.

#### SQLite DB open 실패

- `file`과 header로 SQLite 여부를 확인한다.
- WAL·SHM 누락, 잠긴 DB, SQLCipher와 custom format을 구분한다.
- APK에서 driver와 `open` call을 찾아 실제 DB 종류를 확인한다.

#### DataStore 문자열 미식별

- Preferences DataStore와 Proto DataStore를 구분한다.
- serializer class와 `.proto` schema를 정적 분석한다.
- raw `strings` 결과만으로 데이터 부재를 판단하지 않는다.

#### 외부 저장소 접근 차이

- 단말 API와 `targetSdk`를 함께 기록한다.
- 앱 전용 외부 경로와 shared collection을 구분한다.
- `requestLegacyExternalStorage`가 적용되는 Android version인지 확인한다.

#### backup 결과 불일치

- cloud backup, D2D와 `adb backup`을 같은 기능으로 보지 않는다.
- Android 11 이하 규칙과 Android 12 이상 규칙을 모두 확인한다.
- OEM별 `allowBackup` 처리 차이와 사용자의 backup 설정을 확인한다.

#### Keystore hook 결과 없음

- key가 최초 설치·로그인 때만 생성됐는지 확인한다.
- Java wrapper 뒤의 Native·provider 호출 여부를 확인한다.
- hook 전에 이미 초기화됐다면 spawn 방식으로 시작한다.
- API 전체를 변조하지 말고 앱 전용 secure storage wrapper를 관찰한다.

## 빠른 명령어 참조

기준 정보:

```bash
adb shell getprop ro.build.version.sdk
adb shell getprop ro.crypto.type
adb shell "dumpsys package com.target.app | grep -E 'versionName|versionCode|targetSdk|debuggable'"
```

컨테이너·파일:

```bash
adb shell run-as com.target.app find . -type f
adb shell run-as com.target.app find shared_prefs databases files cache no_backup -type f
adb shell ls -la /sdcard/Android/data/com.target.app/files
```

선택 파일 분석:

```bash
file evidence/main.db
xxd -l 32 evidence/main.db
sqlite3 evidence/main.db ".tables"
sqlite3 evidence/main.db "PRAGMA table_info(users);"
rg -l -i 'access[_-]?token|refresh[_-]?token|password|authorization' evidence/container
```

정적 검색:

```bash
rg -n 'SharedPreferences|DataStore|RoomDatabase|SQLiteDatabase|AndroidKeyStore|getExternalFilesDir|MediaStore' work
rg -n 'allowBackup|fullBackupContent|dataExtractionRules|requestLegacyExternalStorage' evidence/AndroidManifest.xml work
```

## 관련 문서

- [Android 환경 구축](setup-android.md): ADB, emulator·실기기와 container 접근 준비
- [정적 분석](static-analysis.md): 저장 API, table·key와 caller 식별
- [Frida 후킹 실무](frida-scripts.md): 앱 전용 secure storage wrapper 관찰
- [암호화·키 관리](crypto-keys.md): algorithm, mode, key derivation과 hard-coded key
- [인증·세션](auth-mobile.md): 추출 token의 만료·폐기·재사용 확인
- [WebView 보안](webview-issues.md): cookie, LocalStorage와 WebView cache
- [개인정보 노출](privacy-leakage.md): 화면·로그·클립보드 등 부수 채널
- [iOS 데이터 저장](data-storage-ios.md): iOS container, Keychain과 backup

## 참고자료

공식 문서와 테스트 가이드:

- [OWASP MASVS-STORAGE](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
- [OWASP MASTG - Local Storage for Sensitive Data](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0001/)
- [OWASP MASTG - Backups](https://mas.owasp.org/MASTG/knowledge/android/MASVS-STORAGE/MASTG-KNOW-0050/)
- [OWASP MASTG - Keyboard Cache](https://mas.owasp.org/MASTG/knowledge/android/MASVS-STORAGE/MASTG-KNOW-0055/)
- [Android Developers - Data and file storage overview](https://developer.android.com/training/data-storage)
- [Android Developers - App-specific files](https://developer.android.com/training/data-storage/app-specific)
- [Android Developers - Direct Boot](https://developer.android.com/privacy-and-security/direct-boot)
- [Android Developers - Android Keystore](https://developer.android.com/privacy-and-security/keystore)
- [Android Developers - Auto Backup](https://developer.android.com/identity/data/autobackup)
- [Android Developers - EncryptedSharedPreferences](https://developer.android.com/reference/androidx/security/crypto/EncryptedSharedPreferences)
- [Android Developers - Sensitive data in external storage](https://developer.android.com/privacy-and-security/risks/sensitive-data-external-storage)
- [Android Developers - Log information disclosure](https://developer.android.com/privacy-and-security/risks/log-info-disclosure)
- [Android Developers - Secure clipboard handling](https://developer.android.com/privacy-and-security/risks/secure-clipboard-handling)

보조 도구:

- [SQLCipher for Android](https://www.zetetic.net/sqlcipher/sqlcipher-for-android/)
