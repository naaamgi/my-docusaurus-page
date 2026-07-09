---
sidebar_position: 2
title: 점검 환경 구축 - Android
description: 모바일 진단 - Android 점검 환경 구축 (ADB / Frida / Burp 프록시 / 시스템 CA / APK 추출 / 트러블슈팅)
keywords: [Android, ADB, Frida, frida-server, Burp Suite, Magisk, CA 인증서, APK, MASVS, MASTG, 모바일 환경 구축, Setup]
draft: false
---

# 점검 환경 구축 - Android
> Android 앱 점검에 필요한 기본 환경 (ADB / Frida / Burp 프록시 / 시스템 CA / APK 핸들링) 셋업.
> 이 페이지를 마치면 점검 대상 앱을 후킹·프록시·정적 분석으로 보낼 준비가 완료된 상태가 된다.

## 점검 환경 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-RESILIENCE / MASTG-TEST 환경 셋업 (점검 전제) |
| **대상 OS** | Android 14 (API 34) 표준 / Android 11 ~ 15 호환 |
| **단말 요건** | 루팅 단말 권장 (Magisk) — ⚠️ 회사 정책상 루팅 단말 제한 시 추가 가이드 필요 |
| **예상 소요** | 1 ~ 2 시간 (최초 1회) |
| **핵심 도구** | ADB, frida-tools, frida-server, Burp Suite, Magisk |

---

## 환경 구축 목적

Android 앱 점검은 (1) 단말 ↔ PC 간 제어 채널 (ADB), (2) 앱 런타임 후킹 (Frida), (3) HTTPS 트래픽 가시화 (Burp + 시스템 CA) 가 동시에 작동해야 의미 있는 결과를 얻는다. 이 페이지는 점검 첫날 한 번에 셋업이 끝나도록 절차를 정리한다.

> **다른 페이지와 영역 분리**
> - SSL Pinning 우회 (Frida / Objection / Smali 패치) → `ssl-pinning-bypass.md`
> - Root 탐지 우회 (Magisk Hide / Shamiko / Frida) → `root-detection-bypass.md`
> - 자주 쓰는 Frida 후킹 스크립트 모음 → `frida-scripts.md`
> - APK 디컴파일 / Smali / jadx 정적 분석 → `static-analysis.md`
> - iOS 환경 구축 → `setup-ios.md`

---

## 사전 조건

### PC 측 준비
- macOS / Linux / Windows (예시는 macOS / Linux 기준, Windows 는 동일 명령 PowerShell 로 치환)
- Python 3.10 이상 (`python3 --version`)
- Java 17 이상 (Burp Suite / apktool 실행용)
- USB-C 케이블 1개 (또는 동일 Wi-Fi 환경 — 무선 디버깅 사용 시)

### 단말 측 준비
- 루팅된 실기기 (Pixel 6/7/8 계열 권장) 또는 Android Studio AVD `Google APIs (No Play Store)` 이미지
- Magisk 26 이상 설치
- 개발자 옵션 활성화 (설정 → 휴대전화 정보 → 빌드 번호 7회 탭)
- USB 디버깅 ON / OEM 잠금 해제 ON / (Android 11+) 무선 디버깅 ON

⚠️ **회사 정책상 루팅 단말 사용이 제한되는 경우**: 본 페이지 절차는 루팅 단말 가정. 비루팅 단말로만 점검해야 하는 경우 (예: BYOD 정책) 별도 가이드 필요 — 비루팅 단말에서는 시스템 CA 승격 / frida-server 실행 / 일부 후킹이 불가능해 점검 범위가 축소됨.

---

## 구축 절차

### Step 1. ADB 설치 + 단말 연결

**PC 측 설치:**

```bash
# macOS — Homebrew
brew install --cask android-platform-tools

# Ubuntu / Debian
sudo apt install android-tools-adb android-tools-fastboot

# Windows — Android SDK Platform Tools 직접 다운로드
# https://developer.android.com/tools/releases/platform-tools
```

