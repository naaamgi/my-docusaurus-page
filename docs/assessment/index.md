---
title: 진단
sidebar_position: 1
sidebar_label: 진단 개요
description: 웹/모바일 취약점 진단 실무 가이드 - OWASP, KISA 기반 점검 절차와 판정 기준
keywords: [vulnerability assessment, pentest, web, mobile, OWASP, KISA, MASVS]
slug: /assessment
---

# 진단
> **실무 모의해킹 / 취약점 진단** 현업에서 바로 쓸 수 있도록 정리한 가이드.
> 점검 절차 → 페이로드 → 취약 판정 기준까지 1페이지에서 빠르게 확인할 수 있게 구성.

---

## 영역

| 영역 | 설명 | 워크플로우 |
| :--- | :--- | :--- |
| [**웹 (Web)**](./web/) | 웹 애플리케이션 취약점 진단 | OWASP Top 10 + KISA 점검 항목 기반 |
| [**모바일 (Mobile)**](./mobile/) | Android/iOS 앱 취약점 진단 | OWASP MASVS + KISA 모바일 가이드 기반 |

---

## 사용 방법

### 1. 진단 시작 시 — 워크플로우 페이지부터
각 영역의 `워크플로우` 페이지에는 **점검 항목 ↔ 개별 문서 매핑 표**가 있어요. 진단 범위 확인하고 빠뜨린 항목 없는지 체크리스트로 활용하세요.

### 2. 작업 중 — 사이드바 또는 검색
특정 취약점 작업할 때는 **사이드바에서 클릭** 또는 **상단 검색창에 키워드 입력** (예: "race condition", "ssrf"). 카테고리 안 뒤져도 바로 페이지로 직행하도록 평면(flat) 구조로 설계.

### 3. 판정 시 — 취약 기준과 오탐 주의 확인
각 페이지의 **"취약 판정 기준"** 을 기준으로 실제 취약 여부를 정리하세요. 단순 오류/응답 차이처럼 오탐이 섞이기 쉬운 케이스는 페이지별 주의 항목까지 같이 확인.

---

## 페이지 표준 구조

모든 진단 페이지는 `_template.md` 구조를 따라요:

1. **점검 개요** — 분류, CWE, 영향도, 점검 시간
2. **점검 목적** — 왜 보는가
3. **진단 절차** — Step-by-step
4. **페이로드 / 테스트 케이스** — 실제 사용할 페이로드
5. **취약 판정 기준** — Pass/Fail 명확히
6. **참고자료**

---

## 표기법

```
<TARGET>     # 점검 대상 도메인/IP
<PARAM>      # 점검 대상 파라미터명
<USER>       # 테스트 계정
<PAYLOAD>    # 페이로드 위치
```

---

## 관련 영역

- [Cheatsheet](/cheatsheet/) — 도구별 명령어 빠른 참조 (HTB/OSCP 스타일)
- [Penetration Testing](/cheatsheet/information-gathering/port-scanning/) — 침투 단계별 가이드
- Redteam — C2 인프라 구축 등 레드팀 운영 (`draft` 문서)
