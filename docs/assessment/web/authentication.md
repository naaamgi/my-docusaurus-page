---
sidebar_position: 14
title: 인증
description: 웹 진단 - 사용자 열거, 로그인 시도 제한, 계정 상태, 재설정, MFA 우회 점검 절차와 판정 기준
keywords: [인증, Authentication, Brute Force, Password Spraying, 사용자 열거, Username Enumeration, MFA, OTP, 비밀번호 재설정, OWASP A07]
draft: false
toc_max_heading_level: 3
---

> 로그인·비밀번호 변경/재설정·MFA에서 계정 존재 여부가 노출되거나 인증 단계를 건너뛸 수 있는지 확인한다.

## 점검 목적

가입 → 로그인 → MFA → 비밀번호 변경/재설정 흐름에서 **응답 일관성, 시도 제한, 토큰 검증, 단계 강제**가 서버 측에 적용되는지 확인한다.

세션 쿠키와 로그아웃은 [세션 관리](./session-management.md), JWT 검증은 [JWT 공격](./jwt-attacks.md), 다른 사용자 대상 변경은 [인가 / IDOR](./authorization-idor.md)에서 이어간다.

---

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **사용자 열거** | 계정 존재 여부가 메시지·상태 코드·응답 시간으로 갈림 | 가입·로그인·재설정 중 하나라도 안정적으로 구분되면 취약 |
| **온라인 추측 방어 미흡** | 로그인·OTP·복구 코드가 반복 시도에 노출됨 | 계정 기준 제한 없이 계속 추측 가능하면 취약 |
| **계정 상태 우회** | 미인증·잠금·비활성 상태가 다른 인증 경로에서 무시됨 | 보호 API나 계정 기능 접근이 가능하면 취약 |
| **변경·복구 흐름 결함** | 비밀번호·이메일·MFA 변경 또는 재설정 토큰 검증이 약함 | 재인증 없이 민감 설정 변경, 토큰 재사용·교차 사용 시 취약 |
| **MFA 단계 우회** | 1차 인증 이후 MFA 완료 전 상태가 최종 인증처럼 동작 | 보호 기능 접근, factor 교체, trusted device 재사용 시 취약 |
| **서버 측 인증 검증 누락** | UI는 막지만 API가 인증 상태를 강제하지 않음 | 미인증 또는 부분 인증 세션으로 보호 응답을 받으면 취약 |

---

## 진단 절차

#### Step 1. 인증 흐름 매핑

가입, 이메일 인증, 로그인, MFA, 비밀번호 변경, 재설정 요청·검증 요청을 기록한다. 각 단계의 쿠키·토큰·사용자 식별값과 최종 인증 완료 시점을 확인한다.

#### Step 2. 응답 차이 비교

존재하는 본인 계정과 무작위 계정으로 로그인·가입·재설정을 비교한다.

- 응답 메시지·상태 코드·길이
- `Location`, `Set-Cookie`, JSON 필드
- 비슷한 조건에서 반복 측정한 응답 시간

#### Step 3. 시도 제한 확인

작은 횟수의 연속 실패로 다음 동작을 확인한다.

- 계정 기준 실패 횟수 누적
- 지연 증가, 일시 제한, CAPTCHA 등 추가 통제
- IP·쿠키·`X-Forwarded-For` 변경으로 제한이 초기화되는지
- OTP 재발급 또는 비밀번호 재설정 재요청이 실패 횟수를 초기화하는지

#### Step 4. 가입·계정 상태 확인

이메일 미인증, 잠금, 비활성, 초대 대기 상태의 계정이 로그인·재설정·MFA 등록·보호 API를 통과하는지 비교한다.

#### Step 5. 변경·재설정 흐름 확인

- 비밀번호·이메일·MFA 변경 시 현재 비밀번호 또는 동등한 재인증 요구
- 재설정 토큰의 난수성·만료·일회성·이전 토큰 무효화
- `Host`, `X-Forwarded-Host`, `Referer`로 재설정 링크나 토큰이 외부로 전달되는지

#### Step 6. MFA 강제 확인

1차 인증 후 MFA 완료 전 세션으로 보호 API를 직접 호출한다. OTP 검증뿐 아니라 MFA 등록·변경·비활성화·복구 코드 흐름도 같은 강도로 보호되는지 확인한다.

---

## 페이로드 노트

### 1. 사용자 열거

```text
1. valid_user + 잘못된 비밀번호
2. random_user_7f3a + 같은 비밀번호
```

