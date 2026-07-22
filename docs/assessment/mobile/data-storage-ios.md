---
sidebar_position: 12
title: iOS 데이터 저장
description: iOS 앱의 컨테이너 변화를 추적하고 UserDefaults, Core Data, File Protection, Keychain, App Group, 백업과 부수 노출을 검증하는 실무 흐름
keywords: [iOS Data Storage, UserDefaults, plist, Core Data, SQLite, File Protection, Keychain, kSecAttrAccessible, App Group, iOS Backup, UIPasteboard, Unified Logging, MASVS-STORAGE]
toc_max_heading_level: 3
draft: false
---

> 앱에서 입력하거나 서버에서 받은 값이 컨테이너·Keychain·backup·부수 채널에 어떻게 남는지 확인한다. 핵심은 plist에서 문자열을 찾는 것이 아니라 **사용자 동작과 저장 변화를 연결하고 잠금·복원·공유 조건에서 실제 접근 가능성을 검증하는 것**이다.

## 사용 시점

- 로그인·자동 로그인 뒤 token과 계정 정보의 저장 위치를 찾을 때
- 개인정보, 메시지, 영수증, 신분증 또는 첨부파일이 단말에 남는지 확인할 때
- 앱이 UserDefaults, Core Data, SQLite, Realm 또는 자체 파일을 사용할 때
- Keychain accessibility, access group, 동기화와 사용자 presence 조건을 확인할 때
- 잠금·재부팅·로그아웃·계정 전환 뒤 데이터 접근과 잔존 상태를 비교할 때
- Finder·iCloud backup, Pasteboard 또는 Unified Logging을 통한 부수 노출을 확인할 때

탈옥 단말에서 파일이나 Keychain item을 읽을 수 있다는 사실만으로 취약점을 확정하지 않는다. app sandbox, Data Protection class, 단말 잠금 상태, backup·동기화 정책과 데이터의 실제 재사용 가능성을 함께 본다.

## 분석 기준

동일한 앱도 iOS version, build·entitlement, 단말 잠금과 backup 환경에 따라 결과가 달라진다.

Windows PowerShell:

```powershell
ideviceinfo -k ProductVersion
ideviceinfo -k ProductType
frida-ps -Uai | Select-String -Pattern 'target'
```

macOS에서 추출한 app bundle까지 함께 확인하는 경우:

```bash
frida-ps -Uai | grep -i target
codesign -dvvv --entitlements :- Payload/Target.app
```

| 기준 | 확인 내용 | 판단 영향 |
| :--- | :--- | :--- |
| build | App Store, Ad Hoc, 개발·재서명 build | container 접근과 entitlement 차이 |
| 단말 | 실기기·simulator, jailbreak, passcode | Keychain·Data Protection 조건 |
| 앱 상태 | 신규 설치, 로그인, 로그아웃, 계정 전환 | 잔존 데이터와 사용자 분리 |
| 데이터 | password, token, 개인정보, 문서, cache | 필요한 보호 수준 |
| 실행 상태 | foreground, background, 잠금, 재부팅 | protection class 접근 가능 시점 |
| 이동 경로 | local backup, iCloud, App Group, Handoff | 단말 밖 이동과 공유 범위 |
| 서버 | token 만료·폐기, 단말 바인딩, 재인증 | 추출 값의 실제 영향 |

Xcode와 simulator는 macOS에서만 사용한다. Windows에서는 USB forwarding·SSH, Frida·Objection과 libimobiledevice를 사용할 수 있지만, 전용 테스트 단말과 macOS 분석 환경이 있으면 container·backup 검증이 수월하다.

## 저장 위치

