---
sidebar_position: 1
title: Frida로 HTS 진단하기 - 기본 개념·명령어·16/17 차이
description: Windows HTS 동적 진단을 위한 Frida 입문. frida-tools 명령어와 옵션 설명, frida-trace, 메모리 덤프(fridump3), Frida 16 이하와 17 이상의 API 차이 정리
keywords: [Frida, frida-tools, frida-trace, fridump3, HTS, 금융권 진단, 메모리 덤프, Frida 17, Interceptor, REPL]
toc_max_heading_level: 3
draft: false
---

# Frida로 HTS 진단하기

> HTS(Windows 데스크톱 트레이딩 앱)를 Frida로 후킹해서 진단할 때 필요한 기본 개념, 명령어와 옵션, 버전별(16 이하 / 17 이상) 차이를 정리한 문서다. Frida를 처음 쓰는 사람을 기준으로, 명령어마다 **옵션이 무슨 뜻인지**까지 적었다.

:::info 기준 환경
**frida 16.1.4 + frida-tools 12.2.1**(Windows) 기준이다. 17 이상은 공식 릴리즈 노트를 따랐다.
:::

## 1. Frida란

Frida는 실행 중인 프로세스에 **JavaScript를 주입(inject)** 해서 함수 호출을 가로채고(후킹), 인자와 반환값을 보거나 바꾸고, 메모리를 읽는 **동적 계측(dynamic instrumentation)** 도구다. 대상 프로그램을 수정하거나 재컴파일하지 않아도 된다.

HTS 진단에서 주로 하는 일은 다음과 같다.

| 목적 | 예시 |
|---|---|
| 통신 데이터 확인 | `send`, `recv`, `WSASend`, `WSARecv` 후킹으로 암호화 전후 데이터 확인 |
| 암호화 확인 | `CryptEncrypt`, `BCryptEncrypt` 등 후킹으로 평문, 키, IV 확인 |
| 메모리 평문 노출 점검 | 프로세스 메모리를 덤프해서 계정, 토큰, 주문 정보 검색 |
| 클라이언트 검증 로직 확인 | 무결성 검사, 위변조 탐지 함수의 반환값 관찰 |

### 구성 요소

| 구성 | 설명 |
|---|---|
| `frida` (Python 패키지) | 핵심 엔진과 Python 바인딩. `pip install frida` |
| `frida-tools` | 명령줄 도구 모음(`frida`, `frida-ps`, `frida-trace` 등). `pip install frida-tools` |
| `frida-server` / `frida-gadget` | 원격 단말(Android, iOS)에서 도는 에이전트. **Windows 로컬 진단에는 필요 없다** |

### 용어 정리

| 용어 | 뜻 |
|---|---|
| **attach** | 이미 실행 중인 프로세스에 붙는 것. 이미 지나간 초기화 구간은 볼 수 없다 |
| **spawn** | Frida가 프로그램을 직접 실행(일시정지 상태)하면서 붙는 것. 시작 시점부터 후킹할 수 있다 |
| **REPL** | Read-Eval-Print Loop. 한 줄 입력하면 바로 실행하고 결과를 보여주는 대화형 콘솔. 파이썬의 `>>>` 프롬프트와 같은 개념이다. `frida -n 프로세스명`을 `-l` 없이 실행하면 열린다 |
| **Interceptor** | 함수 진입(`onEnter`)과 반환(`onLeave`)을 가로채는 Frida API |
| **Module** | 프로세스에 로드된 EXE/DLL 하나. 이름과 base 주소, export 목록을 갖는다 |
| **NativePointer** | 메모리 주소를 나타내는 Frida 객체. `ptr.readU32()`처럼 읽고 쓴다 |
| **agent / script** | 대상 프로세스 안에서 실행되는 JavaScript 코드 |
| **export** | DLL이 외부에 공개한 함수. 이름으로 주소를 찾을 수 있다 |
| **offset** | 모듈 base 주소로부터의 거리. 이름이 없는(비공개) 함수를 IDA/Ghidra에서 찾은 offset으로 후킹할 때 쓴다 |

## 2. 버전 주의: Frida 16 이하 vs 17 이상

