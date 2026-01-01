---
sidebar_position: 5
---

# 기타 도구 (Other Tools)

클라우드 침투테스트에 유용한 기타 도구 및 기법을 소개합니다.

---

## ScoutSuite

### 설명
**멀티 클라우드 보안 감사 도구**

AWS, Azure, GCP 환경을 자동으로 스캔하여 보안 취약점을 찾아냅니다.

**지원 플랫폼:**
- AWS
- Azure
- GCP
- Alibaba Cloud
- Oracle Cloud

**🎯 언제 사용?**
- 클라우드 환경의 전반적인 보안 평가
- 잘못된 설정(Misconfiguration) 탐지
- CIS 벤치마크 준수 확인

### 설치

```bash
# virtualenv 사용
sudo apt-get install virtualenv
git clone https://github.com/nccgroup/ScoutSuite
cd ScoutSuite
virtualenv -p python3 venv
source venv/bin/activate
pip install -r requirements.txt
```

```bash
# 또는 pip로 직접 설치
pip install scoutsuite
```

**root로 실행 필요 시:**
```bash
sudo apt-get install virtualenv
sudo su
virtualenv -p python3 venv
source venv/bin/activate
pip install scoutsuite
```

### 사용법

**AWS 스캔:**
```bash
# 프로필 사용
python scout.py aws --profile=<aws profile name>

# 설치 버전 사용
scout aws --profile=<aws profile name>
```

**Azure 스캔:**
```bash
scout azure --cli
```

**GCP 스캔:**
```bash
scout gcp --service-account=<service-account-key.json>
```

**💡 주요 옵션:**
- `--profile`: AWS 프로필 이름
- `--cli`: Azure CLI 자격증명 사용
- `--service-account`: GCP 서비스 계정 키

**📤 출력:**
- HTML 리포트 생성
- 브라우저로 결과 확인 가능
- 취약점 우선순위 표시

**🎯 확인 사항:**
- 공개된 S3/Blob/Storage 버킷
- 암호화되지 않은 리소스
- 과도한 IAM 권한
- 방화벽 규칙 오류
- MFA 미사용 계정

### jq를 이용한 ScoutSuite 결과 파싱

ScoutSuite는 JSON 형식으로 결과를 저장하므로 `jq`로 파싱할 수 있습니다.

**암호화되지 않은 EBS 볼륨 찾기:**
```bash
for d in scoutsuite_results_aws-*; do
  tail $d -n +2 | jq -r '.services.ec2.regions[].volumes[] | select(.Encrypted == false) | .arn' >> ec2-ebs-volume-not-encrypted.txt
done
```

**암호화되지 않은 EBS 스냅샷:**
```bash
for d in scoutsuite_results_aws-*; do
  tail $d -n +2 | jq -r '.services.ec2.regions[].snapshots[] | select(.encrypted == false) | .arn' >> ec2-ebs-snapshot-not-encrypted.txt
done
```

**MFA 미사용 사용자:**
```bash
for d in scoutsuite_results_aws-*; do
  tail $d -n +2 | jq -r '.account_id' >> iam-user-without-mfa.txt
  for item in $(tail $d -n +2 | jq -r '.services.iam.findings[] | select(.description | contains("User without MFA")) | .items[]' | sed 's/\.mfa_enabled.*//'); do
    tail $d -n +2 | jq -r ".services.$item | .arn" >> iam-user-without-mfa.txt
  done
done
```

**Azure Storage Account 목록:**
```bash
tail scoutsuite_results_azure-tenant-*.js -n +2 | jq -r '.services.storageaccounts.subscriptions[].storage_accounts[] | .name'
```

**Azure VM 호스트네임:**
```bash
tail scoutsuite_results_azure-tenant-*.js -n +2 | jq -jr '.services.virtualmachines.subscriptions[].instances[] | .name,".",.location,".cloudapp.windows.net","\n"'
```

---

## Prowler

### 설명
**AWS/Azure 보안 평가 도구**

CIS 벤치마크, PCI-DSS, GDPR 등 규정 준수를 자동 검사합니다.

**🎯 언제 사용?**
- 규정 준수 검사
- 보안 베스트 프랙티스 확인
- 자동화된 보안 평가

### 설치

```bash
git clone https://github.com/prowler-cloud/prowler
cd prowler
pip install -r requirements.txt
```

### 사용법

```bash
# AWS 스캔 (빠른 모드)
prowler aws -q -p <profile name>

# Azure 스캔
prowler azure --sp-env-auth

# 특정 리전만
prowler aws -f <region>

# JSON 출력
prowler aws -M json
```