| 위치 | 대표 경로·API | 먼저 볼 항목 |
| :--- | :--- | :--- |
| UserDefaults | `Library/Preferences/<bundle>.plist` | token, 사용자 ID, 기능 상태 |
| Application Support | `Library/Application Support/` | DB, 영속 파일, 자체 설정 |
| Documents | `Documents/` | 사용자 문서, Files·file sharing 노출 |
| Caches·tmp | `Library/Caches/`, `tmp/` | API response, 임시 복호화 파일 |
| Core Data·SQLite | `*.sqlite`, `-wal`, `-shm` | 메시지, 거래, 삭제 전 레코드 |
| Data Protection | `NSFileProtection*` | 잠금·재부팅 중 접근 조건 |
| Keychain | `SecItem*`, `kSecAttrAccessible` | secret, migration, sync, user presence |
| App Group | `/var/mobile/Containers/Shared/AppGroup/` | 앱·extension 간 공유 범위 |
| Backup | Finder·iCloud, `Manifest.db` | 포함 경로, 암호화와 복원 결과 |
| 부수 채널 | Pasteboard, Unified Logging, keyboard cache | sandbox 밖으로 나간 민감 데이터 |

WebView cookie와 LocalStorage는 [WebView 보안](webview-issues.md), 암호 알고리즘과 key derivation은 [암호화·키 관리](crypto-keys.md)에서 이어서 본다.

## 진단 절차

#### Step 1. 앱·단말 기준선

앱 version, Bundle ID, iOS version, 배포 방식, jailbreak·passcode 상태를 기록한다. 테스트 계정만 사용하고 앱 삭제·재설치 전 Keychain과 단말 등록의 복구 방법을 확인한다.

#### Step 2. 컨테이너 경로

개발 build는 Xcode의 Devices and Simulators에서 container를 내려받을 수 있다. jailbreak·재서명 환경에서는 Objection으로 현재 UUID 경로를 확인한다.

```bash
objection -g com.target.app explore
```

```text
com.target.app on (iPhone) [usb] # env
```

확인할 경로는 bundle과 data container가 다르다.

```text
Bundle: /var/containers/Bundle/Application/<UUID>/Target.app
Data:   /var/mobile/Containers/Data/Application/<UUID>
```

container UUID는 재설치 때 달라질 수 있으므로 고정하지 않는다. 접근 준비는 [iOS 환경 구축](setup-ios.md)을 따른다.

#### Step 3. 정적 저장 API

Info.plist·entitlement와 binary에서 저장 API를 찾는다.

```bash
plutil -p Payload/Target.app/Info.plist
codesign -d --entitlements :- Payload/Target.app
strings -a Payload/Target.app/Target | grep -iE 'NSUserDefaults|UserDefaults|CoreData|NSSQLiteStoreType|Realm|SecItem|kSecAttrAccessible|UIPasteboard|NSFileProtection'
```

Windows에서는 `plistutil`과 PowerShell filter를 사용한다. entitlement는 macOS `codesign`, jailbreak toolchain의 `ldid` 또는 전달받은 추출 결과로 확인한다.

```powershell
plistutil -i Payload\Target.app\Info.plist -o evidence\Info.plist.xml
strings.exe Payload\Target.app\Target | Select-String -Pattern 'NSUserDefaults|UserDefaults|CoreData|NSSQLiteStoreType|Realm|SecItem|kSecAttrAccessible|UIPasteboard|NSFileProtection'
```

다음 설정은 별도로 기록한다.

- `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`
- `NSFileProtectionKey`
- `com.apple.security.application-groups`
- `keychain-access-groups`
- iCloud container·ubiquity entitlement

API 문자열은 후보일 뿐이다. 실제 path·key·entity와 사용자 기능을 연결해야 한다.

#### Step 4. 사용자 동작·파일 변화

한 번에 한 동작만 수행하고 file path, size, 수정 시각을 비교한다.

```text
신규 설치 → 기준선 A
로그인 → 기준선 B
개인정보·문서 조회 → 기준선 C
background·잠금 → 기준선 D
로그아웃·계정 전환 → 기준선 E
```

USB forwarding 환경의 host 예시다.

```powershell
ssh -p 2222 root@127.0.0.1 "find '<APP_DATA>' -type f -exec stat -f '%m %z %N' {} \;" > evidence\before-login.txt
# 앱에서 로그인 수행
ssh -p 2222 root@127.0.0.1 "find '<APP_DATA>' -type f -exec stat -f '%m %z %N' {} \;" > evidence\after-login.txt
Compare-Object (Get-Content evidence\before-login.txt) (Get-Content evidence\after-login.txt)
```

Linux·macOS에서는 같은 결과를 `diff`로 비교한다.

