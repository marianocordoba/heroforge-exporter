// ==UserScript==
// @name     HeroSaver for HeroForge
// @version  1
// @description  Automatically load HeroSaver when visiting HeroForge
// @namespace https://github.com/marianocordoba/heroforge-exporter
// @match  https://www.heroforge.com/
// @grant        none
// ==/UserScript==

(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/marianocordoba/heroforge-exporter@main/dist/hfe.js';
  document.head.appendChild(script);
})();
