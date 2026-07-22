---
sidebar_position: 3
title: 점검 환경 구축 - iOS
description: 모바일 진단 - iOS 점검 환경 구축 (탈옥 / Sileo / Frida / Burp 프로파일+CA 신뢰 / IPA 추출 / 트러블슈팅)
keywords: [iOS, Jailbreak, palera1n, Dopamine, unc0ver, Sileo, Frida, Burp Suite, IPA, frida-ios-dump, MASVS, MASTG, 모바일 환경 구축]
draft: false
toc_max_heading_level: 3
---

> iOS는 비탈옥 단말의 프록시 기준선과 탈옥 단말의 심화 분석 환경을 분리해 준비한다. 탈옥 도구는 문서의 고정 표를 믿지 않고 단말 SoC와 정확한 iOS 버전을 공식 호환표에 대조한다.

## 환경 선택

| 환경 | 먼저 할 수 있는 것 | 제한·확인할 것 | 권장 사용 |
| :--- | :--- | :--- | :--- |
| **비탈옥 실기기** | 사용자 CA, Burp 프록시, 앱 기능과 일반 통신 기준선 | 다른 앱 컨테이너, App Store 앱 후킹, 복호화 추출 제한 | 고객 환경 기준선 |
| **탈옥 실기기** | Frida, 앱 컨테이너, 복호화 추출, 보호기법 분석 | 단말·iOS·탈옥 도구 호환성, 탐지와 안정성 | 심화 동적 분석 |
| **Simulator** | 개발 빌드의 빠른 반복, 기본 정적·동적 관찰 | 실기기 Keychain, Data Protection, 코드서명, 탈옥 탐지와 차이 | 학습과 개발 빌드 보조 |

탈옥은 모든 모바일 점검의 시작 조건이 아니다. 먼저 비탈옥 단말에서 Safari와 앱의 동작을 비교하고, 컨테이너 접근·Frida·복호화 IPA처럼 탈옥이 필요한 작업에서 심화 환경으로 전환한다.

---

## 구축 목표

다음 결과를 각각 확인한다.

1. USB 페어링과 단말 식별이 정상이다.
2. 비탈옥 상태에서도 Safari HTTP/HTTPS가 Burp에 보인다.
3. 탈옥 또는 debuggable 환경에서는 `frida-ps -U`가 성공한다.
4. 고객 제공 IPA 또는 승인된 추출 경로를 확보한다.

> **다른 페이지와 영역 분리**
> - 탈옥 탐지 대응 → [탈옥 탐지 우회](./jailbreak-detection-bypass.md)
> - SSL Pinning 대응 → [SSL Pinning 우회](./ssl-pinning-bypass.md)
> - 공용 후킹 패턴 → [Frida 후킹 스크립트](./frida-scripts.md)
> - IPA 구조와 코드 탐색 → [정적 분석](./static-analysis.md)
> - Android 환경 → [Android 환경 구축](./setup-android.md)

---

## 사전 조건

### PC 측 준비

- Burp와 Frida CLI는 Windows, macOS, Linux에서 사용 가능
- 탈옥 도구, Xcode, 코드서명과 개발 빌드 분석은 macOS가 가장 수월함
- 최신 Python 3과 격리된 가상환경
- macOS/Linux에서는 `libimobiledevice`, 필요한 경우 `usbmuxd`와 `iproxy`
- 데이터 전송과 DFU를 지원하는 케이블. 케이블 종류에 따라 DFU 인식 차이가 날 수 있음

### 단말 측 준비

탈옥을 선택하기 전에 아래 값을 기록한다.

```text
기기 모델:
SoC:
iOS 정확한 버전:
탈옥 도구와 릴리스:
rootless / rootful:
패스코드·DFU 제약:
원복 방법:
```