```bash
diff -u evidence/before-login.txt evidence/after-login.txt
```

#### Step 5. 선택 파일 분석

container 전체를 증적으로 복사하지 않는다. 변경된 파일과 테스트 계정에 해당하는 레코드만 추출한다. DB는 WAL·SHM을 같은 시점에 확보하고 source·host SHA-256을 비교한다.

#### Step 6. 잠금·재부팅 검증

민감 파일과 Keychain item을 선택해 다음 상태에서 접근 결과를 비교한다.

1. 단말 잠금 해제
2. 단말 잠금
3. 재부팅 후 첫 unlock 전
4. 첫 unlock 후 다시 잠금

앱 기능이 background에서 반드시 동작해야 하는지도 함께 기록한다. 보호 class 이름만으로 요구사항 적합성을 판단하지 않는다.

#### Step 7. 종료·복원 영향

로그아웃·계정 전환 뒤 file과 Keychain item이 삭제되는지 확인한다. 허가된 전용 테스트 단말에서는 backup·restore 이후 이전 사용자 정보가 다시 나타나거나 유효 token이 복원되는지도 확인한다.

## 실습 노트

### 1. 컨테이너 변화

앱 data container에서 path와 크기부터 확인한다.

```bash
find '<APP_DATA>/Documents' '<APP_DATA>/Library' '<APP_DATA>/tmp' -type f -exec stat -f '%m %z %N' {} \;
```

| 관찰 | 먼저 볼 위치 | 다음 행동 |
| :--- | :--- | :--- |
| 로그인 직후 plist 변경 | `Library/Preferences` | key 이름과 값 종류 확인 |
| DB와 WAL 동시 증가 | `Application Support` | 세 파일을 함께 확보 |
| 문서 열람 뒤 cache 증가 | `Caches`, `tmp` | background·로그아웃 후 잔존 확인 |
| Files 앱에서 문서 확인 | `Documents` | file sharing 설정과 암호화 확인 |
| extension 실행 뒤 파일 변경 | App Group container | 공유 멤버와 접근 범위 확인 |

같은 동작을 두 번 반복해 재현성을 확인한다. UUID·timestamp만 바뀌는 system file은 민감 저장 후보와 분리한다.

### 2. UserDefaults·plist

UserDefaults는 앱 설정을 위한 key-value 저장소이며 secret을 자동으로 암호화하지 않는다. 먼저 key 이름을 확인하고 필요한 값만 마스킹한다.

macOS:

```bash
plutil -p '<APP_DATA>/Library/Preferences/com.target.app.plist'
```

Windows·Linux에서 libplist를 사용하는 경우:

```bash
plistutil -i evidence/com.target.app.plist -o evidence/com.target.app.xml
rg -n '<key>|token|password|account|session' evidence/com.target.app.xml
```

| 값 | 현재 판단 | 다음 확인 |
| :--- | :--- | :--- |
| theme, locale, onboarding | 일반 설정 | 불필요한 사용자 식별 여부 |
| 로그인 여부 boolean | 조작 후보 | 서버 인증과 분리 여부 |
| access token | 조건부 후보 | 만료·backup·Data Protection |
| refresh token·password | 취약 후보 | Keychain 사용과 실제 재사용 |
| 암호화 key·고정 IV | 취약 후보 | ciphertext 복호화 재현 |

UserDefaults에 token이 보였다는 사실만으로 심각도를 정하지 않는다. sandbox 접근 조건, backup, 잠금 상태와 server-side 수명을 함께 본다.

### 3. Core Data·SQLite·Realm

Core Data의 SQLite store와 WAL·SHM을 같은 시점에 확보한다.

```bash
find '<APP_DATA>/Library/Application Support' -type f \( -name '*.sqlite' -o -name '*.sqlite-wal' -o -name '*.sqlite-shm' -o -name '*.realm' \)
file evidence/Model.sqlite
sqlite3 evidence/Model.sqlite ".tables"
sqlite3 evidence/Model.sqlite "SELECT name, sql FROM sqlite_master WHERE type='table';"
```

처음부터 `SELECT *`로 전체 데이터를 출력하지 않는다. entity·column과 row 수를 본 뒤 테스트 계정 한 건의 존재·길이만 확인한다.

