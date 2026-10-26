// Runs in the extension's isolated content-script world.
// It cannot see the page's CK / RK globals, so it injects the real
// exporter bundle into the page's MAIN world via a <script> tag.
(() => {
  if (document.getElementById("hfe-injector")) return;
  const s = document.createElement("script");
  s.id = "hfe-injector";
  s.src = chrome.runtime.getURL("inject.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();