- palera1n은 checkm8 대상인 A8~A11 계열의 공식 호환 장치만 고려한다. A12 이상을 palera1n 대상으로 분류하지 않는다.
- Dopamine 지원 범위는 stable과 beta가 달라질 수 있으므로 공식 README와 해당 릴리스 노트를 모두 확인한다.
- A11 장치는 iOS 버전에 따라 패스코드 비활성화나 초기화 조건이 생길 수 있다. 개인 단말이 아니라 초기화 가능한 점검 전용 단말을 사용한다.
- MDM·사내 Apple ID 정책과 충돌하면 임의로 우회하지 않고 별도 점검 단말이나 고객 제공 환경을 사용한다.

---

## 구축 절차

경로를 먼저 고른다.

| 목적 | 진행 순서 |
| :--- | :--- |
| 비탈옥 기준선 | Step 1 → Step 5 |
| 탈옥 심화 분석 | Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 |
| 고객 제공 debuggable build | Step 1 → Step 4의 비탈옥 Frida 방식 → Step 5 |

#### Step 1. 단말 식별과 USB 기준선

macOS/Linux에서 `libimobiledevice`를 사용할 수 있으면 페어링 상태와 정확한 버전을 먼저 저장한다.

```bash
idevice_id -l
ideviceinfo -k ProductType
ideviceinfo -k ProductVersion
```

Windows에서는 Apple Devices 또는 iTunes가 단말을 정상 인식하고 신뢰 팝업이 승인됐는지 먼저 확인한다. 이 단계가 실패하면 Frida, IPA 전송, SSH 포워딩을 진행하지 않는다.

#### Step 2. 필요한 경우 탈옥 환경 준비

**Dopamine 계열:**

```text
1. 공식 README와 릴리스에서 SoC·iOS 지원 여부 확인
2. 릴리스가 stable인지 beta인지 기록
3. 공식 배포 경로에서 IPA 확보
4. 지원되는 사이드로드 방식과 만료 조건 확인
5. 탈옥 후 rootless/rootful과 패키지 매니저 상태 기록
```

**palera1n:**

```bash
# 공식 설치 후 현재 옵션 확인
palera1n --version
palera1n --help
```

DFU 진입과 rootless/rootful 옵션은 장치와 릴리스에 따라 달라질 수 있으므로 공식 설치 문서를 그대로 따른다. 특히 A11의 패스코드·초기화 조건을 확인하기 전에는 진행하지 않는다.

**탈옥이 필요한 시점**: App Store 앱의 광범위한 런타임 후킹, 다른 앱 컨테이너 접근, 복호화 IPA 추출처럼 stock 환경의 sandbox와 코드서명 제한을 넘어야 할 때다. Burp CA 프로파일 설치와 Safari 프록시 기준선은 탈옥 없이 가능하다.

#### Step 3. 패키지 매니저와 설치 출처 확인

탈옥 방식에 따라 Sileo, Zebra 등 패키지 매니저와 rootless 경로가 달라진다. 저장소를 한꺼번에 추가하지 말고 필요한 패키지의 공식 출처부터 확인한다.

```text
Sileo → Sources → Edit → Add Repository

  - https://build.frida.re                    (Frida 공식)
```

커뮤니티 tweak 저장소는 보호기법 문서에서 필요한 경우에만 추가한다. 오래된 tweak와 현재 rootless 환경의 호환성을 이름만 보고 판단하지 않는다.

#### Step 4. Frida 설치와 연결

**단말 측:**

```text
Sileo → Search → "frida" 검색 → "Frida" (build.frida.re 의 패키지) 설치
설치 후 SSH 또는 NewTerm 으로 단말 쉘 진입 후 확인:

  frida-server --version
```

**PC 측 — `frida-tools` 설치:**

```powershell
py -m venv .venv-frida
.\.venv-frida\Scripts\Activate.ps1
python -m pip install --upgrade frida-tools
frida --version
```

macOS/Linux도 가상환경 안에서 `python -m pip install --upgrade frida-tools`를 사용한다. PC와 단말은 가능한 한 같은 Frida 릴리스로 맞춘다.

**검증:**

```bash
# USB 연결
frida-ps -U
# PID    Name
# -----  ----------------------------
# 234    SpringBoard
# 567    com.target.app
# ...
```

