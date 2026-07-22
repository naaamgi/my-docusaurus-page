---
sidebar_position: 16
title: 권한 검증 / IDOR
description: 웹 진단 - IDOR, BOLA, 수평·수직 권한, Mass Assignment, Forced Browsing, HTTP Method 편차 점검 절차와 판정 기준
keywords: [권한, Authorization, IDOR, BOLA, 수직권한, 수평권한, Mass Assignment, Forced Browsing, OWASP A01]
draft: false
toc_max_heading_level: 3
---

> 로그인한 사용자가 다른 사람의 글·주문·파일을 보거나, 일반 사용자가 관리자 기능을 실행할 수 있는지 확인한다.

## 점검 목적

같은 요청을 **사용자 A, 사용자 B, 관리자, 로그아웃 상태**에서 비교한다. 화면에서 버튼이 보이는지가 아니라, 서버가 다른 사람의 데이터나 제한 기능을 실제로 허용하는지 확인한다.

이 문서에서 `객체`는 게시글, 주문, 파일, 계정처럼 ID로 구분되는 데이터를 뜻한다. ID가 숫자인지 UUID인지는 중요하지 않다. 요청한 사용자가 그 데이터를 볼 수 있는지가 핵심이다.

로그인·MFA 흐름은 [인증](./authentication.md), 세션 수명주기는 [세션 관리](./session-management.md), JWT 자체의 검증 결함은 [JWT 공격](./jwt-attacks.md)에서 이어간다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **다른 사용자 데이터 접근** | 주문·게시글·파일 ID를 바꾸면 다른 사람의 데이터가 나옴 | 사용자 A 세션으로 사용자 B의 비공개 데이터를 볼 수 있으면 취약. IDOR/BOLA에 해당 |
| **관리자 기능 접근** | 일반 사용자가 관리자용 요청을 직접 보낼 수 있음 | 공지 작성·승인·회원 관리 같은 기능이 실제 실행되면 취약. BFLA에 해당 |
| **숨겨진 필드 변경** | 정상 화면에 없는 `role`, `ownerId`, `approved` 등을 요청에 추가함 | 권한·소유자·승인 상태가 실제로 바뀌면 취약. Mass Assignment/BOPLA에 해당 |
| **다른 요청 방식에서만 허용** | 같은 기능이 특정 메서드·구버전 API·마지막 단계에서만 열림 | 막혀야 할 작업이 다른 요청 방식에서 성공하면 취약 |
| **화면에서만 숨김** | 관리자 메뉴나 버튼은 없지만 API는 호출 가능함 | 서버가 데이터 또는 기능을 반환하면 취약 |

---

## 진단 절차

#### Step 1. 비교할 계정과 데이터 준비

최소한 같은 권한의 사용자 A·B를 준비한다. 각 계정으로 글, 주문, 파일 같은 테스트 데이터를 하나씩 만든다. 관리자 기능도 확인하려면 관리자 계정이 추가로 필요하다.

| 계정 | 준비할 데이터 | 용도 |
| :--- | :--- | :--- |
| 사용자 A | `ORDER_A`, `FILE_A` | A가 자기 데이터를 보는 정상 요청 확보 |
| 사용자 B | `ORDER_B`, `FILE_B` | A 요청에 B의 ID를 넣어 비교 |
| 관리자 | 공지 작성·승인 같은 관리자 기능 | 관리자 요청을 일반 사용자 세션으로 비교 |
| 로그아웃 상태 | 없음 | 로그인하지 않아도 접근되는지 확인 |

삭제·승인·결제처럼 되돌리기 어려운 기능은 전용 테스트 데이터에서만 확인한다. 계정이 하나뿐이면 다른 사용자 데이터인지 판단하기 어려우므로 확정하지 않는다.

#### Step 2. ID가 들어가는 요청 찾기

각 계정으로 기능을 정상 사용하면서 Burp에서 요청을 기록한다. 다음과 같이 특정 데이터를 가리키는 값을 찾는다.

- 이름에 `id`, `no`, `seq`, `key`가 들어간 값
- URL의 `/orders/1042`, query의 `?fileId=33`
- JSON body의 `userId`, `ownerId`, `postId`
- Header·Cookie의 사용자 번호
- 다운로드·수정·삭제·승인 요청

