# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## 로컬에서 초안 확인

Node.js 20 이상이 설치된 환경에서 저장소 루트를 기준으로 실행합니다. `package-lock.json`에 맞춰 의존성을 설치합니다.

```powershell
npm ci
npm start -- --host 127.0.0.1 --port 3000 --no-open
```

[로컬 기술 문서](http://127.0.0.1:3000/my-docusaurus-page/)에서 확인합니다. 개발 서버는 `draft: true` 문서도 표시하고 저장 시 변경을 반영합니다. 서버 종료는 실행한 터미널에서 `Ctrl+C`를 누릅니다.

전체 빌드는 `npm run build`로 확인합니다. 프로덕션 빌드에서는 초안 문서가 제외되므로, 초안은 위 개발 서버에서 확인합니다.

## 의존성 보안 업데이트

`package.json`의 `overrides`는 Docusaurus 3.10.2의 하위 의존성 보안 수정 버전을 적용합니다.

- `serialize-javascript`: 빌드 플러그인이 사용하는 버전을 `7.1.2`로 고정합니다. [공식 릴리스](https://github.com/yahoo/serialize-javascript/releases/tag/v7.1.2)
- `sockjs`의 `uuid`: CommonJS와 `v4()` API를 유지하는 수정 버전 `11.1.1`로 고정합니다. [공식 릴리스](https://github.com/uuidjs/uuid/releases/tag/v11.1.1)

상위 패키지가 수정 버전을 채택하면 해당 override를 제거하고 `npm ci`, `npm audit`, `npm run build` 및 개발 서버의 검색 기능을 다시 확인합니다. `npm audit fix --force`는 Docusaurus를 이전 버전으로 바꿀 수 있으므로 사용하지 않습니다.

## Installation

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