현재 Frida는 USB 연결에 `-U`를 직접 사용한다. `iproxy 27042 27042`를 기본 절차로 먼저 실행하지 않는다. USB 자동 탐지가 실패했거나 별도 TCP 연결을 의도한 경우에만 포워딩을 보조 수단으로 검토한다.

Frida 공식 문서는 탈옥하지 않은 단말에서도 debuggable 앱과 Frida Gadget을 사용하는 방식을 제공한다. 고객이 제공한 개발 빌드라면 탈옥부터 시도하지 말고 해당 경로를 우선 확인한다.

#### Step 5. Burp 프로파일과 CA 신뢰

**5-1. Burp 측 — Wi-Fi 인터페이스 바인딩:**

```text
Burp → Settings → Tools → Proxy → Proxy listeners → Add
  Bind to port:    8080
  Bind to address: All interfaces
```

**5-2. 단말 측 — 매뉴얼 프록시:**

```text
설정 → Wi-Fi → 연결된 네트워크 (i 아이콘) → HTTP 프록시 → 수동 구성
  서버:  <PC LAN IP>
  포트:  8080
```

**5-3. Burp CA 다운로드 + 프로파일 설치:**

```text
1) 단말 Safari 에서 http://burp 접속 (프록시 설정된 상태)
2) 우상단 "CA Certificate" 클릭 → cacert.cer 다운로드
3) 단말 → 설정 → 일반 → VPN 및 기기 관리 → 다운로드된 프로파일
   → "PortSwigger CA" 선택 → 설치 → 패스코드 입력 → 동의
```

**5-4. 인증서 완전 신뢰 (필수 — 누락하면 HTTPS 캡처 실패)**

iOS 10.3+ 이후 사용자 설치 CA 는 **명시적으로 "완전 신뢰" 토글을 켜야** SSL 검증에 사용된다.

```text
설정 → 일반 → 정보 → 인증서 신뢰 설정
  → "PortSwigger CA" 토글 ON
```

**검증**: 단말 Safari 에서 `https://example.com` 접속 시 Burp 에서 평문 캡처 + 인증서 경고 없음.

이 절차는 탈옥하지 않은 iOS에서도 가능하다. Safari 기준선은 정상인데 점검 대상 앱만 실패하면 [SSL Pinning 우회](./ssl-pinning-bypass.md)에서 앱의 trust 처리와 Pinning을 확인한다.

#### Step 6. 분석 대상 IPA 확보

우선순위는 다음과 같다.

1. 고객이 제공한 승인된 테스트 IPA, dSYM, 앱 버전 정보
2. 개발팀이 제공한 debuggable 또는 테스트 빌드
3. 승인된 계정으로 설치한 App Store 앱을 탈옥 단말에서 복호화 추출

App Store 실행 파일은 FairPlay 보호 상태일 수 있으므로 단순 다운로드 파일을 바로 디스어셈블할 수 있다고 가정하지 않는다. 고객 제공 빌드와 App Store 배포본의 서명·설정 차이도 함께 기록한다.

```bash
# 커뮤니티 도구 예시 — 저장소 상태와 현재 Frida/Python 호환성 확인
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

`frida-ios-dump`는 커뮤니티 도구다. 실패하면 동일 명령을 반복하기보다 현재 저장소의 지원 상태, Python 의존성, SSH 연결, rootless 경로와 Frida 호환성을 확인한다. TestFlight 또는 `ipatool` 다운로드 결과도 자동으로 복호화 분석본이라고 단정하지 않는다.

---

## 구축 검증

선택한 환경에 해당하는 항목이 정상이면 구축 완료다.

- [ ] USB 페어링과 단말 모델·iOS 버전 기록 완료
- [ ] 단말 Safari 에서 `https://example.com` 접속 시 Burp 에서 평문 캡처 + 인증서 경고 없음
- [ ] 탈옥·debuggable 환경이면 `frida-ps -U`가 프로세스 목록 출력
- [ ] 고객 제공 IPA 또는 승인된 추출 경로와 앱 버전 확인

앱만 통신이나 실행에 실패하면 환경 구축 실패와 보호기법 동작을 분리해서 기록한다.

---

## 트러블슈팅