```bash
sqlite3 evidence/Model.sqlite "SELECT count(*) FROM ZMESSAGE;"
sqlite3 evidence/Model.sqlite "SELECT Z_PK, length(ZBODY) FROM ZMESSAGE WHERE ZUSERID='<TEST_ID>' LIMIT 1;"
```

SQLite header가 보이면 DB file 자체는 평문 형식이지만 모든 column이 민감하거나 외부에서 접근 가능한 것은 아니다. app-layer 암호화, File Protection class, backup과 attacker model을 함께 확인한다.

`NSPersistentStoreFileProtectionKey`, Realm encryption key 또는 SQLCipher가 보이면 key가 hard-coded·plist에 저장됐는지, Keychain과 연결되는지 확인한다.

```bash
strings -a Payload/Target.app/Target | grep -iE 'NSPersistentStoreFileProtectionKey|Realm\.Configuration|encryptionKey|SQLCipher'
```

### 4. 파일·Data Protection

iOS의 Data Protection은 file별 class에 따라 잠금 상태의 접근 가능 시점을 제어한다. 별도 지정이 없는 third-party app data의 기본 class는 `NSFileProtectionCompleteUntilFirstUserAuthentication`이다.

| class | 접근 가능 시점 | 실무 판단 |
| :--- | :--- | :--- |
| `Complete` | unlock 중 | 잠금 중 필요 없는 민감 파일 후보 |
| `CompleteUnlessOpen` | unlock 때 연 파일은 잠금 후 계속 사용 가능 | background write 요구 확인 |
| `CompleteUntilFirstUserAuthentication` | 재부팅 후 첫 unlock부터 다음 재부팅까지 | 기본값, 잠금 후 접근 가능 |
| `None` | lock state와 무관 | 민감 파일이면 우선 검토 |

선택한 파일의 속성을 앱 process에서 확인하는 Frida 예시다. 전체 container를 재귀 출력하지 않는다.

```javascript
if (typeof ObjC !== 'undefined' && ObjC.available) {
    const Foundation = Process.getModuleByName('Foundation');
    const homeAddress = Foundation.findExportByName('NSHomeDirectory');
    const NSHomeDirectory = new NativeFunction(homeAddress, 'pointer', []);
    const home = new ObjC.Object(NSHomeDirectory()).toString();
    const fileManager = ObjC.classes.NSFileManager.defaultManager();
    const NSString = ObjC.classes.NSString;
    const protectionKey = NSString.stringWithString_('NSFileProtectionKey');
    const relativePaths = [
        '/Library/Application Support/Model.sqlite',
        '/Documents/receipt.pdf'
    ];

    relativePaths.forEach(function (relativePath) {
        const path = NSString.stringWithString_(home + relativePath);
        if (!fileManager.fileExistsAtPath_(path)) {
            return;
        }

        const attributes = fileManager.attributesOfItemAtPath_error_(path, ptr(0));
        const protection = attributes.objectForKey_(protectionKey);
        console.log(relativePath + ' protection=' + protection);
    });
}
```

`Complete`가 아니라고 바로 취약한 것은 아니다. 데이터 민감도, background 요구, 실제 lock-state 접근과 app-layer 암호화를 연결한다.

### 5. App Group·파일 공유

App Group container는 같은 entitlement를 가진 앱과 extension이 공유한다. 기본 app sandbox와 접근 주체가 다르다.

```bash
codesign -d --entitlements :- Payload/Target.app
rg -n 'application-groups|UIFileSharingEnabled|LSSupportsOpeningDocumentsInPlace|documentPicker|containerURLForSecurityApplicationGroupIdentifier' work evidence
```

| 기능 | 확인할 것 |
| :--- | :--- |
| App Group | group ID, 참여 앱·extension, shared file·UserDefaults suite |
| File Sharing | Documents가 Finder·iTunes에서 보이는지 |
| Open in Place | Files 앱에서 문서를 열고 수정할 수 있는지 |
| Document Picker | 사용자가 export한 파일의 암호화·잔존 기간 |
| iCloud container | 다른 단말 동기화 의도와 계정 전환 처리 |

