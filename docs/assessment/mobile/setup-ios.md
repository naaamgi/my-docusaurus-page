---
sidebar_position: 3
title: 점검 환경 구축 - iOS
description: 모바일 진단 - iOS 점검 환경 구축 (탈옥 / Sileo / Frida / Burp 프로파일+CA 신뢰 / IPA 추출 / 트러블슈팅)
keywords: [iOS, Jailbreak, palera1n, Dopamine, unc0ver, Sileo, Frida, Burp Suite, IPA, frida-ios-dump, MASVS, MASTG, 모바일 환경 구축]
draft: false
---

# 점검 환경 구축 - iOS
> iOS 앱 점검에 필요한 기본 환경 (탈옥 / Sileo / Frida / Burp 프로파일·CA 신뢰 / IPA 추출) 셋업.
> Android 와 달리 단말 / iOS 버전 / 탈옥 도구 매칭이 까다로워, **단말 + iOS 버전을 먼저 정하고 거기 맞는 탈옥 도구를 고르는 흐름**.

## 점검 환경 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP MASVS-RESILIENCE / MASTG-TEST 환경 셋업 (점검 전제) |
| **대상 OS** | iOS 17 표준 / iOS 15 ~ 17 호환 (단말+탈옥도구 매칭 표 참조) |
| **단말 요건** | 탈옥 가능 실기기 (시뮬레이터로는 동적 분석 불가) — ⚠️ 회사 정책 시 별도 가이드 필요 |
| **예상 소요** | 2 ~ 4 시간 (탈옥 단계 포함, 최초 1회) |
| **핵심 도구** | palera1n / Dopamine, Sileo, Frida, Burp Suite, frida-ios-dump |

---

## 환경 구축 목적

iOS 앱 점검은 (1) 탈옥된 실기기, (2) 패키지 매니저 (Sileo) + Frida, (3) Burp 프로파일 + CA 신뢰가 동시에 갖춰져야 가능. 시뮬레이터는 ARM 바이너리 실행이 안 되고 (Apple Silicon 일부 예외) 키체인·Data Protection·코드사이닝 등 보안 메커니즘 검증이 불가능해, **점검은 반드시 실기기 + 탈옥** 환경에서 진행한다.

> **다른 페이지와 영역 분리**
> - 탈옥 탐지 우회 (Liberty Lite / Shadow / Frida) → `jailbreak-detection-bypass.md`
> - SSL Pinning 우회 (Frida / SSL Kill Switch / Objection) → `ssl-pinning-bypass.md`
> - Frida 후킹 스크립트 모음 → `frida-scripts.md`
> - IPA 디컴파일 / class-dump / Hopper → `static-analysis.md`
> - Android 환경 구축 → `setup-android.md`

---

## 사전 조건

### PC 측 준비
- macOS 권장 (Xcode + libimobiledevice 등 iOS 도구 호환성). Linux 도 가능하나 Apple ID / 코드사이닝 작업은 macOS 필요.
- Python 3.10 이상
- `libimobiledevice` (USB 통신) — `brew install libimobiledevice ideviceinstaller`
- USB-C / Lightning 케이블

### 단말 측 준비

**단말 ↔ iOS 버전 ↔ 탈옥 도구 매칭표 (2026-05 기준):**

| 단말 (SoC) | iOS 버전 | 권장 탈옥 도구 | 비고 |
| :--- | :--- | :--- | :--- |
| iPhone 6s ~ X (A9~A11) | iOS 15 / 16 / 17 | **palera1n** (rootless / rootful) | checkm8 기반, 매 부팅마다 재탈옥 |
| iPhone XS ~ 14 (A12~A15) + arm64e | iOS 15 / 16 (~16.6.1) | **Dopamine** | semi-untethered, 안정적 |
| iPhone XS ~ 14 (A12~A15) | iOS 15 / 16 / 17 | **palera1n (rootless mode)** | 일부 버전 제한 |
| iPhone 15 / 16 (A16+) + iOS 17/18 | 제한적 | (대부분 미지원) | 점검용 단말로 부적합 |

