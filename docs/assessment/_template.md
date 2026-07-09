---
title: 페이지 작성 템플릿
sidebar_position: 99
sidebar_label: 페이지 템플릿
sidebar_class_name: sidebar-template-item
description: 진단 페이지 표준 템플릿 - 새 페이지 작성 시 이 구조를 복사해서 사용
keywords: [template, 템플릿]
draft: false
---

# 진단 페이지 작성 템플릿

> 이 파일은 **새 진단 페이지를 만들 때 복사해서 쓰는 템플릿**이에요.
> 아래 구조와 톤(어조)을 그대로 따라야 페이지마다 일관성이 유지됩니다.

---

## 작성 원칙

1. **명령어/페이로드만 나열하지 말 것** — 언제 쓰는지, 왜 쓰는지, 어떻게 판정하는지 항상 같이.
2. **한국어 설명 + 영문 기술용어** — 예: "에러 기반 (Error-based) 탐지", "시간 기반 (Time-based) 추출"
3. **실전 판단에 필요한 맥락 우선** — 페이로드, 사용 조건, 판정 기준, 오탐 주의를 한 세트로 작성.
4. **취약 판정 기준은 체크리스트로** — Pass/Fail 명확히 갈리도록.
5. **표기법은 `<TARGET>`, `<PARAM>` 등 placeholder** 사용.
6. **장식용 이모지 사용 금지** — 영향도 색상(🔴🟡🟢), 경고(⚠️) 외에는 사용하지 않음.

---

## 표준 구조
```markdown
---
sidebar_position: N
title: 취약점 한글명
description: 한 줄 설명 (검색엔진 노출용)
keywords: [관련, 키워드, 영문, 한글, 5-10개]
draft: false
---

# 취약점 한글명
> **한 줄 요약** — 이 페이지를 1초 안에 파악할 수 있게.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A0X:2025 / KISA 점검 항목 X.X |
| **CWE** | [CWE-XXX](https://cwe.mitre.org/data/definitions/XXX.html) |
| **영향도** | 🔴 높음 / 🟡 중간 / 🟢 낮음 |
| **점검 난이도** | 하 / 중 / 상 / 최상 |
| **예상 점검 시간** | 30분 ~ 2시간 |

## 점검 목적
## 진단 절차

### Step 1. 진입점 식별
어디서 사용자 입력이 들어가는지 확인. (URL 파라미터, POST body, 헤더, 쿠키 등)

### Step 2. 기본 탐지
가장 간단한 페이로드로 반응 확인.

\`\`\`http
GET /search?q=<PAYLOAD> HTTP/1.1
Host: <TARGET>
\`\`\`

### Step 3. 심화 / 우회
WAF/필터가 있을 경우 우회 시도.

### Step 4. 영향 검증
실제 위협으로 이어지는지 확인 (단순 alert이 아닌 실제 영향).

## 페이로드 / 테스트 케이스

### 케이스 1: 기본 탐지
설명...

\`\`\`
페이로드
\`\`\`

### 케이스 2: 우회
설명...

\`\`\`
페이로드
\`\`\`

### 케이스 3: 영향 입증
실제 데이터 탈취/조작이 가능한지 입증.

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 조건 1 (구체적이고 검증 가능하게)
- [ ] 조건 2
- [ ] 조건 3

## 참고자료

- [OWASP 페이지](https://owasp.org/...)
- [PortSwigger Web Security Academy](https://portswigger.net/web-security/...)
- [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/...)
```

---

## 좋은 예시 / 나쁜 예시

### 나쁜 예시
```markdown
## XSS 페이로드
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
```

→ 명령어만 나열. 언제 쓰는지, 어떻게 판정하는지, 오탐은 어떻게 가를지 알 수 없음.

### 좋은 예시
```markdown
### 케이스 1: 기본 Reflected XSS 탐지

**대상**: URL 파라미터, 검색창, 폼 입력값 등 사용자 입력이 응답에 그대로 출력되는 곳

**페이로드:**
<script>alert(document.domain)</script>

**판정:** 응답 HTML에 `<script>...</script>` 태그가 그대로 들어가 있고
브라우저에서 도메인이 alert 으로 뜨면 취약.
```

→ 맥락 + 페이로드 + 판정 기준이 한 세트로.
