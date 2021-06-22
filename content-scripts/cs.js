try {
  if (window.parent.location.origin !== "https://scratch.mit.edu") throw "Scratch Addons: not first party iframe";
} catch {
  throw "Scratch Addons: not first party iframe";
}

let pseudoUrl; // Fake URL to use if response code isn't 2xx

let receivedResponse = false;
const onMessageBackgroundReady = (request, sender, sendResponse) => {
  if (request === "backgroundListenerReady" && !receivedResponse) {
    chrome.runtime.sendMessage({ contentScriptReady: { url: location.href } }, onResponse);
  }
};
chrome.runtime.onMessage.addListener(onMessageBackgroundReady);
const onResponse = (res) => {
  if (res && !receivedResponse) {
    console.log("[Message from background]", res);
    chrome.runtime.onMessage.removeListener(onMessageBackgroundReady);
    if (res.httpStatusCode === null || String(res.httpStatusCode)[0] === "2") {
      onInfoAvailable(res);
      receivedResponse = true;
    } else {
      pseudoUrl = `https://scratch.mit.edu/${res.httpStatusCode}/`;
      console.log(`Status code was not 2xx, replacing URL to ${pseudoUrl}`);
      chrome.runtime.sendMessage({ contentScriptReady: { url: pseudoUrl } }, onResponse);
    }
  }
};
chrome.runtime.sendMessage({ contentScriptReady: { url: location.href } }, onResponse);

const DOLLARS = ["$1", "$2", "$3", "$4", "$5", "$6", "$7", "$8", "$9"];

const promisify =
  (callbackFn) =>
  (...args) =>
    new Promise((resolve) => callbackFn(...args, resolve));

let _page_ = null;
let globalState = null;

const comlinkIframesDiv = document.createElement("div");
comlinkIframesDiv.id = "scratchaddons-iframes";
const comlinkIframe1 = document.createElement("iframe");
comlinkIframe1.id = "scratchaddons-iframe-1";
comlinkIframe1.style.display = "none";
const comlinkIframe2 = comlinkIframe1.cloneNode();
comlinkIframe2.id = "scratchaddons-iframe-2";
const comlinkIframe3 = comlinkIframe1.cloneNode();
comlinkIframe3.id = "scratchaddons-iframe-3";
const comlinkIframe4 = comlinkIframe1.cloneNode();
comlinkIframe4.id = "scratchaddons-iframe-4";
comlinkIframesDiv.appendChild(comlinkIframe1);
comlinkIframesDiv.appendChild(comlinkIframe2);
comlinkIframesDiv.appendChild(comlinkIframe3);
comlinkIframesDiv.appendChild(comlinkIframe4);
document.documentElement.appendChild(comlinkIframesDiv);

const csUrlObserver = new EventTarget();
const cs = {
  _url: location.href, // Updated by module.js on calls to history.replaceState/pushState
  get url() {
    return this._url;
  },
  set url(newUrl) {
    this._url = newUrl;
    csUrlObserver.dispatchEvent(new CustomEvent("change", { detail: { newUrl } }));
  },
  requestMsgCount() {
    chrome.runtime.sendMessage("getMsgCount");
  },
  copyImage(dataURL) {
    // Firefox only
    return new Promise((resolve, reject) => {
      browser.runtime.sendMessage({ clipboardDataURL: dataURL }).then(
        (res) => {
          resolve();
        },
        (res) => {
          reject(res.toString());
        }
      );
    });
  },
  getAddonStorage(addonId) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage({ getAddonStorage: { addonId } }, resolve));
  },
  setAddonStorage(addonId, storageDiff) {
    return new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ setAddonStorage: { addonId, storageDiff } }, resolve)
    );
  },
  clearAddonStorage(addonId) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage({ clearAddonStorage: { addonId } }, resolve));
  },
};
Comlink.expose(cs, Comlink.windowEndpoint(comlinkIframe1.contentWindow, comlinkIframe2.contentWindow));

const pageComlinkScript = document.createElement("script");
pageComlinkScript.src = chrome.runtime.getURL("libraries/thirdparty/cs/comlink.js");
document.documentElement.appendChild(pageComlinkScript);