**버전 + 단말 인식 확인:**

```bash
adb version
# Android Debug Bridge version 1.0.41 이상 권장

adb devices
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

### Step 2. Frida 환경 — PC `frida-tools` + 단말 `frida-server`

**핵심: 버전 매칭.** PC `frida-tools` 메이저 버전과 단말 `frida-server` 버전이 어긋나면 `frida-ps` 단계부터 실패한다.

**PC 측 — `frida-tools` 설치:**

```bash
# 시스템 Python 에 직접 설치
pip3 install --upgrade frida-tools

# 또는 가상환경 사용
python3 -m venv ~/venv-frida
source ~/venv-frida/bin/activate
pip install frida-tools

frida --version
# 16.x 가 나와야 함
```

**단말 측 — `frida-server` 푸시:**

```bash
# 1) PC 측 frida 버전 확인
frida --version
# 예: 16.5.1

# 2) 단말 아키텍처 확인
adb shell getprop ro.product.cpu.abi
# 결과 예: arm64-v8a    ← 일반적인 실기기
#         x86_64        ← Android Studio AVD

# 3) frida-server 다운로드
# https://github.com/frida/frida/releases/tag/16.5.1
# 예: frida-server-16.5.1-android-arm64.xz
xz -d frida-server-16.5.1-android-arm64.xz

# 4) 단말로 푸시 + 실행
adb push frida-server-16.5.1-android-arm64 /data/local/tmp/frida-server
adb shell "chmod 755 /data/local/tmp/frida-server"
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

**왜 이 단계가 핵심인지**: `frida-server` 가 동작 중이어야 모든 런타임 후킹 (SSL Pinning 우회 / Root 탐지 우회 / 데이터 추출) 이 가능. **단말 재부팅 시 `frida-server` 도 다시 띄워야 함** — 자동화하려면 Magisk 모듈 `MagiskFrida` 사용.

### Step 3. Burp Suite 프록시 설정

**Burp 측 — 외부 인터페이스 바인딩:**

```
Burp Suite → Settings → Tools → Proxy
  → Proxy listeners → Add (또는 127.0.0.1:8080 편집)
     Bind to port:    8080
     Bind to address: All interfaces (또는 PC LAN IP 직접 지정)
```

⚠️ 단말과 PC 가 동일 Wi-Fi 에 있어야 함. **사내망 / 공용 Wi-Fi 에서는 PC 의 IP + Burp 포트가 외부에 노출**되니, 점검 종료 시 반드시 `Loopback only` 로 되돌리거나 방화벽으로 8080 차단.

**단말 측 — 매뉴얼 프록시:**

```
설정 → 네트워크 → Wi-Fi → 연결된 SSID 길게 누름 → 수정 → 고급 옵션
  프록시:        수동
  프록시 호스트: <PC LAN IP>     (예: 192.168.0.10)
  프록시 포트:   8080
```

**검증 — HTTP 트래픽:**

단말 브라우저에서 `http://example.com` 접속 → Burp Proxy History 에 요청이 보이면 정상. **이 시점에선 HTTPS 는 아직 인증서 오류로 캡처 불가** — Step 4 에서 해결.

### Step 4. Burp CA 인증서 설치
**왜 시스템 CA 로 승격해야 하는지**: Android 7 (Nougat, API 24) 이후 앱은 기본적으로 **사용자가 추가한 CA 인증서를 신뢰하지 않는다** (Network Security Config 정책). 점검 대상 앱이 기본 설정대로 빌드된 경우, Burp CA 가 "사용자 CA" 슬롯에만 있으면 HTTPS 캡처 실패 — Pinning 여부와 무관하게 SSL handshake 에러.

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

**왜 파일명을 바꿔야 하는지**: Android 시스템 CA 디렉토리 (`/system/etc/security/cacerts/`) 는 **OpenSSL subject hash (8자) + `.0` 형식 파일명만** 인식. 임의 파일명을 두면 인증서가 로드되지 않는다.

