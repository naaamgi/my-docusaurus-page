---
title: 모바일 진단 워크플로우
sidebar_position: 1
sidebar_label: 모바일 워크플로우 (인덱스)
description: 모바일 앱 취약점 진단 점검 항목 - OWASP MASVS / MASTG 및 KISA 모바일 가이드 기반 매핑
keywords: [mobile pentest, OWASP MASVS, MASTG, KISA, Android, iOS, Frida, Objection]
slug: /assessment/mobile
draft: false
---

> 모바일 앱을 처음 받았을 때 어떤 문서부터 열어야 하는지 연결하는 작업 인덱스다. 학습할 때는 `기반 구축 → 보호기법 우회 → 주요 점검` 순서로 진행하고, 실제 프로젝트에서는 점검을 막는 보호기법만 필요한 만큼 우회한다.

---

## 학습 순서

```mermaid
flowchart LR
    A["1. 환경 구축"] --> B["2. 초기 탐색·정적 분석 기반"]
    B --> C["3. 보호기법 식별·우회"]
    C --> D["4. 주요 점검 항목"]
    D --> E["5. 네이티브 분석 심화"]
    E --> F["6. 결과 해석·증적 정리"]
```

### 1. 실습 기반

| 순서 | 문서 | 완료 기준 |
| :--- | :--- | :--- |
| 1 | [Android 환경 구축](./setup-android) 또는 [iOS 환경 구축](./setup-ios) | 단말 연결, 프록시 기준선, 분석 대상 확보 |
| 2 | [초기 정보 탐색 루틴](./initial-analysis-routine) | 기준 정보, 실행·프록시 기준선, 주요 파일과 보호기법 분기 정리 |
| 3 | [정적 분석](./static-analysis) | APK/IPA 구조, 설정, 주요 클래스와 호출 지점 파악 |
| 4 | [Frida 후킹 스크립트](./frida-scripts) | attach/spawn, 클래스 탐색, 인자·반환값 관찰 |

Android와 iOS 환경 구축 문서는 합치지 않는다. 필요한 단말 준비, 인증서 신뢰, 앱 추출 방식과 트러블슈팅이 서로 다르기 때문이다.

### 2. 보호·우회

| 현재 막힘 | 먼저 볼 문서 |
| :--- | :--- |
| HTTPS 요청이 앱에서만 보이지 않음 | [SSL Pinning 우회](./ssl-pinning-bypass) |
| 루팅·탈옥 안내 후 앱이 종료됨 | [루팅 탐지 우회](./root-detection-bypass), [탈옥 탐지 우회](./jailbreak-detection-bypass) |
| Frida attach/spawn 직후 종료됨 | [디버거/Frida 탐지 우회](./anti-debug-bypass) |
| 수정·재서명한 앱이 실행되지 않음 | [앱 위변조 / 재패키징 점검](./app-tampering) |

학습할 때는 각 보호기법을 모두 실습한다. 실제 프로젝트에서는 정적 분석과 기준선 관찰로 적용 여부를 먼저 확인하고, 본 점검을 막는 보호기법만 제한적으로 우회한다.

### 3. 고객사 주요 점검

| 영역 | Android | iOS / 공통 |
| :--- | :--- | :--- |
| 데이터 저장 | [Android 데이터 저장소](./data-storage-android) | [iOS 데이터 저장소](./data-storage-ios) |
| 통신 | [인증서 검증 및 평문 통신](./certificate-validation) | [SSL Pinning 우회](./ssl-pinning-bypass) |
| 플랫폼 연동 | [Export된 컴포넌트](./exported-components), [Deep Link / Intent](./deeplink-intent) | [Deep Link / Intent](./deeplink-intent), [WebView](./webview-issues) |
| 인증·암호 | [인증 및 세션](./auth-mobile), [로컬 인증](./local-auth-bypass) | [암호화 키 관리](./crypto-keys) |
| 코드·프라이버시 | [코드·의존성 품질](./code-quality) | [개인정보 흐름·노출](./privacy-leakage) |