const moduleScript = document.createElement("script");
moduleScript.type = "module";
moduleScript.src = chrome.runtime.getURL("content-scripts/inject/module.js");

(async () => {
  await new Promise((resolve) => {
    moduleScript.addEventListener("load", resolve);
  });
  _page_ = Comlink.wrap(Comlink.windowEndpoint(comlinkIframe3.contentWindow, comlinkIframe4.contentWindow));
})();

document.documentElement.appendChild(moduleScript);

let initialUrl = location.href;
let path = new URL(initialUrl).pathname.substring(1);
if (path[path.length - 1] !== "/") path += "/";
const pathArr = path.split("/");
if (pathArr[0] === "scratch-addons-extension") {
  if (pathArr[1] === "settings") {
    let url = chrome.runtime.getURL("webpages/settings/index.html");
    if (location.hash) url += location.hash;
    chrome.runtime.sendMessage({ replaceTabWithUrl: url });
  }
}
if (path === "discuss/3/topic/add/") {
  window.addEventListener("load", () => forumWarning("forumWarning"));
} else if (path.startsWith("discuss/topic/")) {
  window.addEventListener("load", () => {
    if (document.querySelector('div.linkst > ul > li > a[href="/discuss/18/"]')) {
      forumWarning("forumWarningGeneral");
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Message from background]", request);
  if (request === "getInitialUrl") {
    sendResponse(pseudoUrl || initialUrl);
  }
});

function addStyle(addon) {
  const allStyles = [...document.querySelectorAll(".scratch-addons-style")];
  const addonStyles = allStyles.filter((el) => el.getAttribute("data-addon-id") === addon.addonId);

  const appendByIndex = (el, index) => {
    // Append a style element in the correct place preserving order
    const nextElement = allStyles.find((el) => Number(el.getAttribute("data-addon-index") > index));
    if (nextElement) document.documentElement.insertBefore(el, nextElement);
    else {
      if (document.body) document.documentElement.insertBefore(el, document.body);
      else document.documentElement.appendChild(el);
    }
  };

  for (let userstyle of addon.styles) {
    if (addon.injectAsStyleElt) {
      // If an existing style is already appended, just enable it instead
      const existingEl = addonStyles.find((style) => style.textContent === userstyle);
      if (existingEl) {
        existingEl.disabled = false;
        continue;
      }

      const style = document.createElement("style");
      style.classList.add("scratch-addons-style");
      style.setAttribute("data-addon-id", addon.addonId);
      style.setAttribute("data-addon-index", addon.index);
      style.textContent = userstyle;
      appendByIndex(style, addon.index);
    } else {
      const existingEl = addonStyles.find((style) => style.href === userstyle);
      if (existingEl) {
        existingEl.disabled = false;
        continue;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.setAttribute("data-addon-id", addon.addonId);
      link.setAttribute("data-addon-index", addon.index);
      link.classList.add("scratch-addons-style");
      link.href = userstyle;
      appendByIndex(link, addon.index);
    }
  }
}
function removeAddonStyles(addonId) {
  // Instead of actually removing the style/link element, we just disable it.
  // That way, if the addon needs to be reenabled, it can just enable that style/link element instead of readding it.
  // This helps with load times for link elements.
  document.querySelectorAll(`[data-addon-id='${addonId}']`).forEach((style) => (style.disabled = true));
}

function injectUserstyles(addonsWithUserstyles) {
  for (const addon of addonsWithUserstyles || []) {
    addStyle(addon);
  }
}

const textColorLib = __scratchAddonsTextColor;
function setCssVariables(addonSettings, addonsWithUserstyles) {
  const hyphensToCamelCase = (s) => s.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  const setVar = (addonId, varName, value) =>
    document.documentElement.style.setProperty(`--${hyphensToCamelCase(addonId)}-${varName}`, value);

  const addonIds = addonsWithUserstyles.map((obj) => obj.addonId);

  // Set variables for settings
  for (const addonId of addonIds) {
    for (const settingName of Object.keys(addonSettings[addonId] || {})) {
      const value = addonSettings[addonId][settingName];
      if (typeof value === "string" || typeof value === "number") {
        setVar(addonId, hyphensToCamelCase(settingName), addonSettings[addonId][settingName]);
      }
    }
  }

  // Set variables for customCssVariables
  const getColor = (addonId, obj) => {
    if (typeof obj === "string" || obj === undefined) return obj;
    let hex;
    switch (obj.type) {
      case "settingValue":
        return addonSettings[addonId][obj.settingId];
      case "textColor": {
        hex = getColor(addonId, obj.source);
        let black = getColor(addonId, obj.black);
        let white = getColor(addonId, obj.white);
        return textColorLib.textColor(hex, black, white, obj.threshold);
      }
      case "multiply": {
        hex = getColor(addonId, obj.source);
        return textColorLib.multiply(hex, obj);
      }
      case "brighten": {
        hex = getColor(addonId, obj.source);
        return textColorLib.brighten(hex, obj);
      }
      case "alphaBlend": {
        let opaqueHex = getColor(addonId, obj.opaqueSource);
        let transparentHex = getColor(addonId, obj.transparentSource);
        return textColorLib.alphaBlend(opaqueHex, transparentHex);
      }
      case "recolorFilter": {
        hex = getColor(addonId, obj.source);
        return textColorLib.recolorFilter(hex);
      }
    }
  };

  for (const addon of addonsWithUserstyles) {
    const addonId = addon.addonId;
    for (const customVar of addon.cssVariables) {
      const varName = customVar.name;
      setVar(addonId, varName, getColor(addonId, customVar.value));
    }
  }
}

function waitForDocumentHead() {
  if (document.head) return Promise.resolve();
  else {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.head) {
          resolve();
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { subtree: true, childList: true });
    });
  }
}