화면에 보이지 않는 요청은 JavaScript 파일, API 문서, `robots.txt`, 정상 응답의 링크에서 찾을 수 있다. 숨겨진 주소를 찾은 것만으로는 취약점이 아니다. 일반 사용자로 실제 접근되는지까지 확인한다.

#### Step 3. 다른 사용자 ID로 바꾸기

사용자 A로 로그인한 상태를 유지하고, 요청 안의 A 데이터 ID만 B 데이터 ID로 바꾼다.

1. A 세션 + A 데이터: 정상 응답 저장
2. A 세션 + B 데이터: 다른 사용자 접근 확인
3. B 세션 + B 데이터: B 데이터가 실제 존재하는지 확인
4. 로그아웃 + B 데이터: 로그인 없이도 접근되는지 확인

`200`, `403`, `404` 같은 상태 코드만 보지 않는다. 응답 내용, 파일 내용, 수정 후 다시 조회했을 때 값이 바뀌었는지도 확인한다.

#### Step 4. 관리자 요청을 일반 사용자로 보내기

관리자로 공지 작성, 승인, 사용자 관리 같은 기능을 한 번 실행해 요청을 저장한다. 요청의 관리자 세션만 일반 사용자 세션으로 바꿔 다시 보낸다.

- 관리자 페이지는 막히지만 실제 저장 요청은 열리는지
- 상세 화면은 막히지만 승인·삭제 요청은 열리는지
- 현재 API는 막히지만 구버전·모바일 API는 열리는지
- `GET`은 막히지만 `POST`, `PATCH`, `DELETE`는 열리는지

#### Step 5. 화면에 없는 필드 추가하기

프로필·게시글·주문을 조회한 JSON과 수정 요청을 비교한다. 응답에는 있지만 수정 화면에는 없는 필드를 요청에 하나씩 추가한다.

- 소유자: `userId`, `ownerId`, `organizationId`
- 권한: `role`, `isAdmin`, `permissions`
- 상태: `approved`, `verified`, `status`
- 업무 값: `price`, `balance`, `discount`, `limit`

추가한 값이 응답에 표시됐다는 이유만으로 확정하지 않는다. 다시 조회하거나 재로그인해 실제로 저장됐는지 확인한다.

#### Step 6. 막혔을 때 같은 기능의 다른 요청 확인

기본 요청이 `403` 등으로 차단되면 같은 기능을 처리하는 다른 요청이 있는지 확인한다.

- URL과 body에 ID가 함께 있으면 하나씩 바꿔보기
- 상세 조회 외에 수정·삭제·다운로드 요청 확인
- 미리보기는 막히지만 최종 저장 요청은 열리는지 확인
- 웹·모바일, 현재·구버전 API 비교

### 상황별 빠른 선택

| 현재 보고 있는 기능 | 먼저 할 테스트 |
| :--- | :--- |
| 주문·게시글 상세 조회 | 사용자 A 요청의 ID를 사용자 B의 ID로 변경 |
| 파일 다운로드 | A 세션을 유지하고 B 파일 ID로 변경 |
| 프로필·게시글 수정 | body의 `userId`, `ownerId`와 화면에 없는 필드 확인 |
| 관리자 공지·승인 | 관리자 요청의 쿠키만 일반 사용자 쿠키로 변경 |
| 여러 단계를 거치는 승인·결제 | 마지막 저장·확정 요청을 일반 사용자로 직접 전송 |
| 한 Method만 `403` | 같은 주소의 다른 HTTP Method 비교 |
| 화면에 없는 관리자 주소 발견 | 로그아웃·일반 사용자·관리자 순서로 응답 비교 |

---

## 페이로드 노트

### 1. 주문·게시글·파일 ID 바꾸기

**이럴 때 사용**

- URL이 `/orders/1042`, `/posts/81`처럼 끝남
- 요청에 `orderId`, `postId`, `fileId`가 있음
- 다운로드 주소에 파일 번호나 UUID가 있음

**바꿀 값**: 사용자 A의 ID를 사용자 B가 만든 테스트 데이터의 ID로 바꾼다. 로그인 세션은 A로 유지한다.

```http
GET /api/orders/1042 HTTP/1.1
Host: target.example
Cookie: SESSION=<USER_A_SESSION>
```

