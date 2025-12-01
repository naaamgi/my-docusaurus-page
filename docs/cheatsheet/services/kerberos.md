---
sidebar_position: 3
---

# Kerberos - 88

## 기본 정보

**포트**: 88

Kerberos는 네트워크 인증 프로토콜로, Active Directory 환경에서 주로 사용됩니다.

## 설치

```bash
sudo apt-get install krb5-kdc
```

## 티켓 처리 (Ticket Handling)

```bash
# TGT(Ticket Granting Ticket) 획득
impacket-getTGT <DOMAIN>/<USERNAME>:'<PASSWORD>'

# 티켓 환경 변수 설정
export KRB5CCNAME=<FILE>.ccache
export KRB5CCNAME='realpath <FILE>.ccache'

# 특정 애플리케이션에 티켓 적용
KRB5CCNAME=<FILE>.ccache <APPLICATION>
```

## Kerberos 관련 파일 및 명령어

```bash
# Kerberos 설정 파일
/etc/krb5.conf

# 티켓 요청 생성
kinit <USERNAME>

# 사용 가능한 Kerberos 티켓 확인
klist

# 캐시된 Kerberos 티켓 삭제
kdestroy

# Kerberos principals 파일 (홈 디렉토리에 위치)
.k5login

# Key table 파일
krb5.keytab

# Kerberos 관리 콘솔
kadmin

# keytab 파일에 새 사용자 추가
add_principal <EMAIL>

# Kerberos 인증으로 명령 실행
ksu

# keytab 파일 목록 확인
klist -k /etc/krb5.keytab

# keytab 파일 편집 활성화
kadmin -p kadmin/<EMAIL> -k -t /etc/krb5.keytab
```

## 티켓 변환 (Ticket Conversion)

### kirbi to ccache

```bash
# Base64 디코딩
base64 -d <USERNAME>.kirbi.b64 > <USERNAME>.kirbi

# kirbi를 ccache로 변환
impacket-ticketConverter <USERNAME>.kirbi <USERNAME>.ccache

# 환경 변수 설정
export KRB5CCNAME=`realpath <USERNAME>.ccache`
```

### ccache to kirbi

```bash
# ccache를 kirbi로 변환
impacket-ticketConverter <USERNAME>.ccache <USERNAME>.kirbi

# Base64 인코딩
base64 -w0 <USERNAME>.kirbi > <USERNAME>.kirbi.base64
```

## 참고

- TGT (Ticket Granting Ticket): 초기 인증 티켓
- TGS (Ticket Granting Service): 서비스 접근 티켓
- ccache: Linux/Unix Kerberos 티켓 캐시 형식
- kirbi: Windows Kerberos 티켓 형식
- Kerberoasting, AS-REP Roasting 등의 공격은 Active Directory 섹션 참고
