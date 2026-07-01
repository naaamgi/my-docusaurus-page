---
sidebar_position: 11
title: 데이터 저장소 점검 - iOS (Data Storage / iOS)
description: 모바일 진단 - iOS NSUserDefaults / Keychain / plist / Core Data / Data Protection / 백업 / 클립보드 점검 + PoC + 대응방안
keywords: [Data Storage, NSUserDefaults, Keychain, plist, Core Data, Data Protection, NSFileProtection, kSecAttrAccessible, UIPasteboard, MASVS-STORAGE, iOS]
draft: false
---

# 데이터 저장소 점검 - iOS (Data Storage / iOS)

> iOS 앱이 단말 내 컨테이너 / Keychain / 클립보드 / 시스템 로그 등에 저장하는 데이터가 **평문 / 약한 보호 / 부적절한 보호 클래스** 인지 점검.
> 탈옥 단말 / 백업 추출 / 단말 분실 시나리오에서 어떤 데이터가 노출되는지 확인.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-STORAGE-1, 2 / MASTG-TEST-0011, 0012, 0013, 0014 |
| **CWE** | [CWE-312: Cleartext Storage](https://cwe.mitre.org/data/definitions/312.html), [CWE-922: Insecure Storage](https://cwe.mitre.org/data/definitions/922.html), [CWE-311: Missing Encryption](https://cwe.mitre.org/data/definitions/311.html) |
| **영향도** | 🔴 (Keychain 외 자격증명/카드/주민번호 평문) / 🟡 (식별자/캐시/로그) |
| **점검 난이도** | 하 (컨테이너 직접 확인) ~ 중 (Frida 로 Keychain Access Control / 암호화 호출 후킹) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

iOS 앱은 (1) 앱 컨테이너 (`Documents/`, `Library/`, `tmp/`), (2) Keychain (시스템 보안 저장소), (3) 클립보드, (4) 시스템 로그 (Unified Logging) 에 데이터를 저장. **Keychain 외 컨테이너 데이터는 단말 잠금 PIN 만 풀리면 (또는 탈옥 시) 즉시 접근 가능** 하므로, 자격증명 / 카드 / 개인정보는 반드시 Keychain + 적절한 Access Control 사용.

> **다른 페이지와 영역 분리**
> - Android 데이터 저장소 → `data-storage-android.md`
> - 환경 구축 (탈옥 + SSH 컨테이너 접근) → `setup-ios.md`
> - 정적 분석 (저장 코드 위치) → `static-analysis.md`
> - WebView 의 LocalStorage / Cookie → `webview-issues.md`

---

## 유형 구분 — 저장 위치별

| 위치 | 경로 | 점검 포인트 |
| :--- | :--- | :--- |
| **NSUserDefaults** | `Library/Preferences/<bundle_id>.plist` | 평문 plist — 자격증명 / 토큰 저장 |
| **plist 파일** | `Documents/*.plist`, `Library/*.plist` | 동일 — 평문 직렬화 |
| **Documents/** | `Documents/` | 사용자 파일 / 다운로드 / 영수증 등 — iTunes 백업 대상 |
| **Library/** | `Library/Application Support/`, `Library/Caches/` | 앱 데이터 / 캐시 |
| **tmp/** | `tmp/` | 임시 파일 — 자동 정리 안 됨 |
| **Core Data** | `Library/Application Support/*.sqlite` | SQLite 기반 — 기본 미암호화 |
| **Keychain** | 시스템 서비스 | 미사용 / 약한 Access Control / 잘못된 보호 클래스 |
| **Data Protection** | NSFileProtection 클래스 | `Complete` / `CompleteUnlessOpen` / `CompleteUntilFirstUserAuthentication` / `None` |
| **UIPasteboard** | 시스템 클립보드 | OTP / 카드 자동 정리 미적용 |
| **Unified Logging** | `os_log` 등 시스템 로그 | 자격증명 / 요청 본문 노출 |
| **백업** | iCloud / iTunes Backup | 민감 항목 backup-exclusion 미적용 |

---

## 진단 절차

### Step 1. 앱 컨테이너 진입

```bash
# 탈옥 단말 (setup-ios.md 환경) + SSH
ssh root@<단말IP>
# 또는 USB 포워딩: iproxy 2222 22 → ssh root@127.0.0.1 -p 2222

# 앱 컨테이너 위치는 매번 무작위 (UUID 디렉토리)
ls /var/mobile/Containers/Data/Application/ | head -5
# 5E5C5..../
# 7AAA0..../
# ...

# 앱 식별자로 정확한 컨테이너 찾기 (objection 사용 — 가장 빠름)
objection -g com.target.app explore
> env
# Bundle Path:    /var/containers/Bundle/Application/<UUID>/TargetApp.app
# Documents:      /var/mobile/Containers/Data/Application/<UUID>/Documents
# Library:        /var/mobile/Containers/Data/Application/<UUID>/Library
# Caches:         /var/mobile/Containers/Data/Application/<UUID>/Library/Caches
# tmp:            /var/mobile/Containers/Data/Application/<UUID>/tmp
```

**왜 이 단계가 필요한지**: iOS 는 앱 컨테이너 경로가 매번 무작위 UUID — 정적 매핑 안 됨. `objection env` 가 가장 빠른 식별 방법.

### Step 2. 사용자 액션 ↔ 저장 변화 매핑

```bash
# 1) 앱 신규 설치 후 스냅샷 1
find <컨테이너> -type f > before.txt

# 2) 로그인 / 결제 등 액션 수행

# 3) 스냅샷 2
find <컨테이너> -type f > after.txt

# 4) diff
diff before.txt after.txt
```

### Step 3. 각 위치별 점검 (케이스 1~7)

### Step 4. Keychain 사용 / Access Control 검증 (Frida)

Keychain 사용 여부 + 항목별 `kSecAttrAccessible` 옵션 확인.

---

## 페이로드 / 테스트 케이스

### 케이스 1: NSUserDefaults 평문 저장

**언제 점검하는지**: 모든 앱 — Android 의 SharedPreferences 와 같은 위치. 자주 평문 자격증명 저장.

```bash
# 위치: Library/Preferences/<bundle_id>.plist
plutil -convert xml1 -o - Library/Preferences/com.target.app.plist | less

# 자주 발견되는 평문 노출 (XML 변환 후)
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>username</key><string>victim@example.com</string>
    <key>password</key><string>P@ssw0rd123</string>           <!-- 위험 -->
    <key>access_token</key><string>eyJhbGciOi...</string>     <!-- 위험 -->
    <key>refresh_token</key><string>rt_xxx...</string>
    <key>last_session_at</key><date>2026-05-13T...</date>
    <key>is_logged_in</key><true/>
</dict>
</plist>
```

**판정**: 비밀번호 / 토큰 / 카드번호 평문 → High. NSUserDefaults 는 **암호화 저장소가 아님** — 식별자 / 환경설정 외엔 사용 금지.

### 케이스 2: Documents / Library / tmp 파일 평문

**언제 점검하는지**: 앱 사용 중 생성되는 파일 (영수증 / 채팅 첨부 / 캐시 / 직렬화 등).

```bash
# 컨테이너 전체 스캔
find <컨테이너> -type f -name "*.plist" -o -name "*.json" -o -name "*.sqlite" -o -name "*.db" -o -name "*.log"

# 자주 발견
- Documents/receipts/2026_05_*.pdf       → 결제 영수증 (개인정보)
- Library/Application Support/auth.json  → 자격증명 / 토큰
- Library/Caches/<bundle>.sqlite          → URLCache (응답 본문 평문 — Bearer 토큰)
- tmp/*                                   → 임시 파일 (자동 정리 안 됨)
```

**판정**: 위 파일에 토큰 / 개인정보 / 카드 평문이면 미흡. **`Library/Caches/<bundle_id>.sqlite` 는 URLCache 기본 위치 — 응답 본문이 캐싱되면서 Bearer 토큰까지 평문 저장되는 케이스 빈번** → 별도 확인.

### 케이스 3: Core Data (SQLite) 평문

**언제 점검하는지**: 채팅 / 메모 / 거래 내역 등 구조화 데이터.

```bash
# Core Data 기본 위치
find Library/Application\ Support -name "*.sqlite" -o -name "*.sqlite-wal" -o -name "*.sqlite-shm"

# 추출 + 조회 (PC 로 pull)
scp -P 2222 root@127.0.0.1:/var/mobile/Containers/Data/Application/<UUID>/Library/Application\ Support/Model.sqlite ./
sqlite3 Model.sqlite ".tables"
sqlite3 Model.sqlite "SELECT * FROM ZMESSAGES;"
```

**판정**: 메시지 본문 / 카드번호 / 개인정보 평문 → 미흡. iOS Core Data 는 **기본 미암호화** — `NSPersistentStoreFileProtectionKey: FileProtectionType.complete` 또는 SQLCipher 적용 필요.

### 케이스 4: Keychain — 미사용 / 약한 Access Control

**왜 Keychain 이 표준인지**: Keychain 은 시스템 보안 저장소 + Secure Enclave 결합 + 보호 클래스 (`kSecAttrAccessible*`) + Access Control (생체 / Passcode) 결합 가능. **자격증명 / 토큰 / 결제 정보는 반드시 Keychain**.

**Frida 로 Keychain 사용 추적:**

```javascript
// frida-scripts.md 패턴 4 의 SecItemAdd / SecItemCopyMatching 후킹
if (ObjC.available) {
    Interceptor.attach(Module.findExportByName('Security', 'SecItemAdd'), {
        onEnter: function (args) {
            var query = new ObjC.Object(args[0]);
            console.log('[+] SecItemAdd');
            console.log(query.toString());
        }
    });
    Interceptor.attach(Module.findExportByName('Security', 'SecItemCopyMatching'), {
        onEnter: function (args) {
            var query = new ObjC.Object(args[0]);
            console.log('[+] SecItemCopyMatching');
            console.log(query.toString());
        }
    });
}
```

**판정 항목 — 로그에서 확인:**

```
[+] SecItemAdd
{
    "class" = genp;                                        ← kSecClassGenericPassword
    "acct" = "access_token";                               ← 항목명
    "v_Data" = <ENCRYPTED>;
    "pdmn" = "ak";                                         ← kSecAttrAccessible
                                                              "ak"  = WhenUnlocked (단말 잠금 해제 시)
                                                              "cku" = WhenUnlockedThisDeviceOnly (백업 제외, 권장)
                                                              "akpu"= WhenPasscodeSetThisDeviceOnly (가장 강함)
                                                              "ak~" = AfterFirstUnlock (재부팅 후 1회 잠금 해제)
                                                              "dk"  = AlwaysThisDeviceOnly (deprecated, 위험)
    "u_AccCtrl" = <SecAccessControlRef>;                   ← 있으면 생체/Passcode 결합
    "u_AccGrp" = "TEAMID.com.target.app";                  ← Keychain Access Group
}
```

**판정**:

- [ ] Keychain **미사용** (NSUserDefaults / 파일에 토큰 / 자격증명 저장) → 미흡
- [ ] `kSecAttrAccessibleAlways` / `kSecAttrAccessibleAlwaysThisDeviceOnly` 사용 → 미흡 (deprecated, 잠금 무관)
- [ ] **`ThisDeviceOnly` 미적용** (백업으로 다른 단말 복원 시 노출 가능) → 미흡
- [ ] Access Control (`SecAccessControlCreateWithFlags` + Biometric / Passcode) 미적용 (고민감 데이터인 경우) → 미흡

### 케이스 5: 단말 백업 추출 (iTunes Backup)

**언제 점검하는지**: iCloud / iTunes 백업이 활성화된 단말. 백업 파일로 자격증명 / 데이터 추출 가능 여부 확인.

```bash
# macOS Finder 또는 iTunes 로 단말 백업 (암호화 X 옵션)
# 백업 위치: ~/Library/Application Support/MobileSync/Backup/<UUID>/

# iOS 백업 추출 도구
# - libimobiledevice idevicebackup2 (CLI)
# - iMazing (GUI, 상용)

# 백업 내 앱 컨테이너 파일은 인덱싱돼 있어 직접 path 매핑 안 됨
# Manifest.db 의 fileID 검색으로 추출

# 도구 예: iMazing → Apps → TargetApp → Documents 등 직접 노출
```

**점검 항목:**

```
- 비암호화 백업에 자격증명 / 토큰 / 개인정보 노출됨 (백업 평문 가능)
- Keychain 항목 중 ThisDeviceOnly 가 아닌 항목은 백업에 복호화 가능 형태로 포함
- 민감 파일 (Documents/* 등) 이 backup-exclusion 미적용
```

**판정**: 백업에서 토큰 / 개인정보 평문 확인 → 미흡. 단, **암호화 백업은 사용자가 패스워드 설정 시 안전** — 점검 시 비암호화 백업 환경 가정.

### 케이스 6: UIPasteboard (클립보드) — OTP / 카드 자동 정리

**언제 점검하는지**: OTP 전송 / 카드번호 입력 후 자동 복사 / 인증코드 처리.

```javascript
// Frida — UIPasteboard.setString 후킹
if (ObjC.available) {
    var UIPasteboard = ObjC.classes.UIPasteboard;
    Interceptor.attach(UIPasteboard['- setString:'].implementation, {
        onEnter: function (args) {
            var s = ObjC.Object(args[2]).toString();
            console.log('[+] UIPasteboard.setString: ' + s);
        }
    });
}
```

**판정**:

- 자격증명 / OTP / 카드번호를 클립보드 복사 + 일정 시간 후 자동 정리 X → Medium
- iOS 14+ 의 클립보드 알림 (다른 앱이 읽으면 사용자에게 알림) 자체는 안전 신호지만, **정리 자체는 앱 책임**

### 케이스 7: 시스템 로그 (Unified Logging)

```bash
# 단말 로그 (Console.app 또는 idevicesyslog)
idevicesyslog | grep -i "com.target.app"

# 자주 발견
- NSLog(@"login req: %@", body)              → 본문에 자격증명
- os_log(OS_LOG_DEFAULT, "token = %@", t)   → 토큰 노출
```

**판정**: Release 빌드에 NSLog / os_log 가 민감 데이터 출력 → Medium.

### 그 외 — 한 줄 언급

- **iCloud Drive / iCloud Keychain 동기화** — 사용자 환경 변수. 점검 대상 앱이 의도적 / 비의도적 동기화 시 별도 점검
- **Snapshot 캐시** (`Library/Caches/Snapshots/`) — 앱 백그라운드 진입 시 스크린샷 캐시. 민감 화면이 캐시되면 사진앱처럼 노출 가능 → `application(_:didEnterBackground:)` 에서 화면 가림 처리
- **Spotlight Indexing** — `Documents/` 의 파일이 검색 결과에 노출 가능. 민감 파일은 `NSURLIsExcludedFromBackupKey` 외 별도 처리

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약 / 미흡:

- [ ] NSUserDefaults / plist / 파일에 **자격증명 / 토큰 / 카드 / 주민번호** 평문 저장
- [ ] Keychain 미사용 (자격증명을 NSUserDefaults / 파일에 저장)
- [ ] Keychain 사용했으나 `kSecAttrAccessibleAlways` / `WhenUnlocked` (ThisDeviceOnly 미적용)
- [ ] 고민감 데이터 (결제 PIN / 비밀번호) 에 Access Control (Biometric / Passcode) 미적용
- [ ] Core Data SQLite 가 평문 (FileProtection.complete 미적용 + 암호화 X)
- [ ] `Library/Caches/<bundle>.sqlite` (URLCache) 에 Bearer 토큰 등 평문 응답 캐싱
- [ ] 클립보드에 OTP / 카드번호 복사 후 자동 정리 미적용
- [ ] Release 빌드의 시스템 로그에 자격증명 / 토큰 / 본문 출력
- [ ] Documents 의 민감 파일이 백업 제외 (`isExcludedFromBackupKey`) 미적용 + ThisDeviceOnly 미적용 → 비암호화 백업으로 추출 가능

**오탐 주의:**

- [ ] iOS 의 Data Protection (NSFileProtectionComplete) 가 적용되어 있고 단말 잠금 상태면 컨테이너 파일도 암호화 — 잠금 상태 + Data Protection 조합 시 안전 (단, 점검자가 잠금 해제 후 보는 환경은 가정 자체가 다름)
- [ ] 일부 식별자 (UUID / 디바이스 ID) 는 평문이어도 단독 영향 적음 — 결합 시 평가
- [ ] 캐시 이미지 / 임시 파일은 통상 무영향 — 결제 영수증 / 신분증 사진은 민감

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Data Storage / iOS] NSUserDefaults 에 access_token 평문 저장

1. `setup-ios.md` 의 탈옥 단말 환경 셋업 완료
2. 점검 대상 앱 (`com.target.app`) 신규 설치 → 로그인 수행
3. `objection env` 로 컨테이너 위치 식별 → `Library/Preferences/com.target.app.plist` 직접 확인

**1차 — 컨테이너 진입:**

```bash
$ objection -g com.target.app explore
on (iPhone: 17.x) [usb] # env
Documents:    /var/mobile/Containers/Data/Application/5E5C5.../Documents
Library:      /var/mobile/Containers/Data/Application/5E5C5.../Library
```

**2차 — plist 추출 + 평문 노출 확인:**

```bash
$ scp -P 2222 root@127.0.0.1:/var/mobile/Containers/Data/Application/5E5C5.../Library/Preferences/com.target.app.plist ./

$ plutil -convert xml1 -o - com.target.app.plist
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>username</key><string>victim@example.com</string>
    <key>password</key><string>P@ssw0rd123</string>
    <key>access_token</key><string>eyJhbGciOiJIUzI1NiIs...</string>
    <key>refresh_token</key><string>rt_a1b2c3...</string>
    <key>auto_login</key><true/>
</dict>
</plist>
```

**확인 사항:**
- NSUserDefaults 에 비밀번호 / 액세스 토큰 / 리프레시 토큰 모두 평문 저장
- 단말 분실 / 탈취 / 백업 추출 시 즉시 자격증명 + 세션 노출
- NSUserDefaults 는 암호화 저장소가 아님 — Keychain 사용 필요
- 안전 패턴: Keychain (`kSecClassGenericPassword`) + `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` + SecAccessControl (Biometric) + 비밀번호 저장 자체 금지

---

### PoC 2 — [Data Storage / iOS] Keychain 사용은 했지만 약한 Access Control

1. Frida 로 SecItemAdd 호출 후킹
2. 추출된 query 에서 `pdmn = "ak"` 확인 → `kSecAttrAccessibleWhenUnlocked` (ThisDeviceOnly 미적용)
3. 비암호화 백업으로 단말 외 복원 가능

**1차 — Frida 후킹 로그:**

```
[+] SecItemAdd
{
    "class"      = genp;
    "acct"       = "biometric_secret";
    "svce"       = "com.target.app";
    "v_Data"     = <0a1b2c3d ...>;
    "pdmn"       = "ak";                     ← WhenUnlocked (백업 가능 + 다른 단말 복원 가능)
    "u_AccCtrl"  = (null);                   ← Access Control 미설정
}
```

**확인 사항:**
- Keychain 사용은 했으나 `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` (`cku`) 또는 `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` (`akpu`) 미적용
- 비암호화 백업으로 추출 시 다른 단말로 복원 가능 → 자격증명 단말 의존성 부재
- 고민감 항목 (생체 인증 시크릿) 에 SecAccessControl (Biometric / Passcode) 미결합
- 안전 패턴: `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` + `SecAccessControlCreateWithFlags(kSecAccessControlBiometryAny | kSecAccessControlPrivateKeyUsage)`

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 — 자격증명 / 결제 / 주민번호 평문은 탈취 / 백업 추출 / 탈옥 환경에서 즉시 노출
- **무결성 (Integrity)**: 🟡 — 평문 저장 + 단말 root 시 변조 가능
- **추가 위협**:
  - 단말 분실 + 잠금 PIN 노출 (Shoulder Surfing) → 컨테이너 데이터 즉시 노출
  - 비암호화 iTunes 백업 추출 → 다른 단말 복원 + 자격증명 탈취
  - iCloud 백업 노출 (계정 유출) → 동일
  - Keychain ThisDeviceOnly 미적용 항목은 백업 / 복원으로 단말 의존성 상실
  - PCI-DSS / 개인정보보호법 / 전자금융감독규정 위반

**비즈니스 임팩트:**
iOS 의 Keychain + Data Protection 은 OS 가 제공하는 강력한 저장 보호 체계 — 미사용 / 약한 설정 시 OS 의 모든 보호 효과가 사라진다. 결제 / 금융 / 의료 앱은 **Keychain + ThisDeviceOnly + Access Control (Biometric)** 결합이 표준 점검 항목.

---

## 대응방안

### 개발자 관점

1. **자격증명 / 토큰 / 결제정보는 반드시 Keychain** — NSUserDefaults / 파일 사용 금지.

   ```swift
   import LocalAuthentication

   var error: Unmanaged<CFError>?
   let access = SecAccessControlCreateWithFlags(
       nil,
       kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,   // 가장 강한 보호 클래스
       [.biometryCurrentSet, .privateKeyUsage],           // 현재 등록된 생체 + 키 사용 시 인증
       &error
   )!

   let query: [String: Any] = [
       kSecClass as String:               kSecClassGenericPassword,
       kSecAttrService as String:         "com.target.app",
       kSecAttrAccount as String:         "refresh_token",
       kSecValueData as String:           token.data(using: .utf8)!,
       kSecAttrAccessControl as String:   access,
   ]
   SecItemAdd(query as CFDictionary, nil)
   ```

2. **보호 클래스 선택 가이드:**

   ```
   kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly      ← 고민감 (결제 PIN, 비밀번호) — 가장 강함
   kSecAttrAccessibleWhenUnlockedThisDeviceOnly         ← 일반 토큰 / 자격증명 — 백업 제외
   kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly     ← 백그라운드 작업 필요 (푸시 등) — 재부팅 후 1회 잠금 해제 필요
   kSecAttrAccessibleWhenUnlocked                       ← 일반 — 백업 가능 (권장 아님)
   kSecAttrAccessibleAlways*                            ← deprecated / 금지
   ```

3. **Core Data / 파일 — Data Protection 적용:**

   ```swift
   // Core Data store 옵션
   let storeOptions: [AnyHashable: Any] = [
       NSPersistentStoreFileProtectionKey: FileProtectionType.complete
   ]

   // 일반 파일 쓰기
   try data.write(to: url, options: [.completeFileProtection])
   ```

4. **민감 파일 백업 제외:**

   ```swift
   var url = documentsURL.appendingPathComponent("secret.dat")
   var values = URLResourceValues()
   values.isExcludedFromBackup = true
   try url.setResourceValues(values)
   ```

5. **URLCache 의 응답 캐싱 — Bearer 토큰 응답은 캐시 금지:**

   ```swift
   var request = URLRequest(url: url)
   request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
   // 또는 URLSessionConfiguration.default.urlCache = nil
   ```

6. **클립보드 — OTP / 카드는 자동 정리:**

   ```swift
   UIPasteboard.general.setObjects([code as NSString],
       localOnly: true,
       expirationDate: Date().addingTimeInterval(60))  // iOS 10+ 자동 만료
   ```

7. **로그 — Release 빌드 비활성화 + 민감 데이터 마스킹:**

   ```swift
   #if DEBUG
       os_log("login: %{public}@", username)
   #else
       os_log("login: %{private}@", username)   // %{private} 는 시스템 로그에서 마스킹
   #endif
   ```

8. **백그라운드 진입 시 화면 가림 (Snapshot 캐시 보호):**

   ```swift
   func applicationDidEnterBackground(_ application: UIApplication) {
       // 민감 화면 위에 blur view 추가
   }
   ```

### 운영자 관점

1. **MDM 정책 — 단말 패스코드 / 생체인증 강제** — 사내 단말 표준.
2. **백업 정책** — iCloud / iTunes 백업 모니터링, 민감 앱은 backup-exclusion 정책 권고.

### 위험 / 안전 코드 비교

```swift
// 위험 — NSUserDefaults
UserDefaults.standard.set(token, forKey: "access_token")          // 평문 plist

// 위험 — 약한 보호 클래스
let query: [String: Any] = [
    kSecClass as String:        kSecClassGenericPassword,
    kSecAttrAccount as String:  "token",
    kSecValueData as String:    token.data(using: .utf8)!,
    kSecAttrAccessible as String: kSecAttrAccessibleAlways          // ← deprecated
]

// 안전 — Keychain + 강한 보호 + Access Control (위 1번 예시 참조)
```

---

## 다른 페이지로 위임

- **Android 데이터 저장소** → `data-storage-android.md`
- **컨테이너 접근 / SSH** → `setup-ios.md`
- **저장 코드 위치 식별** → `static-analysis.md`
- **Frida 로 Keychain 호출 후킹 / 키 추출** → `frida-scripts.md`
- **WebView 의 LocalStorage / Cookie / WebKit cache** → `webview-issues.md`

---

## 참고자료

- [OWASP MASVS-STORAGE](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
- [OWASP MASTG - Testing Data Storage (iOS)](https://mas.owasp.org/MASTG/0x06d-Testing-Data-Storage/)
- [OWASP MASTG-TEST-0011 - Local Data Storage (iOS)](https://mas.owasp.org/MASTG/tests/ios/MASVS-STORAGE/MASTG-TEST-0011/)
- [Apple - Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Apple - Keychain Item Accessibility](https://developer.apple.com/documentation/security/keychain_services/keychain_items/restricting_keychain_item_accessibility)
- [Apple - Protecting App Data with Data Protection](https://developer.apple.com/documentation/uikit/protecting_the_user_s_privacy/encrypting_your_app_s_files)
- [Apple - LocalAuthentication / SecAccessControl](https://developer.apple.com/documentation/localauthentication)
- [HackTricks - iOS Data Storage](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting#testing-data-storage)
- [Objection - iOS Keychain Dump](https://github.com/sensepost/objection/wiki/Using-objection)
