---
sidebar_position: 21
title: 코드·의존성 품질
description: 모바일 릴리스 빌드의 입력 검증, 오류 처리, 의존성, 플랫폼 지원, Native 메모리 안전성을 확인하는 실무 노트
keywords: [MASVS-CODE, Input Validation, SQL Injection, Path Traversal, Dependency, SBOM, Native Memory Safety, Release Build]
toc_max_heading_level: 3
draft: false
---

> TODO나 로그 개수를 세는 문서가 아니다. **신뢰하지 않는 입력이 위험한 기능에 도달하는 경로**, 운영 빌드의 진단 기능, 취약 의존성과 Native 메모리 오류처럼 실제 보안 경계를 약화시키는 품질을 확인한다.

## 사용 시점

- 스토어·고객사 배포본의 Release 설정을 확인할 때
- Deep Link, IPC, 파일, QR, 서버 응답을 앱 내부에서 처리할 때
- SQLite, 파일 시스템, 파서, 동적 로딩으로 외부 입력이 전달될 때
- 오래된 SDK·Native 라이브러리가 다수 포함되어 있을 때
- 비정상 입력에서 크래시나 보안 검사 생략이 관찰될 때

WebView, Deep Link, 저장소처럼 별도 문서가 있는 영역은 그 문서에서 상세 판정한다. 여기서는 여러 입력 경로에 공통으로 적용되는 코드·공급망·빌드 기준을 다룬다.

## 분석 기준

코드 품질 이슈는 `Source → Transform → Sink → Impact`로 기록한다.

| 구간 | 예시 |
| --- | --- |
| Source | Intent extra, URL, ContentProvider, 파일, QR, 서버 응답 |
| Transform | 파싱, 디코딩, 정규화, 검증, 권한 확인 |
| Sink | SQL, 파일, WebView, Reflection, Native parser, 동적 코드 |
| Impact | 데이터 범위 확대, 파일 덮어쓰기, 코드 실행, 보안 검사 생략 |

위험 API가 존재하거나 앱이 크래시했다는 사실만으로 결론내리지 않는다. 공격자가 Source를 제어할 수 있는지, 검증 뒤 Sink에 어떤 값이 도달하는지, 보호 자산에 실제 영향이 있는지 확인한다.

## 점검 범위

현재 MASVS-CODE는 최신 플랫폼 요구, 앱 업데이트, 알려진 취약점이 없는 구성요소, 신뢰하지 않는 입력 검증을 핵심 통제로 둔다. 실무에서는 다음 보조 항목을 함께 본다.

- Release 빌드의 Debuggable·Test 설정과 비운영 리소스
- 예외·오류 때 인증·권한·인증서 검증이 Fail-open 되는지
- 의존성 버전, 유지보수 상태, 실제 취약 코드 도달성
- Native 코드의 메모리 오류와 빌드 완화 기법
- 지원 종료 OS와 강제·권고 업데이트 정책

`android:allowBackup`, 민감 로그, ATS·Network Security Config처럼 다른 통제에 속하는 설정은 관련 문서로 연결한다.

## 진단 절차

1. 실제 배포 채널에서 받은 빌드와 해시·서명·버전을 기록한다.
2. Manifest, entitlement, 프로비저닝, 문자열에서 Release 설정을 확인한다.
3. 외부 입력 Source와 위험 Sink를 목록화하고 연결한다.
4. 정상값, 경계값, 형식 오류, 권한 없는 객체를 안전한 시험 데이터로 입력한다.
5. 의존성 이름·버전·출처를 수집하고 최신 Advisory와 대조한다.
6. Native 입력 경로는 보호 기법과 Sanitizer 결과를 개발팀과 함께 확인한다.
7. 재현 가능한 영향과 도달성을 기준으로 우선순위를 정한다.

무작위 대량 입력이나 반복 크래시 유발은 기본 절차에 넣지 않는다. 가용성 영향이 있는 Fuzzing은 범위·시간·대상 빌드를 합의한 별도 환경에서 수행한다.

## 실습 노트

### Release 빌드

Android의 최종 병합 Manifest와 패키지 속성을 확인한다.

```bash
apkanalyzer manifest print target.apk
apksigner verify --verbose --print-certs target.apk
rg -n -i "debuggable|testOnly|profileable|usesCleartextTraffic" apktool-output/AndroidManifest.xml
```