| 관찰 | 판정 |
| :--- | :--- |
| "비밀번호 오류" / "존재하지 않는 사용자" | 메시지 기반 열거 |
| `401` / `404`, 다른 redirect | 상태·경로 기반 열거 |
| 한쪽만 `Set-Cookie` 또는 다른 JSON 필드 | 응답 구조 기반 열거 |
| 반복 측정에서 일관된 시간 차이 | Timing 기반 열거 후보 |

단일 시간 측정만으로 판정하지 않는다. 로그인뿐 아니라 회원가입과 비밀번호 찾기에서도 같은 차이를 확인한다.

### 2. 로그인 / OTP 시도 제한

대량 사전 공격 대신 제한된 실패 요청으로 카운터의 범위와 우회 가능성을 확인한다.

#### 공격별 요청 패턴

| 유형 | 요청 분포 | 확인할 통제 |
| :--- | :--- | :--- |
| Brute Force | 한 계정 + 여러 비밀번호 | 계정 기준 실패 카운터·지연·잠금 |
| Password Spraying | 여러 계정 + 소수의 흔한 비밀번호 | 분산 계정 탐지·조직 단위 이상 징후 |
| Credential Stuffing | 여러 계정 + 각기 다른 유출 자격증명 | MFA·유출 비밀번호 차단·위험 기반 추가 인증 |

본인 테스트 계정을 여러 개 준비하고 계정당 소수 요청만 사용한다. 실제 유출 자격증명이나 대규모 사용자 목록은 기본 진단에서 사용하지 않는다.

#### 제한 범위 확인

```text
1. 같은 계정에 잘못된 비밀번호를 연속 입력
2. 지연·잠금·추가 인증이 시작되는 시점 기록
3. IP, 쿠키, 전달 헤더를 하나씩 바꿔 같은 계정 재시도
4. 정상 로그인 후 카운터가 적절히 초기화되는지 확인
```

**취약 판정**: 실제 운영 속도로 계속 추측할 수 있거나, 신뢰되지 않은 `X-Forwarded-For`·쿠키 변경만으로 제한을 우회할 수 있으면 취약.

| 관찰 | 다음 요청 |
| :--- | :--- |
| 한 계정만 잠기고 다른 계정은 제한 없음 | 소수 계정에 같은 비밀번호를 한 번씩 비교 |
| IP만 차단 | 같은 계정으로 신뢰되지 않은 전달 헤더·새 연결 비교 |
| CAPTCHA 이후 API가 계속 응답 | CAPTCHA token 제거 후 로그인 API 직접 요청 |
| 중간에 정상 로그인하면 제한 해제 | 별도 테스트 계정의 성공 요청이 전체 카운터를 초기화하는지 확인 |
| 잠금 메시지가 특정 계정에서만 발생 | 사용자 열거 신호로 함께 판정 |

OTP는 다음을 추가 확인한다.

- 짧은 OTP에 계정 기준 rate limit 적용
- OTP 재발급 후에도 실패 카운터 유지
- 같은 OTP를 성공 후 다시 사용할 수 없음
- OTP 만료 후 거부

### 3. 가입 / 계정 상태

가입 완료 여부와 실제 인증 가능 상태가 일치하는지 확인한다. 본인 테스트 계정으로 상태를 나눠 비교한다.

| 계정 상태 | 시도할 요청 | 취약 징후 |
| :--- | :--- | :--- |
| 이메일 미인증 | 로그인·보호 API·MFA 등록 | 인증 전용 기능 외 보호 데이터 접근 |
| 잠금 | 로그인·재설정·OTP 재발급 | 다른 인증 경로에서 잠금이 무시됨 |
| 비활성·탈퇴 | 로그인·재설정 | 계정이 다시 활성화되거나 인증 가능 |
| 초대 대기 | 초대 수락·비밀번호 설정 | 토큰이 다른 계정과 결합되거나 재사용 가능 |

이메일 인증 토큰은 계정에 결합되어야 하고, 사용 후 재사용되지 않아야 한다.

```http
POST /api/email/verify HTTP/1.1
Content-Type: application/json

{"user_id":"<TEST_ACCOUNT_B>","token":"<ACCOUNT_A_TOKEN>"}
```

**판정**: A 계정 토큰으로 B 계정이 인증되거나, 미인증·비활성 상태에서 보호 기능을 사용할 수 있으면 취약.

### 4. 비밀번호 변경

현재 비밀번호 필드를 제거하거나 빈 값으로 보내 서버가 재인증을 강제하는지 확인한다.