### Dopamine 7일 만료

```text
- 무료 Apple ID 사이드로드는 7일 만료
- 해결: 유료 개발자 계정 사이드로드 (1년) 또는 매주 재사이드로드
- 또는 TrollStore (영구 사이드로드, iOS 14~16.6.x 일부) 사용
```

### `frida-ps -U` 단말 미인식

```bash
# USB 연결 + libimobiledevice 동작 확인
idevice_id -l
# UUID 가 출력되어야 함

# 단말 Frida launch daemon 상태 확인
launchctl list | grep frida
# re.frida.server   ...

# 다시 시작
launchctl unload /Library/LaunchDaemons/re.frida.server.plist
launchctl load   /Library/LaunchDaemons/re.frida.server.plist
```

### Safari HTTPS 인증서 오류

```text
- 설정 → 일반 → 정보 → 인증서 신뢰 설정 에서 "PortSwigger CA" 토글이 OFF
  → 위 5-4 단계 수행
- 프로파일 설치는 했지만 신뢰 토글을 안 켰을 가능성 (가장 흔한 실수)
```

### 앱 HTTPS 캡처 실패

Safari는 정상인데 앱만 실패하는지 먼저 확인한다. 이후 [SSL Pinning 우회](./ssl-pinning-bypass.md)에서 ATS, 사용자 CA 비신뢰, Pinning을 구분한다.

### 앱 즉시 종료

비탈옥 단말에서는 정상인지 비교한 뒤 [탈옥 탐지 우회](./jailbreak-detection-bypass.md)와 [디버거/Frida 탐지 우회](./anti-debug-bypass.md)로 이동한다.

### `frida-ios-dump` SSH 연결 실패

```bash
# SSH 가 단말에 설치되어 있어야 함
# Sileo 에서 "OpenSSH" 또는 "Dropbear" 설치
# 포트 포워딩
iproxy 2222 22
ssh root@127.0.0.1 -p 2222
```

SSH 계정과 초기 암호는 jailbreak/bootstrap 구성에 따라 다를 수 있다. 공식 문서에서 확인하고, 기본 암호가 설정된 환경이면 점검망에 연결하기 전에 변경한다.

### 구형 SSL tweak 미동작

현재 iOS, rootless 환경, 앱의 TLS 라이브러리와 tweak 지원 범위를 확인한다. 특정 tweak 또는 Frida 스크립트가 항상 더 안정적이라고 단정하지 않고, 앱이 사용하는 검증 지점을 식별해 [SSL Pinning 우회](./ssl-pinning-bypass.md)의 다음 방법을 선택한다.

---

## 다음 문서

- [정적 분석](./static-analysis.md)
- [Frida 후킹 스크립트](./frida-scripts.md)
- [SSL Pinning 우회](./ssl-pinning-bypass.md)
- [탈옥 탐지 우회](./jailbreak-detection-bypass.md)
- [iOS 데이터 저장소](./data-storage-ios.md)
- [Android 환경 구축](./setup-android.md)

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG - iOS Basic Security Testing Setup](https://mas.owasp.org/MASTG/0x06b-Basic-Security-Testing/)
- [Frida 공식 문서 - iOS](https://frida.re/docs/ios/)
- [Dopamine (Jailbreak)](https://github.com/opa334/Dopamine)
- [palera1n 호환표](https://docs.palera.in/docs/reference/compatibility-chart/)
- [Apple - 수동 설치 인증서 신뢰](https://support.apple.com/102390)

### 커뮤니티 참고 / 도구

- [frida-ios-dump](https://github.com/AloneMonkey/frida-ios-dump)
- [ipatool](https://github.com/majd/ipatool)
- [PortSwigger - Installing Burp's CA certificate in an iOS device](https://portswigger.net/support/installing-burp-suites-ca-certificate-in-an-ios-device)
- [HackTricks - iOS Pentesting](https://book.hacktricks.xyz/mobile-pentesting/ios-pentesting)
- [NowSecure - iOS Pentesting Setup](https://www.nowsecure.com/blog/2024/01/16/ios-pen-testing-setup/)
