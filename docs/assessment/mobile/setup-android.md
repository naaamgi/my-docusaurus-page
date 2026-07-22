---
sidebar_position: 2
title: 점검 환경 구축 - Android
description: 모바일 진단 - Android 점검 환경 구축 (ADB / Frida / Burp 프록시 / 시스템 CA / APK 추출 / 트러블슈팅)
keywords: [Android, ADB, Frida, frida-server, Burp Suite, Magisk, CA 인증서, APK, MASVS, MASTG, 모바일 환경 구축, Setup]
draft: false
toc_max_heading_level: 3
---

> Android 단말을 ADB로 제어하고, Burp 기준선을 확보한 뒤, 필요한 환경에서 Frida와 APK 추출까지 확인하는 순서로 구성한다. Windows AVD와 루팅 실기기를 구분해 사용한다.

## 환경 선택

| 환경 | 먼저 할 수 있는 것 | 제한·확인할 것 | 권장 사용 |
| :--- | :--- | :--- | :--- |
| **Google APIs AVD** | `adb root`, 시스템 CA, APK 설치·추출, Frida | Play Store 포함 이미지는 일반적으로 `adb root` 제한 | 반복 실습과 도구 숙련 |
| **루팅 실기기** | 실제 ABI·제조사 환경, 시스템 CA, Frida | Magisk 상태, Root 탐지, 회사 단말 정책 | 고객 앱 동작 확인 |
| **비루팅 실기기** | ADB 허용 범위, 사용자 CA, 일반 프록시, 앱 기능 관찰 | 시스템 CA, `frida-server`, 다른 앱 컨테이너 접근 제한 | 최초 기준선과 실제 사용자 환경 |

처음 연습할 때는 Android Studio AVD의 **Google APIs 이미지**를 권장한다. Play Store 로고가 붙은 이미지는 production 성격이라 `adb root`가 막힐 수 있다. 이미지를 만든 뒤 명칭만 믿지 말고 `adb root` 결과로 실제 권한을 확인한다.

---

## 구축 목표

다음 네 가지를 각각 확인한다. 하나가 실패해도 모두 같은 환경 문제로 묶지 않는다.

1. `adb devices`로 단말을 제어할 수 있다.
2. 브라우저의 HTTP/HTTPS가 Burp에 보인다.
3. 적용 환경에서는 `frida-ps -U`로 프로세스를 볼 수 있다.
4. 설치된 앱의 base/split APK 위치를 확인하고 필요한 파일을 추출할 수 있다.

> **다른 페이지와 영역 분리**
> - SSL Pinning 우회 → [SSL Pinning 우회](./ssl-pinning-bypass.md)
> - Root·Frida 탐지 대응 → [루팅 탐지 우회](./root-detection-bypass.md), [디버거/Frida 탐지 우회](./anti-debug-bypass.md)
> - 공용 후킹 패턴 → [Frida 후킹 스크립트](./frida-scripts.md)
> - APK 디컴파일과 코드 탐색 → [정적 분석](./static-analysis.md)
> - iOS 환경 → [iOS 환경 구축](./setup-ios.md)

---

## 사전 조건

### PC 측 준비

- Windows, macOS 또는 Linux
- Android SDK Platform Tools
- Python 3 최신 버전과 격리된 가상환경 권장
- Burp Suite와 OpenSSL. Windows에서는 Git Bash·WSL 또는 별도 OpenSSL 사용
- 실기기 사용 시 데이터 전송이 되는 USB 케이블

### 단말 측 준비

- Android Studio AVD `Google APIs` 이미지 또는 별도 루팅 실기기
- 실기기는 필요한 경우 현재 단말과 호환되는 Magisk 환경
- 개발자 옵션 활성화 (설정 → 휴대전화 정보 → 빌드 번호 7회 탭)
- USB 디버깅 활성화. 무선 디버깅은 실제로 사용할 때만 활성화

비루팅 단말에서도 사용자 CA 설치, 브라우저 프록시 기준선, ADB 허용 범위와 앱 기능 관찰은 가능하다. 시스템 CA 승격과 `frida-server`가 필요한 단계만 루팅 환경으로 전환한다.