Documents에 파일이 있다는 사실만으로 외부 노출을 확정하지 않는다. `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`, 실제 Files 앱 노출과 파일 내용 보호를 함께 확인한다.

### 6. Keychain

Keychain은 password, token과 작은 secret을 보호하기 위한 system 저장소다. 일반 password item을 저장했다고 해서 그 값이 Secure Enclave private key가 되는 것은 아니다. Secure Enclave key는 `kSecAttrTokenIDSecureEnclave`로 생성한 256-bit EC private key에 해당한다.

```bash
strings -a Payload/Target.app/Target | grep -iE 'SecItemAdd|SecItemUpdate|SecItemCopyMatching|kSecAttrAccessible|kSecAttrAccessControl|kSecAttrSynchronizable|kSecAttrAccessGroup|kSecAttrTokenIDSecureEnclave'
```

| 속성 | 의미 | 판단 질문 |
| :--- | :--- | :--- |
| `WhenUnlocked` | unlock 중 접근, 기본값 | foreground secret에 충분한가 |
| `WhenUnlockedThisDeviceOnly` | unlock 중 접근, 다른 단말 migration 제외 | device binding이 필요한가 |
| `WhenPasscodeSetThisDeviceOnly` | passcode 필요, 제거 시 item 무효화 | 가장 민감한 foreground key인가 |
| `AfterFirstUnlock` | 첫 unlock 이후 background 접근 | background 기능이 실제 필요한가 |
| `Always*` | lock과 무관, deprecated | legacy 사용과 민감 item 여부 |
| `kSecAttrSynchronizable` | iCloud Keychain sync | 사용자 다른 단말 공유가 의도됐는가 |
| `kSecAttrAccessGroup` | 앱·extension 간 공유 | 불필요하게 넓은 group인가 |
| `SecAccessControl` | user presence·biometry 등 | 거래·서명 직전 presence가 필요한가 |

다음 hook은 `kSecValueData`를 출력하지 않고 add query의 보호 metadata만 기록한다.

```javascript
if (typeof ObjC !== 'undefined' && ObjC.available) {
    const Security = Process.getModuleByName('Security');

    function constant(name) {
        const address = Security.findExportByName(name);
        return new ObjC.Object(address.readPointer());
    }

    const keys = {
        accessible: constant('kSecAttrAccessible'),
        accessControl: constant('kSecAttrAccessControl'),
        synchronizable: constant('kSecAttrSynchronizable'),
        valueData: constant('kSecValueData')
    };

    const secItemAdd = Security.findExportByName('SecItemAdd');
    Interceptor.attach(secItemAdd, {
        onEnter: function (args) {
            const query = new ObjC.Object(args[0]);
            const accessible = query.objectForKey_(keys.accessible);
            const accessControl = query.objectForKey_(keys.accessControl);
            const synchronizable = query.objectForKey_(keys.synchronizable);
            const valueData = query.objectForKey_(keys.valueData);

            console.log('[SecItemAdd] accessible=' + accessible);
            console.log('[SecItemAdd] accessControl=' + (accessControl !== null));
            console.log('[SecItemAdd] synchronizable=' + synchronizable);
            console.log('[SecItemAdd] hasValueData=' + (valueData !== null));
        }
    });
}
```

`WhenUnlocked` 또는 `ThisDeviceOnly` 미사용만으로 취약점을 확정하지 않는다. background·migration 요구, passcode 정책, token 수명과 사용자 presence가 필요한 기능인지를 함께 본다. 전체 Keychain dump는 테스트 계정 secret까지 출력할 수 있으므로 기본 증적 방식으로 사용하지 않는다.

### 7. Backup·복원

Documents, Application Support와 Preferences는 일반적으로 backup 대상이다. Caches와 tmp는 기본 backup 대상이 아니다. `isExcludedFromBackup`은 다시 내려받을 수 있는 cache·support file을 제외하는 용도이며 사용자 문서를 무조건 제외하는 보안 옵션이 아니다.

전용 테스트 단말에서 확보한 backup의 `Manifest.db`로 앱 domain과 path를 먼저 제한한다.

