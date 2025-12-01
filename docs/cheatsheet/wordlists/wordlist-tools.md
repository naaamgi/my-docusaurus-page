---
sidebar_position: 1
---

# Wordlist 생성 도구

커스텀 워드리스트를 생성하는 도구들입니다.

## CeWL

> https://github.com/digininja/CeWL

웹사이트를 크롤링하여 워드리스트를 생성합니다.

### 설치

```bash
# Kali Linux (기본 포함)
sudo apt install cewl

# 또는 Git
git clone https://github.com/digininja/CeWL.git
cd CeWL
gem install bundler
bundle install
```

### 기본 사용법

```bash
# 기본 (depth 2, min 3글자)
cewl http://<RHOST>

# 출력 파일 지정
cewl -w wordlist.txt http://<RHOST>

# 깊이 0 (현재 페이지만)
cewl -d 0 -m 5 -w wordlist.txt http://<RHOST>/index.php

# 깊이 5, 최소 3글자
cewl -d 5 -m 3 -w wordlist.txt http://<RHOST>/index.php

# 소문자로 변환
cewl -d 0 -m 5 -w wordlist.txt http://<RHOST> --lowercase

# 숫자 포함
cewl -d 5 -m 3 -w wordlist.txt http://<RHOST> --with-numbers
```

### 옵션

```bash
-d <DEPTH>          # 크롤링 깊이 (기본 2)
-m <MIN>            # 최소 단어 길이 (기본 3)
-w <FILE>           # 출력 파일
--lowercase         # 소문자로 변환
--with-numbers      # 숫자 포함
-e, --email         # 이메일 주소 수집
-a, --meta          # 메타 데이터 포함
-v, --verbose       # Verbose 모드
--auth_type         # 인증 타입 (digest, basic)
--auth_user         # 사용자명
--auth_pass         # 비밀번호
```

### 실전 예제

```bash
# 회사 웹사이트에서 워드리스트 생성
cewl -d 2 -m 5 -w company_wordlist.txt https://company.com --lowercase

# 이메일도 함께 수집
cewl -d 2 -m 5 -w wordlist.txt -e --email_file emails.txt https://company.com

# 인증이 필요한 사이트
cewl -w wordlist.txt --auth_type basic --auth_user admin --auth_pass password http://<RHOST>
```

---

## CUPP

> https://github.com/Mebus/cupp

대화형으로 타겟에 특화된 워드리스트를 생성합니다.

### 설치

```bash
git clone https://github.com/Mebus/cupp.git
cd cupp
```

### 사용법

```bash
# 대화형 모드
python3 cupp.py -i

# 질문에 답하기
# - 이름, 성
# - 닉네임
# - 생일
# - 파트너 이름/생일
# - 자녀 이름/생일
# - 애완동물 이름
# - 회사 이름
# - 키워드
```

### 출력

```bash
# 생성된 워드리스트
john.txt
```

---

## crunch

패턴 기반 워드리스트 생성 도구입니다.

### 설치

```bash
sudo apt install crunch
```

### 기본 사용법

```bash
# 구조: crunch <MIN> <MAX> <CHARSET> -o <FILE>

# 5자리 숫자 (00000-99999)
crunch 5 5 0123456789 -o numbers.txt

# 5자리 영문 대문자
crunch 5 5 ABCDEFGHIJKLMNOPQRSTUVWXYZ -o uppercase.txt

# 4-6자리 소문자
crunch 4 6 abcdefghijklmnopqrstuvwxyz -o lowercase.txt
```

### 패턴 사용

```bash
# % 기호로 패턴 지정
# @ = 소문자
# , = 대문자
# % = 숫자
# ^ = 특수문자

# Password + 3자리 숫자 (Password000 ~ Password999)
crunch 11 11 -t Password%%% -o wordlist.txt

# foobar + 3자리 숫자
crunch 9 9 -t foobar%%% -o wordlist.txt

# Test + 2자리 숫자 + 대문자 2개 (Test00AA ~ Test99ZZ)
crunch 8 8 -t Test%%,, -o wordlist.txt
```

### 문자셋 지정