#### 4-2. 방법 A — Magisk 모듈
```
Magisk → Modules 에서 다음 중 하나 설치:
  - MagiskTrustUserCerts    (사용자 CA 슬롯의 모든 인증서를 시스템 CA 로 승격)
  - AlwaysTrustUserCerts    (동일 목적, 다른 메인테이너)
  - Move Certificates       (동일 목적)
```

**적용 절차:**

```
1) 단말에서 Burp CA (cacert.der) 다운로드
   → 설정 → 보안 → 암호화 및 자격 증명 → CA 인증서 설치 → cacert.der 선택
2) Magisk → Modules → MagiskTrustUserCerts 활성화
3) 단말 재부팅
4) 설정 → 보안 → 신뢰할 수 있는 자격증명 → "시스템" 탭 에서 "PortSwigger" 항목 확인
```

**언제 쓰는지**: Magisk 가 설치된 실기기 / 에뮬레이터. 재부팅 시 자동으로 시스템 CA 로 다시 주입되어 유지보수 부담이 없다.

#### 4-3. 방법 B — tmpfs 마운트로 직접 푸시
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

**언제 쓰는지**: Magisk 가 없는 단말 / `userdebug` 빌드 AVD. **재부팅 시 tmpfs 가 해제**되어 적용이 풀린다 — 매 부팅마다 다시 적용해야 함.

#### 4-4. 검증

단말 브라우저에서 `https://example.com` 접속 → Burp 에서 HTTPS 평문이 캡처되고 인증서 경고 없음 → 시스템 CA 적용 정상.

> **점검 대상 앱은 여전히 캡처 실패할 수 있음** — 앱이 SSL Pinning 을 별도로 적용한 경우. 이 케이스는 환경 구축의 영역이 아니라 `ssl-pinning-bypass.md` 의 영역.

### Step 5. APK 추출 + 설치

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

# 강제 재설치 — 서명이 같으면 -r, 서명 다르면 -d 추가
adb install -r -d target-base.apk
```

**왜 이 단계가 필요한지**: 점검 대상이 스토어 배포 앱인 경우 APK 를 추출해 정적 분석 (`static-analysis.md`) 으로 보내야 한다. SSL Pinning 우회용 Smali 패치 / 재서명한 APK 를 다시 설치하는 흐름도 빈번 — 재설치 명령을 미리 확인.

---

## 검증 — 구축 완료 시그널

다음 4 가지가 동시에 정상이면 환경 구축 완료:

- [ ] `adb devices` 출력에서 단말이 `device` 상태로 표시
- [ ] `frida-ps -U` 가 단말의 프로세스 목록을 정상 출력 (수십~수백 개)
- [ ] 단말 브라우저에서 `https://example.com` 접속 시 Burp 에서 HTTPS 평문 캡처 + 인증서 경고 없음
- [ ] 점검 대상 앱이 정상 실행 (단, 앱이 Pinning / Root 탐지로 차단되면 후속 페이지에서 우회 적용)

---

## 트러블슈팅

### `frida-ps -U` 가 `unable to connect to remote frida-server`

```bash
# 1) frida-server 가 실제 실행 중인지 확인
adb shell "ps -A | grep frida"
# 결과 없으면 다시 실행
adb shell "su -c '/data/local/tmp/frida-server &'"

# 2) 버전 매칭 확인
frida --version                                       # PC
adb shell /data/local/tmp/frida-server --version      # 단말
# 메이저 버전이 다르면 PC 의 frida-tools 또는 단말 frida-server 중 하나를 맞춤
```

### `frida-server: cannot execute binary file: Exec format error`

아키텍처가 어긋난 경우. arm64 단말에 x86_64 바이너리를 푸시했거나 반대. `adb shell getprop ro.product.cpu.abi` 로 다시 확인 후 올바른 바이너리 다운로드.

