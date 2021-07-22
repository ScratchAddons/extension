import "./set-lang.js";
import Addon from "../addon-api/popup/Addon.js";
import WebsiteLocalizationProvider from "../libraries/common/website-l10n.js";

const scratchAddons = (window.scratchAddons = {});
// Store event targets for addon.* API events
scratchAddons.eventTargets = {
  auth: [],
  settings: [],
  self: [],
};
scratchAddons.localEvents = new EventTarget();
scratchAddons.globalState = {};
scratchAddons.methods = {};
scratchAddons._pending = {
  getMsgCount: [],
};
scratchAddons.l10n = new WebsiteLocalizationProvider();
scratchAddons.isLightMode = false;

(async () => {
  const addonId = location.pathname.split("/")[2];
  const promisify =
    (callbackFn) =>
    (...args) =>
      new Promise((resolve) => callbackFn(...args, resolve));

  const sendMessage = promisify(chrome.runtime.sendMessage.bind(chrome.runtime));
  const popupData = await sendMessage({
    requestPopupInfo: {
      addonId,
    },
  });
  scratchAddons.globalState = {
    auth: popupData.auth,
    addonSettings: popupData.settings,
  };

  /*
   Popups do not have tab ID, so it is not possible to send messages from
   background to popup (unless as part of the callback) with the traditional
   sendMessage API. By creating a port and holding a reference of it on the
   background script it can send messages. Note that we still use sendMessage
   to send to background to reduce code duplication.

   Once the background acknowledges the connection, it sends a ping.
  */
  const port = chrome.runtime.connect(undefined, { name: addonId });
  await new Promise((resolve) => {
    port.onMessage.addListener((value) => {
      if (value === "ping") resolve();
    });
  });

  scratchAddons.methods.getMsgCount = () =>
    new Promise((resolve) => {
      scratchAddons._pending.getMsgCount.push(resolve);
      chrome.runtime.sendMessage("getMsgCount");
    });
  port.onMessage.addListener((request) => {
    if (request.setMsgCount) {
      const { count } = request.setMsgCount;
      scratchAddons._pending.getMsgCount.forEach((resolve) => resolve(count));
      scratchAddons._pending.getMsgCount = [];
      return;
    }
    if (request.newGlobalState) {
      scratchAddons.globalState = request.newGlobalState;
      return;
    }
    if (request.fireEvent && request.fireEvent.addonId === addonId) {
      scratchAddons.eventTargets[request.fireEvent.target]?.forEach((t) =>
        t.dispatchEvent(new CustomEvent(request.fireEvent.name))
      );
      return;
    }
  });

  const addon = new Addon({
    id: addonId,
  });
  const globalObj = Object.create(null);
  await scratchAddons.l10n.loadByAddonId(addonId);
  const msg = (key, placeholders) =>
    scratchAddons.l10n.get(key.startsWith("/") ? key.slice(1) : `${addonId}/${key}`, placeholders);
  msg.locale = scratchAddons.l10n.locale;

  const fileName = popupData.popup.script;
  const module = await import(chrome.runtime.getURL(`/popups/${addonId}/${fileName}`));
  module.default({
    addon: addon,
    global: globalObj,
    console,
    msg,
    safeMsg: (key, placeholders) =>
      scratchAddons.l10n.escaped(key.startsWith("/") ? key.slice(1) : `${addonId}/${key}`, placeholders),
  });
})();

const lightThemeLink = document.createElement("link");
lightThemeLink.setAttribute("rel", "stylesheet");
lightThemeLink.setAttribute("href", "../../webpages/styles/colors-light.css");

chrome.storage.sync.get(["globalTheme"], function ({ globalTheme = false }) {
  if (globalTheme === true) {
    scratchAddons.isLightMode = true;
    document.head.appendChild(lightThemeLink);
  }
});

if (window.parent === window) {
  document.body.classList.add("fullscreen");
  document.documentElement.classList.add("fullscreen");
}