```bash
# 특정 문자만 사용
crunch 4 4 abc123 -o wordlist.txt
# 출력: aaaa, aaab, aaac, aaa1, aaa2, aaa3, ...

# 파일에서 문자셋 읽기
echo "abcd1234" > charset.txt
crunch 5 5 -f charset.txt -o wordlist.txt
```

### 유용한 예제

```bash
# 전화번호 (010-0000-0000 ~ 010-9999-9999)
crunch 13 13 -t 010-%%%%-%% -o phones.txt

# 이메일 패턴
crunch 5 5 -t admin@@@@ -o emails.txt

# 년도 (2020-2024)
crunch 4 4 -t 202% -o years.txt
```

---

## Bash 스크립트

### 숫자 추가

```bash
# Password1 ~ Password100
for i in {1..100}; do printf "Password@%d\n" $i >> wordlist.txt; done

# Admin0 ~ Admin999
for i in {0..999}; do printf "Admin%03d\n" $i >> wordlist.txt; done
```

### 년도 조합

```bash
# 2020-2024
for year in {2020..2024}; do echo "Password$year" >> wordlist.txt; done

# 계절 + 년도
for year in {2020..2024}; do
    echo "Spring$year" >> wordlist.txt
    echo "Summer$year" >> wordlist.txt
    echo "Fall$year" >> wordlist.txt
    echo "Winter$year" >> wordlist.txt
done
```

### 조합 생성

```bash
# 단어 + 숫자 + 특수문자
words=("Password" "Admin" "User")
numbers=("123" "2024" "01")
specials=("!" "@" "#")

for word in "${words[@]}"; do
    for num in "${numbers[@]}"; do
        for spec in "${specials[@]}"; do
            echo "${word}${num}${spec}" >> wordlist.txt
        done
    done
done
```

---

## Username Anarchy

> https://github.com/urbanadventurer/username-anarchy

이름으로 사용자명 조합을 생성합니다.

### 설치

```bash
git clone https://github.com/urbanadventurer/username-anarchy.git
cd username-anarchy
```

### 사용법

```bash
# 기본 형식
./username-anarchy -f first,first.last,last,flast,f.last -i names.txt

# names.txt 예제
John Doe
Jane Smith
```

출력:
```
john
john.doe
doe
jdoe
j.doe
jane
jane.smith
smith
jsmith
j.smith
```

---

## Wordlist 변조

### 중복 제거

```bash
sort -u wordlist.txt > unique.txt
```

### 소문자 변환

```bash
tr '[:upper:]' '[:lower:]' < wordlist.txt > lowercase.txt
```

### 대문자 변환

```bash
tr '[:lower:]' '[:upper:]' < wordlist.txt > uppercase.txt
```

### 숫자 제거

```bash
sed -i '/^1/d' wordlist.txt
sed -i '/^[0-9]/d' wordlist.txt
```

### 특정 길이만 추출

```bash
# 8자 이상
awk 'length($0) >= 8' wordlist.txt > filtered.txt

# 정확히 10자
awk 'length($0) == 10' wordlist.txt > filtered.txt
```

### 조합

```bash
# 파일 합치기
cat wordlist1.txt wordlist2.txt > combined.txt

# 중복 제거
sort -u combined.txt > final.txt
```

---

## JavaScript Wordlist 추출

브라우저 콘솔에서 실행:

```javascript
javascript:(function(){
    const e=document.documentElement.innerText.match(/[a-zA-Z_\-]+/g),
    n=[...new Set(e)].sort();
    document.open(),
    document.write(n.join("<br>")),
    document.close();
})();
```

---

## 참고

**CeWL:**
- 타겟 웹사이트 기반 워드리스트
- 회사/조직 특화 워드리스트에 효과적
- `-e` 옵션으로 이메일도 수집

**CUPP:**
- 개인 정보 기반
- Social Engineering에 효과적
- 생일, 이름 등 조합

**crunch:**
- 패턴 기반 생성
- 전체 조합 생성 (매우 큼)
- PIN, 전화번호 등에 효과적

**Username Anarchy:**
- 사용자명 열거에 효과적
- 이메일 주소 추측