async function onInfoAvailable({ globalState: globalStateMsg, l10njson, addonsWithUserscripts, addonsWithUserstyles }) {
  const isStudio = /^\/studios\/\d+(?:\/(?:projects|comments|curators|activity))?\/?$/.test(location.pathname);
  if (isStudio && !pseudoUrl) {
    await waitForDocumentHead();
    if (document.querySelector("meta[name='format-detection']")) {
      // scratch-www studio
      pseudoUrl = location.href.replace("/studios/", "/studios_www/");
      receivedResponse = false;
      chrome.runtime.sendMessage({ contentScriptReady: { url: pseudoUrl } }, onResponse);
      return;
    }
  }

  // In order for the "everLoadedAddons" not to change when "addonsWithUserscripts" changes, we stringify and parse
  const everLoadedAddons = JSON.parse(JSON.stringify(addonsWithUserscripts));
  const disabledDynamicAddons = [];
  globalState = globalStateMsg;
  setCssVariables(globalState.addonSettings, addonsWithUserstyles);
  // Just in case, make sure the <head> loaded before injecting styles
  waitForDocumentHead().then(() => injectUserstyles(addonsWithUserstyles));
  if (!_page_) {
    await new Promise((resolve) => {
      // We're registering this load event after the load event that
      // sets _page_, so we can guarantee _page_ exists now
      moduleScript.addEventListener("load", resolve);
    });
  }

  _page_.globalState = globalState;
  _page_.l10njson = l10njson;
  _page_.addonsWithUserscripts = addonsWithUserscripts;
  _page_.dataReady = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.newGlobalState) {
      _page_.globalState = request.newGlobalState;
      globalState = request.newGlobalState;
      setCssVariables(request.newGlobalState.addonSettings, addonsWithUserstyles);
    } else if (request.fireEvent) {
      _page_.fireEvent(request.fireEvent);
    } else if (request.dynamicAddonEnabled) {
      const { scripts, userstyles, cssVariables, addonId, injectAsStyleElt, index } = request.dynamicAddonEnabled;
      addStyle({ styles: userstyles, addonId, injectAsStyleElt, index });
      if (everLoadedAddons.find((addon) => addon.addonId === addonId)) {
        // Addon was reenabled
        _page_.fireEvent({ name: "reenabled", addonId, target: "self" });
      } else {
        // Addon was not injected in page yet
        _page_.runAddonUserscripts({ addonId, scripts, enabledLate: true });
      }

      addonsWithUserscripts.push({ addonId, scripts });
      addonsWithUserstyles.push({ styles: userstyles, cssVariables, addonId, injectAsStyleElt, index });
      setCssVariables(globalState.addonSettings, addonsWithUserstyles);
      everLoadedAddons.push({ addonId, scripts });
    } else if (request.dynamicAddonDisable) {
      const { addonId } = request.dynamicAddonDisable;
      disabledDynamicAddons.push(addonId);

      let addonIndex = addonsWithUserscripts.findIndex((a) => a.addonId === addonId);
      if (addonIndex !== -1) addonsWithUserscripts.splice(addonIndex, 1);
      addonIndex = addonsWithUserstyles.findIndex((a) => a.addonId === addonId);
      if (addonIndex !== -1) addonsWithUserstyles.splice(addonIndex, 1);

      removeAddonStyles(addonId);
      _page_.fireEvent({ name: "disabled", addonId, target: "self" });
    } else if (request.updateUserstylesSettingsChange) {
      const { userstyles, addonId, injectAsStyleElt, index } = request.updateUserstylesSettingsChange;
      // Removing the addon styles and readding them works since the background
      // will send a different array for the new valid userstyles.
      // Try looking for the "userscriptMatches" function.
      removeAddonStyles(addonId);
      addStyle({ styles: userstyles, addonId, injectAsStyleElt, index });
    } else if (request.setMsgCount) {
      _page_.setMsgCount(request.setMsgCount);
    } else if (request === "getRunningAddons") {
      const userscripts = addonsWithUserscripts.map((obj) => obj.addonId);
      const userstyles = addonsWithUserstyles.map((obj) => obj.addonId);
      sendResponse({ userscripts, userstyles, disabledDynamicAddons });
    }
  });
}