```bash
sqlite3 evidence/backup/Manifest.db "SELECT fileID, relativePath, flags FROM Files WHERE domain='AppDomain-com.target.app' ORDER BY relativePath;"
```

| 확인 항목 | 질문 |
| :--- | :--- |
| backup 종류 | Finder local, iCloud, D2D 중 무엇인가 |
| local 암호화 | backup password가 설정됐는가 |
| 앱 파일 | 어떤 Documents·Application Support·Preferences가 포함됐는가 |
| 제외 속성 | 재생성 가능한 대용량 cache만 제외했는가 |
| Keychain | accessibility와 `ThisDeviceOnly`, sync를 구분했는가 |
| 복원 | 이전 사용자 token·설정이 다른 설치에서 되살아나는가 |

Keychain item은 backup에 포함될 수 있지만 secret은 보호된 상태로 처리된다. `ThisDeviceOnly`는 다른 단말로의 migration을 막고, `kSecAttrSynchronizable`은 iCloud Keychain sync 여부를 제어한다. 두 속성을 같은 개념으로 기록하지 않는다.

backup 생성은 단말 전체의 다른 앱 데이터도 포함할 수 있다. 개인 단말에서는 수행하지 않고 전용 테스트 단말·고객사 제공 backup만 사용한다. “backup에서 파일이 보임”보다 민감 파일의 보호 상태와 restore 후 실제 영향이 중요하다.

### 8. Pasteboard·로그·입력 캐시

Pasteboard에는 실제 테스트 값만 복사한다. 일반 pasteboard는 Handoff를 통해 다른 Apple 기기로 전달될 수 있으므로 `localOnly`와 `expirationDate` 사용 여부를 확인한다.

```bash
strings -a Payload/Target.app/Target | grep -iE 'UIPasteboard|setItems|localOnly|expirationDate|generalPasteboard'
```

내용을 로그로 남기지 않고 길이만 확인하는 hook 예시다.

```javascript
if (typeof ObjC !== 'undefined' && ObjC.available) {
    const UIPasteboard = ObjC.classes.UIPasteboard;
    const setString = UIPasteboard['- setString:'];

    Interceptor.attach(setString.implementation, {
        onEnter: function (args) {
            const value = new ObjC.Object(args[2]);
            console.log('[UIPasteboard] stringLength=' + value.length());
        }
    });
}
```

OTP·복구 code·카드번호처럼 수명이 짧은 값은 clipboard 사용 필요성, local-only, 만료와 수동 복사 여부를 함께 본다. paste permission·알림이 나타난다는 사실만으로 안전을 확정하지 않는다.

Unified Logging은 subsystem·process로 범위를 줄여 확인한다.

```bash
idevicesyslog | grep -i 'TargetApp'
```

Windows PowerShell:

```powershell
idevicesyslog | Select-String -Pattern 'TargetApp'
```

Swift `Logger`의 string·object interpolation은 기본적으로 redaction되지만 `NSLog`, 직접 파일 로그, `.public` 지정이나 잘못된 format 사용은 별도 확인한다. production build에서 password, token, request body와 개인정보가 원문으로 남는지 본다.

password·PIN 입력란은 `isSecureTextEntry`, autocorrection과 text content type을 확인한다. 테스트 문자열의 keyboard 추천 노출만 확인하고 keyboard database 전체를 수집하지 않는다.

## 결과 판정

| 관찰 결과 | 현재 판단 | 추가 확인 |
| :--- | :--- | :--- |
| sandbox의 단순 설정 평문 | 일반 동작 | backup·공유 노출 여부 |
| UserDefaults의 access token | 조건부 후보 | 수명, File Protection, backup, server binding |
| password·refresh token 지속 평문 | 취약 후보 | Keychain 부재와 실제 재사용 |
| 민감 파일의 `NSFileProtectionNone` | 취약 후보 | lock-state 접근과 app-layer 암호화 |
| 기본 `UntilFirstUserAuthentication` | 일반 동작 가능 | 잠금 중 보호 요구 여부 |
| `WhenUnlocked` Keychain item | 일반 기본값 | foreground 사용과 migration 요구 |
| `AfterFirstUnlock` secret | 조건부 후보 | background 접근 필요성 |
| `ThisDeviceOnly` 미사용 | 요구사항 확인 | 다른 단말 migration 허용 여부 |
| user presence 미적용 | 요구사항 확인 | 거래·서명 직전 재확인이 필요한가 |
| Documents 민감 파일+file sharing | 취약 후보 | Files·Finder 실제 접근과 암호화 |
| backup에 민감 file 포함 | 조건부 후보 | backup 암호화와 restore 영향 |
| production log 원문 secret | 취약 후보 | 수집 가능한 경로와 재사용 |