```http
POST /api/profile/password HTTP/1.1
Cookie: SESSION=<USER_SESSION>
Content-Type: application/json

{"new_password":"NewPassword-For-PoC"}
```

**판정**: 현재 비밀번호나 동등한 재인증 없이 실제 비밀번호가 변경되면 취약. 사용자 ID를 바꿔 다른 계정을 변경하는 문제는 인가 결함으로 분리한다.

### 5. 비밀번호 재설정

본인 계정으로 여러 토큰을 발급해 형식과 수명 주기를 비교한다.

| 확인 항목 | 취약 징후 |
| :--- | :--- |
| 난수성 | 짧은 숫자·순번·timestamp 등 예측 가능한 값 |
| 만료 | 서비스가 정한 유효시간 이후에도 사용 가능 |
| 일회성 | 사용한 토큰 재사용 가능 |
| 재발급 | 새 토큰 발급 후 이전 토큰도 계속 유효 |
| 계정 결합 | 다른 사용자 식별값과 조합해 토큰 사용 가능 |
| 전달 경로 | URL query 토큰이 외부 `Referer`·로그에 노출 |

#### 토큰 수명 주기

```text
1. 같은 계정에서 T1 발급
2. 다시 요청해 T2 발급
3. T1 사용 시도
4. T1 재사용 시도
5. T2 사용 시도
```

새 토큰 발급 시 이전 토큰을 무효화하는지는 서비스 정책에 따라 다를 수 있다. 최소한 사용 완료된 토큰은 다시 사용할 수 없어야 하며, 각 토큰은 발급 계정과 목적에 결합되어야 한다.

```http
POST /api/password/reset/confirm HTTP/1.1
Content-Type: application/json

{"user_id":"<TEST_ACCOUNT_B>","token":"<ACCOUNT_A_TOKEN>","new_password":"NewPassword-For-PoC"}
```

재설정 코드가 짧다면 로그인과 별도의 계정 기준 시도 제한이 적용되는지도 확인한다. 코드 재발급만으로 실패 횟수가 초기화되면 우회 후보이다.

재설정 메일 링크가 요청 헤더로 조립되는지도 확인한다.

```http
POST /api/password/reset HTTP/1.1
Host: attacker.example
Content-Type: application/json

{"email":"<OWN_TEST_ACCOUNT>"}
```

**판정**: 메일의 링크 origin이 공격자 값으로 바뀌거나 토큰이 외부 origin으로 전달되면 취약. 프록시 환경에서는 `X-Forwarded-Host`도 하나씩 비교한다.

#### 대체 복구 수단

- 보안 질문처럼 공개 정보로 추측 가능한 수단이 기존 MFA를 대체하는지
- 이메일·전화번호 변경 직후 새 채널로 복구가 가능한지
- 고객센터 복구가 기존 factor와 동등한 신원 확인을 요구하는지

### 6. MFA 우회

#### 2단계 건너뛰기

```http
GET /api/profile HTTP/1.1
Cookie: SESSION=<STAGE1_SESSION>
```

1차 인증만 마친 세션으로 보호 데이터가 반환되면 MFA가 서버 측에서 강제되지 않은 것이다.

#### 응답 변조

```http
POST /api/mfa/verify HTTP/1.1
Content-Type: application/json

{"otp":"000000"}
```

응답의 `success:false`를 클라이언트에서 바꿔도, 서버가 인증 완료 상태나 최종 토큰을 발급하지 않아야 한다.

#### 복구·설정 변경

- 복구 코드 재사용
- MFA 비활성화 시 현재 비밀번호·기존 factor 미검증
- 새 factor 등록 시 MFA 미완료 세션 허용
- "이 기기 기억" 값만 복사해 MFA 생략

```http
POST /api/mfa/disable HTTP/1.1
Cookie: SESSION=<FULLY_AUTHENTICATED_SESSION>
Content-Type: application/json

{}
```

```http
POST /api/mfa/factor/replace HTTP/1.1
Cookie: SESSION=<STAGE1_OR_STOLEN_SESSION>
Content-Type: application/json

{"type":"totp","secret":"<ATTACKER_CONTROLLED_SECRET>"}
```

**판정**: 기존 factor 또는 동등한 재인증 없이 MFA를 끄거나 공격자 factor로 교체할 수 있으면 취약. 활성 세션만으로 factor 변경을 허용하는지 확인한다.

#### Trusted Device / Push