---

## 구축 절차

#### Step 1. ADB 설치와 단말 연결

**PC 측 설치:**

Windows에서 Android Studio를 설치했다면 먼저 Platform Tools 경로에서 확인한다.

```powershell
Set-Location "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
.\adb.exe version
.\adb.exe devices -l
```

환경 변수에 등록했다면 이후 예시는 운영체제와 관계없이 `adb`로 실행한다.

```bash
# macOS — Homebrew
brew install --cask android-platform-tools

# Ubuntu / Debian
sudo apt install android-tools-adb android-tools-fastboot

```

**버전 + 단말 인식 확인:**

```bash
adb version
adb devices -l
# List of devices attached
# RZ8M82XXXX     device          ← "device" 가 떠야 정상
# RZ8M82XXXX     unauthorized    ← 단말에서 RSA 키 승인 안 된 상태
# RZ8M82XXXX     offline         ← 케이블 / 권한 문제
```

**왜 이 단계가 가장 먼저인지**: ADB 가 `device` 상태가 아니면 frida-server 푸시 / 시스템 CA 설치 / APK 추출 모두 막힌다. 가장 먼저 끝내야 후속 단계가 모두 동작.

**무선 디버깅 (Android 11+, USB 케이블 없이):**

```bash
# 1) 단말: 개발자 옵션 → 무선 디버깅 → "페어링 코드로 디바이스 페어링"
# 2) PC:
adb pair <단말IP>:<페어링포트>     # 페어링 코드 입력
adb connect <단말IP>:<연결포트>    # "무선 디버깅" 화면의 IP / 포트
adb devices
```

**언제 쓰는지**: 실기기 점검 + 케이블 자리 부족 / 단말을 자주 회수해야 하는 환경. **점검 트래픽이 사내망에 노출**될 수 있으므로 점검 종료 시 무선 디버깅 OFF.

#### Step 2. Frida 환경 구성

**핵심은 PC 패키지와 단말 서버를 같은 릴리스로 맞추는 것**이다. 문서에 특정 버전을 고정하지 않고 설치 시점의 `frida --version`과 공식 릴리스를 기준으로 파일을 선택한다.

**PC 측 — `frida-tools` 설치:**

```powershell
py -m venv .venv-frida
.\.venv-frida\Scripts\Activate.ps1
python -m pip install --upgrade frida-tools
frida --version
```

macOS/Linux에서는 같은 방식으로 가상환경을 활성화한다.

```bash
python3 -m venv .venv-frida
source .venv-frida/bin/activate
python -m pip install --upgrade frida-tools
frida --version
```

**단말 측 — `frida-server` 준비:**

```bash
# CPU ABI 확인
adb shell getprop ro.product.cpu.abilist

# 공식 릴리스에서 같은 버전·ABI의 Android frida-server를 내려받아 압축 해제
# 예시 이름: frida-server-<VERSION>-android-<ARCH>.xz

adb push frida-server-<VERSION>-android-<ARCH> /data/local/tmp/frida-server
adb shell "chmod 755 /data/local/tmp/frida-server"
```

AVD처럼 `adb root`가 가능한 환경과 `su`를 사용하는 실기기를 구분한다.

```bash
# userdebug AVD
adb root
adb shell "/data/local/tmp/frida-server &"

# Magisk 등으로 루팅한 production 실기기
adb shell "su -c '/data/local/tmp/frida-server &'"
```

**검증:**

```bash
frida-ps -U
# PID    Name
# -----  ----------------------------
# 234    com.android.systemui
# 567    com.target.app
# ...
```

위 목록이 나오면 PC ↔ 단말 ↔ `frida-server` 연결 정상. 빈 출력 / 에러는 트러블슈팅 항목 참조.

단말 재부팅 후에는 서버가 자동으로 다시 실행된다고 가정하지 않는다. 먼저 `ps`와 `frida-ps -U`로 상태를 확인한 뒤 필요한 경우 다시 실행한다.

#### Step 3. Burp 프록시 기준선 확보

