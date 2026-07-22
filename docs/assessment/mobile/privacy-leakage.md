---
sidebar_position: 20
title: 개인정보 흐름·노출
description: 모바일 앱의 개인정보 수집·사용·전송·제3자 제공 흐름과 고지·권한·플랫폼 선언의 일치 여부를 확인하는 실무 노트
keywords: [Privacy, Personal Data, Third-party SDK, Permissions, Data Safety, Privacy Manifest, Clipboard, MASVS-PRIVACY]
toc_max_heading_level: 3
draft: false
---

> 개인정보 필드 하나를 발견하는 데서 끝내지 않는다. **어떤 기능에서 수집해 어느 주체로 보내고 얼마나 남기는지**, 사용자에게 설명된 내용과 실제 동작이 일치하는지 추적한다.

## 사용 시점

- 회원가입·본인확인·결제·위치 기반 기능이 있을 때
- 분석·광고·크래시·고객지원 SDK가 포함되어 있을 때
- 카메라·마이크·연락처·위치 같은 권한을 요청할 때
- Google Play Data safety나 App Store 개인정보 표시를 검토할 수 있을 때
- 로그·클립보드·최근 앱 화면에서 민감값이 관찰될 때

이 문서는 기술적 사실을 수집하고 불일치를 찾는 진단 노트다. 개인정보보호법 위반 여부는 처리 주체, 동의 근거, 계약, 관할, 최신 법령에 따라 달라질 수 있으므로 법무·개인정보 담당자와 별도로 확정한다.

## 분석 기준

데이터마다 다음 흐름을 작성한다.

```text
수집 화면·센서 → 앱 모듈 → 로컬 처리·저장 → 자사 API → 제3자 SDK·도메인 → 보존·삭제
```

| 기준 | 확인 질문 |
| --- | --- |
| 데이터 | 정확히 어떤 값이며 다른 값과 결합하면 식별 가능한가 |
| 목적 | 핵심 기능, 보안, 분석, 광고 중 무엇인가 |
| 주체 | 자사, 위탁·제휴사, SDK 사업자 중 누가 받는가 |
| 시점 | 설치, 동의 전, 로그인, 특정 기능 실행 중 언제인가 |
| 통제 | 선택 거부, 권한 철회, 탈퇴·삭제가 가능한가 |
| 고지 | 처리방침, 권한 설명, 스토어 선언과 일치하는가 |

광고 ID처럼 재설정 가능한 식별자도 계정·위치·연락처와 결합하면 식별성이 커질 수 있다. 반대로 단말 안에서만 일시 처리되고 외부로 전송되지 않는 데이터는 플랫폼의 “수집” 정의와 다를 수 있다.

## 개인정보 지도

점검 시작 전에 기능별 표를 만든다.

| 기능 | 데이터 | 권한·API | 자사 목적지 | 제3자 목적지 | 고지 |
| --- | --- | --- | --- | --- | --- |
| 로그인 | 계정 ID, 기기 정보 | 네트워크 | `api.example` | Crash SDK | 처리방침 3항 |
| 매장 검색 | 대략·정밀 위치 | 위치 권한 | `geo.example` | 지도 SDK | 권한 화면 |
| 고객 문의 | 사진, 자유 입력 | 사진 선택기 | `support.example` | 상담 SaaS | 문의 화면 |

SDK 이름만으로 데이터 흐름을 단정하지 않는다. 초기화 옵션, 사용자 식별 설정, 자동 수집 기본값, 실제 네트워크 요청을 함께 확인한다.

## 진단 절차

1. 처리방침, 동의 화면, 권한 설명, 스토어 선언을 확보한다.
2. APK·IPA에서 권한, SDK, Privacy Manifest, 도메인을 목록화한다.
3. 신규 설치부터 동의 전·후, 로그인 전·후 트래픽을 각각 기록한다.
4. 주요 기능에 시험용 개인정보를 넣고 저장·로그·전송 위치를 추적한다.
5. 제3자 도메인의 사업자와 전송 필드를 연결한다.
6. 권한 거부·철회, 분석·광고 선택 해제, 로그아웃·탈퇴를 시험한다.
7. 고지와 실제 흐름의 차이 및 재현 가능한 노출 영향을 정리한다.