- Trusted Device 쿠키만 새 브라우저로 복사했을 때 계정·기기 결합 없이 MFA가 생략되는지
- 로그아웃·비밀번호 변경·MFA 재등록 후에도 기존 신뢰 토큰이 유효한지
- Push 승인 요청을 짧은 간격으로 반복할 수 있는지, 사용자에게 요청 출처와 거부 기능이 제공되는지

복구 코드는 각각 한 번만 사용할 수 있어야 하며, 사용·재발급 후 이전 코드가 무효화되어야 한다.

### 7. 인증 상태 검증 누락

로그인 전, 1차 인증 후, 완전 인증 후 요청을 각각 비교한다.

```http
GET /api/account HTTP/1.1
Host: target.example
```

로그인 화면이 보이는지보다 보호 API가 데이터나 기능을 반환하는지로 판정한다. 일반 사용자와 관리자 간 권한 차이는 인가 문서에서 이어간다.

---

## 우회 매트릭스

| 관찰 | 다음 확인 |
| :--- | :--- |
| 로그인 메시지는 같지만 코드·길이가 다름 | 사용자 열거 |
| IP 기준으로만 로그인 차단 | 같은 계정에서 IP·전달 헤더 변경 |
| 계정 잠금만 적용 | 소수 비밀번호를 여러 테스트 계정에 분산해 통제 비교 |
| 중간의 정상 로그인으로 제한 해제 | 성공 요청이 다른 계정·IP 카운터까지 초기화하는지 확인 |
| CAPTCHA가 브라우저에만 표시 | CAPTCHA token 없이 API 직접 요청 |
| OTP 재발급 시 다시 시도 가능 | 실패 카운터 초기화 여부 |
| 미인증·잠금 계정에 다른 흐름이 열림 | 재설정·MFA 등록·보호 API 직접 요청 |
| 비밀번호 변경 UI에 현재 비밀번호가 있음 | 필드 제거·빈 값·JSON 직접 요청 |
| 재설정 링크가 요청 host를 반영 | `Host`·`X-Forwarded-Host` 비교 |
| 재설정 요청에 token과 user ID가 함께 있음 | 두 테스트 계정의 값을 교차 결합 |
| MFA 전 임시 세션 발급 | 보호 API 직접 호출 |
| MFA 결과를 JSON boolean으로만 처리 | 응답 변조 후 서버 측 인증 상태 확인 |
| MFA 변경이 활성 세션만 요구 | 기존 factor 없이 비활성화·교체 요청 |
| Trusted Device가 독립 쿠키로 동작 | 새 브라우저·다른 계정에서 쿠키 재사용 |

---

## 취약 판정 기준

### 취약

- [ ] 로그인·가입·재설정 응답으로 사용자 존재 여부를 안정적으로 구분 가능
- [ ] 로그인·OTP를 지속 추측할 수 있거나 간단한 헤더·쿠키 변경으로 제한 우회 가능
- [ ] Password Spraying·Credential Stuffing 형태의 분산 요청에 실질적인 통제가 없음
- [ ] 미인증·잠금·비활성 계정이 다른 인증 경로 또는 보호 API를 통과함
- [ ] 현재 자격증명 또는 동등한 재인증 없이 비밀번호·MFA 설정 변경 가능
- [ ] 재설정 토큰이 예측·재사용 가능하거나 사용자·origin 검증이 누락됨
- [ ] 복구 코드·이메일·고객센터 등 대체 복구 수단이 기존 인증보다 약함
- [ ] MFA 완료 전 세션으로 보호 API 접근 가능
- [ ] 클라이언트 응답 변조만으로 인증 완료 상태 획득 가능
- [ ] Trusted Device 토큰이 계정·기기에 결합되지 않거나 중요 변경 후에도 계속 유효함
- [ ] 미인증 요청으로 보호 데이터나 기능 접근 가능

### 후보 / 보류

- [ ] 응답 시간 차이가 있으나 반복 측정에서 일관되지 않음
- [ ] CAPTCHA·지연은 있으나 실제 추측 속도가 충분히 제한되는지 확인되지 않음

---

## 참고자료

### 공식 및 테스트 가이드

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [PortSwigger - Authentication vulnerabilities](https://portswigger.net/web-security/authentication)
- [PortSwigger - Password-based authentication](https://portswigger.net/web-security/authentication/password-based)
- [PortSwigger - Multi-factor authentication](https://portswigger.net/web-security/authentication/multi-factor)
- [PortSwigger - Other authentication mechanisms](https://portswigger.net/web-security/authentication/other-mechanisms)

### 커뮤니티 참고 / 도구

- [HackTricks - Login Bypass](https://hacktricks.wiki/en/pentesting-web/login-bypass/index.html)
