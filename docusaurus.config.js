// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '남키 노트',
  tagline: '모의해킹 및 레드팀 기술 노트',
  favicon: 'img/favicon.ico',

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'google-site-verification', 
        content: 'TkKso4Rp4FBa7WmPeJolw4p7PHEmAgbaEN58vXpDT7s', 
      },
    },
    
    {
      tagName: 'meta',
      attributes: {
        // [⚠️ 여기에 스크린샷에서 복사한 name 속성을 붙여넣으세요]
        name: 'algolia-site-verification', 
        // [⚠️ 여기에 스크린샷에서 복사한 content 속성을 붙여넣으세요]
        content: '86D382FE0A8B0915', 
      },
    },
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://naaamgi.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/my-docusaurus-page/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'naaamgi', // Usually your GitHub org/user name.
  projectName: 'my-docusaurus-page', // Usually your repo name.

  deploymentBranch: 'gh-pages',

  trailingSlash: true,

  onBrokenLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          
          // 💡 핵심 수정: 문서 경로를 루트(/)로 변경
          routeBasePath: '/', 
          
          // 💡 docs 폴더의 기본 인덱스 파일을 제거했으므로, 
          // index 페이지 역할을 할 docs 파일을 지정해야 합니다.
          // intro 문서가 index 역할을 하게 됩니다.
          // intro 문서 파일명은 intro.md 또는 intro.mdx여야 합니다.
          
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: undefined,
        },
        blog: false, 
        
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: '남키 노트',
        logo: {
          alt: 'My Site Logo',
          src: 'img/apple-touch-icon.png',
          // 💡 핵심 수정: 로고 클릭 시 이동할 경로를 명시적으로 지정
          href: '/', 
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            // 💡 루트 경로가 되었으므로, 레이블을 사이트 이름과 중복되지 않게 바꿀 수 있습니다.
            label: 'docs', // 'Tutorial' 대신 'docs' 등으로 변경
          },

          // 💡 블로그 링크 제거
          // {to: '/blog', label: 'Blog', position: 'left'}, 
          // 💡 블로그 링크를 외부 URL로 리다이렉트되도록 수정합니다.
          {
            href: 'https://naaamgi.github.io/', // 👈 여기에 실제 블로그 URL을 입력하세요!
            label: 'blog',
            position: 'left',
          },
        ],
      },
      // Algolia DocSearch 설정
      algolia: {
        appId: 'IKHBXIBECM',
        apiKey: '5859c4721a681cc197a6ba1bd5ecf454',
        indexName: 'namgi-notes',
        contextualSearch: false,
        searchParameters: {},
        facetFilters: [], 
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Links',
            items: [
              {
                label: 'blog',
                href: 'https://naaamgi.github.io/',
              },
              {
                label: 'github',
                href: 'https://github.com/naaamgi/my-docusaurus-page',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} 남키 노트. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