`1042`가 A의 주문이고 `2087`이 B의 주문이라면 ID만 바꾼다.

```http
GET /api/orders/2087 HTTP/1.1
Host: target.example
Cookie: SESSION=<USER_A_SESSION>
```

UUID도 같은 방식이다. B 계정의 정상 요청에서 UUID를 확보한 뒤 A 요청에 넣는다. 무작위로 UUID를 맞히기 어려워도, A가 B의 UUID를 알고 있을 때 접근할 수 있다면 권한 문제다.

**확인할 것**: B의 주문 내용·게시글·파일이 반환되는지, 수정 요청이라면 B 데이터가 실제로 바뀌었는지 확인한다.

| 응답 | 판단 |
| :--- | :--- |
| B 객체 내용 또는 파일 반환 | 취약 확정 |
| `403`, 또는 A·B 모두 같은 차단 응답 | 해당 요청은 통제됨 |
| A 세션에서는 `404`, B 세션에서는 정상 | 다른 사용자 데이터의 존재를 숨기는 정상 처리일 수 있음 |
| `200` + 빈 객체·마스킹 응답 | 공개 정책과 필드별 차이를 추가 확인 |

### 2. URL에 ID가 두 개 이상 있을 때

**이럴 때 사용**: `/users/10/orders/2087`처럼 사용자 ID와 주문 ID가 한 URL에 같이 들어간다.

**바꿀 값**: 사용자 ID와 주문 ID를 한 번에 하나씩 바꾼다.

```http
GET /api/users/<USER_A>/orders/<ORDER_B> HTTP/1.1
Cookie: SESSION=<USER_A_SESSION>
```

다음 조합을 하나씩 비교한다.

| 사용자 ID | 주문 ID | 확인 의도 |
| :--- | :--- | :--- |
| A | A | 정상 기준선 |
| A | B | 주문 ID만 확인하고 소유자는 확인하지 않는지 |
| B | A | URL의 사용자 ID를 믿는지 |
| B | B | B의 주문 전체에 접근되는지 |

**확인할 것**: A로 로그인한 상태에서 B의 주문이 반환되는 조합이 있는지 확인한다. 두 값을 동시에 바꾸면 어느 ID에서 검사가 빠졌는지 알기 어렵다.

### 3. URL이 아니라 요청 본문·헤더·쿠키에 ID가 있을 때

**이럴 때 사용**: 주소는 항상 `/api/profile`처럼 같지만, JSON body나 Header·Cookie에 사용자 ID가 들어간다.

**바꿀 값**: 정상 요청에서 확인한 사용자 ID 위치를 하나씩 B의 ID로 바꾼다.

```http
PUT /api/profile HTTP/1.1
Host: target.example
Cookie: SESSION=<USER_A_SESSION>
Content-Type: application/json

{
  "userId": "<USER_B_ID>",
  "displayName": "idor-check"
}
```

| 위치 | 단일 변경 예시 |
| :--- | :--- |
| Body | `"userId": "<USER_B_ID>"` |
| Header | `X-User-Id: <USER_B_ID>` |
| Cookie | `userId=<USER_B_ID>` |

**확인할 것**: A 세션인데 B의 프로필이 보이거나 B의 이름이 바뀌는지 확인한다. 여러 위치를 동시에 바꾸면 서버가 어느 값을 믿었는지 알기 어렵다.

### 4. 관리자 화면의 요청을 일반 사용자로 보내기

**이럴 때 사용**: 관리자만 공지 작성, 게시글 승인, 회원 정지, 자료 내보내기를 할 수 있다.

**바꿀 값**: 관리자로 정상 요청을 저장한 뒤 관리자 쿠키만 일반 사용자 쿠키로 바꾼다.

관리자 계정의 정상 요청에서 세션만 일반 사용자로 바꾼다.

```http
POST /api/notices HTTP/1.1
Host: target.example
Cookie: SESSION=<NORMAL_USER_SESSION>
Content-Type: application/json

{
  "title": "authorization-test",
  "content": "test object"
}
```

**확인할 것**: `200` 응답만 보지 말고 공지가 실제 생성됐는지 목록에서 다시 확인한다. 테스트 공지는 확인 후 정리한다.