### Prowler 결과 파싱

**Critical 취약점만 추출:**
```bash
for d in prowler-output-*.json; do
  tail $d -n +1 | jq -r '.[] | select(.Severity == "critical") | .AccountId,.ResourceArn,.ServiceName,.Description,.StatusExtended,.Risk' >> prowler-critical-vulns-shortlist.txt
done
```

**전체 Critical 결과:**
```bash
for d in prowler-output-*.json; do
  tail $d -n +1 | jq -r '.[] | select(.Severity == "critical")' >> prowler-critical-vulns-full-findings.txt
done
```

**서비스별 분류:**
```bash
# 서비스 목록 추출
for d in prowler-output-*.json; do
  tail $d -n +1 | jq -r '.[].resources[].group.name' | sort -u >> servicesunsorted.txt
done
sort -u servicesunsorted.txt > services.txt

# 서비스별 Critical 취약점
while read -r p; do
  for d in prowler-output-*.json; do
    echo $p; echo $d
    tail "$d" -n +1 | jq -r --arg service "$p" '.[] | select(.resources[].group.name == $service and .severity == "Critical")' >> "$p-criticals.txt"
  done
done < services.txt
```

**💡 설명:**
여러 계정의 Prowler 결과를 서비스/심각도별로 분류하여 분석합니다.

---

## Cloud_Enum

### 설명
**공개 클라우드 리소스 검색 도구**

AWS, Azure, GCP의 공개된 스토리지, 웹사이트 등을 키워드로 검색합니다.

**🎯 언제 사용?**
- 회사 이름으로 공개 리소스 검색
- S3/Blob/Storage 버킷 찾기
- 퍼블릭 접근 가능 리소스 열거

### 설치

```bash
git clone https://github.com/initstring/cloud_enum
cd cloud_enum
pip install -r requirements.txt
```

### 사용법

```bash
python3 cloud_enum.py -k <name-to-search>
```

**예제:**
```bash
# "company" 키워드로 검색
python3 cloud_enum.py -k company

# 결과: company-prod, company-dev, company-backups 등 발견
```

**💡 설명:**
- 일반적인 네이밍 패턴으로 리소스 추측
- DNS 조회로 존재 여부 확인
- 공개 접근 가능 여부 테스트

**📤 발견 가능한 것:**
- AWS S3 버킷
- Azure Blob 컨테이너
- Google Cloud Storage
- Azure 웹사이트
- AWS CloudFront

**🎯 사용 시기:**
- 정찰 단계
- 외부 공격 표면 탐색
- 데이터 유출 경로 확인

---

## GitLeaks

### 설명
**Git 저장소에서 비밀 정보 탐지**

코드 저장소에서 API 키, 비밀번호, 토큰 등을 자동으로 찾아냅니다.

**🎯 언제 사용?**
- GitHub, GitLab 저장소 분석
- 소스 코드에서 자격증명 탐색
- 실수로 커밋된 비밀 정보 찾기

### 설치

**Docker 사용:**
```bash
sudo docker pull zricethezav/gitleaks
```

### 사용법

**도움말:**
```bash
sudo docker run --rm --name=gitleaks zricethezav/gitleaks --help
```

**저장소 스캔:**
```bash
# 원격 저장소
sudo docker run --rm --name=gitleaks zricethezav/gitleaks -v -r <repo URL>

# 로컬 저장소
sudo docker run --rm --name=gitleaks -v /path/to/repo:/repo zricethezav/gitleaks -v -r /repo
```

**💡 주요 옵션:**
- `-v`: Verbose (상세 출력)
- `-r`: Repository URL 또는 경로
- `--config`: 커스텀 설정 파일

**📤 탐지 대상:**
- AWS Access Key
- Azure Service Principal
- GCP Service Account Key
- API 토큰
- 비밀번호
- Private Key (RSA, SSH 등)

**🎯 사용 시기:**
- 소스 코드 저장소 접근 시
- Cloud Source Repository 클론 후
- Git 히스토리 전체 분석

### 유사 도구

**TruffleHog:**
```bash
git clone https://github.com/trufflesecurity/trufflehog
trufflehog git https://github.com/company/repo
```

**Shhgit:**
- 실시간 GitHub 모니터링
- https://github.com/eth0izzle/shhgit

**Gitrob:**
- GitHub 조직 분석
- https://github.com/michenriksen/gitrob

---

## ip2Provider

### 설명
**IP 주소가 클라우드 제공자인지 확인**

