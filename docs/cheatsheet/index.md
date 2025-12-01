---
sidebar_position: 1
title: Overview
---

# Security Cheatsheet

## 📋 소개

이 Cheatsheet은 [0xsyr0/OSCP](https://github.com/0xsyr0/OSCP)를 기반으로 한글화 및 재구성한 침투 테스트 명령어 모음입니다.

**특징:**
- 실전 중심의 명령어 모음
- 빠른 참조에 최적화
- 도구별 상세 옵션
- OSCP/모의해킹 특화

---

## 🗂️ 구조

### Basics
기본 명령어 및 유틸리티
- 파일 전송, 쉘 안정화, 포트 포워딩 등

### Services
서비스별 공격 기법
- SMB, FTP, SSH, RDP, MSSQL, WinRM 등 19개 서비스

### Information Gathering
정보 수집 도구
- Nmap, Port Scanning

### Web Application
웹 애플리케이션 공격
- Burp Suite, ffuf, SQLi, XSS, LFI 등

### Database
데이터베이스 공격
- MySQL, PostgreSQL, MSSQL, MongoDB, Redis
- SQL/NoSQL Injection

### Password Attacks
비밀번호 크래킹 및 공격
- hashcat, Hydra, John, Kerbrute, mimikatz, NetExec

### Exploitation
익스플로잇 프레임워크
- Metasploit Framework
- Sliver C2

### Post Exploitation
침투 후 활동
- Active Directory
- Lateral Movement

### Payloads
공격 페이로드
- Reverse Shells (Bash, Python, PowerShell 등)
- Web Shells (PHP, ASP, JSP 등)

### Wordlists
워드리스트 생성
- CeWL, CUPP, crunch
- Username Anarchy

---

## 💡 사용 방법

### 표기법

```bash
<RHOST>     # 원격 호스트 (타겟 IP/도메인)
<LHOST>     # 로컬 호스트 (공격자 IP)
<RPORT>     # 원격 포트
<LPORT>     # 로컬 포트
<USERNAME>  # 사용자명
<PASSWORD>  # 비밀번호
<DOMAIN>    # 도메인 이름
<FILE>      # 파일명
```

### 명령어 형식

```bash
# 기본 형식
tool <RHOST> -u <USERNAME> -p <PASSWORD>

# 예제
nmap -sV -p- <RHOST>
hydra -l admin -P passwords.txt ssh://<RHOST>
```

### 팁

- 각 섹션은 독립적으로 참조 가능
- 명령어는 복사해서 바로 사용 가능
- 주석으로 간단한 설명 포함
- 실전 시나리오 예제 포함

---

## 📚 주요 섹션

### 빠른 참조

**초기 침투:**
1. [Nmap](/cheatsheet/information-gathering/nmap) - 포트 스캔
2. [Services](/cheatsheet/services) - 서비스별 공격
3. [Web Application](/cheatsheet/web-application) - 웹 공격

**권한 상승:**
1. [Linux Privilege Escalation](/cheatsheet/basics/linux-priv-esc)
2. [Windows Privilege Escalation](/cheatsheet/basics/windows-priv-esc)

**자격증명 획득:**
1. [Password Attacks](/cheatsheet/password-attacks) - 크래킹
2. [mimikatz](/cheatsheet/password-attacks/mimikatz) - Windows 자격증명
3. [hashcat](/cheatsheet/password-attacks/hashcat) - Hash 크래킹

**횡적 이동:**
1. [Active Directory](/cheatsheet/post-exploitation/active-directory)
2. [Lateral Movement](/cheatsheet/post-exploitation/lateral-movement)

---

## 🔗 관련 리소스

**원본:**
- [0xsyr0/OSCP GitHub](https://github.com/0xsyr0/OSCP)

**도구 공식 문서:**
- [Metasploit](https://www.metasploit.com/)
- [Impacket](https://github.com/fortra/impacket)
- [Burp Suite](https://portswigger.net/burp)
- [Sliver](https://github.com/BishopFox/sliver)

**학습 자료:**
- [HackTricks](https://book.hacktricks.xyz/)
- [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings)
- [GTFOBins](https://gtfobins.github.io/)

---

## ⚠️ 주의사항

- **합법적인 용도로만 사용**
- 권한이 있는 시스템에서만 테스트
- 모의해킹 계약서 및 승인 필수
- 무단 사용 시 법적 책임

---

## 📝 기여

이 문서는 계속 업데이트됩니다. 오류나 개선사항이 있다면 제보해주세요.

**업데이트 내역:**
- 2024년 기준 최신 도구 및 기법 반영
- 한글화 및 설명 추가
- 실전 예제 추가
- Sliver C2 추가