승인처럼 여러 화면을 거치는 기능은 마지막 실행 요청이 따로 있을 수 있다.

```text
GET  /admin/requests/<TEST_ID>            -> 상세 확인
POST /admin/requests/<TEST_ID>/preview    -> 사전 검증
POST /admin/requests/<TEST_ID>/approve    -> 최종 실행
```

상세 화면이나 미리보기는 막혀도 최종 승인 요청이 성공할 수 있다. 일반 사용자로 승인 상태가 실제 바뀌면 취약이다.

### 5. 화면에 없는 `role`·`ownerId` 필드 추가하기

**이럴 때 사용**: 프로필이나 주문 조회 응답에는 `role`, `ownerId`, `approved`가 보이지만 수정 화면에서는 이 값을 입력할 수 없다.

이런 숨겨진 필드를 수정 요청에 추가하는 테스트를 Mass Assignment라고 부른다.

**바꿀 값**: 정상 수정 요청에 의심 필드를 하나씩 추가한다.

정상 프로필 수정 요청에 제한 속성을 하나씩 추가한다.

```http
PATCH /api/profile HTTP/1.1
Host: target.example
Cookie: SESSION=<NORMAL_USER_SESSION>
Content-Type: application/json

{
  "displayName": "test-user",
  "role": "admin"
}
```

게시글·주문에서는 소유자나 승인 상태처럼 서버가 정해야 하는 값도 확인한다.

```json
{
  "name": "test-object",
  "ownerId": "<USER_B_ID>",
  "approved": true
}
```

**확인할 것**: 다시 조회했을 때 값이 저장됐는지, 재로그인 후 관리자 기능이 열리는지 확인한다. 오류 메시지에 필드명이 나오거나 응답에 입력값이 반복된 것만으로는 확정하지 않는다.

### 6. 같은 주소에 다른 HTTP Method 보내기

**이럴 때 사용**: `GET /api/admin/users/10`은 `403`인데 같은 주소에서 수정·삭제 요청도 지원하는 것으로 보인다.

**바꿀 값**: URL과 일반 사용자 세션은 그대로 두고 `GET`, `POST`, `PUT`, `PATCH`, `DELETE`를 비교한다. 삭제는 전용 테스트 데이터에서만 시도한다.

```text
GET    /api/admin/users/<TEST_ID>  -> 403
POST   /api/admin/users/<TEST_ID>  -> 비교
PUT    /api/admin/users/<TEST_ID>  -> 비교
PATCH  /api/admin/users/<TEST_ID>  -> 비교
DELETE /api/admin/users/<TEST_ID>  -> 전용 객체에서만 확인
```

프록시나 서버가 Method Override를 지원하는 흔적이 있을 때만 다음 헤더도 확인한다.

```http
POST /api/admin/users/<TEST_ID> HTTP/1.1
Host: target.example
Cookie: SESSION=<NORMAL_USER_SESSION>
X-HTTP-Method-Override: PATCH
```

**확인할 것**: 다른 Method에서 데이터가 반환되거나 수정·삭제가 실제 실행되는지 확인한다. `OPTIONS` 응답에 지원 Method가 보이는 것은 단서일 뿐 취약점은 아니다.

### 7. 화면에 없는 관리자 주소 직접 요청하기

**이럴 때 사용**: 일반 사용자 화면에는 관리자 메뉴가 없지만 JavaScript, API 문서, `robots.txt` 등에서 관리자 주소를 찾았다. 이런 확인 방식을 Forced Browsing이라고 부른다.

**바꿀 값**: 찾은 주소를 로그아웃 상태와 일반 사용자 세션으로 각각 요청한다.

```text
/admin
/manage
/api/admin
/api/internal
/api/v1/export
```

**확인할 것**: 관리자 데이터가 반환되거나 공지 작성·승인 같은 기능이 실제 실행되는지 확인한다. 주소가 존재하거나 로그인 화면으로 이동하는 것만으로는 취약점이 아니다.

