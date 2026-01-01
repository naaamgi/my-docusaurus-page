---
sidebar_position: 1
---

# Cloud Penetration Testing

## 📋 소개

클라우드 환경 침투테스트를 위한 치트시트입니다. AWS, Azure, GCP 등 주요 클라우드 플랫폼에서 사용되는 명령어와 기법을 다룹니다.

이 문서는 [CloudPentestCheatsheets](https://github.com/dafthack/CloudPentestCheatsheets) by Beau Bullock (@dafthack)을 기반으로 초급자를 위한 설명을 추가하여 재구성했습니다.

**특징:**
- 클라우드 플랫폼별 공격 기법
- 초급자를 위한 상세 설명
- 명령어 옵션 및 파라미터 설명
- 실전 시나리오 예제

---

## 🗂️ 구조

### [AWS (Amazon Web Services)](./aws)
AWS 환경 침투테스트
- S3 버킷 열거 및 탈취
- IAM 권한 상승
- EC2 인스턴스 공격
- Lambda 함수 분석
- 자격증명 탈취

### [Azure (Microsoft Azure)](./azure)
Azure 환경 침투테스트
- Azure AD 열거
- Storage Account 공격
- Virtual Machine 접근
- Key Vault 탈취
- Managed Identity 악용

### [GCP (Google Cloud Platform)](./gcp)
GCP 환경 침투테스트
- Cloud Storage 열거
- IAM 권한 분석
- Compute Engine 공격
- Service Account 악용

### [기타 도구](./other-tools)
클라우드 보안 도구
- ScoutSuite
- Prowler
- Pacu
- CloudMapper
- 기타 유용한 도구

### [참고자료](./references)
클라우드 보안 학습 자료 및 참고 문서

---

## 💡 클라우드 침투테스트란?

### 온프레미스와의 차이점

**온프레미스 환경:**
- 물리적 접근 가능
- 네트워크 기반 공격
- OS/애플리케이션 취약점

**클라우드 환경:**
- API 기반 공격
- IAM/권한 관리 취약점
- 잘못된 설정 (Misconfiguration)
- 공개된 리소스 (Public Buckets)
- 자격증명 노출

### 주요 공격 벡터

1. **공개된 스토리지**
   - S3, Azure Blob, GCS 버킷
   - 민감 정보 노출
   - 쓰기 권한 악용

2. **자격증명 탈취**
   - Access Key/Secret Key
   - Service Principal
   - Service Account Key

3. **권한 상승**
   - 과도한 IAM 권한
   - Role Assumption
   - Managed Identity 악용

4. **메타데이터 서비스**
   - EC2 메타데이터
   - Azure IMDS
   - GCP Metadata API

---

## 🎯 침투테스트 프로세스

### 1단계: 정찰 (Reconnaissance)
- 도메인/서브도메인 열거
- 공개된 스토리지 검색
- 자격증명 수집 (GitHub, 구성 파일)

### 2단계: 초기 접근 (Initial Access)
- 자격증명 검증
- 공개 API 테스트
- 메타데이터 서비스 접근

### 3단계: 권한 상승 (Privilege Escalation)
- IAM 정책 분석
- Role 열거
- 취약한 권한 탐색

### 4단계: 횡적 이동 (Lateral Movement)
- 다른 리소스 접근
- 크로스 계정 공격
- 서비스 간 이동

### 5단계: 데이터 탈취 (Exfiltration)
- 민감 데이터 검색
- 스토리지 다운로드
- 시크릿/키 추출

---

## 📚 사전 지식

### 필수 개념

**IAM (Identity and Access Management):**
- 클라우드 리소스 접근 제어
- 사용자, 그룹, 역할 관리
- 정책 기반 권한 부여

**리소스:**
- 클라우드에서 생성/관리되는 모든 객체
- 예: VM, 스토리지, 데이터베이스, 함수

**리전 (Region):**
- 클라우드 서비스가 제공되는 지리적 위치
- 각 리전마다 독립적인 리소스

**메타데이터 서비스:**
- 인스턴스 정보 제공 API
- 임시 자격증명 노출 가능
- SSRF 공격으로 악용 가능

### 권장 사항

- 각 클라우드 플랫폼의 기본 서비스 이해
- CLI 도구 사용법 숙지
- API 호출 방식 학습
- 로그 및 모니터링 우회 기법

---

## ⚠️ 주의사항

- **합법적인 용도로만 사용**
- 권한이 있는 환경에서만 테스트
- 침투테스트 계약서 필수
- 클라우드 비용 발생 주의
- 로그 모니터링 주의
- 무단 사용 시 법적 책임

---

## 🔗 관련 리소스

**원본:**
- [CloudPentestCheatsheets](https://github.com/dafthack/CloudPentestCheatsheets) by Beau Bullock

**학습 자료:**
- [HackTricks Cloud](https://cloud.hacktricks.xyz/)
- [OWASP Cloud Security](https://owasp.org/www-project-cloud-security/)
- [Rhino Security Labs Blog](https://rhinosecuritylabs.com/blog/)

**공식 문서:**
- [AWS Documentation](https://docs.aws.amazon.com/)
- [Azure Documentation](https://docs.microsoft.com/azure/)
- [GCP Documentation](https://cloud.google.com/docs)
