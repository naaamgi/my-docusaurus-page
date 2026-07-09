---
sidebar_position: 10
title: 데이터 저장소 점검 - Android
description: 모바일 진단 - Android SharedPreferences / SQLite / 파일 / Android Keystore / Scoped Storage / 백업 점검 절차와 판정 기준
keywords: [Data Storage, SharedPreferences, SQLite, Android Keystore, Scoped Storage, allowBackup, EncryptedSharedPreferences, Cache, MASVS-STORAGE]
draft: false
---

# 데이터 저장소 점검 - Android
> 앱이 단말 내에 저장하는 데이터 (자격증명 / 토큰 / 개인정보 / 결제 정보 등) 가 **평문 / 약한 암호화 / 부적절한 위치** 에 저장되는지 점검.
> 단말이 분실 / 탈취되거나 다른 앱이 같은 단말에 침투했을 때 어떤 데이터가 노출되는지 확인.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-STORAGE-1, 2 / MASTG-TEST-0001, 0003, 0004, 0010 |
| **CWE** | [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html), [CWE-922: Insecure Storage](https://cwe.mitre.org/data/definitions/922.html), [CWE-798: Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html) |
| **영향도** | 🔴 (자격증명 / 결제 / 주민번호 평문) / 🟡 (식별자 / 캐시 / 로그) |
| **점검 난이도** | 하 (앱 컨테이너 접근 + 파일 확인) ~ 중 (Frida 로 런타임 데이터 / Keystore 사용 후킹) |
| **예상 점검 시간** | 1 ~ 4시간 |

---

## 점검 목적

Android 앱은 (1) 앱 전용 컨테이너 (`/data/data/<pkg>/`), (2) 외부 저장소 (`/sdcard/`, Scoped Storage), (3) 시스템 서비스 (Keystore, Backup, Clipboard) 에 데이터를 저장한다. 점검은 **각 저장 위치에 어떤 데이터가 어떤 형태로 저장되는지** 확인 + **단말 탈취 시나리오** 에서 노출 정도 평가.

> **다른 페이지와 영역 분리**
> - iOS 데이터 저장소 점검 → `data-storage-ios.md`
> - 환경 구축 (앱 컨테이너 접근) → `setup-android.md`
> - 정적 분석 (저장 코드 위치 식별) → `static-analysis.md`
> - WebView 의 LocalStorage / Cookie → `webview-issues.md`

---

## 유형 구분 — 저장 위치별

| 위치 | 경로 | 점검 포인트 |
| :--- | :--- | :--- |
| **SharedPreferences** | `/data/data/<pkg>/shared_prefs/*.xml` | 평문 / 약한 암호화 / 자격증명 저장 |
| **SQLite DB** | `/data/data/<pkg>/databases/*.db` | 평문 DB / 약한 암호화 (SQLCipher 미사용) |
| **Internal Files** | `/data/data/<pkg>/files/`, `/cache/` | 평문 파일 / 캐시 누설 |
| **External Storage** | `/sdcard/Android/data/<pkg>/` (Scoped) 또는 `/sdcard/<dir>` (legacy) | 다른 앱 / 사용자 접근 가능성 |
| **Android Keystore** | 시스템 서비스 (HW/SW 보호) | 미사용 / 약한 사용 (UserAuthRequired 미적용) |
| **Backup** | `adb backup` (Android 12 미만) | `allowBackup="true"` + 평문 데이터 |
| **Clipboard** | 시스템 클립보드 | 자격증명 / OTP 복사 후 미정리 |
| **Logcat** | 시스템 로그 (Android 4.1+ 앱별 격리) | `Log.d` 의 민감 데이터 |
| **WebView 데이터** | `/data/data/<pkg>/app_webview/`, `/databases/webview*.db` | 쿠키 / LocalStorage / Cache (`webview-issues.md` 영역) |

---

## 진단 절차

### Step 1. 앱 컨테이너 진입 + 구조 파악

```bash
# 루팅 단말
adb shell
su
cd /data/data/com.target.app
ls -la
# cache/  code_cache/  databases/  files/  shared_prefs/  app_webview/  ...

# 비루팅 단말도 디버거블 빌드면 run-as 사용 가능
adb shell "run-as com.target.app ls -la /data/data/com.target.app"
```

**왜 이 단계가 필요한지**: 모든 후속 점검의 출발점. 이 단계가 안 되면 (`run-as` 도 막히고 루팅도 안 되면) 환경 자체를 다시 봐야 함 (`setup-android.md`).

### Step 2. 점검 흐름 — 사용자 액션 ↔ 저장 변화 매핑

```
1) 앱 새로 설치 후 컨테이너 스냅샷 1 (find . -type f > before.txt)
2) 로그인 / 주요 액션 수행 (결제, 정보 입력 등)
3) 컨테이너 스냅샷 2
4) diff 로 변경된 파일 식별 → 그 파일에 어떤 데이터가 들어갔는지 검사
```

**왜 이 흐름인지**: 단순히 컨테이너만 보면 어느 파일이 점검 대상인지 모른다. **사용자 액션 ↔ 저장 변화** 를 매핑해야 어떤 기능에서 어떤 데이터가 저장되는지 명확.

### Step 3. 각 위치별 점검
### Step 4. Keystore 사용 검증
암호화 키가 있어도 **Android Keystore 가 아닌 코드 / 파일에 저장**되어 있으면 의미 없음. Frida 로 Keystore API 호출을 추적해 사용 여부 확인.

---

## 페이로드 / 테스트 케이스

### 케이스 1: SharedPreferences 평문 저장

**언제 점검하는지**: 모든 앱. 가장 흔한 결함 위치.

```bash
# 점검
cat /data/data/com.target.app/shared_prefs/*.xml

# 자주 발견되는 평문 노출
<map>
    <string name="user_id">42</string>
    <string name="access_token">eyJhbGciOi...</string>           ← 토큰 평문
    <string name="refresh_token">rt_xxx...</string>              ← 동일
    <string name="username">victim@example.com</string>
    <string name="password">P@ssw0rd123</string>                  ← 비밀번호 평문 (드물지만 발견)
    <boolean name="auto_login" value="true"/>
    <string name="biometric_key">RAWKEYBYTES...</string>          ← 키 평문
</map>
```

**판정**: 위 항목 중 하나라도 발견되면 미흡 (Medium ~ High). **비밀번호 / 카드번호 / 주민번호 평문 발견 시 즉시 High**.

**오탐 주의**: `EncryptedSharedPreferences` (Jetpack Security) 사용 시 파일은 암호화되어 보이지만 **마스터 키가 Android Keystore 에 저장** 되면 안전. 파일이 암호문 (Base64) 형태고 키 흔적이 보이지 않으면 안전 가능성 높음 → Frida 로 키 위치 추가 검증.

### 케이스 2: SQLite DB 평문 저장

**언제 점검하는지**: 채팅 / 메모 / 거래 내역 / 캐시 등 구조화 데이터를 다루는 앱.

```bash
# 1) DB 파일 추출
adb pull /data/data/com.target.app/databases/main.db ./

# 2) sqlite3 로 조회
sqlite3 main.db ".tables"
sqlite3 main.db ".schema users"
sqlite3 main.db "SELECT * FROM users;"

# 자주 발견되는 평문 노출
# - users 테이블의 password / token / phone / national_id
# - messages 테이블의 본문 / 첨부파일 경로 / 발신자 정보
# - transactions 테이블의 카드 번호 / 거래 상세
```

**판정**: 평문 노출 시 미흡. 단, 일부 앱은 자체 암호화 컬럼 (Base64 + AES) 적용 — 파일 헤더 확인:

```bash
# SQLCipher 적용 여부 — 파일 시작이 "SQLite format 3" 이면 평문, 이상한 바이너리면 SQLCipher
file main.db
hexdump -C main.db | head -1
```

**SQLCipher 적용 시 우회 시도** (실무 표준):

```javascript
// Frida — net.sqlcipher.database.SQLiteDatabase.openOrCreateDatabase 후킹해서 키 추출
Java.perform(function () {
    var DB = Java.use('net.sqlcipher.database.SQLiteDatabase');
    DB.openOrCreateDatabase.overload('java.io.File', 'java.lang.String',
        'net.sqlcipher.database.SQLiteDatabase$CursorFactory',
        'net.sqlcipher.DatabaseErrorHandler').implementation = function (f, key, cf, eh) {
            console.log('[+] SQLCipher key: ' + key);
            return this.openOrCreateDatabase(f, key, cf, eh);
        };
});
```

**판정**: 키가 Frida 로 노출되면 **키가 메모리 / 코드에 평문 존재** → SQLCipher 적용은 됐지만 키 보호가 미흡 → Medium. 키가 Keystore 에서만 풀리고 메모리에서 즉시 폐기되는 구조라야 안전.

### 케이스 3: Internal Files / Cache 평문

**언제 점검하는지**: 토큰 캐시 / 사용자 프로필 / 다운로드 / 임시 파일.

```bash
# 점검
find /data/data/com.target.app/files -type f
find /data/data/com.target.app/cache -type f

# 자주 발견되는 결함
- /files/auth_state.json    → access_token / refresh_token 평문
- /files/user_profile.json  → 이름 / 주민번호 / 주소
- /cache/img_*              → 다운로드 이미지 (개인정보 포함 가능)
- /files/*.log              → 디버그 로그 (자격증명 / 요청 본문)
```

**판정**: 평문 자격증명 / 개인정보 → Medium ~ High.

### 케이스 4: External Storage
**언제 점검하는지**: 첨부파일 / 다운로드 / 사진 저장 기능. Android 11+ 의 Scoped Storage 가 적용 안 된 케이스.

```bash
# Scoped Storage (Android 10+) 표준 위치 — 앱 자신만 접근
ls /sdcard/Android/data/com.target.app/files/

# Legacy (Android 9 이하 또는 requestLegacyExternalStorage) — 다른 앱 접근 가능
ls /sdcard/Pictures/TargetApp/
ls /sdcard/Download/target_*
```

**점검 항목:**

```
- AndroidManifest.xml 의 android:requestLegacyExternalStorage="true" 사용 (Android 10 호환용)
- /sdcard 의 앱별 디렉토리 외에 데이터 저장 (다른 앱 접근 가능)
- 외부 저장소에 토큰 / 개인정보 / 백업 파일 저장
```

**판정**: 외부 저장소에 자격증명 / 개인정보 평문 저장 → 미흡 (다른 앱이 `READ_EXTERNAL_STORAGE` 권한으로 접근 가능). Scoped Storage 위반 + 민감 데이터 = Medium ~ High.

### 케이스 5: Android Keystore 미사용 / 약한 사용

**언제 점검하는지**: 앱이 자체 암호화를 표방하는데 키 보호가 의심되는 경우. 모든 결제 / 인증 앱 점검 시 표준 항목.

**Frida 로 Keystore API 호출 추적:**

```javascript
// Keystore 사용 여부 확인
Java.perform(function () {
    var KeyStore = Java.use('java.security.KeyStore');
    KeyStore.getInstance.overload('java.lang.String').implementation = function (type) {
        console.log('[+] KeyStore.getInstance: ' + type);
        // type 이 "AndroidKeyStore" 면 정상 사용
        // type 이 "BKS", "PKCS12" 등이면 자체 키 저장소 (보호 약함)
        return this.getInstance(type);
    };

    var KeyGenerator = Java.use('javax.crypto.KeyGenerator');
    KeyGenerator.getInstance.overload('java.lang.String').implementation = function (alg) {
        console.log('[+] KeyGenerator: ' + alg);
        return this.getInstance(alg);
    };
});
```

**점검 항목:**

```
- KeyStore.getInstance("AndroidKeyStore") 호출 여부          → 미사용 시 미흡
- KeyGenParameterSpec.Builder 의 옵션:
    .setUserAuthenticationRequired(true)                     ← 생체/PIN 인증 후에만 키 사용 (권장)
    .setInvalidatedByBiometricEnrollment(true)               ← 지문 추가 시 키 무효화 (권장)
    .setUnlockedDeviceRequired(true)                         ← 잠금 해제 상태에서만 (권장)
    .setKeySize(256), .setBlockModes(GCM), .setEncryptionPaddings(NONE)  ← AES-GCM 권장
- HW-backed 여부 확인 (StrongBox / TEE)
```

**판정**: AndroidKeyStore 미사용 / `UserAuthenticationRequired` 미적용 / 약한 알고리즘 (DES, ECB, MD5) 사용 → 미흡.

### 케이스 6: `allowBackup="true"`
**언제 점검하는지**: AndroidManifest 점검 시. Android 12+ 단말에서는 영향 축소되었지만 11 이하 단말 대응 필요.

```bash
# 매니페스트 확인
grep -i "allowBackup" target-decoded/AndroidManifest.xml
# android:allowBackup="true"     ← 위험
# 실제 백업 시도
adb backup -noapk com.target.app -f target.ab
# 단말에서 "백업" 버튼 탭
# target.ab 가 0 바이트 아니면 백업 가능

# 추출
dd if=target.ab bs=1 skip=24 | openssl zlib -d > target.tar
# 일부 단말은 zlib 대신 raw — 헤더 확인
tar -xvf target.tar
# apps/com.target.app/ 의 sp/, db/, f/ 추출 → 케이스 1~3 와 동일 점검
```

**판정**: `allowBackup="true"` + 민감 데이터 평문 → 미흡 (구단말). 신규 앱은 `android:dataExtractionRules` (Android 12+) 로 세밀 제어 권장.

### 케이스 7: 클립보드 / Logcat / Toast — 부수 노출

**Logcat:**

```bash
# Android 4.1+ 부터 다른 앱 로그는 안 보이지만, READ_LOGS 권한 / 점검 단말은 전체 보임
adb logcat -d | grep -i "com.target.app"

# 자주 발견
- Log.d("API", "request body: {\"password\":\"...\"}")  ← 디버그 로그에 자격증명
- Log.d("Auth", "token=eyJ...")                          ← 토큰 노출
```

**클립보드:**

```javascript
// Frida — ClipboardManager.setPrimaryClip 후킹
Java.perform(function () {
    var ClipboardManager = Java.use('android.content.ClipboardManager');
    ClipboardManager.setPrimaryClip.implementation = function (clip) {
        console.log('[+] Clipboard set: ' + clip.toString());
        return this.setPrimaryClip(clip);
    };
});

// 점검: OTP / 자격증명 / 카드번호를 클립보드에 복사하는데 일정 시간 후 자동 정리 안 됨 → 미흡
```

**판정**: Logcat 에 민감 데이터 / 클립보드에 OTP·카드 자동 정리 미적용 → Medium.

### 그 외 — 한 줄 언급

- **Companion 앱 / Cross-Backup** — 거의 사용 안 됨. 발견 시 별도 점검
- **MediaStore (사진 / 영상)** — Scoped Storage 위반 케이스로 케이스 4 와 동일 점검
- **WorkManager / SyncAdapter 캐시** — 위치는 `/data/data/<pkg>/databases/` 의 `androidx.work.workdb` — 케이스 2 와 동일

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약 / 미흡:

- [ ] SharedPreferences / SQLite / 파일에 **자격증명 / 토큰 / 카드 / 주민번호** 평문 저장
- [ ] AndroidKeystore 미사용 (자체 키 저장소 또는 코드 / 파일에 키 보관)
- [ ] Keystore 사용은 했으나 `UserAuthenticationRequired` / `UnlockedDeviceRequired` 미적용
- [ ] 약한 알고리즘 (DES / 3DES / RC4 / MD5 / SHA1) 또는 ECB 모드 사용
- [ ] 외부 저장소 (`/sdcard/`) 에 민감 데이터 저장 + Scoped Storage 미적용
- [ ] `allowBackup="true"` (Android 12 미만 대응 필요한 앱) + 민감 데이터
- [ ] Logcat 에 자격증명 / 토큰 / 요청 본문 등 민감 데이터 출력
- [ ] 클립보드에 OTP / 카드번호 복사 후 자동 정리 미적용

**오탐 주의:**

- [ ] `EncryptedSharedPreferences` (Jetpack Security) 사용 시 파일이 암호문이면 안전 가능성 높음 — Frida 로 키 위치 추가 검증
- [ ] 일부 식별자 (UUID / 세션 ID) 는 평문이어도 단독으론 무영향 — 결합 시나리오 평가
- [ ] 캐시 이미지 / 임시 파일은 통상 무영향 — 단, 결제 영수증 / 신분증 사진 등은 민감

---

## 다른 페이지로 위임

- **iOS 데이터 저장소** → `data-storage-ios.md`
- **앱 컨테이너 접근 (루팅 / run-as)** → `setup-android.md`
- **저장 코드 위치 식별 (jadx)** → `static-analysis.md`
- **Frida 로 런타임 후킹 / 키 추출** → `frida-scripts.md`
- **WebView 의 LocalStorage / Cookie** → `webview-issues.md`
- **백업 / 자격증명 흐름의 인증 결함** → 본 페이지 + `setup-android.md`

---

## 참고자료

- [OWASP MASVS-STORAGE](https://mas.owasp.org/MASVS/05-MASVS-STORAGE/)
- [OWASP MASTG - Testing Data Storage (Android)](https://mas.owasp.org/MASTG/0x05d-Testing-Data-Storage/)
- [OWASP MASTG-TEST-0001 - Local Storage for Sensitive Data](https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0001/)
- [Android - Jetpack Security (EncryptedSharedPreferences)](https://developer.android.com/topic/security/data)
- [Android - Keystore System](https://developer.android.com/training/articles/keystore)
- [Android - Scoped Storage](https://developer.android.com/training/data-storage)
- [Android - Backup and restore](https://developer.android.com/guide/topics/data/autobackup)
- [SQLCipher for Android](https://www.zetetic.net/sqlcipher/sqlcipher-for-android/)
- [HackTricks - Android Local Storage](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting#insecure-data-storage)
- [PCI-DSS Requirement 3 - Protect Stored Account Data](https://www.pcisecuritystandards.org/document_library/)
