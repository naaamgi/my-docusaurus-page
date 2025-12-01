---
sidebar_position: 4
---

# NetBIOS - 137/138/139

## 기본 정보

**포트**: 137 (UDP - Name Service), 138 (UDP - Datagram Service), 139 (TCP - Session Service)

NetBIOS는 네트워크 상에서 컴퓨터 이름을 확인하고 세션을 설정하는 프로토콜입니다.

## 열거 (Enumeration)

```bash
# NetBIOS 스캔
nbtscan <RHOST>

# NetBIOS 이름 조회
nmblookup -A <RHOST>
```

## Nmap

```bash
# NetBIOS 포트 스캔
sudo nmap -p137,138,139 <RHOST>

# NetBIOS NSE 스크립트
sudo nmap -p137-139 --script nbstat <RHOST>
sudo nmap -p137-139 --script smb-os-discovery <RHOST>

# SMB 관련 스크립트 찾기
locate -r '\.nse$' | xargs grep categories | grep 'default\|version\|safe' | grep smb
```

## 참고

- NetBIOS는 주로 SMB/CIFS와 함께 사용됨
- 139번 포트는 SMB over NetBIOS
- 445번 포트는 SMB Direct (NetBIOS 없이)
- 더 많은 SMB 명령어는 SMB (445) 섹션 참고