실제 주민등록번호·카드번호·건강정보는 시험에 사용하지 않는다. 고유한 가상 값으로 필드 이동을 추적한다.

## 실습 노트

### 권한·센서

Android 권한과 관련 컴포넌트를 확인한다.

```bash
aapt2 dump permissions target.apk
rg -n "uses-permission|ACCESS_BACKGROUND_LOCATION|READ_CONTACTS|RECORD_AUDIO|QUERY_ALL_PACKAGES" apktool-output/AndroidManifest.xml
```

iOS는 `Info.plist`의 Usage Description, entitlement, 실제 API 호출을 연결한다.

```bash
plutil -p Payload/Target.app/Info.plist
codesign -d --entitlements :- Payload/Target.app
```

권한 선언만으로 수집을 확정하지 않는다. 요청 시점, 거부 시 대체 흐름, 백그라운드 접근, 네트워크 전송을 확인한다. 반대로 사진 선택기처럼 전체 저장소 권한 없이 필요한 파일만 고르는 대안이 있는지도 본다.

### SDK·도메인

패키지와 프레임워크에서 분석·광고·크래시 SDK 후보를 찾고 도메인 목록을 만든다.

```bash
rg -n -i "firebase|analytics|crash|advert|tracking|telemetry|segment|amplitude|appsflyer" jadx-output/sources Payload/Target.app
```

트래픽은 최소 네 시점으로 나눈다.

```text
T0 최초 실행·동의 전
T1 필수 동의 후·로그인 전
T2 로그인 후·기능 미사용
T3 개인정보 기능 실행 후
```

같은 필드가 자사 API와 SDK 양쪽으로 나가는지, SDK 사용자 ID가 계정·전화번호·이메일과 결합되는지 확인한다. TLS 가시화가 필요하면 Pinning 우회 문서를 사용하되 허가된 시험 환경에서만 수행한다.

### Android · Data safety

Google Play의 Data safety 표시를 확보할 수 있다면 실제 전송과 대조한다. 앱 본체뿐 아니라 포함된 SDK의 수집도 범위에 넣는다.

- 수집·공유 데이터 유형
- 처리 목적과 필수·선택 여부
- 전송 중 보호와 삭제 요청 설명
- 계정 연계·익명 처리 주장

스토어 선언이 없거나 접근할 수 없는 고객사 내부 앱이라면 처리방침과 고객 제공 자료를 기준선으로 사용한다. 선언과 다른 네트워크 필드를 발견해도 먼저 인코딩·가명화·서버 측 즉시 처리 여부를 확인한다.

### iOS · Privacy Manifest

앱과 Framework의 `PrivacyInfo.xcprivacy`를 모두 찾는다.

```bash
find Payload/Target.app -name PrivacyInfo.xcprivacy -print
plutil -lint Payload/Target.app/PrivacyInfo.xcprivacy
plutil -p Payload/Target.app/PrivacyInfo.xcprivacy
```

주요 키는 다음과 같다.

- `NSPrivacyCollectedDataTypes`: 수집 데이터 유형과 목적
- `NSPrivacyAccessedAPITypes`: Required Reason API와 승인 사유
- `NSPrivacyTracking`: 추적 여부
- `NSPrivacyTrackingDomains`: 추적 도메인

Manifest는 진단의 출발점이지 실제 동작의 증거가 아니다. Xcode가 합산한 Privacy Report, App Store 개인정보 표시, 네트워크 관찰을 함께 비교한다. 각 SDK는 자체 Manifest를 가질 수 있다.

### 로그·진단 데이터

시험용 이메일·전화번호·토큰 표식을 기능별로 입력한 뒤 앱 로그와 공유 가능한 진단 파일에서 검색한다.

```bash
adb logcat --pid="$(adb shell pidof -s com.example.app)"
adb shell run-as com.example.app find files cache -type f -maxdepth 3 -print
```