Frida 17.0.0(2025-05)에서 **JavaScript API가 호환되지 않게 바뀌었다.** 인터넷에서 구한 스크립트가 에러가 난다면 먼저 버전부터 의심한다. (출처: 공식 릴리즈 노트 [Frida 17.0.0 Released](https://frida.re/news/2025/05/17/frida-17-0-0-released/))

### 2.1 API 변경 요약

| 기능 | 16 이하 방식 | 17 이상 방식 |
|---|---|---|
| 모듈의 export 주소 | `Module.findExportByName('ws2_32.dll', 'send')`<br/>`Module.getExportByName('ws2_32.dll', 'send')` | `Process.getModuleByName('ws2_32.dll').getExportByName('send')` |
| 모듈 base 주소 | `Module.findBaseAddress('HTS.exe')` | `Process.getModuleByName('HTS.exe').base` |
| 모듈 지정 없이 export 검색 | `Module.getExportByName(null, 'send')` | `Module.getGlobalExportByName('send')` |
| 메모리 읽기 | `Memory.readU32(ptr)` | `ptr.readU32()` |
| 메모리 쓰기 | `Memory.writeU32(ptr, v)` | `ptr.writeU32(v)` (반환값이 NativePointer라 체이닝 가능) |
| 열거 API | `Process.enumerateModules(` 콜백 `onMatch/onComplete )` 형태 | 배열을 반환하는 형태만 지원 |
| Java/ObjC/Swift 브릿지 | 런타임에 내장 | 런타임에서 분리. 직접 작성한 agent는 브릿지를 따로 포함해야 한다 (REPL, frida-trace는 frida-tools 14가 포함해 줌) |

HTS는 Windows 네이티브 앱이라 **브릿지 변경보다 Module/Memory API 변경이 영향이 크다.**

### 2.2 16.1.4에서 17 방식이 되는 범위

| 코드 | Frida 16.1.4 결과 |
|---|---|
| `Process.getModuleByName('kernel32.dll').getExportByName('Sleep')` | 동작 |
| `Process.getModuleByName('ping.exe').base` | 동작 |
| `ptr.readU32()` | 동작 |
| `Process.enumerateRanges('rw-')` (콜백 없이) | 배열 반환, 동작 |
| `Module.getGlobalExportByName('Sleep')` | **`not a function` 에러** (17에서 추가된 함수) |

그래서 **16과 17에서 모두 돌아가는 코드를 쓰려면** 아래 규칙을 따른다.

- export 주소: `Process.getModuleByName(...).getExportByName(...)`
- base 주소: `Process.getModuleByName(...).base`
- 메모리 읽기/쓰기: `ptr.readXxx()` / `ptr.writeXxx()`
- 모듈 지정 없는 검색(`getGlobalExportByName`)만 16과 17이 다르므로 피하거나 분기한다.

```javascript
// 16/17 공통으로 동작하는 스타일
const ws2 = Process.getModuleByName('WS2_32.dll');
const sendto = ws2.getExportByName('sendto');

Interceptor.attach(sendto, {
  onEnter(args) { console.log('sendto len=' + args[2].toInt32()); },
  onLeave(retval) { console.log('sendto ret=' + retval.toInt32()); }
});
console.log('hooked sendto @ ' + sendto);
```

### 2.3 frida와 frida-tools 버전 짝

| 구분 | 내용 |
|---|---|
| 이 문서의 검증 조합 | frida 16.1.4 + frida-tools 12.2.1 |
| 최신 frida-tools 14.x | `frida >= 17.26.0, < 18.0.0` 요구 (frida-tools 저장소 `pyproject.toml` 기준) |

frida와 frida-tools는 **서로 맞는 짝**을 쓴다. 한쪽만 올리면 에러가 난다.

### 2.4 폐쇄망에 특정 버전 옮기기

고객사 PC처럼 인터넷이 안 되는 환경에서는 **인터넷이 되는 PC에서 설치 파일(whl)을 미리 받아 옮긴 뒤**, 인터넷 없이 설치한다. 아래에서 `[ ]`로 감싼 부분은 **자기 환경에 맞게 바꿔 넣는 값**이다.

#### 0단계. 두 PC의 환경 맞추기

whl 파일은 Python 버전, OS, 비트 수에 따라 파일이 다르다. 폐쇄망 PC에서 아래를 먼저 확인하고, **인터넷 PC에서도 같은 조건**으로 받는다.

```bash
python --version
python -c "import struct; print(struct.calcsize('P') * 8)"
```

| 명령 | 확인하는 것 |
|---|---|
| `python --version` | Python 버전 (예: 3.11.x) |
| `python -c "import struct; print(struct.calcsize('P') * 8)"` | Python 비트 수. `64`면 64비트 |

frida 16.1.4의 whl 이름은 `frida-16.1.4-cp37-abi3-win_amd64.whl`이다. `abi3`은 Python 3.7 이상이면 버전이 달라도 쓸 수 있다는 뜻이고, `win_amd64`는 64비트 Windows용이라는 뜻이다. 폐쇄망 PC의 Python이 **32비트라면 파일이 달라지니** 반드시 비트 수를 확인한다.

#### 1단계. 인터넷 PC에서 whl 파일 준비

:::caution pip download만 쓰면 폐쇄망에서 설치가 실패한다
`frida-tools` 12.2.1은 whl이 아니라 **소스(`.tar.gz`)만 배포**된다. `pip download`로 받으면 소스 파일이 저장되는데, 이 파일은 설치할 때 `setuptools`를 인터넷에서 받아 빌드하려고 한다. 폐쇄망에서는 아래 오류로 실패한다.

```text
ERROR: Could not find a version that satisfies the requirement setuptools>=40.8.0 (from versions: none)
ERROR: Failed to build 'frida-tools' when installing build dependencies for frida-tools
```

그래서 인터넷 PC에서 **`pip wheel`로 whl을 미리 만들어서** 가져간다.
:::

```bash
python -m pip wheel frida==[frida 버전] frida-tools==[frida-tools 버전] -w [whl을 저장할 폴더]
```

이 문서의 조합으로 채우면 다음과 같다.

```bash
python -m pip wheel frida==16.1.4 frida-tools==12.2.1 -w C:\wheels
```

| 옵션 | 의미 |
|---|---|
| `python -m pip` | 지금 쓰는 Python에 연결된 pip를 실행 (`pip` 단독 실행보다 헷갈릴 일이 적다) |
| `wheel` | 지정한 패키지와 **의존 패키지까지** whl 파일로 만든다 (소스만 있는 패키지는 이 단계에서 빌드해 whl로 바꿔 준다) |
| `frida==[버전] frida-tools==[버전]` | 정확히 이 버전을 받는다 (`==`로 고정) |
| `-w [폴더]`, `--wheel-dir [폴더]` | 만든 whl 파일을 저장할 폴더 |

결과로 아래 6개 파일이 생긴다. (`pip download`로는 `frida_tools-12.2.1-py3-none-any.whl` 대신 `frida-tools-12.2.1.tar.gz`가 받아진다.)

| 파일 | 설명 |
|---|---|
| `frida-16.1.4-cp37-abi3-win_amd64.whl` | frida 본체 |
| `frida_tools-12.2.1-py3-none-any.whl` | frida-tools |
| `colorama-0.4.6-py2.py3-none-any.whl` | frida-tools 의존 패키지 |
| `prompt_toolkit-3.0.53-py3-none-any.whl` | frida-tools 의존 패키지 |
| `pygments-2.21.0-py3-none-any.whl` | frida-tools 의존 패키지 |
| `wcwidth-0.9.4-cp310-abi3-win_amd64.whl` | prompt_toolkit 의존 패키지 |

의존 패키지(`colorama` 등)의 버전은 받는 시점에 따라 달라질 수 있다. 중요한 것은 **6개 파일을 전부 가져가는 것**이다.

#### 2단계. 폐쇄망 PC로 옮기기

whl 폴더 전체를 폐쇄망 PC로 옮긴다(승인된 반입 절차 사용). 아래에서는 `[whl 경로]`로 표기한다. 경로에 공백이 있으면 따옴표로 감싼다.

#### 3단계. 폐쇄망 PC에서 설치

아래 네 가지 방법 중 편한 것을 쓰면 된다. 모두 **인터넷 없이** 설치한다.

**방법 1. `--find-links`로 폴더를 지정 (의존 패키지를 자동 설치)**

```bash
python -m pip install --no-index --find-links="[whl 경로]" frida==[frida 버전] frida-tools==[frida-tools 버전]
```

```bash
python -m pip install --no-index --find-links="C:\wheels" frida==16.1.4 frida-tools==12.2.1
```

| 옵션 | 의미 |
|---|---|
| `--no-index` | PyPI(인터넷)에 접속하지 않는다. 이 옵션이 없으면 폐쇄망에서 접속을 시도하다 오래 멈추거나 실패한다 |
| `--find-links="[whl 경로]"`, `-f` | 이 폴더에서 패키지 파일을 찾는다 |
| `frida==[버전] frida-tools==[버전]` | 설치할 패키지와 버전. 의존 패키지는 폴더에서 알아서 찾아 같이 설치된다 |

**방법 2. `--user` + `--no-deps`로 패키지를 하나씩 설치**

관리자 권한이 없는 PC에서 유용하다. 의존 패키지를 pip가 자동으로 설치하지 않으므로 **필요한 패키지를 직접 모두 나열**해야 한다.

```bash
python -m pip install --user --no-index --no-deps --find-links="[whl 경로]" [패키지 이름]
```

```bash
python -m pip install --user --no-index --no-deps --find-links="C:\wheels" frida==16.1.4 colorama prompt_toolkit pygments wcwidth frida_tools==12.2.1
```

| 옵션 | 의미 |
|---|---|
| `--user` | 관리자 권한 없이 **현재 사용자 전용 위치**(`%APPDATA%\Python\...`)에 설치한다. `frida.exe` 같은 실행 파일도 그쪽 `Scripts` 폴더에 생기므로 PATH에 없으면 직접 호출하거나 PATH에 추가한다 |
| `--no-index` | 인터넷에 접속하지 않는다 |
| `--no-deps` | 의존 패키지를 **자동으로 설치하지 않는다**. 어떤 파일을 설치할지 내가 직접 정할 때 쓴다 |
| `--find-links="[whl 경로]"` | whl 파일이 있는 폴더 |
| `[패키지 이름]` | 설치할 패키지. 이름은 `frida_tools`처럼 `_`로 써도, `frida-tools`처럼 `-`로 써도 된다 |

:::caution --no-deps를 쓰면 의존 패키지를 빠뜨리기 쉽다
`frida-tools`만 `--no-deps`로 설치하면 설치는 성공하지만, 실행할 때 `ModuleNotFoundError: No module named 'frida'`가 난다. `frida`, `colorama`, `prompt_toolkit`, `pygments`, `wcwidth`를 모두 같이 설치해야 한다.
:::

**방법 3. whl 파일 경로를 직접 지정**

폴더 검색 없이 파일을 하나씩 지정한다. 어떤 파일이 설치되는지 가장 분명하다.

```bash
python -m pip install --no-index --no-deps "[whl 경로]\[whl 파일 이름]"
```

```bash
python -m pip install --no-index --no-deps C:\wheels\frida-16.1.4-cp37-abi3-win_amd64.whl C:\wheels\frida_tools-12.2.1-py3-none-any.whl C:\wheels\colorama-0.4.6-py2.py3-none-any.whl C:\wheels\prompt_toolkit-3.0.53-py3-none-any.whl C:\wheels\pygments-2.21.0-py3-none-any.whl C:\wheels\wcwidth-0.9.4-cp310-abi3-win_amd64.whl
```

PowerShell에서는 `C:\wheels\*.whl`처럼 와일드카드를 그대로 못 넘기는 경우가 있다. 이때는 파일 이름을 하나씩 적거나 방법 1을 쓴다.
**방법 4. 가상환경에 설치 (시스템 Python을 건드리지 않음)**

고객사 PC의 기존 Python 환경을 바꾸고 싶지 않을 때 좋다.

```bash
python -m venv [가상환경 폴더]
[가상환경 폴더]\Scripts\python.exe -m pip install --no-index --find-links="[whl 경로]" frida==[frida 버전] frida-tools==[frida-tools 버전]
[가상환경 폴더]\Scripts\frida.exe --version
```

```bash
python -m venv C:\frida-env
C:\frida-env\Scripts\python.exe -m pip install --no-index --find-links="C:\wheels" frida==16.1.4 frida-tools==12.2.1
C:\frida-env\Scripts\frida.exe --version
```

| 부분 | 의미 |
|---|---|
| `python -m venv [폴더]` | 독립된 Python 환경을 만든다 |
| `[가상환경 폴더]\Scripts\python.exe` | 그 환경의 Python. 이걸로 pip를 실행하면 그 환경에만 설치된다 |
| `[가상환경 폴더]\Scripts\frida.exe` | 가상환경에 설치된 frida 실행 파일 |

환경을 지울 때는 폴더를 삭제하면 끝이라서, 버전을 바꿔 가며 테스트할 때(예: 16과 17을 번갈아 쓸 때) 편하다.

#### 4단계. 설치 확인

```bash
frida --version
python -m pip list
frida-ps
```

| 명령 | 정상일 때 |
|---|---|
| `frida --version` | `16.1.4` |
| `python -m pip list` | `frida 16.1.4`, `frida-tools 12.2.1` 등 6개 패키지 확인 |
| `frida-ps` | 프로세스 목록이 출력됨 (frida가 정상 동작) |

#### 다른 버전이 이미 설치되어 있을 때

먼저 지우고 설치하거나, 같은 명령에 `--force-reinstall`을 더한다.

```bash
python -m pip uninstall -y frida frida-tools
```

| 옵션 | 의미 |
|---|---|
| `uninstall` | 패키지 삭제 |
| `-y` | "삭제할까요?" 질문에 자동으로 예 |
| `--force-reinstall` (install에 추가) | 이미 설치된 패키지도 다시 설치한다 |

#### 설치가 안 될 때

| 증상 | 원인과 확인 |
|---|---|
| `Could not find a version that satisfies the requirement setuptools` | `frida-tools`가 whl이 아니라 `.tar.gz`로 받아진 경우. 1단계의 `pip wheel`로 다시 만들어 온다 |
| `No matching distribution found for frida==...` | 폴더에 해당 whl이 없거나, Python 버전·비트 수가 whl과 맞지 않음. 0단계 확인 |
| `ModuleNotFoundError: No module named 'frida'` | `--no-deps`로 설치하며 `frida`를 빠뜨림 |
| `frida`가 "인식되지 않는 명령" | `--user` 설치 시 `Scripts` 폴더가 PATH에 없음. 전체 경로로 실행하거나 PATH에 추가 |
| 설치는 됐는데 버전이 다름 | `python -m pip list`로 확인하고, 여러 Python이 설치돼 있다면 `where python`으로 어느 Python인지 확인 |

## 3. frida-tools 명령어 총정리

설치된 도구는 `frida-tools` 버전에 따라 다르다. 12.2.1에는 아래 15개가 있다. 최신 14.x에는 `frida-strace`, `frida-pm`이 추가된 것으로 확인된다(프로젝트 `pyproject.toml` 기준, 12.2.1에서는 미설치).

| 도구 | 하는 일 | HTS 진단 사용도 |
|---|---|---|
| `frida` | 프로세스에 붙어 JS 실행, REPL 제공 | 매우 높음 |
| `frida-ps` | 프로세스 목록 | 매우 높음 |
| `frida-trace` | 함수 호출 자동 후킹·로그 | 높음 |
| `frida-discover` | 자주 호출되는 내부 함수 탐색 | 보통 |
| `frida-kill` | 프로세스 종료 | 낮음 |
| `frida-ls-devices` | Frida가 인식하는 기기 목록 | 낮음 (로컬 PC는 ID `local`로 표시) |
| `frida-ls`, `frida-pull`, `frida-push`, `frida-rm` | 원격 기기 파일 목록, 가져오기, 넣기, 삭제 | 모바일 위주 |
| `frida-itrace` | 명령어(instruction) 단위 추적 | 고급 |
| `frida-join` | Portal에 참여 | 거의 안 씀 |
| `frida-create` | agent 프로젝트 뼈대 생성 | 개발용 |
| `frida-compile` | TypeScript/JS를 하나의 스크립트로 번들링 | 17 이상에서 브릿지 쓸 때 중요 |
| `frida-apk` | APK 관련 처리 | 모바일 전용 |

:::caution frida-itrace
파이프 같은 비대화형 환경에서 `frida-itrace`를 실행하면 콘솔을 찾지 못한다는 오류(`NoConsoleScreenBufferError`)가 난다.
:::

### 모든 도구에 공통인 연결 옵션

| 옵션 | 의미 |
|---|---|
| `-D ID`, `--device ID` | 지정한 ID의 기기에 연결 (`frida-ls-devices`로 확인) |
| `-U`, `--usb` | USB 기기에 연결 (모바일용. Windows 로컬 진단에서는 쓰지 않는다) |
| `-R`, `--remote` | 원격 frida-server에 연결 |
| `-H HOST`, `--host HOST` | 지정한 HOST의 frida-server에 연결 |
| `-O FILE`, `--options-file FILE` | 옵션을 텍스트 파일에서 읽음 (옵션이 길 때 편하다) |
| `--version` | 버전 출력 |

옵션을 주지 않으면 **로컬 PC**가 대상이다. HTS 진단에서는 보통 이 기본값을 쓴다.

## 4. frida-ps: 프로세스 찾기

진단의 첫 단계는 대상 프로세스의 **이름과 PID**를 확인하는 것이다.

```bash
frida-ps
```

```text
  PID  Name
-----  -------------------------------
30028  AppActions.exe
17272  ApplicationFrameHost.exe
```

| 옵션 | 의미 | 비고 |
|---|---|---|
| `-a`, `--applications` | 앱만 표시 | 모바일용. **Windows 로컬에서는 빈 목록(`[]`)이 나온다** |
| `-i`, `--installed` | 설치된 모든 앱 포함 | 모바일용. Windows 로컬에서는 마찬가지로 비어 있었다 |
| `-j`, `--json` | JSON 형식으로 출력 | 스크립트로 가공할 때 |
| `-D ID` | 연결할 기기 지정 | 로컬 PC는 `-D local` (생략해도 로컬이 기본) |

**옵션을 모두 넣은 완성 예시**

```bash
frida-ps -D local -a -i -j
```

로컬 기기(`-D local`)에서 앱만(`-a`), 설치된 앱까지 포함해서(`-i`), JSON으로(`-j`) 출력하라는 뜻이다. 다만 위 결과처럼 Windows에서는 `-a`, `-i`가 의미가 없으므로 **HTS 진단에서는 옵션 없이 `frida-ps`만** 쓰고, 이름으로 거르고 싶으면 PowerShell에서 아래처럼 한다.

```bash
frida-ps | Select-String [HTS 프로세스 이름 일부]
```

HTS는 **프로세스가 여러 개**(메인, 보조, 보안 모듈)일 수 있다. 어느 프로세스가 통신과 암호화를 하는지 PID로 구분해야 한다. 이름 검색은 PowerShell에서 `frida-ps | Select-String HTS`처럼 한다.

## 5. frida: 붙어서 JS 실행하기

### 5.1 기본 사용 패턴

| 상황 | 명령 | 설명 |
|---|---|---|
| 실행 중인 프로세스에 attach | `frida -n HTS.exe` | 이름으로 붙음 |
| PID로 attach | `frida -p 1234` | 프로세스가 여러 개일 때 정확히 지정 |
| 프로그램을 직접 실행(spawn) | `frida -f "C:\path\HTS.exe"` | 시작 시점부터 후킹 |
| 스크립트 로드 | `frida -n HTS.exe -l hook.js` | JS 파일을 주입하고 REPL 유지 |
| 한 줄만 실행하고 종료 | `frida -p 1234 -q -t 5 -e "console.log(Process.arch)"` | 빠른 확인용 |
| 로그 저장 | `frida -n HTS.exe -l hook.js -o evidence.log` | 증적 보관 |

### 5.2 옵션 상세

**대상 선택**

| 옵션 | 의미 | 언제 쓰나 |
|---|---|---|
| `-n NAME`, `--attach-name NAME` | 프로세스 이름으로 attach | 이름이 하나뿐일 때 |
| `-p PID`, `--attach-pid PID` | PID로 attach | 같은 이름이 여러 개일 때 |
| `-f TARGET`, `--file TARGET` | 실행 파일을 spawn | 초기 로직(로그인 전, 모듈 로드)까지 봐야 할 때 |
| `-F`, `--attach-frontmost` | 맨 앞 창의 앱에 attach | 간단히 붙고 싶을 때 |
| `-W PATTERN`, `--await PATTERN` | 패턴에 맞는 프로세스가 **새로 뜰 때까지 기다렸다가** 붙음 | 다른 런처가 HTS를 띄우는 경우 |
| `-N IDENTIFIER` | 식별자(Bundle ID 등)로 attach | 모바일 |
| `--stdio {inherit,pipe}` | spawn한 프로그램의 입출력 처리 방식 (기본 `inherit`) | 보통 그대로 |
| `--aux option` | spawn 시 부가 옵션 (예: `uid=(int)42`) | 거의 안 씀 |
| `--realm {native,emulated}` | 어느 영역에 붙을지 | 거의 안 씀 |

**스크립트와 실행**

| 옵션 | 의미 | 언제 쓰나 |
|---|---|---|
| `-l SCRIPT`, `--load SCRIPT` | JS 파일 로드 | 거의 모든 후킹 |
| `-e CODE`, `--eval CODE` | JS 한 줄을 바로 실행 | 빠른 확인 |
| `-q` | 조용한 모드(프롬프트 없음). `-l`/`-e`를 실행한 뒤 종료 | 자동화, 한 번 실행 |
| `-t TIMEOUT`, `--timeout TIMEOUT` | `-q` 모드에서 종료까지 기다리는 초 | `-q`와 함께 |
| `-o LOGFILE`, `--output LOGFILE` | 콘솔 출력을 파일에도 저장 | 증적 |
| `-P PARAMETERS_JSON`, `--parameters` | 스크립트에 넘길 JSON (도움말에는 "Gadget과 같은 형식"이라고 적혀 있다) | 16.1.4/12.2.1에서는 `-l` 스크립트의 전역 `parameters`로 읽히지 않는다. 설정값은 스크립트에 직접 적는 편이 확실하다 |
| `-c CODESHARE_URI`, `--codeshare` | Frida CodeShare 스크립트 로드 | **외부 코드를 받아 실행하므로 고객사 환경에서는 쓰지 않는다** |
| `-C USER_CMODULE`, `--cmodule` | C 모듈 로드 | 고급 |
| `--toolchain {any,internal,external}` | CModule 컴파일러 선택 | 고급 |

**동작 제어**

| 옵션 | 의미 | 언제 쓰나 |
|---|---|---|
| `--pause` | spawn 후 메인 스레드를 **멈춘 채로 둠**. REPL에서 `%resume`으로 재개 | 시작 전에 후킹을 모두 걸어 두고 싶을 때 |
| `--kill-on-exit` | Frida가 종료되면 spawn한 프로그램도 종료 | 정리 |
| `--eternalize` | 종료 전에 스크립트를 대상에 **남겨 둠** | Frida가 끊겨도 후킹 유지 |
| `--exit-on-error` | 스크립트 예외 발생 시 종료 코드 1로 종료 | 자동화 |
| `--auto-perform` | 입력 코드를 `Java.perform`으로 감쌈 | Android 전용 |
| `--auto-reload` / `--no-auto-reload` | `-l` 파일이 바뀌면 자동 재로드(기본 켜짐) / 끔 | 스크립트 수정하며 테스트 |
| `--runtime {qjs,v8}` | JS 엔진 선택 (QuickJS 또는 V8) | 복잡한 스크립트, 최신 문법이 필요할 때 |
| `--debug` | Node.js 호환 디버거를 켬 | 스크립트 디버깅 |
| `--squelch-crash` | 크래시 리포트를 콘솔에 출력하지 않음 | 로그 정리 |

### 5.2.1 옵션을 조합한 완성 예시

`[ ]`는 자기 환경에 맞게 바꿔 넣는 값이다.

**예시 1. 실행 중인 프로세스에 attach해서 스크립트를 돌리고 로그를 저장한 뒤 자동 종료**

```bash
frida -p [PID] -l [hook.js 경로] -o [evidence.log 경로] --runtime=v8 --exit-on-error -q -t [초]
```

```bash
frida -p 1234 -l C:\work\hook.js -o C:\work\evidence.log --runtime=v8 --exit-on-error -q -t 30
```

| 부분 | 역할 |
|---|---|
| `-p 1234` | PID 1234 프로세스에 attach |
| `-l C:\work\hook.js` | 이 스크립트를 주입 |
| `-o C:\work\evidence.log` | 콘솔 출력을 파일에도 저장 (증적) |
| `--runtime=v8` | V8 엔진으로 실행 |
| `--exit-on-error` | 스크립트에서 예외가 나면 종료 코드 1로 종료 |
| `-q -t 30` | 프롬프트 없이 실행하고 30초 뒤 종료 |

**예시 2. 프로그램을 직접 실행(spawn)해서 시작 전에 멈추고, 후킹을 건 뒤 재개**

```bash
frida -f "[HTS 실행 파일 경로]" -l [hook.js 경로] -o [evidence.log 경로] --pause --kill-on-exit --runtime=v8
```

```bash
frida -f "C:\HTS\HTS.exe" -l C:\work\hook.js -o C:\work\evidence.log --pause --kill-on-exit --runtime=v8
```

| 부분 | 역할 |
|---|---|
| `-f "C:\HTS\HTS.exe"` | 이 프로그램을 Frida가 직접 실행 |
| `-l`, `-o`, `--runtime=v8` | 예시 1과 같음 |
| `--pause` | 시작 지점에서 메인 스레드를 멈춘 채로 둠 |
| `--kill-on-exit` | Frida를 종료하면 실행한 프로그램도 종료 |

`--pause`를 썼으므로 프롬프트(`[Local::HTS.exe ]->`)가 뜨면 **`%resume`을 입력해야** 프로그램이 시작된다. 예시 1의 `-q`는 프롬프트를 없애므로 `--pause`와 함께 쓰지 않는다.

**예시 3. 한 줄만 실행해서 확인하고 종료**

```bash
frida -p [PID] -q -t [초] -e "[JS 코드]"
```

```bash
frida -p 1234 -q -t 5 -e "console.log(Process.enumerateModules().length)"
```

### 5.3 REPL 안의 명령어

REPL 프롬프트(예: `[Local::PID::1234 ]->`)에서 `%`로 시작하면 Frida 전용 명령이다. 12.2.1 소스 기준으로 아래 9개가 있다.

| 명령 | 설명 |
|---|---|
| `%help` | 사용 가능한 REPL 명령 목록 출력 |
| `%resume` | spawn(`--pause`)한 프로세스의 실행 재개 |
| `%load 파일` | 추가 스크립트를 로드하고 REPL 상태를 다시 불러옴 |
| `%reload` | `-l`로 준 스크립트를 다시 실행 |
| `%unload` | 로드한 스크립트 해제 |
| `%autoperform` | `Java.perform` 자동 감싸기 켜고 끄기 (Android) |
| `%autoreload` | 스크립트 자동 재로드 켜고 끄기 |
| `%exec 파일` | 현재 로드된 스크립트 컨텍스트에서 JS 파일 실행 |
| `%time 식` | 식의 실행 시간을 측정해서 출력 |

그 밖의 REPL 사용법:

- `exit` 또는 `quit`: 종료
- `객체?`: 객체 정보 표시 (예: `Process?`)
- 탭 키: 자동완성

### 5.4 REPL에서 바로 해볼 수 있는 탐색 명령

```javascript
Process.arch                         // x64 등
Process.enumerateModules()           // 로드된 모듈 목록(배열)
Process.getModuleByName('WS2_32.dll')   // 특정 모듈 (16/17 공통)
Process.enumerateRanges('rw-')       // 읽기·쓰기 가능한 메모리 영역 목록
```

## 6. frida-trace: 함수 호출 자동 추적

함수 이름만 지정하면 **후킹 코드를 자동으로 만들어 주고** 호출을 로그로 남긴다. 처음 대상 앱이 어떤 API를 쓰는지 훑을 때 가장 편하다.

### 6.1 옵션 상세

**함수/모듈 선택**

| 옵션 | 의미 |
|---|---|
| `-i FUNCTION`, `--include FUNCTION` | `[모듈!]함수` 패턴에 맞는 함수를 추적. 와일드카드(`*`) 사용 가능 |
| `-x FUNCTION`, `--exclude FUNCTION` | 해당 함수를 추적에서 제외 |
| `-I MODULE`, `--include-module MODULE` | 해당 모듈의 **모든 함수**를 추적 |
| `-X MODULE`, `--exclude-module MODULE` | 해당 모듈을 추적에서 제외 |
| `-a MODULE!OFFSET`, `--add MODULE!OFFSET` | export가 아닌 함수를 **offset**으로 추가 (IDA에서 찾은 내부 함수용) |
| `-T`, `-t MODULE` | 프로그램/특정 모듈의 **import**(가져다 쓰는 함수) 포함 |
| `-s DEBUG_SYMBOL` | 디버그 심볼로 선택 |
| `-m`, `-M`, `-j`, `-J`, `-y`, `-Y` | ObjC/Java/Swift 메서드 포함·제외 (**모바일용**) |

**출력**

| 옵션 | 의미 |
|---|---|
| `-d`, `--decorate` | 로그에 모듈 이름 추가 (예: `Sleep() [KERNELBASE.dll]`) |
| `-q`, `--quiet` | 출력 메시지 포맷을 적용하지 않음 |
| `-o OUTPUT` | 메시지를 파일로 저장 |
| `-S PATH`, `--init-session PATH` | 세션 시작 시 실행할 JS 파일 (공통 변수, 헬퍼 준비) |
| `-P PARAMETERS_JSON` | 핸들러에서 전역 `parameters`로 읽을 JSON |

대상 지정 옵션(`-n`, `-p`, `-f`, `-W` 등)은 `frida`와 같다.

### 6.2 패턴 문법

`-i`와 `-x`는 `모듈!함수` 형태를 받는다. 각각 와일드카드를 쓸 수 있다. 아래는 공식 문서(frida.re/docs/frida-trace)의 설명이다.

| 패턴 | 의미 |
|---|---|
| `-i "send*"` | 모든 모듈의 `send`로 시작하는 함수 |
| `-i "ws2_32.dll!send*"` | `ws2_32.dll`의 `send`로 시작하는 함수 |
| `-i "msvcrt.dll!*mem*"` | `msvcrt.dll`에서 이름에 `mem`이 들어간 함수 |
| `-i "ws2_32.dll!"` (끝이 `!`) | 해당 모듈의 모든 함수 |

옵션은 **입력한 순서대로** 처리된다. 같은 옵션이라도 순서가 다르면 결과 개수가 달라진다(공식 문서 예시: `-i "str*" -i "mem*" -X "msvcrt.dll"`과 `-X "msvcrt.dll" -i "str*" -i "mem*"`는 결과가 다르다). **제외는 포함 뒤에 적는다**는 식으로 의도에 맞게 순서를 정한다.

### 6.2.1 옵션을 조합한 완성 예시

**예시 1. attach해서 특정 함수만 추적하고, 일부는 제외하고, 파일로 저장**

```bash
frida-trace -p [PID] --decorate -i "[모듈]![함수 패턴]" -x "[모듈]![제외할 함수 패턴]" -o [로그 파일]
```

```bash
frida-trace -p 1234 --decorate -i "KERNELBASE.dll!Sleep*" -x "KERNELBASE.dll!SleepConditionVariable*" -o trace.log
```

| 부분 | 역할 |
|---|---|
| `-p 1234` | PID 1234에 attach |
| `--decorate` | 로그에 모듈 이름 표시 (`Sleep() [KERNELBASE.dll]`) |
| `-i "KERNELBASE.dll!Sleep*"` | `Sleep`으로 시작하는 함수를 추적 |
| `-x "KERNELBASE.dll!SleepConditionVariable*"` | 그중 `SleepConditionVariable...` 계열은 제외 |
| `-o trace.log` | 로그를 파일로 저장 |

결과: 4개였던 대상이 `SleepEx`, `Sleep` 2개가 되었고(`Started tracing 2 functions`), `trace.log`에는 `Sleep() [KERNELBASE.dll]`, `SleepEx() [KERNELBASE.dll]` 줄이 기록된다.

**예시 2. 모듈 단위 추적과 offset 추가**

```bash
frida-trace -p [PID] --decorate -I "[모듈 이름]" -X "[제외할 모듈 이름]" -a "[모듈 이름]!0x[offset]" -o [로그 파일]
```

```bash
frida-trace -p 1234 --decorate -I "WS2_32.dll" -X "msvcrt.dll" -a "HTS.exe!0x1A2B3C" -o trace.log
```

| 부분 | 역할 |
|---|---|
| `-I "WS2_32.dll"` | 이 모듈의 **모든 함수**를 추적 (호출이 매우 많아질 수 있다) |
| `-X "msvcrt.dll"` | 이 모듈은 추적에서 제외 |
| `-a "HTS.exe!0x1A2B3C"` | `HTS.exe` base에서 `0x1A2B3C`만큼 떨어진 **이름 없는 함수**를 추가. 이 offset은 예시 값이며 IDA/Ghidra로 찾은 값을 쓴다 |

`-I`로 모듈 전체를 잡으면 로그가 폭발할 수 있으니 처음에는 예시 1처럼 `-i`로 범위를 좁힌다.

### 6.3 실행 예시와 결과

```bash
# 실행 중인 프로세스에 attach해서 Sleep 계열 추적
frida-trace -p 45672 --decorate -i "KERNELBASE.dll!Sleep*" -o out.log
```

```text
Attaching...
Instrumenting...
SleepEx: Auto-generated handler at "...\__handlers__\KERNELBASE.dll\SleepEx.js"
Sleep: Auto-generated handler at "...\__handlers__\KERNELBASE.dll\Sleep.js"
Started tracing 4 functions. Press Ctrl+C to stop.
```

실행한 폴더에 `__handlers__\모듈명\함수명.js` 파일이 생긴다. 이 파일이 **그 함수의 후킹 코드**다. 직접 수정하면 다음 실행부터 반영된다.

```javascript
{
  onEnter(log, args, state) {
    log('Sleep() [KERNELBASE.dll]');   // 호출될 때
  },
  onLeave(log, retval, state) {        // 반환될 때
  }
}
```

| 인자 | 의미 |
|---|---|
| `log` | 추적 출력에 한 줄 남기는 함수 |
| `args` | 함수 인자 배열(NativePointer). `args[0].readUtf8String()`처럼 읽는다. 값을 대입해 인자를 변조할 수도 있다 |
| `retval` | 반환값(`onLeave`에서). `retval.replace(0)`으로 바꿀 수 있다 |
| `state` | 호출 사이에 유지되는 공용 저장소 |

### 6.4 주의사항

- **spawn(`-f`)으로 시작하면 `Started tracing 0 functions`가 나올 수 있다.** 예를 들어 `ping.exe`를 `-f`로 spawn하고 `-i "kernel32.dll!Sleep*"`를 주면 0개다. spawn 직후에는 DLL이 아직 로드되지 않아서 패턴에 맞는 함수가 없는 것으로 보인다. 같은 프로세스에 **attach**하고 `KERNELBASE.dll!Sleep*`를 주면 4개가 잡힌다.
- **Windows 11에서는 함수의 실제 구현이 `KERNELBASE.dll`에 있는 경우가 많다.** `kernel32.dll`로 못 찾으면 `KERNELBASE.dll`로 지정해 본다.
- 어떤 DLL이 어떤 함수를 export하는지는 아래처럼 확인할 수 있다.

```bash
frida -p 1234 -q -t 5 -e "Process.enumerateModules().forEach(function(m){ try{ if(m.getExportByName('sendto')) console.log(m.name) }catch(e){} })"
```

## 7. frida-discover: 자주 호출되는 내부 함수 찾기

대상 프로세스에서 호출되는 내부 함수를 관찰해서 **어떤 함수가 많이 불리는지 찾는** 도구다. export 이름이 없는 HTS 내부 함수의 단서를 찾을 때 쓴다. 옵션은 `frida`의 연결·대상 지정 옵션(`-n`, `-p`, `-f` 등)과 같다.

```bash
frida-discover -n HTS.exe
```

옵션을 조합한 완성 예시는 아래와 같다.

```bash
frida-discover -D local -p [PID] --runtime=v8 --squelch-crash
```

| 부분 | 역할 |
|---|---|
| `-D local` | 로컬 PC |
| `-p [PID]` | 이 PID에 attach |
| `--runtime=v8` | V8 엔진 사용 |
| `--squelch-crash` | 크래시 리포트를 콘솔에 출력하지 않음 |
## 8. 기타 도구

### 8.1 frida-ls-devices: 기기 목록

```bash
frida-ls-devices
```

인식된 기기 목록이다. 로컬 PC는 ID `local`로, 그 밖에 `barebone`, `socket`(원격 연결용 항목)이 함께 표시된다. 다른 도구의 `-D` 옵션에 이 ID를 넣는다. 옵션은 `-O`(옵션 파일), `--version`뿐이다.

### 8.2 frida-kill: 프로세스 종료

```bash
frida-kill [연결 옵션] [프로세스 이름 또는 PID]
```

| 부분 | 의미 |
|---|---|
| `-D local` | 로컬 PC (공통 연결 옵션) |
| `[프로세스 이름 또는 PID]` | 종료할 대상 |

**완성 예시**

```bash
frida-kill -D local 1234
```

PID 1234 프로세스를 종료한다. 진단 중 멈춘 대상 프로세스를 정리할 때 쓴다.

### 8.3 frida-ls / frida-pull / frida-push / frida-rm: 원격 파일 조작

| 명령 | 형식 | 설명 |
|---|---|---|
| `frida-ls` | `frida-ls [옵션] [원격 경로]...` | 원격 기기의 파일 목록 |
| `frida-pull` | `frida-pull [옵션] [원격 경로]... [로컬 경로]` | 원격 파일을 가져오기 |
| `frida-push` | `frida-push [옵션] [로컬 경로]... [원격 경로]` | 원격에 파일 올리기 |
| `frida-rm` | `frida-rm [옵션] [원격 경로]...` | 원격 파일 삭제 |

**frida-server가 있는 원격 기기(모바일 등)가 대상**이라 로컬 Windows HTS 진단에서는 쓰지 않는다.

```bash
frida-pull -U /data/local/tmp/log.txt C:\work
```

### 8.4 frida-create: 스크립트 프로젝트 뼈대 생성

| 옵션 | 의미 |
|---|---|
| `-t TEMPLATE`, `--template TEMPLATE` | 템플릿 종류. `agent`(JS/TS 에이전트) 또는 `cmodule`(C 모듈) |
| `-n PROJECT_NAME`, `--project-name PROJECT_NAME` | 프로젝트 이름 |
| `-o OUTDIR`, `--output-directory OUTDIR` | 만들 폴더 |

**완성 예시**

```bash
frida-create -t agent -n [프로젝트 이름] -o [만들 폴더]
```

```bash
frida-create -t agent -n myagent -o C:\work\myagent
```

실행하면 `agent` 폴더, `package.json`, `tsconfig.json`, `.gitignore`가 생긴다. 이후 `npm install`이 필요한 TypeScript 프로젝트라서 **인터넷이 안 되는 고객사 PC에서는 쓰기 어렵다.** 인터넷 PC에서 만들고 `frida-compile`로 한 파일로 묶어서 옮기는 식으로 쓴다.

### 8.5 frida-compile: 스크립트를 하나로 묶기

| 옵션 | 의미 |
|---|---|
| `[module]` | 컴파일할 TypeScript/JavaScript 파일 |
| `-o OUTPUT`, `--output OUTPUT` | 결과 파일 이름 |
| `-w`, `--watch` | 파일이 바뀔 때마다 자동으로 다시 컴파일 |
| `-S`, `--no-source-maps` | 소스맵을 만들지 않음 |
| `-c`, `--compress` | 압축 (terser 사용) |
| `-v`, `--verbose` | 상세 출력 |

**완성 예시**

```bash
frida-compile [입력 파일] -o [출력 파일] -c -S -v
```

```bash
frida-compile C:\work\hook.js -o C:\work\hook.out.js -c -S -v
```

입력 파일을 압축(`-c`)하고 소스맵은 빼고(`-S`) 진행 상황을 자세히(`-v`) 출력하면서 `hook.out.js`로 저장한다. `-w`는 계속 실행되는 감시 모드라서 위 예시에는 넣지 않았다. 17 이상에서 Java/ObjC 브릿지를 쓰는 에이전트를 만들 때 특히 필요하다.

## 9. 메모리 덤프

`frida-dump`라는 공식 도구는 **없다.** 메모리 덤프는 다음 두 방법을 쓴다.

1. **fridump3**: Frida로 프로세스 메모리를 읽어 파일로 저장하는 오픈소스 도구
2. 직접 작성: `Process.enumerateRanges()`로 영역을 구하고 `readByteArray()`로 읽어서 `send()`로 전달

### 9.1 fridump3 (업스트림 rootbsd/fridump3)

- 저장소: [github.com/rootbsd/fridump3](https://github.com/rootbsd/fridump3)
- 원본 [Nightbringer21/fridump](https://github.com/Nightbringer21/fridump)에 Python 3 지원과 네트워크(IP) 접속을 더한 포크다.
- Windows, Linux, macOS에서 실행해 iOS, Android, **Windows** 앱의 메모리를 덤프할 수 있다고 README에 적혀 있다. 모바일 전용 도구가 아니다.

```bash
python fridump3.py [-h] [-o dir] [-u] [-H HOST] [-v] [-r] [-s] [--max-size bytes] process
```

| 옵션 | 의미 |
|---|---|
| `process` | 대상 프로세스 (이름 또는 PID) |
| `-o dir`, `--out dir` | 출력 폴더 (**이미 존재하는 폴더**여야 한다. 지정하지 않으면 현재 폴더의 `dump`) |
| `-u`, `--usb` | USB 연결 기기 (모바일용) |
| `-H HOST`, `--host HOST` | IP로 연결한 기기 (모바일용) |
| `-v`, `--verbose` | 상세 출력 |
| `-r`, `--read-only` | 읽기 전용(`r--`) 영역을 덤프. 기본은 읽기·쓰기(`rw-`) 영역. README는 "데이터가 더 많아지고 에러도 늘어난다"고 설명한다 |
| `-s`, `--strings` | 덤프 파일에서 문자열을 추출해 `strings.txt`로 저장 |
| `--max-size bytes` | 파일 하나의 최대 크기 (기본 20971520 = 20MB). 초과하는 영역은 쪼개서 저장 |

**옵션을 모두 넣은 완성 예시**:

```bash
python fridump3.py -v -r -s --max-size [바이트] -o [출력 폴더] [PID 또는 프로세스 이름]
```

```bash
python fridump3.py -v -r -s --max-size 10485760 -o C:\dump 1234
```

| 부분 | 역할 |
|---|---|
| `-v` | 상세 출력 (영역 주소, 크기 등) |
| `-r` | 읽기 전용 영역(`r--`)을 덤프 |
| `-s` | 덤프 파일에서 문자열을 뽑아 `strings.txt`로 저장 |
| `--max-size 10485760` | 파일 하나의 최대 크기 10MB (바이트 단위)로 쪼개서 저장 |
| `-o C:\dump` | 결과를 이 폴더에 저장 (**미리 만들어 둔 폴더**) |
| `1234` | 대상 PID |

`-u`, `-H`는 모바일 기기용이라 Windows 로컬에는 넣지 않는다. **먼저 옵션 없이** `python fridump3.py [PID]`로 기본 덤프(읽기·쓰기 영역)를 해 보고, 필요할 때 `-r`을 추가하는 순서를 권한다. `-r`은 데이터가 많아지고 오류도 늘어난다.

동작 원리는 짧다. 업스트림 `fridump3.py` 소스 기준으로 다음과 같다.

1. 대상에 attach한다 (`-u`, `-H`가 없으면 로컬 `frida.attach`).
2. 프로세스 안에 JS를 주입해 `enumerateRanges`(영역 목록)와 `readMemory`(메모리 읽기)를 RPC로 노출한다.
3. 영역을 순회하며 `<base주소>_dump.data` 파일로 저장한다. 읽기에 실패한 영역은 "memory access violation" 메시지만 출력하고 건너뛴다.

덤프 후에는 `strings.txt`나 덤프 파일에서 계정 ID, 세션 토큰, 주문 정보, 비밀번호 같은 문자열을 검색해 **메모리에 평문으로 남는지** 확인한다.

### 9.2 fridump3와 Frida 16/17

업스트림 `master`의 JS는 16 이하 API를 쓴다.

```javascript
rpc.exports = {
  enumerateRanges: function (prot) {
    return Process.enumerateRangesSync(prot);
  },
  readMemory: function (address, size) {
    return Memory.readByteArray(ptr(address), size);
  }
};
```

`Memory.readByteArray(ptr, size)`는 17에서 제거된 **정적 Memory API**다. 업스트림 저장소에는 "Frida 17+" 대응 풀 리퀘스트(#6)가 열려 있고 아직 반영되지 않았다. 17 환경이라면 같은 부분을 17 방식으로 바꿔야 한다.

```javascript
// 17 방식 (릴리즈 노트의 마이그레이션 규칙을 적용한 예)
rpc.exports = {
  enumerateRanges: async function (prot) {
    return Process.enumerateRanges(prot);
  },
  readMemory: function (address, size) {
    return ptr(address).readByteArray(size);
  }
};
```

16.1.4에서도 위 17 방식의 `Process.enumerateRanges('rw-')`(배열 반환)와 `ptr.readXxx()`는 동작한다(2.2절 참고).

## 10. HTS 진단 시 흐름

1. `frida-ps`로 대상 프로세스와 PID를 확인한다.
2. `frida -n 이름` 또는 `frida -p PID`로 attach가 되는지 확인한다.
3. attach가 막히면(프로세스 종료, 에러) `frida -f 경로`로 spawn을 시도한다.
4. `frida-trace`로 통신(`send`/`recv`), 암호화 API를 훑는다.
5. 필요한 지점만 `-l`로 직접 작성한 스크립트를 로드해 인자, 반환값을 본다.
6. 메모리 덤프(fridump3)로 평문 노출을 확인한다.
7. 로그와 화면을 증적으로 저장한다 (`-o`).

금융권 앱은 일반적으로 키보드 보안, 백신/무결성 모듈, anti-debug가 함께 동작해서 **Frida attach 자체가 막히는 경우**가 있다. 이때 대응 방법은 이 문서에서 다루지 않았고, 실제 진단 기록으로 별도 정리할 예정이다.

## 빠른 명령어 참조

```bash
# 프로세스 확인
frida-ps

# 실행 중 프로세스에 붙기 (REPL)
frida -n HTS.exe
frida -p 1234

# 스크립트 로드 + 로그 저장
frida -p 1234 -l hook.js -o evidence.log

# 시작부터 후킹 (spawn)
frida -f "C:\path\HTS.exe" -l hook.js

# 한 줄 실행 후 종료
frida -p 1234 -q -t 5 -e "console.log(Process.enumerateModules().length)"

# 함수 자동 추적
frida-trace -p 1234 --decorate -i "WS2_32.dll!send*" -i "WS2_32.dll!recv*" -o trace.log

# 메모리 덤프
python fridump3.py -s -o C:\dump 1234
```

## 트러블슈팅 체크리스트

### 스크립트가 `not a function` 에러를 낸다
- [ ] `frida --version`과 `pip show frida-tools`로 버전 확인
- [ ] 스크립트가 17용(`Module.getGlobalExportByName` 등)인지, 16용(`Module.findExportByName` 등)인지 확인
- [ ] 2.2절의 16/17 공통 스타일로 바꿔 보기

### frida-trace가 `Started tracing 0 functions`
- [ ] spawn(`-f`) 대신 attach(`-n`, `-p`)로 시도 (DLL이 아직 로드되지 않았을 수 있다)
- [ ] 함수가 실제 어느 모듈에 있는지 확인 (Windows 11에서는 `KERNELBASE.dll`일 수 있다)
- [ ] 모듈명 대소문자와 와일드카드 확인
- [ ] 옵션 순서 확인 (제외는 포함 뒤에)

### attach가 안 된다
- [ ] 프로세스가 여러 개인지 확인하고 PID로 재시도
- [ ] 관리자 권한 CMD에서 실행 (관리자 권한 프로세스에는 일반 권한으로 붙을 수 없는 경우가 있다)
- [ ] 프로세스 종료, 크래시가 발생하면 `-f` spawn으로 시도
- [ ] 보안 모듈 로드 이후에 붙는지, 이전에 붙는지 확인

### fridump3에서 `memory access violation`이 많다
- [ ] 정상이다. 읽을 수 없는 영역은 건너뛴다. 특히 `-r` 옵션을 켜면 늘어난다
- [ ] `--max-size`를 줄여 쪼개서 읽기
- [ ] `-o`로 지정한 폴더가 **존재하는지** 확인 (없으면 종료된다)

## 참고 자료

- [Frida 17.0.0 Released](https://frida.re/news/2025/05/17/frida-17-0-0-released/) — 17 변경사항 공식 공지
- [frida-trace 공식 문서](https://frida.re/docs/frida-trace/)
- [frida-tools (GitHub)](https://github.com/frida/frida-tools)
- [rootbsd/fridump3](https://github.com/rootbsd/fridump3)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)