⚠️ **iOS 17 의 경우**: 일부 보안 기법 (예: 옛 SSL Kill Switch 2) 가 구조 변경으로 동작하지 않음. **Frida 기반 우회 스크립트가 가장 안전**. 탈옥 환경 구축이 어려우면 **iPhone X / iOS 16.6.x + Dopamine** 조합이 점검 표준 단말로 안정적.

⚠️ **회사 정책**: 일부 회사는 사내 Apple ID / MDM 정책으로 탈옥 단말 관리. 미적용 시 별도 점검 단말 발급 또는 회사 가이드 필요.

---

## 구축 절차

### Step 1. 단말 탈옥

**Dopamine (iOS 15 ~ 16.6.1, A12 ~ A15):**

```
1) Sideloadly 또는 AltStore 로 Dopamine.ipa 사이드로드
   - https://github.com/opa334/Dopamine/releases
2) 단말 → 설정 → 일반 → VPN 및 기기 관리 → 개발자 앱 → Dopamine 신뢰
3) Dopamine 앱 실행 → "Jailbreak" 탭
4) "Install" 후 단말 자동 재부팅
5) 재부팅 후 Dopamine 앱 실행 → "Jailbreak" 다시 탭 (semi-untethered: 부팅마다 1회)
```

**palera1n (iOS 15 ~ 17, checkm8 기반 — A11 이하 또는 A12~ rootless):**

```bash
# macOS 예시
brew install --cask palera1n

# 단말을 DFU 모드로 진입
# iPhone 8/X: 전원 + 음량- 동시 → 화면 꺼지면 음량- 만 유지

palera1n -l            # rootless
# 또는
palera1n -f            # rootful (탈옥 후 더 강한 권한)

# 진행 도중 패스코드 비활성 / 단말 초기화 요구할 수 있음
# 점검 단말은 절대 개인 데이터를 두지 않는 가정
```

**왜 탈옥이 필요한지**: 탈옥 없는 iOS 는 (1) 임의 바이너리 (`frida-server`) 실행 불가, (2) 시스템 디렉토리 / 다른 앱 컨테이너 접근 불가, (3) 시스템 CA 변경 불가. 탈옥 없이는 정적 분석 (IPA 추출 일부) 정도만 가능.

### Step 2. Sileo (패키지 매니저) 확인 + 저장소 추가

탈옥 후 단말에 Sileo (또는 Cydia) 가 설치된다. 점검에 필요한 도구는 모두 Sileo 저장소에서 설치.

```
Sileo → Sources → Edit → Add Repository

  - https://build.frida.re                    (Frida 공식)
  - https://repo.chariz.com                   (Chariz, 다양한 Tweak)
  - https://havoc.app                         (Havoc, 인기 저장소)
  - https://repo.misty.moe                    (Liberty Lite 등)
  - https://opa334.github.io                  (Dopamine 메인테이너)
```

**왜 이 저장소들인지**:
- `build.frida.re` → `frida` / `frida-server` 패키지 (필수)
- `chariz` / `havoc` → 우회용 Tweak (`Liberty Lite`, `A-Bypass`)
- `misty.moe` → SSL Kill Switch 류 (iOS 16 이하만 안정)

### Step 3. Frida 설치

**단말 측:**

```
Sileo → Search → "frida" 검색 → "Frida" (build.frida.re 의 패키지) 설치
설치 후 SSH 또는 NewTerm 으로 단말 쉘 진입 후 확인:

  $ frida-server --version
  16.5.1
```

**PC 측 — `frida-tools` 설치:**

```bash
pip3 install --upgrade frida-tools
frida --version
# 단말의 frida-server 와 동일 메이저 버전이어야 함
```

**검증:**

