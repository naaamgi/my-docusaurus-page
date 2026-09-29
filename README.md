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