취약점을 확정하려면 다음을 연결한다.

- 보호 대상 데이터가 실제 테스트 동작에서 생성됐다.
- 공격자 모델에서 접근 가능한 container·공유·backup·부수 채널에 남았다.
- Data Protection·Keychain·app-layer 암호화가 요구 수준에 미치지 못한다.
- 로그아웃·만료 후에도 값이 남거나 server에서 사용할 수 있다.
- 단순 identifier·mask·재생성 가능한 cache가 아닌 실제 민감 값이다.

심각도는 데이터 종류만으로 정하지 않는다. jailbreak·passcode·backup password·사용자 상호작용, 다른 단말 migration과 server-side 만료·재인증을 함께 본다.

## 증적 항목

- 앱 version, Bundle ID, iOS version과 build 유형
- 실기기·simulator, jailbreak, passcode 상태
- 사용자 동작과 변경된 file·entity·UserDefaults key 매핑
- container·App Group path, file size·SHA-256
- Data Protection class와 lock-state 접근 결과
- Keychain class, accessibility, access control, access group, sync
- 민감 값 종류, 마스킹된 일부, 길이와 만료 시각
- 로그아웃·계정 전환·재부팅 전후 잔존 결과
- backup 종류, 암호화, 포함 path와 restore 결과
- 추출 값의 제한된 server 재사용 결과

## 트러블슈팅

#### Objection `env` 식별 실패

- Bundle ID와 process 이름을 다시 확인한다.
- 앱이 즉시 종료되면 spawn·attach 방식과 gadget 상태를 구분한다.
- 재서명 build의 application identifier와 원본 Bundle ID 차이를 확인한다.
- Xcode debug container 또는 Frida `NSHomeDirectory` 확인으로 전환한다.

#### SSH container 접근 거부

- rootless jailbreak의 prefix와 SSH 사용자·port를 확인한다.
- bundle container와 data container를 혼동하지 않았는지 확인한다.
- 앱 재설치 뒤 바뀐 UUID를 다시 찾는다.
- 접근 실패를 안전한 저장의 증거로 기록하지 않는다.

#### plist 변환 실패

- XML·binary plist와 손상 파일을 `file`로 구분한다.
- macOS는 `plutil`, Windows·Linux는 libplist의 `plistutil`을 사용한다.
- extension 없는 archive·protobuf 파일을 plist로 오해하지 않는다.

#### Core Data DB open 실패

- SQLite, WAL, SHM을 같은 시점에 확보했는지 확인한다.
- app process 종료가 허가된 테스트 조건인지 확인한다.
- encrypted store, Realm과 custom format을 구분한다.
- source와 host file hash가 같은지 확인한다.

#### File Protection 값 누락

- 선택 path가 실제 app container 안에 존재하는지 확인한다.
- 속성을 읽는 시점과 파일 생성·교체 시점을 비교한다.
- atomic write가 새 파일을 만들며 protection·backup 속성을 바꿨는지 확인한다.

#### Keychain metadata 미출력

- item이 최초 설치·로그인 때만 생성됐는지 확인한다.
- hook 전에 이미 생성됐다면 spawn 방식으로 시작한다.
- wrapper library와 `SecItemUpdate` 경로도 확인한다.
- query 전체나 `kSecValueData`를 출력하지 않는다.

#### backup 앱 domain 누락

- Bundle ID와 `AppDomain-<bundle-id>`를 확인한다.
- backup 종류, 앱의 설치 상태와 제외 설정을 확인한다.
- 암호화 local backup의 unlock 조건과 도구 지원을 확인한다.
- 개인 단말에서 새 전체 backup을 만들지 않는다.