```bash
# 단말과 동일 Wi-Fi 또는 USB 연결
frida-ps -U
# PID    Name
# -----  ----------------------------
# 234    SpringBoard
# 567    com.target.app
# ...
```

**왜 USB 우선인지**: Wi-Fi 연결은 iOS 의 백그라운드 절전과 충돌 가능. **USB + `iproxy 27042 27042` (libimobiledevice)** 조합이 가장 안정적이며, 회의실 / 출장 환경에서도 동일하게 동작.

```bash
iproxy 27042 27042         # USB 로 Frida 포트 포워딩
frida-ps -H 127.0.0.1
```

### Step 4. Burp 프로파일 + CA 인증서 신뢰

**4-1. Burp 측 — Wi-Fi 인터페이스 바인딩:**

```
Burp → Settings → Tools → Proxy → Proxy listeners → Add
  Bind to port:    8080
  Bind to address: All interfaces
```

**4-2. 단말 측 — 매뉴얼 프록시:**

```
설정 → Wi-Fi → 연결된 네트워크 (i 아이콘) → HTTP 프록시 → 수동 구성
  서버:  <PC LAN IP>
  포트:  8080
```

**4-3. Burp CA 다운로드 + 프로파일 설치:**

```
1) 단말 Safari 에서 http://burp 접속 (프록시 설정된 상태)
2) 우상단 "CA Certificate" 클릭 → cacert.cer 다운로드
3) 단말 → 설정 → 일반 → VPN 및 기기 관리 → 다운로드된 프로파일
   → "PortSwigger CA" 선택 → 설치 → 패스코드 입력 → 동의
```

**4-4. 인증서 완전 신뢰 (필수 — 누락하면 HTTPS 캡처 실패)**

iOS 10.3+ 이후 사용자 설치 CA 는 **명시적으로 "완전 신뢰" 토글을 켜야** SSL 검증에 사용된다.

```
설정 → 일반 → 정보 → 인증서 신뢰 설정
  → "PortSwigger CA" 토글 ON
```

**검증**: 단말 Safari 에서 `https://example.com` 접속 시 Burp 에서 평문 캡처 + 인증서 경고 없음.

> **점검 대상 앱은 여전히 캡처 실패할 수 있음** — SSL Pinning 적용 시. 해당 케이스는 `ssl-pinning-bypass.md` 의 영역.

### Step 5. IPA 추출
**왜 IPA 추출이 필요한지**: App Store 배포 IPA 는 FairPlay 로 암호화되어 있어, **탈옥 단말에서 메모리 덤프**를 통해 복호화된 IPA 를 얻어야 정적 분석 (`static-analysis.md`) 이 가능하다.

```bash
# PC 측 — frida-ios-dump 클론
git clone https://github.com/AloneMonkey/frida-ios-dump
cd frida-ios-dump
pip3 install -r requirements.txt

# 단말과 USB 연결 + iproxy 포워딩
iproxy 2222 22                        # 단말 SSH 포트 포워딩 (Dropbear/OpenSSH)

# 패키지명 또는 Display Name 확인
frida-ps -Uai | grep -i <KEYWORD>
# PID  Name              Identifier
# 567  TargetApp         com.target.app

# 덤프
./dump.py com.target.app -o target.ipa

# 결과 — target.ipa 가 PC 에 생성됨
```

**언제 쓰는지**: App Store 배포 앱 점검. 사내 빌드 / TestFlight IPA 는 이미 복호화 상태이므로 **`ipatool` 로 직접 다운로드** 가능.

```bash
brew install ipatool
ipatool auth login
ipatool download -b com.target.app -o ./target.ipa
```

---

## 검증 — 구축 완료 시그널

다음 4 가지가 동시에 정상이면 환경 구축 완료:

- [ ] 단말 탈옥 상태 유지 (Sileo 정상 실행)
- [ ] `frida-ps -U` 또는 `frida-ps -H 127.0.0.1` 가 단말 프로세스 목록 출력
- [ ] 단말 Safari 에서 `https://example.com` 접속 시 Burp 에서 평문 캡처 + 인증서 경고 없음
- [ ] 점검 대상 앱이 정상 실행 (단, Pinning / 탈옥 탐지로 차단되면 후속 페이지에서 우회 적용)

