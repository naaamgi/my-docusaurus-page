---
sidebar_position: 3
---

# Linux

Linux 기본 유틸리티 및 명령어입니다.

## Environment Variables

```bash
# PATH에 현재 디렉토리 추가
export PATH=`pwd`:$PATH

# PATH 확인
echo $PATH

# 환경 변수 전체 확인
env
printenv

# 특정 환경 변수 설정
export VAR=value
```

## gcc

```bash
# 기본 컴파일
gcc exploit.c -o exploit

# 32비트 정적 컴파일
gcc --static -m32 -Wl,--hash-style=both exploit.c -o exploit

# Windows 32비트 크로스 컴파일
i686-w64-mingw32-gcc -o main32.exe main.c

# Windows 64비트 크로스 컴파일
x86_64-w64-mingw32-gcc -o main64.exe main.c

# 디버그 심볼 포함
gcc -g exploit.c -o exploit

# 최적화
gcc -O2 exploit.c -o exploit
```

## getfacl

```bash
# ACL(Access Control List) 확인
getfacl <LOCAL_DIRECTORY>

# 재귀적으로 확인
getfacl -R <LOCAL_DIRECTORY>

# 파일 ACL 확인
getfacl <FILE>
```

## iconv

```bash
# UTF-16LE 인코딩 + Base64
echo "<COMMAND>" | iconv -t UTF-16LE | base64 -w 0

# UTF-8에서 UTF-16LE로 변환 + Base64
echo "<COMMAND>" | iconv -f UTF-8 -t UTF-16LE | base64 -w0

# 파일 변환
iconv -f ASCII -t UTF-16LE <FILE>.txt | base64 | tr -d "\n"

# 다양한 인코딩
iconv -f ISO-8859-1 -t UTF-8 input.txt > output.txt
```

## vi/vim

```bash
# sudo 권한으로 저장 (파일 열고 난 후)
:w !sudo tee %

# vim으로 파일 편집 후 저장
vim <FILE>
:wq

# 읽기 전용으로 열기
vim -R <FILE>

# 특정 라인으로 이동
vim +10 <FILE>
```

## find

```bash
# 이름으로 찾기
find / -name <FILE> 2>/dev/null

# 타입으로 찾기
find / -type f -name "*.conf" 2>/dev/null
find / -type d -name "backup" 2>/dev/null

# 크기로 찾기
find / -size +100M 2>/dev/null
find / -size -1k 2>/dev/null

# 수정 시간으로 찾기
find / -mtime -7  # 7일 이내
find / -mtime +30 # 30일 이전

# 최근 60분 이내 변경된 파일
find / -cmin -60 2>/dev/null

# 최근 60분 이내 접근된 파일
find / -amin -60 2>/dev/null

# 파일 내용 검색
find ./ -type f -exec grep -i 'keyword' {} \; 2>/dev/null
```

## grep

```bash
# 재귀 검색
grep -r "pattern" /path/

# 대소문자 무시
grep -i "pattern" <FILE>

# 라인 번호 표시
grep -n "pattern" <FILE>

# 여러 패턴
grep -E "pattern1|pattern2" <FILE>

# 파일 내용 검색
grep -R "keyword" /etc/ 2>/dev/null

# 주석 제외
grep -v "^[#;]" <FILE> | grep -v "^$"
```

## tar

```bash
# 압축
tar -czf archive.tar.gz /path/to/directory
tar -cjf archive.tar.bz2 /path/to/directory

# 압축 해제
tar -xzf archive.tar.gz
tar -xjf archive.tar.bz2

# 내용 확인
tar -tzf archive.tar.gz
tar -tjf archive.tar.bz2
```

## 참고

- 기본 유틸리티 사용법
- 파일 검색 및 조작
- 컴파일 및 인코딩
- 권한 상승은 Privilege Escalation 섹션 참조