`android:debuggable="true"`는 디버거 연결과 `run-as` 접근 범위를 넓힐 수 있으므로 운영 배포본에서 실제 동작을 확인한다. 단, 고객이 의도적으로 제공한 진단 빌드를 스토어 Release와 혼동하지 않는다.

iOS는 서명, entitlement, 프로비저닝, 개발 서버 문자열을 함께 본다.

```bash
codesign -dvvv --entitlements :- Payload/Target.app
security cms -D -i Payload/Target.app/embedded.mobileprovision
rg -n -i "localhost|staging|dev\.|DEBUG|NSLog" Payload/Target.app
```

개발 도메인 문자열이 패키지에 있다는 사실만으로 결함은 아니다. 메뉴·Feature Flag·원격 설정·URL Scheme 등을 통해 운영 사용자가 접근할 수 있는지 확인한다.

### 입력·SQL

쿼리 문자열 생성과 ContentProvider 경로를 찾는다.

```bash
rg -n "rawQuery|execSQL|SQLiteQueryBuilder|selectionArgs|@Query|ContentProvider" jadx-output/sources
```

취약 후보는 외부 입력이 구조적 SQL 구문에 결합되는 경우다.

```kotlin
val sql = "SELECT * FROM notes WHERE title = '" + title + "'"
database.rawQuery(sql, null)
```

바인딩된 값은 데이터로 처리된다.

```kotlin
database.rawQuery(
    "SELECT * FROM notes WHERE title = ?",
    arrayOf(title)
)
```

테이블명·정렬 방향처럼 플레이스홀더로 바인딩할 수 없는 구조 요소는 허용 목록으로 제한한다. 로컬 DB Injection의 영향은 전체 DB 범위, Provider의 Export·Permission, 다른 계정 데이터 존재 여부로 판단한다.

### 파일·URI

외부 파일명, URL 경로, Content URI가 파일 API로 전달되는 흐름을 찾는다.

```bash
rg -n "getCanonical(Path|File)|File\(|Paths\.get|openFileInput|openFileOutput|ContentResolver|FileProvider" jadx-output/sources
```

`../` 문자열 차단만으로 충분하지 않다. URL 디코딩, 심볼릭 링크, 절대 경로, 경로 구분자 차이를 고려해 정규화된 최종 경로가 허용 Base Directory 안인지 확인한다.

```kotlin
val base = filesDir.canonicalFile
val candidate = File(base, suppliedName).canonicalFile
require(candidate.toPath().startsWith(base.toPath()))
```

Content URI는 문자열을 파일 경로로 바꾸지 말고 `ContentResolver`로 열며, 부여된 URI Permission과 MIME·크기·파일 내용 검증을 확인한다.

### 파서·동적 로딩

JSON·XML·직렬화 객체·압축 파일·이미지처럼 복잡한 입력이 어떤 라이브러리로 처리되는지 본다.

```bash
rg -n "ObjectInputStream|XMLReader|DocumentBuilderFactory|ZipInputStream|DexClassLoader|PathClassLoader|Class\.forName|System\.load" jadx-output/sources
```

XML 외부 엔티티, 안전하지 않은 역직렬화, 압축 해제 경로, 과도한 중첩·크기, 외부 DEX·Native Library 로딩을 점검한다. 동적 로딩 자체가 결함은 아니지만 다음 경계가 필요하다.

- 신뢰된 저장 위치와 HTTPS 전송
- 서명·해시 검증과 Rollback 통제
- 로드 대상의 권한·출처 제한
- 실패 시 기존 검증된 코드로의 안전한 복귀

### 예외·상태

보안 검증 주변의 넓은 `catch`, 빈 예외 처리, 기본 성공값을 찾는다.

```bash
rg -n "catch \(.*Exception|catch \{\s*\}|return true|allowAccess|skipValidation|fallback" jadx-output/sources
```

문자열 검색 결과는 후보일 뿐이다. 네트워크 오류, 파싱 실패, Keystore 오류, 인증 취소, 시간 초과를 각각 유도해 다음 상태를 확인한다.

```text
검증 성공 → 기능 허용
검증 실패 → 명확한 거부·안전한 복구
검증 불가 → 성공으로 간주하지 않음
중복 요청 → 이전 성공 상태를 잘못 재사용하지 않음
```