디렉터리·파일 노출, 백업 파일, `.git`, 환경 설정 파일은 [정보 노출](./information-disclosure.md)에서 판정한다. 대규모 경로 열거 도구는 허용된 범위와 요청 속도가 정해진 경우에만 보조적으로 사용한다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 숫자 ID를 바꾸면 `403` | UUID·파일명·공유 링크 ID처럼 같은 데이터를 가리키는 다른 값 |
| URL의 ID는 차단 | 요청 body·Header·Cookie에 같은 사용자 ID가 있는지 확인 |
| 상세 조회는 차단 | 수정·삭제·다운로드·내보내기 등 다른 작업 |
| 한 건 조회는 차단 | 목록·검색·일괄 처리·내보내기 요청 |
| 현재 API는 차단 | 모바일 API·구버전 `/v1` 요청 |
| 관리자 페이지는 차단 | 페이지가 호출하는 최종 API를 일반 세션으로 직접 요청 |
| `GET`은 차단 | 지원되는 `POST`·`PUT`·`PATCH`·`DELETE`의 권한 일관성 |
| JSON 요청은 숨겨진 필드를 거부 | 서비스가 실제 사용하는 form·파일 업로드 요청에서도 같은 필드 확인 |
| 첫 단계는 권한 확인 | 미리보기·확인·최종 실행 단계 직접 요청 |
| `200`이지만 본문이 비어 있음 | 후속 조회·목록·상태 변화·다운로드 크기 확인 |
| ID가 예측 불가능 | 정상 응답·공유 링크·공개 객체에서 다른 계정 식별자 확보 |
| 다른 사용자 데이터 일부가 가려짐 | 원래 공개되는 정보인지, 비공개 필드도 섞여 있는지 확인 |

---

## 취약 판정 기준

### 취약

- [ ] 사용자 A 세션으로 사용자 B의 비공개 객체를 조회·다운로드할 수 있음
- [ ] 사용자 A가 사용자 B의 객체를 생성·수정·삭제하거나 소유 관계를 변경할 수 있음
- [ ] 일반 사용자 또는 미인증 요청으로 상위 역할의 기능을 실행할 수 있음
- [ ] 제한 속성을 읽거나 `role`, `ownerId`, `approved` 같은 서버 관리 값을 변경할 수 있음
- [ ] 다단계 흐름의 일부 단계나 대체 API·HTTP Method에서 권한 검증이 누락됨
- [ ] 클라이언트에서만 기능을 숨기고 서버는 제한 요청을 허용함

### 후보 / 보류

- [ ] 다른 객체의 존재 여부만 상태 코드·길이 차이로 구분되며 데이터 접근은 확인되지 않음
- [ ] `200` 응답이지만 공개 정보·빈 객체·마스킹 값만 반환됨
- [ ] 제한 속성명이 오류나 응답에 나타나지만 실제 저장·권한 변화는 확인되지 않음
- [ ] 다른 사용자 식별자를 확보하지 못해 무작위 값으로만 비교함
- [ ] 테스트 계정이나 객체가 없어 소유·조직·역할 정책을 확인하지 못함
- [ ] 숨겨진 경로 또는 지원 메서드만 발견했고 제한 기능 실행은 확인되지 않음

### 영향 상승 조건

- [ ] 한 사람의 데이터를 넘어 다른 조직의 데이터에도 접근함
- [ ] 읽기뿐 아니라 수정·삭제·승인·권한 변경이 가능함
- [ ] 관리자 기능 또는 다른 사용자의 인증·복구 설정을 변경할 수 있음
- [ ] 하나의 누락이 여러 객체 유형과 API 버전에서 일관되게 재현됨

공개 프로필, 공유 문서처럼 타 사용자 접근이 의도된 객체는 정책과 실제 공개 범위를 먼저 확인한다. 상태 코드만으로 판정하지 않고 반환 데이터 또는 서버 측 상태 변화를 근거로 남긴다.

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
- [OWASP WSTG - Testing for Insecure Direct Object References](https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
- [OWASP WSTG - API Broken Function Level Authorization](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/04-API_Broken_Function_Level_Authorization)
- [OWASP API1:2023 - Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP API3:2023 - Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [OWASP API5:2023 - Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [PortSwigger - Access control vulnerabilities](https://portswigger.net/web-security/access-control)
- [PortSwigger - API testing](https://portswigger.net/web-security/api-testing)

### 커뮤니티 참고 / 도구

- [HackTricks - IDOR](https://book.hacktricks.wiki/en/pentesting-web/idor.html)