요청·응답 전체, 사용자 객체, 위치 좌표, 인증 헤더가 운영 빌드 로그에 남는지 본다. OS 격리로 다른 일반 앱이 Logcat을 읽기 어렵더라도 ADB, 지원 로그 업로드, 크래시 SDK, 공유 단말 운영을 통한 노출 경로가 있을 수 있다.

### 클립보드·공유

OTP, 계좌·카드 식별값, 주소, 인증 링크를 복사하고 다음을 확인한다.

- 사용자가 복사를 명시적으로 요청했는가
- 민감 내용 표시 또는 OS의 Sensitive 표시를 적용했는가
- 붙여넣기 대상과 공유 Sheet에 불필요한 값이 포함되는가
- 앱이 정한 만료 정책과 실제 클립보드 잔존이 일치하는가
- Universal Clipboard 같은 기기 간 동기화 가능성을 고려했는가

자동 삭제가 없다는 이유만으로 일률 판정하지 않는다. OS 버전별 접근 제한, 사용자 기대, 값의 유효 시간, 다른 전달 수단을 포함해 위험을 판단한다. 후킹으로 원문을 출력하면 도구 자체가 민감정보를 새로 남길 수 있으므로 시험값만 사용한다.

### 화면·입력

민감 화면을 연 상태에서 스크린샷, 화면 녹화, 앱 전환 미리보기, 외부 디스플레이를 확인한다. 모든 화면에 캡처 차단을 요구하지 않고, 인증번호·금융자산·건강정보처럼 노출 영향이 큰 화면을 우선한다.

입력 필드에서는 다음을 본다.

- 비밀번호·PIN의 보안 입력 속성
- 자동 수정·자동 완성·제3자 키보드 허용 범위
- 화면 읽기·접근성 서비스와의 제품 요구사항
- 백그라운드 전환 때 입력값과 화면 가림

접근성을 일괄 차단하는 것은 적절한 해결책이 아닐 수 있다. 개인정보 보호와 사용 가능성을 함께 검토한다.

### 철회·삭제

권한을 거부하거나 설정에서 철회한 뒤 앱을 재실행한다. 분석·광고 선택 해제, 로그아웃, 계정 삭제도 각각 시험한다.

```text
동의 전 → 이벤트 전송 여부
동의 후 → 수집 시작 시점
동의 철회 → 신규 전송 중단과 기존 식별자 처리
로그아웃 → SDK 사용자 ID 초기화
계정 삭제 → 로컬 잔존과 서버 삭제 절차
```

클라이언트 관찰만으로 서버의 완전 삭제를 증명할 수는 없다. 삭제 요청 API, 사용자 안내, 재로그인 후 복구 여부를 증적으로 남기고 서버 보존 정책은 담당자 확인 항목으로 분리한다.

## 결과 판정

| 관찰 결과 | 해석 |
| --- | --- |
| 동의 전 제3자 분석 식별자 전송 | 고지·선택 구조와 대조 필요 |
| SDK에 이메일·전화번호 원문 전송 | 필요성·계약·고지·가명화 확인 |
| 선언된 권한이나 SDK가 런타임 미사용 | 불필요 선언·공급망 잔존 후보 |
| 권한 거부 후 핵심 기능만 제한 | 최소 기능 대체 흐름 가능 |
| 로그에 시험용 토큰과 응답 전문 | 실제 노출 경로와 로그 접근 주체 확인 |
| 클립보드에 짧은 유효 OTP 잔존 | OS 보호·만료 시간·대안으로 위험 산정 |
| 개인정보 표시와 실제 데이터 유형 불일치 | 선언 정합성 검토 대상 |
| 탈퇴 후 앱에서 기존 계정 데이터 재노출 | 로컬·서버 삭제 경계 확인 |

심각도는 데이터 민감도, 식별 가능성, 수신 주체, 규모, 지속 시간, 사용자 통제, 악용 가능성을 함께 고려한다. “법 위반”이라는 결론 대신 확인된 기술 사실과 관련 고지의 차이를 명확히 적는다.