오류 메시지에 내부 경로나 Stack Trace가 노출되는 문제와, 오류 때문에 보안 검사가 생략되는 문제를 분리한다.

### 의존성·SBOM

소스가 있으면 Gradle·Swift Package·CocoaPods의 해석된 의존성 목록을 우선 사용한다. 바이너리만 있으면 MobSF·라이브러리 서명 탐지를 보조로 사용하되 버전 오식별 가능성을 남긴다.

```bash
./gradlew app:dependencies
./gradlew dependencyInsight --dependency okhttp --configuration releaseRuntimeClasspath
swift package show-dependencies
```

Advisory를 찾은 뒤 다음을 확인한다.

- 정확한 모듈·버전·플랫폼이 일치하는가
- 취약 기능이 앱에 포함되고 호출되는가
- 공격자 입력이 해당 경로에 도달하는가
- Vendor Patch·Backport·Mitigation이 적용됐는가
- 업데이트 시 호환성 영향과 목표 버전은 무엇인가

CVE가 있다는 이유만으로 곧바로 High로 두지 않는다. 반대로 버전이 식별되지 않는 오래된 바이너리는 “취약 확정”이 아니라 공급망 가시성 부족으로 분리한다.

### 플랫폼·앱 업데이트

최소 지원 OS와 Target SDK·SDK Build Version을 확인한다.

```bash
apkanalyzer manifest target-sdk target.apk
apkanalyzer manifest min-sdk target.apk
otool -l Payload/Target.app/Target | rg -n "LC_BUILD_VERSION|sdk|minos"
```

오래된 OS 지원 자체가 자동 결함은 아니다. 더 이상 보안 업데이트를 받지 않는 플랫폼에서 민감 기능을 허용하는지, 서버가 최소 앱 버전을 적용하는지, 차단 시 안전한 업그레이드 경로가 있는지 확인한다.

강제 업데이트는 고위험 결함을 빠르게 차단할 수 있지만, 앱 시작을 무조건 막으면 가용성·접근성 문제가 생긴다. 필수 보안 업데이트와 일반 권고 업데이트를 구분하고, 버전 비교·서명된 배포 채널·오프라인 정책을 본다.

### Native 메모리

자체 `.so`·Framework가 외부 파일, 이미지, 압축, 프로토콜 입력을 파싱하는지 먼저 찾는다.

```bash
checksec --file=lib/arm64-v8a/libtarget.so
readelf -W -l -s lib/arm64-v8a/libtarget.so
```

NX, PIE, RELRO, Stack Canary가 없다는 사실은 완화 기법 부족이지 메모리 손상 자체의 증거가 아니다. 경계 밖 읽기·쓰기, Use-after-free, 정수 Overflow가 재현되는 입력과 Crash Log를 확보한다.

개발 협업이 가능하면 Android는 HWASan을 우선 검토하고, 운영 표본에서는 GWP-ASan·MTE 같은 탐지·완화 기능을 제품 환경에 맞게 검토한다. ASan은 현재 Android NDK 문서에서 HWASan을 사용할 수 없을 때의 대안으로 다뤄진다.

## 결과 판정

| 관찰 결과 | 해석 |
| --- | --- |
| 운영 배포본이 Debuggable이고 Attach 가능 | Release 빌드 경계 약화 |
| 개발 URL 문자열만 존재하고 도달 불가 | 증거 부족, 정보성 후보 |
| 외부 입력이 SQL 구조에 결합되어 행 범위 확대 | 로컬 SQL Injection 영향 확인 |
| Canonical Path가 Base 밖 파일을 가리킴 | 경로 조작 영향 확인 |
| 파서 오류 뒤 검증이 성공 처리됨 | Fail-open 결함 |
| CVE 버전 일치·취약 기능 도달 가능 | 의존성 취약점 재현 후보 |
| 버전 탐지 불확실·코드 경로 미사용 | 영향 미확정 |
| Native Crash만 재현 | 가용성·메모리 오류 가능성, RCE 단정 금지 |
| 지원 종료 OS에서 고위험 기능 허용 | 위협·보완 통제와 함께 평가 |

심각도는 빌드 플래그나 CVE 점수만 복사하지 않는다. 입력 통제 가능성, 필요한 권한·사용자 상호작용, 자산, 다른 계정·기기로의 확장 범위를 근거로 정한다.