IP 주소 목록이 AWS, Azure, GCP, DigitalOcean 등 어디에 속하는지 확인합니다.

**🎯 언제 사용?**
- 포트 스캔 결과 분석
- 클라우드 호스팅 여부 확인
- 공격 표면 파악

### 설치

```bash
git clone https://github.com/oldrho/ip2provider
cd ip2provider
pip install -r requirements.txt
```

### 사용법

```bash
# 단일 IP
python ip2provider.py 1.2.3.4

# IP 목록 파일
python ip2provider.py -f ip_list.txt
```

**📤 출력 예시:**
```
1.2.3.4 - AWS
5.6.7.8 - Azure
9.10.11.12 - GCP
13.14.15.16 - Unknown
```

**🎯 활용:**
- 클라우드 서비스별로 공격 전략 다름
- AWS면 메타데이터 서비스 공격
- Azure면 IMDS 공격

---

## FireProx

### 설명
**AWS API Gateway를 이용한 IP 회전**

패스워드 스프레이 공격 시 IP 주소를 계속 변경하여 탐지/차단을 우회합니다.

**🎯 언제 사용?**
- Azure/O365 패스워드 스프레이
- IP 기반 차단 우회
- 대량 요청 시 탐지 회피

### 설치

```bash
git clone https://github.com/ustayready/fireprox
cd fireprox
virtualenv -p python3 .
source bin/activate
pip install -r requirements.txt
```

### 사용법

**FireProx 생성:**
```bash
python fire.py --access_key <access_key_id> --secret_access_key <secret_access_key> --region <region> --url https://login.microsoft.com --command create
```

**💡 설명:**
- AWS API Gateway 엔드포인트 생성
- 요청을 프록시하여 대상 서버로 전달
- 각 요청마다 다른 IP 사용

**MSOLSpray와 함께 사용:**
```powershell
Invoke-MSOLSpray -UserList .\userlist.txt -Password Spring2020 -URL https://api-gateway-endpoint-id.execute-api.us-east-1.amazonaws.com/fireprox
```

**🎯 장점:**
- IP 차단 우회
- 속도 제한 우회
- 탐지 어려움

**⚠️ 주의:**
- AWS 비용 발생
- 침투테스트 종료 후 삭제 필수
- 악용 시 AWS 계정 정지 가능

---

## PowerView

### 설명
**Active Directory 정찰 도구**

클라우드와 연동된 온프레미스 AD 환경을 조사할 때 유용합니다.

**🎯 언제 사용?**
- 하이브리드 환경 (온프레미스 + 클라우드)
- Azure AD Connect 서버 찾기
- AD 사용자/그룹 열거

### 설치

```powershell
git clone https://github.com/PowerShellMafia/PowerSploit
Import-Module .\PowerSploit\Recon\PowerView.ps1
```

### 주요 명령어

**ADConnect 계정 찾기:**
```powershell
Get-NetUser -Filter "(samAccountName=MSOL_*)" | Select-Object name,description | fl
```

**💡 설명:**
Azure AD Connect는 `MSOL_`로 시작하는 서비스 계정을 사용합니다.

**📌 ADConnect란?**
- 온프레미스 AD와 Azure AD 동기화
- 서비스 계정이 높은 권한 보유
- 비밀번호 해시 동기화

**🎯 공격 시나리오:**
1. ADConnect 서버 침투
2. MSOL 서비스 계정 탈취
3. 비밀번호 해시 추출
4. Azure AD 접근

---

## Mimikatz

### 설명
**Windows 자격증명 추출 도구**

클라우드 관리자의 로컬 PC를 침투했을 때 사용합니다.

**🎯 언제 사용?**
- 클라우드 관리자 PC 침투 시
- 웹 서버에서 인증서 추출
- SAM 파일에서 해시 덤프

### 인증서 추출

```
mimikatz# crypto::capi
mimikatz# privilege::debug
mimikatz# crypto::cng
mimikatz# crypto::certificates /systemstore:local_machine /store:my /export
```

**💡 설명:**
웹 서버의 SSL/TLS 인증서 private key를 추출합니다.

**🎯 사용 시기:**
- Azure App Service 인증서
- 클라우드 관리 콘솔 인증서
- 클라이언트 인증서

### SAM/SYSTEM 파일 덤프

```
mimikatz# lsadump::sam /system:SYSTEM /sam:SAM
```

**💡 설명:**
SAM과 SYSTEM 파일에서 로컬 계정 해시를 추출합니다.

**🎯 사용 시기:**
- 클라우드 관리자 로컬 계정 추출
- 재사용 비밀번호 찾기