const escapeHTML = (str) => str.replace(/([<>'"&])/g, (_, l) => `&#${l.charCodeAt(0)};`);

function forumWarning(key) {
  let postArea = document.querySelector("form#post > label");
  if (postArea) {
    var errorList = document.querySelector("form#post > label > ul");
    if (!errorList) {
      let typeArea = postArea.querySelector("strong");
      errorList = document.createElement("ul");
      errorList.classList.add("errorlist");
      postArea.insertBefore(errorList, typeArea);
    }
    let addonError = document.createElement("li");
    let reportLink = document.createElement("a");
    reportLink.href = "https://scratchaddons.com/feedback";
    reportLink.target = "_blank";
    reportLink.innerText = chrome.i18n.getMessage("reportItHere");
    let text1 = document.createElement("span");
    text1.innerHTML = escapeHTML(chrome.i18n.getMessage(key, DOLLARS)).replace("$1", reportLink.outerHTML);
    addonError.appendChild(text1);
    errorList.appendChild(addonError);
  }
}

const showBanner = () => {
  const makeBr = () => document.createElement("br");

  const notifOuterBody = document.createElement("div");
  const notifInnerBody = Object.assign(document.createElement("div"), {
    id: "sa-notification",
    style: `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 700px;
    max-height: 270px;
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 10px;
    background-color: #222;
    color: white;
    z-index: 99999;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    text-shadow: none;
    box-shadow: 0 0 20px 0px #0000009e;
    line-height: 1em;`,
  });
  const notifImageLink = Object.assign(document.createElement("a"), {
    href: "https://www.youtube.com/watch?v=hQVAamRCaAU",
    target: "_blank",
  });
  const notifImage = Object.assign(document.createElement("img"), {
    // alt: chrome.i18n.getMessage("hexColorPickerAlt"),
    src: chrome.runtime.getURL("/images/cs/yt-thumbnail.png"),
    style: "height: 100px; border-radius: 5px; padding: 20px",
  });
  const notifText = Object.assign(document.createElement("div"), {
    id: "sa-notification-text",
    style: "margin: 12px;",
  });
  const notifTitle = Object.assign(document.createElement("span"), {
    style: "font-size: 18px; line-height: 24px; display: inline-block; margin-bottom: 12px;",
    textContent: chrome.i18n.getMessage("extensionUpdate"),
  });
  const notifClose = Object.assign(document.createElement("img"), {
    style: `
    float: right;
    cursor: pointer;
    width: 24px;`,
    title: chrome.i18n.getMessage("close"),
    src: chrome.runtime.getURL("../images/cs/close.svg"),
  });
  notifClose.addEventListener("click", () => notifInnerBody.remove(), { once: true });

  const NOTIF_TEXT_STYLE = "display: block; font-size: 14px; color: white !important;";

  const notifInnerText0 = Object.assign(document.createElement("span"), {
    style: NOTIF_TEXT_STYLE + "font-weight: bold;",
    textContent: chrome.i18n
      .getMessage("extensionHasUpdated", DOLLARS)
      .replace(/\$(\d+)/g, (_, i) => [chrome.runtime.getManifest().version][Number(i) - 1]),
  });
  const notifInnerText1 = Object.assign(document.createElement("span"), {
    style: NOTIF_TEXT_STYLE,
    innerHTML: escapeHTML(chrome.i18n.getMessage("extensionUpdateInfo1_v1_16", DOLLARS)).replace(
      /\$(\d+)/g,
      (_, i) =>
        [
          /*
          Object.assign(document.createElement("b"), { textContent: chrome.i18n.getMessage("newFeature") }).outerHTML,
          Object.assign(document.createElement("b"), { textContent: chrome.i18n.getMessage("newFeatureName") })
            .outerHTML,
          */
          Object.assign(document.createElement("a"), {
            href: "https://scratch.mit.edu/scratch-addons-extension/settings",
            target: "_blank",
            textContent: chrome.i18n.getMessage("scratchAddonsSettings"),
          }).outerHTML,
        ][Number(i) - 1]
    ),
  });
  const notifInnerText2 = Object.assign(document.createElement("span"), {
    style: NOTIF_TEXT_STYLE,
    textContent: chrome.i18n.getMessage("extensionUpdateInfo2_v1_16"),
  });
  const notifFooter = Object.assign(document.createElement("span"), {
    style: NOTIF_TEXT_STYLE,
  });
  const notifFooterChangelog = Object.assign(document.createElement("a"), {
    href: `https://scratchaddons.com/changelog?versionname=${chrome.runtime.getManifest().version}-notif`,
    target: "_blank",
    textContent: chrome.i18n.getMessage("notifChangelog"),
  });
  const notifFooterFeedback = Object.assign(document.createElement("a"), {
    href: `https://scratchaddons.com/feedback?version=${chrome.runtime.getManifest().version}-notif`,
    target: "_blank",
    textContent: chrome.i18n.getMessage("feedback"),
  });
  const notifFooterTranslate = Object.assign(document.createElement("a"), {
    href: "https://scratchaddons.com/translate",
    target: "_blank",
    textContent: chrome.i18n.getMessage("translate"),
  });
  const notifFooterLegal = Object.assign(document.createElement("small"), {
    textContent: chrome.i18n.getMessage("notAffiliated"),
  });
  notifFooter.appendChild(notifFooterChangelog);
  notifFooter.appendChild(document.createTextNode(" | "));
  notifFooter.appendChild(notifFooterFeedback);
  notifFooter.appendChild(document.createTextNode(" | "));
  notifFooter.appendChild(notifFooterTranslate);
  notifFooter.appendChild(makeBr());
  notifFooter.appendChild(notifFooterLegal);

  notifText.appendChild(notifTitle);
  notifText.appendChild(notifClose);
  notifText.appendChild(makeBr());
  notifText.appendChild(notifInnerText0);
  notifText.appendChild(makeBr());
  notifText.appendChild(notifInnerText1);
  notifText.appendChild(makeBr());
  notifText.appendChild(notifInnerText2);
  notifText.appendChild(makeBr());
  notifText.appendChild(notifFooter);

  notifImageLink.appendChild(notifImage);

  notifInnerBody.appendChild(notifImageLink);
  notifInnerBody.appendChild(notifText);

  notifOuterBody.appendChild(notifInnerBody);

  document.body.appendChild(notifOuterBody);
};

const handleBanner = async () => {
  const currentVersion = chrome.runtime.getManifest().version;
  const [major, minor, _] = currentVersion.split(".");
  const currentVersionMajorMinor = `${major}.${minor}`;
  // Making this configurable in the future?
  // Using local because browser extensions may not be updated at the same time across browsers
  const settings = await promisify(chrome.storage.local.get.bind(chrome.storage.local))(["bannerSettings"]);
  const force = !settings || !settings.bannerSettings;

  if (force || settings.bannerSettings.lastShown !== currentVersionMajorMinor || location.hash === "#sa-update-notif") {
    console.log("Banner shown.");
    await promisify(chrome.storage.local.set.bind(chrome.storage.local))({
      bannerSettings: Object.assign({}, settings.bannerSettings, { lastShown: currentVersionMajorMinor }),
    });
    showBanner();
  }
};

if (document.readyState !== "loading") {
  handleBanner();
} else {
  window.addEventListener("DOMContentLoaded", handleBanner, { once: true });
}

const isProfile = pathArr[0] === "users" && pathArr[2] === "";
const isStudio = pathArr[0] === "studios";
const r2IsStudioComments = isStudio && pathArr[2] === "comments";
const isProject = pathArr[0] === "projects";

if (isProfile || isStudio || isProject) {
  const shouldCaptureComment = (value) => {
    const regex = / scratch[ ]?add[ ]?ons/;
    // Trim like scratchr2
    const trimmedValue = " " + value.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    const limitedValue = trimmedValue.toLowerCase().replace(/[^a-z /]+/g, "");
    return regex.test(limitedValue);
  };
  const extensionPolicyLink = document.createElement("a");
  extensionPolicyLink.href = "https://scratch.mit.edu/discuss/topic/284272/";
  extensionPolicyLink.target = "_blank";
  extensionPolicyLink.innerText = chrome.i18n.getMessage("captureCommentPolicy");
  Object.assign(extensionPolicyLink.style, {
    textDecoration: "underline",
    color: "white",
  });
  const errorMsgHtml = escapeHTML(chrome.i18n.getMessage("captureCommentError", DOLLARS)).replace(
    "$1",
    extensionPolicyLink.outerHTML
  );
  const sendAnywayMsg = chrome.i18n.getMessage("captureCommentPostAnyway");
  const confirmMsg = chrome.i18n.getMessage("captureCommentConfirm");

  window.addEventListener("load", () => {
    const isScratchWww = Boolean(document.querySelector("meta[name='format-detection']"));
    if (isProfile || (r2IsStudioComments && !isScratchWww)) {
      window.addEventListener(
        "click",
        (e) => {
          const path = e.composedPath();
          if (
            path[1] &&
            path[1] !== document &&
            path[1].getAttribute("data-control") === "post" &&
            path[1].hasAttribute("data-commentee-id")
          ) {
            const form = path[3];
            if (form.tagName !== "FORM") return;
            if (form.hasAttribute("data-sa-send-anyway")) {
              form.removeAttribute("data-sa-send-anyway");
              return;
            }
            const textarea = form.querySelector("textarea[name=content]");
            if (!textarea) return;
            if (shouldCaptureComment(textarea.value)) {
              e.stopPropagation();
              e.preventDefault(); // Avoid location.hash being set to null

              form.querySelector("[data-control=error] .text").innerHTML = errorMsgHtml + " ";
              const sendAnyway = document.createElement("a");
              sendAnyway.onclick = () => {
                const res = confirm(confirmMsg);
                if (res) {
                  form.setAttribute("data-sa-send-anyway", "");
                  form.querySelector("[data-control=post]").click();
                }
              };
              sendAnyway.textContent = sendAnywayMsg;
              Object.assign(sendAnyway.style, {
                textDecoration: "underline",
                color: "white",
              });
              form.querySelector("[data-control=error] .text").appendChild(sendAnyway);
              form.querySelector(".control-group").classList.add("error");
            }
          }
        },
        { capture: true }
      );
    } else if (isProject || (isStudio && isScratchWww)) {
      // For projects, we want to be careful not to hurt performance.
      // Let's capture the event in the comments container instead
      // of the whole window. There will be a new comment container
      // each time the user goes inside the project then outside.
      let observer;
      const waitForContainer = () => {
        if (document.querySelector(".comments-container, .studio-compose-container")) return Promise.resolve();
        return new Promise((resolve) => {
          observer = new MutationObserver((mutationsList) => {
            if (document.querySelector(".comments-container, .studio-compose-container")) {
              resolve();
              observer.disconnect();
            }
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        });
      };
      const getEditorMode = () => {
        // From addon-api/content-script/Tab.js
        const pathname = location.pathname.toLowerCase();
        const split = pathname.split("/").filter(Boolean);
        if (!split[0] || split[0] !== "projects") return null;
        if (split.includes("editor")) return "editor";
        if (split.includes("fullscreen")) return "fullscreen";
        if (split.includes("embed")) return "embed";
        return "projectpage";
      };
      const addListener = () =>
        document.querySelector(".comments-container, .studio-compose-container").addEventListener(
          "click",
          (e) => {
            const path = e.composedPath();
            // When clicking the post button, e.path[0] might
            // be <span>Post</span> or the <button /> element
            const possiblePostBtn = path[0].tagName === "SPAN" ? path[1] : path[0];
            if (!possiblePostBtn) return;
            if (possiblePostBtn.tagName !== "BUTTON") return;
            if (!possiblePostBtn.classList.contains("compose-post")) return;
            const form = path[0].tagName === "SPAN" ? path[3] : path[2];
            if (!form) return;
            if (form.tagName !== "FORM") return;
            if (!form.classList.contains("full-width-form")) return;
            // Remove error when about to send comment anyway, if it exists
            form.parentNode.querySelector(".sa-compose-error-row")?.remove();
            if (form.hasAttribute("data-sa-send-anyway")) {
              form.removeAttribute("data-sa-send-anyway");
              return;
            }
            const textarea = form.querySelector("textarea[name=compose-comment]");
            if (!textarea) return;
            if (shouldCaptureComment(textarea.value)) {
              e.stopPropagation();
              const errorRow = document.createElement("div");
              errorRow.className = "flex-row compose-error-row sa-compose-error-row";
              const errorTip = document.createElement("div");
              errorTip.className = "compose-error-tip";
              const span = document.createElement("span");
              span.innerHTML = errorMsgHtml + " ";
              const sendAnyway = document.createElement("a");
              sendAnyway.onclick = () => {
                const res = confirm(confirmMsg);
                if (res) {
                  form.setAttribute("data-sa-send-anyway", "");
                  possiblePostBtn.click();
                }
              };
              sendAnyway.textContent = sendAnywayMsg;
              errorTip.appendChild(span);
              errorTip.appendChild(sendAnyway);
              errorRow.appendChild(errorTip);
              form.parentNode.prepend(errorRow);

              // Hide error after typing like scratch-www does
              textarea.addEventListener(
                "input",
                () => {
                  errorRow.remove();
                },
                { once: true }
              );
              // Hide error after clicking cancel like scratch-www does
              form.querySelector(".compose-cancel").addEventListener(
                "click",
                () => {
                  errorRow.remove();
                },
                { once: true }
              );
            }
          },
          { capture: true }
        );

      const check = async () => {
        if (
          // Note: do not use pathArr here below! pathArr is calculated
          // on load, pathname can change dynamically with replaceState
          (isStudio && location.pathname.split("/")[3] === "comments") ||
          (isProject && getEditorMode() === "projectpage")
        ) {
          await waitForContainer();
          addListener();
        } else {
          observer?.disconnect();
        }
      };
      check();
      csUrlObserver.addEventListener("change", (e) => check());
    }
  });
}