**Burp 측 — 외부 인터페이스 바인딩:**

```text
Burp Suite → Settings → Tools → Proxy
  → Proxy listeners → Add (또는 127.0.0.1:8080 편집)
     Bind to port:    8080
     Bind to address: All interfaces (또는 PC LAN IP 직접 지정)
```

실기기는 PC와 통신 가능한 점검망을 사용한다. 사내망이나 공용 Wi-Fi에서 `All interfaces`로 열면 Burp 포트가 다른 호스트에 노출될 수 있으므로, 가능한 경우 PC의 점검망 IP로만 바인딩하고 종료 후 listener를 원복한다.

**단말 측 — 매뉴얼 프록시:**

```text
설정 → 네트워크 → Wi-Fi → 연결된 SSID 길게 누름 → 수정 → 고급 옵션
  프록시:        수동
  프록시 호스트: <PC LAN IP>
  프록시 포트:   8080
```

Android Studio AVD에서는 호스트 PC를 가리키는 특수 주소를 사용한다.

```text
프록시 호스트: 10.0.2.2
프록시 포트:   8080
```

**검증 — HTTP 트래픽:**

단말 브라우저에서 `http://example.com` 접속 → Burp Proxy History 에 요청이 보이면 정상. **이 시점에선 HTTPS 는 아직 인증서 오류로 캡처 불가** — Step 4 에서 해결.

#### Step 4. Burp CA 신뢰 설정

먼저 사용자 CA로 브라우저 HTTPS 기준선을 확인한다. Android 7 이후 앱은 기본적으로 사용자 추가 CA를 신뢰하지 않으므로, 브라우저는 보이지만 앱만 TLS 오류가 나면 시스템 CA 또는 앱의 Network Security Config를 확인한다. 이 단계와 SSL Pinning은 별개다.

#### 4-1. Burp CA 추출 + Android 가 요구하는 파일명 변환

```bash
# 1) Burp 의 CA 인증서 export
#    Burp → Proxy → Proxy settings → Import / export CA certificate
#    → Certificate in DER format → cacert.der 저장

# 2) DER → PEM
openssl x509 -inform DER -in cacert.der -out cacert.pem

# 3) Android 가 요구하는 파일명 (subject_hash_old 8자 + ".0") 으로 변환
openssl x509 -inform PEM -subject_hash_old -in cacert.pem | head -1
# 결과 예: 9a5ba575
mv cacert.pem 9a5ba575.0
```

전통적인 Android 시스템 CA 경로는 OpenSSL subject hash와 `.0` 형식 파일명을 사용한다. 실제 저장 경로와 쓰기 가능 여부는 Android 버전과 이미지에 따라 달라질 수 있으므로, 복사 명령 성공만 보지 말고 재부팅 후 시스템 인증서 목록과 브라우저 HTTPS로 확인한다.

#### 4-2. 방법 A — Magisk 모듈
```text
Magisk → Modules 에서 다음 중 하나 설치:
  - MagiskTrustUserCerts    (사용자 CA 슬롯의 모든 인증서를 시스템 CA 로 승격)
  - AlwaysTrustUserCerts    (동일 목적, 다른 메인테이너)
  - Move Certificates       (동일 목적)
```

**적용 절차:**

```text
1) 단말에서 Burp CA (cacert.der) 다운로드
   → 설정 → 보안 → 암호화 및 자격 증명 → CA 인증서 설치 → cacert.der 선택
2) Magisk → Modules → MagiskTrustUserCerts 활성화
3) 단말 재부팅
4) 설정 → 보안 → 신뢰할 수 있는 자격증명 → "시스템" 탭 에서 "PortSwigger" 항목 확인
```

**이럴 때 사용**: Magisk가 설치된 실기기 또는 Magisk 기반 AVD. 모듈은 Android 버전별 호환성과 유지 상태를 확인하고, 설치 전 점검 전용 단말의 스냅샷이나 복구 방법을 준비한다.