---

## 명령 히스토리 확인

### Linux Bash History

```bash
# Bash 히스토리 확인
cat ~/.bash_history

# 모든 사용자 히스토리 검색
sudo find /home -name ".bash_history" -exec cat {} \;
```

**💡 설명:**
사용자가 이전에 실행한 모든 명령을 볼 수 있습니다.

**🎯 발견 가능한 것:**
- `aws configure` 명령에 하드코딩된 키
- `gcloud auth activate-service-account --key-file=./key.json`
- 비밀번호가 포함된 명령
- API 엔드포인트, 내부 서버 주소

**예제:**
```bash
# AWS 관련 명령 검색
cat ~/.bash_history | grep aws

# 비밀번호 검색
cat ~/.bash_history | grep -i password
```

### Windows PowerShell History

```powershell
# PowerShell 히스토리 위치
%USERPROFILE%\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt

# 확인
Get-Content $env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

**💡 설명:**
PowerShell 명령 히스토리를 확인합니다.

**🎯 발견 가능한 것:**
- `Connect-AzAccount -Credential $cred`
- Azure/AWS 명령어
- 평문 비밀번호
- API 호출

---

## 취약한 클라우드 환경 (실습용)

### CloudGoat

**설명:**
AWS 취약한 환경 자동 생성 도구 (CTF 스타일)

**설치:**
```bash
git clone https://github.com/RhinoSecurityLabs/cloudgoat
cd cloudgoat
pip install -r requirements.txt
./cloudgoat.py config profile
./cloudgoat.py config whitelist --auto
```

**사용:**
```bash
# 시나리오 목록
./cloudgoat.py list

# 시나리오 생성
./cloudgoat.py create <scenario_name>

# 완료 후 삭제
./cloudgoat.py destroy <scenario_name>
```

**🎯 언제 사용?**
- AWS 침투테스트 학습
- 기법 연습
- 도구 테스트

---

### SadCloud

**설명:**
Terraform으로 취약한 AWS 환경 생성

**링크:**
https://github.com/nccgroup/sadcloud

**🎯 특징:**
- 다양한 취약점 시나리오
- Terraform 코드 학습
- 실제 환경과 유사

---

### Flaws Cloud

**설명:**
AWS 보안 학습 웹사이트 (CTF)

**URL:**
http://flaws.cloud

**🎯 특징:**
- 단계별 AWS 보안 과제
- S3, IAM, EC2 취약점
- 무료 학습 가능

---

### Thunder CTF

**설명:**
GCP 보안 CTF

**URL:**
http://thunder-ctf.cloud

**🎯 특징:**
- GCP 전용 CTF
- 실제 취약점 시나리오
- 무료

---

## 도구 요약 표

| 도구 | 플랫폼 | 용도 | 난이도 |
|------|--------|------|--------|
| ScoutSuite | AWS/Azure/GCP | 보안 감사 | 초급 |
| Prowler | AWS/Azure | 규정 준수 | 초급 |
| Cloud_Enum | AWS/Azure/GCP | 공개 리소스 검색 | 초급 |
| GitLeaks | Git | 비밀 정보 탐지 | 초급 |
| FireProx | Azure/O365 | IP 회전 | 중급 |
| ip2Provider | - | IP 분류 | 초급 |
| CloudGoat | AWS | 실습 환경 | 중급 |

---

## 참고

### 도구 선택 가이드

**초기 정찰:**
1. Cloud_Enum → 공개 리소스 찾기
2. ip2Provider → 클라우드 제공자 확인

**자격증명 획득:**
1. GitLeaks → 코드에서 키 추출
2. 명령 히스토리 → bash/PowerShell 검색

**보안 평가:**
1. ScoutSuite → 전체 환경 스캔
2. Prowler → 상세 규정 준수

**패스워드 스프레이:**
1. MSOLSpray + FireProx → Azure/O365 공격

**실습/학습:**
1. CloudGoat → AWS 연습
2. Flaws Cloud → AWS 학습
3. Thunder CTF → GCP 학습

---

## 관련 링크

- [ScoutSuite GitHub](https://github.com/nccgroup/ScoutSuite)
- [Prowler GitHub](https://github.com/prowler-cloud/prowler)
- [Cloud_Enum GitHub](https://github.com/initstring/cloud_enum)
- [GitLeaks GitHub](https://github.com/zricethezav/gitleaks)
- [FireProx GitHub](https://github.com/ustayready/fireprox)
- [CloudGoat GitHub](https://github.com/RhinoSecurityLabs/cloudgoat)