### 4. 네이티브 심화

기본 점검과 Java·Kotlin·Objective-C·Swift 계층의 분석으로 원인을 찾지 못했을 때 [IDA Pro 네이티브 분석](./ida-pro-analysis)을 연다. JNI 함수, 자체 `.so`, iOS Framework, Native 파서·암호 루틴처럼 네이티브 계층에 진입해야 하는 대상을 마지막 심화 단계로 둔다.

---

## MASVS 문서 매핑

OWASP MASTG 2.x는 `MASVS Control → MASWE Weakness → MASTG Test` 관계로 테스트 근거를 연결한다. 아래 표는 문서 탐색용 상위 매핑이며, 세부 MASWE/MASTG ID는 각 문서를 정리할 때 검증해 추가한다.

| MASVS 카테고리 | 설명 | 관련 페이지 |
| :--- | :--- | :--- |
| **MASVS-STORAGE** | 안전한 데이터 저장 | [data-storage-android](./data-storage-android), [data-storage-ios](./data-storage-ios) |
| **MASVS-CRYPTO** | 암호화 키 관리 | [crypto-keys](./crypto-keys) |
| **MASVS-AUTH** | 인증 및 세션 관리 | [auth-mobile](./auth-mobile), [local-auth-bypass](./local-auth-bypass) |
| **MASVS-NETWORK** | 안전한 네트워크 통신 | [ssl-pinning-bypass](./ssl-pinning-bypass), [certificate-validation](./certificate-validation) |
| **MASVS-PLATFORM** | 플랫폼 보안 메커니즘 사용 | [webview-issues](./webview-issues), [deeplink-intent](./deeplink-intent), [exported-components](./exported-components) |
| **MASVS-CODE** | 안전한 코드 작성 | [static-analysis](./static-analysis), [code-quality](./code-quality) |
| **MASVS-RESILIENCE** | 무결성·분석 저항성 | [root-detection-bypass](./root-detection-bypass), [jailbreak-detection-bypass](./jailbreak-detection-bypass), [anti-debug-bypass](./anti-debug-bypass), [app-tampering](./app-tampering) |
| **MASVS-PRIVACY** | 개인정보 보호 | [privacy-leakage](./privacy-leakage) |
| **분석 기반** | 환경·도구 준비 | [setup-android](./setup-android), [setup-ios](./setup-ios), [initial-analysis-routine](./initial-analysis-routine), [static-analysis](./static-analysis), [frida-scripts](./frida-scripts) |

---

## 작업 전 확인

| 검증 항목 | Android | iOS |
| :--- | :--- | :--- |
| **대상 기록** | 단말 모델, Android/API, ABI, 앱 버전 | 단말 모델·SoC, iOS, 앱 버전, 탈옥 여부 |
| **단말 인식** | `adb devices`가 `device` 상태 | USB 페어링 후 Frida 또는 `idevice_id`로 확인 |
| **프록시 기준선** | 브라우저 HTTP/HTTPS가 Burp에 보임 | Safari HTTP/HTTPS가 Burp에 보임 |
| **후킹 준비** | 적용 환경이면 `frida-ps -U` 성공 | 탈옥 또는 debuggable 환경이면 `frida-ps -U` 성공 |
| **분석 대상** | base/split APK 경로와 추출 방법 확인 | 고객 제공 IPA 또는 승인된 추출 방법 확인 |

브라우저 기준선은 정상인데 점검 대상 앱만 실패하면 환경 문제로 단정하지 않는다. Pinning, 루팅·탈옥 탐지, Frida 탐지 여부를 해당 보호·우회 문서에서 확인한다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG (Testing Guide)](https://mas.owasp.org/MASTG/)
- [Frida 공식 문서](https://frida.re/docs/home/)

### 도구 프로젝트

- [Objection (Frida-based)](https://github.com/sensepost/objection)
- [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF)