#### 4-3. 방법 B — writable AVD에 직접 반영
```bash
adb root                                  # adbd 를 root 로 재기동 (userdebug 빌드만 가능)
adb push 9a5ba575.0 /sdcard/9a5ba575.0
adb shell

# 단말 내부 쉘에서:
su
mkdir -p /data/local/tmp/cacerts-tmp
cp /system/etc/security/cacerts/* /data/local/tmp/cacerts-tmp/
mount -t tmpfs tmpfs /system/etc/security/cacerts
cp /data/local/tmp/cacerts-tmp/* /system/etc/security/cacerts/
cp /sdcard/9a5ba575.0 /system/etc/security/cacerts/
chmod 644 /system/etc/security/cacerts/*
```

**이럴 때 사용**: `adb root`가 성공하는 userdebug AVD. 재부팅하면 tmpfs가 해제되므로 환경을 다시 만들거나 AVD snapshot으로 보존한다. 최신 이미지에서 경로가 다르거나 mount가 거부되면 같은 명령을 반복하지 말고 해당 이미지의 trust store 구조를 다시 확인한다.

#### 4-4. 검증

단말 브라우저에서 `https://example.com` 접속 → Burp 에서 HTTPS 평문이 캡처되고 인증서 경고 없음 → 시스템 CA 적용 정상.

> **점검 대상 앱은 여전히 캡처 실패할 수 있음** — 앱이 SSL Pinning 을 별도로 적용한 경우. 이 케이스는 환경 구축의 영역이 아니라 `ssl-pinning-bypass.md` 의 영역.

#### Step 5. APK 추출과 재설치 확인

**설치된 앱에서 APK 추출:**

```bash
# 패키지명 확인
adb shell pm list packages | grep -i <KEYWORD>
# package:com.target.app

# APK 경로 확인
adb shell pm path com.target.app
# package:/data/app/~~XYZ==/com.target.app-1/base.apk
# package:/data/app/~~XYZ==/com.target.app-1/split_config.arm64_v8a.apk
# package:/data/app/~~XYZ==/com.target.app-1/split_config.xxhdpi.apk

# 모두 pull
adb pull /data/app/~~XYZ==/com.target.app-1/base.apk                     ./target-base.apk
adb pull /data/app/~~XYZ==/com.target.app-1/split_config.arm64_v8a.apk   ./target-arm64.apk
```

**APK 설치 (재패키징 / 다른 단말 이관):**

```bash
# 단일 APK
adb install target-base.apk

# split APK 가 있는 경우 — 한 번에 설치해야 매니페스트가 매칭됨
adb install-multiple target-base.apk target-arm64.apk target-xxhdpi.apk

# 같은 서명의 기존 앱 위에 재설치
adb install -r target-base.apk

# 낮은 versionCode로 되돌릴 때만 -d 사용
adb install -r -d target-base.apk
```

`-d`는 서명 검증을 우회하지 않는다. 재서명한 APK와 설치된 앱의 인증서가 다르면 업데이트 설치는 실패한다. 기존 앱을 제거하면 앱 데이터가 삭제될 수 있으므로, 점검용 계정과 복구 방법을 확인한 뒤 별도 단말 또는 snapshot에서 진행한다.

---

## 구축 검증

다음 4 가지가 동시에 정상이면 환경 구축 완료:

- [ ] `adb devices` 출력에서 단말이 `device` 상태로 표시
- [ ] `frida-ps -U` 가 단말의 프로세스 목록을 정상 출력 (수십~수백 개)
- [ ] 단말 브라우저에서 `https://example.com` 접속 시 Burp 에서 HTTPS 평문 캡처 + 인증서 경고 없음
- [ ] `pm path` 결과의 base/split APK를 확인하고 필요한 파일을 추출 가능

점검 대상 앱만 통신이나 실행에 실패하면 환경 구축 완료 여부와 보호기법 적용 여부를 분리해서 판단한다.

---

## 트러블슈팅

### `frida-ps -U` 연결 실패

```bash
# 1) frida-server 가 실제 실행 중인지 확인
adb shell "ps -A | grep frida"
# 결과 없으면 다시 실행
adb shell "su -c '/data/local/tmp/frida-server &'"

# 2) 버전 매칭 확인
frida --version                                       # PC
adb shell /data/local/tmp/frida-server --version      # 단말
# 가능한 한 같은 릴리스로 맞춘다.
```