## 증적 항목

- 배포 채널, 앱 버전·빌드·해시·서명
- OS·단말·ABI와 Debugger·계측 상태
- Source·Transform·Sink의 코드 위치와 호출 흐름
- 정상·경계·오류 입력과 실제 결과
- 접근한 DB 행·파일·기능의 권한 경계
- 의존성 모듈·버전·출처·Advisory·도달성
- Native Crash Log, Tombstone, Sanitizer 결과
- 최소 OS·Target SDK·최소 앱 버전 정책

시험 데이터만 사용하고 Crash·Fuzzing 증적에는 요청 속도와 중단 조건을 함께 기록한다.

## 트러블슈팅

#### Manifest 값이 도구마다 다름

소스 Manifest가 아니라 최종 병합된 APK Manifest를 기준으로 한다. Split APK·App Bundle의 Base와 Feature Split도 확인한다.

#### 문자열 결합이 모두 Injection처럼 보임

값이 SQL·경로·코드 구조로 해석되는 Sink인지 확인한다. UI 문자열·로그 메시지 결합은 같은 문제가 아니다.

#### Room 사용인데 쿼리가 동적으로 생성됨

값 바인딩과 구조 요소를 구분한다. `@RawQuery`와 직접 조립한 정렬·테이블 식별자는 별도 확인한다.

#### 라이브러리 버전이 식별되지 않음

소스 Lockfile·SBOM·Build Metadata를 요청한다. 바이너리 유사도 결과 하나로 CVE를 확정하지 않는다.

#### CVE는 있으나 재현되지 않음

플랫폼 조건, 기능 Flag, Vendor Backport, 호출 경로를 확인한다. 도달성과 완화 상태를 별도 필드로 남긴다.

#### Native 크래시가 일정하지 않음

ABI, 스레드, 입력 길이, Heap 상태를 고정하고 Tombstone을 비교한다. 대량 반복은 합의된 전용 환경에서만 수행한다.

#### 디버거가 연결되지 않음

Debuggable, 프로세스 이름, Anti-debug, 배포 서명을 분리한다. 연결 실패만으로 Release 설정이 안전하다고 판정하지 않는다.

#### 업데이트 화면만 반복됨

클라이언트 버전 비교, 서버 응답, 스토어 URL, 오프라인 상태를 확인한다. 우회보다 정상 복구와 가용성 영향을 먼저 기록한다.

## 빠른 명령어 참조

```bash
# Android Release·입력 Sink
apkanalyzer manifest print target.apk
rg -n "rawQuery|execSQL|File\(|DexClassLoader|ObjectInputStream|catch \(" jadx-output/sources

# iOS 서명·의존 Framework
codesign -dvvv --entitlements :- Payload/Target.app
find Payload/Target.app/Frameworks -maxdepth 2 -type f -print

# Native 완화 기법
checksec --file=lib/arm64-v8a/libtarget.so
```

## 관련 문서

- [정적 분석](./static-analysis.md)
- [IDA Pro 네이티브 분석](./ida-pro-analysis.md)
- [Deep Link·Intent](./deeplink-intent.md)
- [Exported Component](./exported-components.md)
- [WebView 보안](./webview-issues.md)
- [개인정보 흐름·노출](./privacy-leakage.md)
- [앱 변조·무결성](./app-tampering.md)

## 참고자료

#### 공식 문서

- [Android Developers · SQL injection](https://developer.android.com/privacy-and-security/risks/sql-injection)
- [Android Developers · Path traversal](https://developer.android.com/privacy-and-security/risks/path-traversal)
- [Android NDK · Memory error debugging and mitigation](https://developer.android.com/ndk/guides/memory-debug)
- [Android NDK · HWAddress Sanitizer](https://developer.android.com/ndk/guides/hwasan)
- [Apple Developer · Security](https://developer.apple.com/documentation/security)

#### 점검 기준·도구

- [OWASP MASVS-CODE](https://mas.owasp.org/MASVS/11-MASVS-CODE/)
- [OWASP MASTG · Mobile App Code Quality](https://mas.owasp.org/MASTG/0x04h-Testing-Code-Quality/)
- [OSV · Open Source Vulnerabilities](https://osv.dev/)
- [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF)
