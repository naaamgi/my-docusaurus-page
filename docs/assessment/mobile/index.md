---
title: 모바일 진단 워크플로우
sidebar_position: 1
sidebar_label: 모바일 워크플로우 (인덱스)
description: 모바일 앱 취약점 진단 점검 항목 - OWASP MASVS / MASTG 및 KISA 모바일 가이드 기반 매핑
keywords: [mobile pentest, OWASP MASVS, MASTG, KISA, Android, iOS, Frida, Objection]
slug: /assessment/mobile
---

# 모바일 진단 워크플로우

> **이 페이지의 역할**: 모바일 진단 점검 항목 ↔ 개별 문서 매핑 인덱스.
> 환경 / 우회 / 저장 / 플랫폼 영역 **12개 페이지 작성 완료** (2026-05-14). 표에 "(예정)" 으로 표시된 8개 페이지는 후속 작성 예정 — `_migration-plan.md` Priority 4 참조.

---

## 진단 단계 (Phase)

```mermaid
flowchart LR
    A[1. 환경 준비] --> B[2. 정적 분석]
    B --> C[3. 동적 분석]
    C --> D[4. 통신 분석]
    D --> E[5. 영향 검증]
    E --> F[6. 보고서]
```

| 단계 | Android | iOS |
| :--- | :--- | :--- |
| **1. 환경 준비** | 루팅된 디바이스 / 에뮬레이터, ADB, Frida 서버 | 탈옥 디바이스, USB 페어링, Frida |
| **2. 정적 분석** | APK 추출 → apktool / jadx | IPA 추출 → class-dump, Hopper |
| **3. 동적 분석** | Frida, Objection 후킹 | Frida, Cycript |
| **4. 통신 분석** | Burp + 시스템 CA 트러스트 | Burp + 프로파일 설치 + SSL Pinning 우회 |
| **5. 영향 검증** | 데이터 저장소 / 인증 / 권한 검증 | 동일 |
| **6. 보고서** | PoC + 디바이스/OS 버전 정보 포함 | 동일 |

---

## 점검 항목 ↔ 페이지 매핑 (OWASP MASVS v2)

| MASVS 카테고리 | 설명 | 관련 페이지 |
| :--- | :--- | :--- |
| **MASVS-STORAGE** | 안전한 데이터 저장 | [data-storage-android](./data-storage-android), [data-storage-ios](./data-storage-ios) |
| **MASVS-CRYPTO** | 암호화 키 관리 | [crypto-keys](./crypto-keys) (예정) |
| **MASVS-AUTH** | 인증 및 세션 관리 | [auth-mobile](./auth-mobile) (예정) |
| **MASVS-NETWORK** | 안전한 네트워크 통신 | [ssl-pinning-bypass](./ssl-pinning-bypass), [certificate-validation](./certificate-validation) (예정) |
| **MASVS-PLATFORM** | 플랫폼 보안 메커니즘 사용 | [webview-issues](./webview-issues), [deeplink-intent](./deeplink-intent) |
| **MASVS-CODE** | 안전한 코드 작성 | [static-analysis](./static-analysis), [code-quality](./code-quality) (예정) |
| **MASVS-RESILIENCE** | 무결성/탬퍼링 방어 | [setup-android](./setup-android), [setup-ios](./setup-ios), [root-detection-bypass](./root-detection-bypass), [jailbreak-detection-bypass](./jailbreak-detection-bypass), [anti-debug-bypass](./anti-debug-bypass) |
| **MASVS-PRIVACY** | 개인정보 보호 | [privacy-leakage](./privacy-leakage) (예정) |
| **(공용 도구)** | Frida 후킹 스크립트 모음 | [frida-scripts](./frida-scripts) |

---

## 점검 항목 ↔ 페이지 매핑 (KISA 모바일 앱 보안 가이드)

> 회사 가이드 확보 후 정확한 항목명으로 갱신할 것.

| 분류 | 점검 항목 | 관련 페이지 |
| :--- | :--- | :--- |
| 환경 설정 | Android 환경 구성 | [setup-android](./setup-android) |
| 환경 설정 | iOS 환경 구성 | [setup-ios](./setup-ios) |
| 정적 분석 | APK / IPA 추출 및 디컴파일 | [static-analysis](./static-analysis) |
| 데이터 저장 | SharedPreferences / Keystore | [data-storage-android](./data-storage-android) |
| 데이터 저장 | Keychain / plist / NSUserDefaults | [data-storage-ios](./data-storage-ios) |
| 데이터 저장 | 로컬 DB (SQLite/Realm) 평문 저장 | [data-storage-android](./data-storage-android) |
| 통신 보안 | 평문 통신 (HTTP) | [certificate-validation](./certificate-validation) (예정) |
| 통신 보안 | SSL Pinning | [ssl-pinning-bypass](./ssl-pinning-bypass) |
| 무결성 | 루팅/탈옥 탐지 | [root-detection-bypass](./root-detection-bypass), [jailbreak-detection-bypass](./jailbreak-detection-bypass) |
| 무결성 | 디버거 / Frida 탐지 | [anti-debug-bypass](./anti-debug-bypass) |
| 무결성 | 앱 위변조 / 재패키징 | [app-tampering](./app-tampering) (예정) |
| 인증 | 로컬 인증 (지문/Face ID) 우회 | [local-auth-bypass](./local-auth-bypass) (예정) |
| 플랫폼 | WebView 취약점 | [webview-issues](./webview-issues) |
| 플랫폼 | Deep Link / Intent | [deeplink-intent](./deeplink-intent) |
| 플랫폼 | Export된 컴포넌트 | [exported-components](./exported-components) (예정) |

---

## 환경 설정 — 작업 시작 전 체크

상세 절차는 다음 페이지 참조:

- **Android** — [setup-android](./setup-android) (ADB / Frida 16.x / Burp 시스템 CA Magisk 표준 / APK 추출 / 트러블슈팅)
- **iOS** — [setup-ios](./setup-ios) (palera1n / Dopamine 매칭표 / Sileo / Frida / Burp 프로파일+CA 신뢰 / IPA 추출)

빠른 검증 체크리스트 (4개 모두 통과하면 환경 구축 완료):

| 검증 항목 | Android | iOS |
| :--- | :--- | :--- |
| **단말 인식** | `adb devices` 가 `device` 상태 | 탈옥 단말 + Sileo 정상 실행 |
| **후킹 도구** | `frida-ps -U` 가 프로세스 목록 출력 | 동일 (USB 시 `iproxy 27042 27042` + `-H 127.0.0.1`) |
| **HTTPS 캡처** | 브라우저에서 평문 캡처 + 인증서 경고 없음 | 동일 — "인증서 신뢰 설정" 토글 확인 (필수) |
| **앱 핸들링** | APK 추출 / 설치 가능 (`adb install`) | IPA 복호화 추출 (`frida-ios-dump`) |

> 점검 대상 앱이 SSL Pinning / Root·탈옥 탐지 / Frida 탐지로 차단되면 → [ssl-pinning-bypass](./ssl-pinning-bypass) / [root-detection-bypass](./root-detection-bypass) / [jailbreak-detection-bypass](./jailbreak-detection-bypass) / [anti-debug-bypass](./anti-debug-bypass) 페이지로 이동.

---

## 참고자료

- [OWASP MASVS](https://mas.owasp.org/MASVS/)
- [OWASP MASTG (Testing Guide)](https://mas.owasp.org/MASTG/)
- [Frida 공식 문서](https://frida.re/docs/home/)
- [Objection (Frida-based)](https://github.com/sensepost/objection)
- [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF)