### `frida-server` 실행 형식 오류

아키텍처가 어긋난 경우. arm64 단말에 x86_64 바이너리를 푸시했거나 반대. `adb shell getprop ro.product.cpu.abi` 로 다시 확인 후 올바른 바이너리 다운로드.

### Burp HTTPS 인증서 오류
```text
- /system/etc/security/cacerts/<hash>.0 파일이 실제로 존재하는지 ls 로 확인
- 설치한 인증서의 subject_hash_old와 실제 파일명을 확인
- chmod 644 권한 확인
- 재부팅 후 다시 시도 (Magisk 모듈 방식은 부팅 시 트러스트 주입)
- 단말의 시스템 시각이 어긋나 있지 않은지 (인증서 NotBefore/NotAfter)
- Android 버전별 trust store 경로가 다른지 확인
```

### 앱 HTTPS 캡처 실패
브라우저 HTTPS는 정상인데 앱만 실패하면 [SSL Pinning 우회](./ssl-pinning-bypass.md)에서 Network Security Config와 Pinning을 구분한다.

### 앱 즉시 종료
기준 단말에서는 실행되고 루팅·Frida 환경에서만 종료되는지 비교한 뒤 [루팅 탐지 우회](./root-detection-bypass.md) 또는 [디버거/Frida 탐지 우회](./anti-debug-bypass.md)로 이동한다.

### `adb devices` unauthorized 상태

```bash
# 단말에서 "RSA 키 허용" 팝업이 떠야 함. 안 뜨면:
adb kill-server
adb start-server
adb devices
# 그래도 안 나오면 단말 → 개발자 옵션 → "USB 디버깅 권한 취소" → 케이블 재연결
```

### AVD `frida-server`·`su` 미지원

→ AVD 이미지가 `user` 빌드인 경우 root 권한 차단. **이미지 선택 시 "Google APIs (No Play Store)" / "AOSP"** 를 사용 — Play Store 가 포함된 이미지는 root 차단. 또는 `rootAVD` / Magisk 패치된 이미지 사용.

### Magisk 사용자 CA 미적용

```text
- 모듈 적용 후 재부팅 했는지 확인
- Magisk 의 "DenyList" 또는 "Zygisk" 설정과 충돌 가능 → 일시적으로 비활성화 후 재시도
- 사용자 CA 슬롯 (설정 → 보안 → 사용자 인증서) 에 Burp CA 가 먼저 들어가 있어야 모듈이 옮길 수 있음
```

---

## 다음 문서

- [정적 분석](./static-analysis.md)
- [Frida 후킹 스크립트](./frida-scripts.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)
- [루팅 탐지 우회](./root-detection-bypass.md)
- [Android 데이터 저장소](./data-storage-android.md)
- [WebView 결함](./webview-issues.md)
- [iOS 환경 구축](./setup-ios.md)

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG - Android Basic Security Testing Setup](https://mas.owasp.org/MASTG/0x05b-Basic-Security-Testing/)
- [OWASP MASTG - Android Platform Overview](https://mas.owasp.org/MASTG/0x05a-Platform-Overview/)
- [Frida 공식 문서 - Android](https://frida.re/docs/android/)
- [Frida Releases (GitHub)](https://github.com/frida/frida/releases)
- [PortSwigger - Configuring an Android device to work with Burp](https://portswigger.net/support/configuring-an-android-device-to-work-with-burp)
- [PortSwigger - Installing Burp's CA certificate in an Android device](https://portswigger.net/support/installing-burp-suites-ca-certificate-in-an-android-device)

### 커뮤니티 참고 / 도구

- [NVISO - MagiskTrustUserCerts](https://github.com/NVISOsecurity/MagiskTrustUserCerts)
- [HackTricks - Android Pentesting](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting)
- [NowSecure - Frida on Android](https://www.nowsecure.com/blog/2023/05/22/frida-on-android/)