#### log 출력 차이

- development·production build와 log level을 구분한다.
- `Logger`, `os_log`, `NSLog`, 자체 파일 logger를 각각 확인한다.
- process·subsystem filter가 지나치게 좁지 않은지 확인한다.

## 빠른 명령어 참조

단말·앱 기준:

Windows PowerShell:

```powershell
ideviceinfo -k ProductVersion
ideviceinfo -k ProductType
frida-ps -Uai | Select-String -Pattern 'target'
```

macOS:

```bash
frida-ps -Uai | grep -i target
codesign -d --entitlements :- Payload/Target.app
```

컨테이너·plist:

```bash
objection -g com.target.app explore
find '<APP_DATA>/Documents' '<APP_DATA>/Library' '<APP_DATA>/tmp' -type f
plutil -p '<APP_DATA>/Library/Preferences/com.target.app.plist'
plistutil -i evidence/com.target.app.plist -o evidence/com.target.app.xml
```

DB·정적 검색:

```bash
sqlite3 evidence/Model.sqlite ".tables"
sqlite3 evidence/Model.sqlite "SELECT name, sql FROM sqlite_master WHERE type='table';"
strings -a Payload/Target.app/Target | grep -iE 'UserDefaults|CoreData|SecItem|kSecAttrAccessible|UIPasteboard|NSFileProtection'
```

backup index:

```bash
sqlite3 evidence/backup/Manifest.db "SELECT fileID, relativePath, flags FROM Files WHERE domain='AppDomain-com.target.app' ORDER BY relativePath;"
```

## 관련 문서

- [iOS 환경 구축](setup-ios.md): 실기기·simulator, Frida, SSH와 USB forwarding
- [정적 분석](static-analysis.md): Info.plist·entitlement, storage API와 caller 식별
- [Frida 후킹 실무](frida-scripts.md): Keychain·Foundation API의 metadata 관찰
- [암호화·키 관리](crypto-keys.md): app-layer 암호화, key derivation과 hard-coded key
- [인증·세션](auth-mobile.md): 추출 token의 만료·폐기·재사용 확인
- [WebView 보안](webview-issues.md): cookie, LocalStorage와 WebKit cache
- [개인정보 노출](privacy-leakage.md): snapshot, log, Pasteboard와 화면 노출
- [Android 데이터 저장](data-storage-android.md): Android storage·Keystore·backup 흐름

## 참고자료

공식 문서와 테스트 가이드:

- [OWASP MASVS-STORAGE](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
- [OWASP MASTG - Data Protection Classes](https://mas.owasp.org/MASTG/tests/ios/MASVS-STORAGE/MASTG-TEST-0299/)
- [OWASP MASTG - Unencrypted Private Storage APIs](https://mas.owasp.org/MASTG/tests/ios/MASVS-STORAGE/MASTG-TEST-0300/)
- [OWASP MASTG - Unencrypted Shared Storage APIs](https://mas.owasp.org/MASTG/tests/ios/MASVS-STORAGE/MASTG-TEST-0303/)
- [OWASP MASTG - App Sandbox Directories](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-STORAGE/MASTG-KNOW-0108/)
- [OWASP MASTG - Backups](https://mas.owasp.org/MASTG/knowledge/ios/MASVS-STORAGE/MASTG-KNOW-0102/)
- [Apple Developer - Restricting keychain accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
- [Apple Developer - Keychain attribute keys](https://developer.apple.com/documentation/security/item-attribute-keys-and-values)
- [Apple Developer - Secure Enclave keys](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave)
- [Apple Platform Security - Data Protection classes](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)
- [Apple Platform Security - Keychain data protection](https://support.apple.com/guide/security/keychain-data-protection-secb0694df1a/web)
- [Apple Developer - File system usage](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively)
- [Apple Developer - Backup exclusion](https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey)
- [Apple Developer - UIPasteboard](https://developer.apple.com/documentation/uikit/uipasteboard)
- [Apple Developer - Unified Logging](https://developer.apple.com/documentation/os/logging)

보조 도구:

- [Objection](https://github.com/sensepost/objection)
- [libimobiledevice](https://libimobiledevice.org/)
