const styles = {};

/**
 * Loads Vue components.
 * @param {string[]} filenames - filenames of the components, without extensions.
 * @returns {Promise}
 */
export default (filenames) =>
  Promise.all(
    filenames.map((filename) => {
      let params = filename.params || {};
      filename = filename.url || filename;
      const htmlUrl = chrome.runtime.getURL(`${filename}.html`);
      const jsUrl = chrome.runtime.getURL(`${filename}.js`);
      const jsPromise = import(jsUrl);
      return fetch(htmlUrl)
        .then((resp) => resp.text())
        .then((text) => {
          const dom = new DOMParser().parseFromString(text, "text/html");

          styles[filename] = {};
          const lightCss = dom.querySelector("style[light]")?.textContent;
          if (lightCss) {
            styles[filename].light = lightCss;
          }

          const css = dom.querySelector("style:not([light])")?.textContent;
          if (css) {
            if (chrome.runtime.getManifest().version_name.includes("-prerelease")) {
              const normalizedCss = css.replace("\n", "").trimEnd();
              const normalizedText = text.replace(/\r/g, "");
              const cssFirstLine = normalizedCss.substring(0, normalizedCss.indexOf("\n"));
              const linesToAdd = normalizedText.split("\n").findIndex((line) => line === cssFirstLine);
              const newLines = Object.assign(Array(linesToAdd), {
                0: "/*",
                [linesToAdd - 1]: "<style> */",
              }).join("\n");
              styles[filename].style = `${newLines}\n${normalizedCss}/* \n</style> */\n/*# sourceURL=${htmlUrl} */`;
            } else {
              styles[filename].style = css;
            }
          }
          return dom.querySelector("template").innerHTML;
        })
        .then((template) => jsPromise.then((esm) => esm.default({ template, ...params })));
    })
  ).then((components) => {
    let all = {};
    chrome.storage.sync.get(["globalTheme"], function (r) {
      if (r.globalTheme) {
        filenames.forEach((filename) => {
          filename = filename.url || filename;
          if (!styles[filename].light) return;
          const style = document.createElement("style");
          style.textContent = styles[filename].light;
          const [componentName] = filename.split("/").slice(-1);
          style.setAttribute("data-vue-component", componentName); // For debugging (has no side effects)
          if (filename.startsWith("popups/")) {
            const [addonId] = filename.split("/").slice(1);
            style.setAttribute("data-addon-id", addonId);
          }
          document.head.appendChild(style);
        });
      }
    });
    filenames.forEach((filename) => {
      filename = filename.url || filename;
      if (!styles[filename].style) return;
      const style = document.createElement("style");
      style.textContent = styles[filename].style;
      const [componentName] = filename.split("/").slice(-1);
      style.setAttribute("data-vue-component", componentName); // For debugging (has no side effects)
      if (filename.startsWith("popups/")) {
        const [addonId] = filename.split("/").slice(1);
        style.setAttribute("data-addon-id", addonId);
      }
      document.head.insertBefore(style, document.head.querySelector("[data-below-vue-components]"));
    });
    components.forEach((component) => (all = { ...all, ...component }));
    return all;
  });