### Burp 에서 HTTPS 캡처가 여전히 인증서 오류
```
- /system/etc/security/cacerts/<hash>.0 파일이 실제로 존재하는지 ls 로 확인
- hash 가 맞는지 (subject_hash_old / subject_hash 두 가지 모두 시도)
- chmod 644 권한 확인
- 재부팅 후 다시 시도 (Magisk 모듈 방식은 부팅 시 트러스트 주입)
- 단말의 시스템 시각이 어긋나 있지 않은지 (인증서 NotBefore/NotAfter)
```

### 점검 대상 앱만 HTTPS 캡처 실패
→ **앱이 SSL Pinning 을 적용한 경우** — 환경 구축의 영역이 아님. `ssl-pinning-bypass.md` 참조 (Frida 스크립트 / Objection / Smali 패치).

### 앱이 실행 즉시 종료
→ **Root 탐지 또는 Frida 탐지** — `root-detection-bypass.md` / `anti-debug-bypass.md` 참조.

### `adb devices` 가 `unauthorized` 로 표시

```bash
# 단말에서 "RSA 키 허용" 팝업이 떠야 함. 안 뜨면:
adb kill-server
adb start-server
adb devices
# 그래도 안 나오면 단말 → 개발자 옵션 → "USB 디버깅 권한 취소" → 케이블 재연결
```

### Android Studio AVD 에서 `frida-server` 가 실행 안 됨 / `su` 명령 없음

→ AVD 이미지가 `user` 빌드인 경우 root 권한 차단. **이미지 선택 시 "Google APIs (No Play Store)" / "AOSP"** 를 사용 — Play Store 가 포함된 이미지는 root 차단. 또는 `rootAVD` / Magisk 패치된 이미지 사용.

### Magisk 모듈 활성화 후에도 사용자 CA 가 시스템으로 안 올라옴

```
- 모듈 적용 후 재부팅 했는지 확인
- Magisk 의 "DenyList" 또는 "Zygisk" 설정과 충돌 가능 → 일시적으로 비활성화 후 재시도
- 사용자 CA 슬롯 (설정 → 보안 → 사용자 인증서) 에 Burp CA 가 먼저 들어가 있어야 모듈이 옮길 수 있음
```

---

## 다른 페이지로 위임

- **SSL Pinning 우회** (Frida / Objection / Smali 패치) → `ssl-pinning-bypass.md`
- **Root 탐지 우회** (Magisk Hide / Shamiko / Frida) → `root-detection-bypass.md`
- **Frida 후킹 스크립트 모음** (Java.use / Java.choose / ClassLoader 후킹 등) → `frida-scripts.md`
- **정적 분석 도구** (apktool / jadx / dex2jar) → `static-analysis.md`
- **iOS 환경 구축** → `setup-ios.md`
- **데이터 저장소 점검** (SharedPreferences / SQLite / Keystore) → `data-storage-android.md`
- **WebView 결함** (JavaScript Interface / file:// 접근) → `webview-issues.md`

---

## 참고자료

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG - Android Basic Security Testing Setup](https://mas.owasp.org/MASTG/0x05b-Basic-Security-Testing/)
- [OWASP MASTG - Android Platform Overview](https://mas.owasp.org/MASTG/0x05a-Platform-Overview/)
- [Frida 공식 문서 - Android](https://frida.re/docs/android/)
- [Frida Releases (GitHub)](https://github.com/frida/frida/releases)
- [PortSwigger - Configuring an Android device to work with Burp](https://portswigger.net/support/configuring-an-android-device-to-work-with-burp)
- [PortSwigger - Installing Burp's CA certificate in an Android device](https://portswigger.net/support/installing-burp-suites-ca-certificate-in-an-android-device)
- [NVISO - MagiskTrustUserCerts](https://github.com/NVISOsecurity/MagiskTrustUserCerts)
- [HackTricks - Android Pentesting](https://book.hacktricks.xyz/mobile-pentesting/android-app-pentesting)
- [NowSecure - Frida on Android](https://www.nowsecure.com/blog/2023/05/22/frida-on-android/)