## 증적 항목

- 앱 빌드·해시, OS·단말, 신규 설치 여부
- 처리방침·동의 화면·스토어 선언의 확인 날짜와 버전
- 기능별 시험 데이터 표식과 수집 시점
- 권한 요청·거부·철회 화면과 후속 동작
- SDK·Framework 버전, 목적지 도메인, 사업자 분류
- 요청 필드, 인코딩·가명화 여부, 동의 전후 차이
- 로그·클립보드·화면의 접근 조건과 잔존 시간
- 로그아웃·탈퇴·삭제 뒤 확인 결과

증적의 개인정보는 가상 값으로 만들고, 실제 계정 식별자·토큰·위치는 마스킹한다.

## 트러블슈팅

#### 프록시에 SDK 요청이 보이지 않음

QUIC, 별도 Network Stack, Pinning, 백그라운드 배치 전송을 확인한다. DNS와 연결 도메인을 먼저 수집하고 기능 실행 후 충분한 시간 동안 관찰한다.

#### 데이터가 암호화·인코딩되어 보임

Content-Encoding, Protobuf, gzip, Base64를 구분한다. 앱 직렬화 직전과 SDK 호출 인자를 시험값으로 관찰한다.

#### 권한은 있으나 실제 호출이 없음

제품 변형, 비활성 기능, SDK 잔존 선언일 수 있다. 권한만으로 수집을 확정하지 않고 호출과 전송 증거를 찾는다.

#### Privacy Manifest가 없음

모든 앱에 동일한 Manifest 항목이 필요한 것은 아니다. Required Reason API와 대상 SDK 요구사항, App Store 제출 조건을 현재 공식 문서로 확인한다.

#### 로그에서 다른 앱 데이터가 섞임

PID나 태그로 범위를 줄이고 앱 프로세스 재시작 시 PID 변경을 반영한다. 시스템 로그의 값이 대상 앱에서 발생했는지도 호출 시점으로 대조한다.

#### 클립보드가 자동으로 사라짐

OS 버전의 자동 정리와 앱의 명시 삭제를 구분한다. 복사 직후와 값 유효 시간 동안의 접근 가능성을 기록한다.

#### 화면 캡처가 플랫폼마다 다름

스크린샷, 화면 녹화, 최근 앱 미리보기는 별도 경로다. 실제 단말과 앱 상태별로 각각 확인한다.

#### 삭제 완료 여부를 확인할 수 없음

클라이언트에서 관찰 가능한 API와 로컬 잔존까지만 판정한다. 서버 보존·백업 삭제는 인터뷰와 정책 증적으로 분리한다.

## 빠른 명령어 참조

```bash
# Android 권한·SDK·도메인
aapt2 dump permissions target.apk
rg -n -i "analytics|crash|advert|tracking|telemetry|https://" jadx-output/sources resources

# iOS Privacy Manifest·설정
find Payload/Target.app -name PrivacyInfo.xcprivacy -print
plutil -p Payload/Target.app/Info.plist

# 앱 프로세스 로그
adb logcat --pid="$(adb shell pidof -s com.example.app)"
```

## 관련 문서

- [Android 데이터 저장](./data-storage-android.md)
- [iOS 데이터 저장](./data-storage-ios.md)
- [인증서 검증·Pinning](./certificate-validation.md)
- [Deep Link·Intent](./deeplink-intent.md)
- [코드 품질](./code-quality.md)
- [Android 실습 환경](./setup-android.md)
- [iOS 실습 환경](./setup-ios.md)

## 참고자료

#### 공식 문서

- [Android Developers · Permissions on Android](https://developer.android.com/guide/topics/permissions/overview)
- [Android Developers · Minimize permission requests](https://developer.android.com/privacy-and-security/minimize-permission-requests)
- [Google Play Console Help · Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Apple Developer · Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Apple Developer · App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [개인정보보호위원회](https://www.pipc.go.kr/)

#### 점검 기준

- [OWASP MASVS-PRIVACY](https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/)
- [OWASP MASTG](https://mas.owasp.org/MASTG/)
