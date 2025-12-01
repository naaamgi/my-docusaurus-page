---
sidebar_position: 4
---

# GitTools

> https://github.com/internetwache/GitTools

노출된 `.git` 디렉토리를 활용한 정보 수집 도구입니다.

## 도구 구성

GitTools는 3가지 주요 도구로 구성되어 있습니다:

1. **gitdumper.sh** - `.git` 디렉토리 다운로드
2. **extractor.sh** - 커밋 히스토리 추출
3. **finder.sh** - `.git` 디렉토리 검색

## 설치

```bash
git clone https://github.com/internetwache/GitTools.git
cd GitTools
```

## gitdumper.sh

노출된 `.git` 디렉토리를 다운로드합니다.

### 기본 사용법

```bash
./gitdumper.sh http://<RHOST>/.git/ /PATH/TO/FOLDER
```

### 예제

```bash
# 웹 서버에서 .git 디렉토리 다운로드
./gitdumper.sh http://example.com/.git/ ./git-dump

# HTTPS 사이트
./gitdumper.sh https://example.com/.git/ ./git-dump
```

## extractor.sh

다운로드한 `.git` 디렉토리에서 모든 커밋을 추출합니다.

### 기본 사용법

```bash
./extractor.sh /PATH/TO/FOLDER/ /PATH/TO/OUTPUT/
```

### 예제

```bash
# git-dump 폴더에서 커밋 추출
./extractor.sh ./git-dump/ ./extracted/
```

### 추출된 결과 확인

```bash
# 추출된 디렉토리 구조 확인
ls -la ./extracted/

# 각 커밋별로 폴더가 생성됨
# 0-커밋해시/
# 1-커밋해시/
# 2-커밋해시/
```

## 전체 워크플로우

### 1. .git 디렉토리 다운로드

```bash
./gitdumper.sh http://<RHOST>/.git/ ./target-git
```

### 2. 커밋 추출

```bash
./extractor.sh ./target-git/ ./commits/
```

### 3. 커밋 히스토리 분석

```bash
cd commits/

# 각 커밋 폴더 확인
for dir in */; do
  echo "=== $dir ==="
  ls -la "$dir"
done
```

### 4. 민감 정보 검색

```bash
# 비밀번호 검색
grep -r "password" ./commits/

# API 키 검색
grep -r "api_key\|API_KEY\|apikey" ./commits/

# 데이터베이스 설정 검색
grep -r "db_password\|database" ./commits/

# 모든 설정 파일 찾기
find ./commits/ -name "*.env" -o -name "config.*" -o -name "*.conf"
```

## Git 명령어로 분석

다운로드한 `.git` 디렉토리는 일반 Git 저장소처럼 사용할 수 있습니다:

```bash
cd /PATH/TO/FOLDER

# 로그 확인
git log

# 특정 커밋 확인
git show <COMMIT_HASH>

# 파일 변경 이력 확인
git log -p <FILE>

# 모든 브랜치 확인
git branch -a

# 특정 브랜치 체크아웃
git checkout <BRANCH>

# 삭제된 파일 복구
git checkout <COMMIT_HASH> -- <FILE>
```

## 유용한 Git 명령어

### 모든 커밋에서 민감 정보 찾기

```bash
# 비밀번호 검색
git log -p | grep -i "password"

# API 키 검색
git log -S "api_key" --all

# 특정 파일의 모든 변경 이력
git log --all --full-history -- <FILE>
```

### 커밋 메시지 검색

```bash
git log --all --grep="password"
git log --all --grep="secret"
git log --all --grep="credential"
```

## 일반적인 발견 사항

- `.env` 파일에 포함된 환경 변수
- `config.php` 등 설정 파일의 하드코딩된 자격증명
- API 키 및 토큰
- 데이터베이스 연결 문자열
- AWS 키
- SSH 개인 키
- 이전 커밋에서 삭제된 민감 파일

## 참고

- `.git` 디렉토리가 공개되어 있는지 확인: `http://<RHOST>/.git/config`
- 대부분의 경우 directory listing이 비활성화되어 있어도 `.git/HEAD` 접근 가능
- 커밋 히스토리에 민감 정보가 있을 수 있음
- GitTools는 Python 2와 3 모두 지원
