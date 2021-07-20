import loadVueComponent from "../../libraries/common/load-vue-components.js";
import loadPopup from "../popup-loader.js";

//theme switching
const lightThemeLink = document.createElement("link");
lightThemeLink.setAttribute("rel", "stylesheet");
lightThemeLink.setAttribute("href", "light.css");
chrome.storage.sync.get(["globalTheme"], function (r) {
  let rr = false; //true = light, false = dark
  if (r.globalTheme) rr = r.globalTheme;
  if (rr) {
    document.head.appendChild(lightThemeLink);
  }
});

function calculatePopupSize() {
  if (!window.innerWidth || !window.innerHeight) {
    setTimeout(calculatePopupSize, 0);
    return;
  }
  let width = window.innerWidth;
  document.documentElement.style.setProperty("--width", `${width}px`);
  let height = window.innerHeight - 3;
  document.documentElement.style.setProperty("--height", `${height}px`);
  document.body.classList.remove("loading");
}

window.addEventListener("load", () => setTimeout(calculatePopupSize, 0));

chrome.runtime.sendMessage("getSettingsInfo", async (res) => {
  // If order unspecified, addon goes first. All new popups should be added here.
  const TAB_ORDER = ["scratch-messaging", "cloud-games"];
  const popupObjects = Object.keys(res.addonsEnabled)
    .filter((addonId) => res.addonsEnabled[addonId] === true)
    .map((addonId) => res.manifests.find((addon) => addon.addonId === addonId))
    // Note an enabled addon might not exist anymore!
    .filter((findManifest) => findManifest !== undefined)
    .filter(({ manifest }) => manifest.popup)
    .sort(({ addonId: addonIdB }, { addonId: addonIdA }) => TAB_ORDER.indexOf(addonIdB) - TAB_ORDER.indexOf(addonIdA))
    .map(
      ({ addonId, manifest }) =>
        (manifest.popup._addonId = addonId) &&
        Object.assign(manifest.popup, {
          html: `popups/${addonId}/popup`,
        })
    );
  popupObjects.push({
    name: chrome.i18n.getMessage("quickSettings"),
    icon: "../../images/icons/wrench.svg",
    html: "webpages/settings/component",
    _addonId: "settings-page",
  });
  let components = [];
  for (let popup of popupObjects) {
    let params = popup._addonId === "settings-page" ? [] : await loadPopup(popup._addonId);
    components.push({ url: popup.html, params });
  }
  components = await loadVueComponent(components);
  console.log(components);

  const vue = new Vue({
    el: "body",
    components,
    data: {
      popups: popupObjects,
      currentPopup: null,
      displayedPopups: [],
      version: chrome.runtime.getManifest().version,
    },
    methods: {
      msg(message, ...params) {
        return chrome.i18n.getMessage(message, ...params);
      },
      direction() {
        return chrome.i18n.getMessage("@@bidi_dir");
      },
      closePopup() {
        setTimeout(() => window.close(), 100);
      },
      openSettingsPage() {
        chrome.runtime.openOptionsPage();
        this.closePopup();
      },
      openChangelog() {
        window.open("https://scratchaddons.com/changelog?versionname=" + chrome.runtime.getManifest().version_name);
        this.closePopup();
      },
      setPopup(popup) {
        if (this.currentPopup !== popup) {
          this.currentPopup = popup;
          if (!this.displayedPopups.includes(popup)) this.displayedPopups.push(popup);
          for (let activeStyle of document.querySelectorAll(`style[data-addon-id=${popup._addonId}]`)) {
            activeStyle.removeAttribute("media");
          }
          for (let inactiveStyle of document.querySelectorAll(
            `style[data-addon-id]:not([data-addon-id=${popup._addonId}])`
          )) {
            inactiveStyle.media = "not all";
          }
        }
      },
    },
    created() {
      this.setPopup(this.popups[0]);
    },
  });
});

chrome.runtime.sendMessage("checkPermissions");