---

## 트러블슈팅

### 탈옥 앱 (Dopamine) 이 7일 후 만료됨

```
- 무료 Apple ID 사이드로드는 7일 만료
- 해결: 유료 개발자 계정 사이드로드 (1년) 또는 매주 재사이드로드
- 또는 TrollStore (영구 사이드로드, iOS 14~16.6.x 일부) 사용
```

### `frida-ps -U` 가 단말을 못 찾음

```bash
# USB 연결 + libimobiledevice 동작 확인
idevice_id -l
# UUID 가 출력되어야 함

# 단말 frida-server 가 동작 중인지
launchctl list | grep frida
# re.frida.server   ...

# 다시 시작
launchctl unload /Library/LaunchDaemons/re.frida.server.plist
launchctl load   /Library/LaunchDaemons/re.frida.server.plist
```

### Burp HTTPS 캡처 실패 — Safari 에서 인증서 오류

```
- 설정 → 일반 → 정보 → 인증서 신뢰 설정 에서 "PortSwigger CA" 토글이 OFF
  → 위 4-4 단계 수행
- 프로파일 설치는 했지만 신뢰 토글을 안 켰을 가능성 (가장 흔한 실수)
```

### 점검 대상 앱만 HTTPS 캡처 실패
→ **앱이 SSL Pinning 적용** — `ssl-pinning-bypass.md` 참조 (Frida 스크립트가 iOS 17 에서도 가장 안정적).

### 앱이 실행 즉시 종료

→ **탈옥 탐지** — `jailbreak-detection-bypass.md` 참조 (Liberty Lite / A-Bypass / Frida).

### `frida-ios-dump` 가 SSH 연결 실패

```bash
# SSH 가 단말에 설치되어 있어야 함
# Sileo 에서 "OpenSSH" 또는 "Dropbear" 설치
# 단말 SSH 기본 패스워드: alpine
# 포트 포워딩
iproxy 2222 22
ssh root@127.0.0.1 -p 2222
```

### iOS 17 에서 SSL Kill Switch 2 가 동작 안 함

→ iOS 17 의 BoringSSL / 코드사인 변경으로 옛 트윅이 부분 동작. **Frida 스크립트** 로 전환. `ssl-pinning-bypass.md` 의 iOS 섹션 참조.

---

## 다른 페이지로 위임

- **SSL Pinning 우회** → `ssl-pinning-bypass.md`
- **탈옥 탐지 우회** → `jailbreak-detection-bypass.md`
- **Frida 후킹 스크립트 모음** → `frida-scripts.md`
- **정적 분석 (class-dump / Hopper / Ghidra)** → `static-analysis.md`
- **Android 환경 구축** → `setup-android.md`
- **데이터 저장소 점검** (Keychain / NSUserDefaults / plist) → `data-storage-ios.md`

---

## 참고자료

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG - iOS Basic Security Testing Setup](https://mas.owasp.org/MASTG/0x06b-Basic-Security-Testing/)
- [Frida 공식 문서 - iOS](https://frida.re/docs/ios/)
- [Dopamine (Jailbreak)](https://github.com/opa334/Dopamine)
- [palera1n (Jailbreak)](https://palera.in/)
- [frida-ios-dump](https://github.com/AloneMonkey/frida-ios-dump)
- [ipatool](https://github.com/majd/ipatool)
- [PortSwigger - Installing Burp's CA certificate in an iOS device](https://portswigger.net/support/installing-burp-suites-ca-certificate-in-an-ios-device)
- [HackTricks - iOS Pentesting](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting)
- [NowSecure - iOS Pentesting Setup](https://www.nowsecure.com/blog/2024/01/16/ios-pen-testing-setup/)
