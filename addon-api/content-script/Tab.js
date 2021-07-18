import Trap from "./Trap.js";
import ReduxHandler from "./ReduxHandler.js";
import Listenable from "../common/Listenable.js";
import dataURLToBlob from "../../libraries/common/cs/data-url-to-blob.js";
import getWorkerScript from "./worker.js";
import * as blocks from "./blocks.js";

const DATA_PNG = "data:image/png;base64,";

/**
 * APIs specific to userscripts.
 * @extends Listenable
 * @property {?string} clientVersion - version of the renderer (scratch-www, scratchr2, etc)
 * @property {Trap} traps
 * @property {ReduxHandler} redux
 */
export default class Tab extends Listenable {
  constructor(info) {
    super();
    this._addonId = info.id;
    this.clientVersion = document.querySelector("meta[name='format-detection']")
      ? "scratch-www"
      : document.querySelector("script[type='text/javascript']")
      ? "scratchr2"
      : null;
    this.traps = new Trap(this);
    this.redux = new ReduxHandler();
    this._waitForElementSet = new WeakSet();
    this._blockContextMenu = [];
  }
  addBlock(...a) {
    blocks.init(this);
    return blocks.addBlock(...a);
  }
  removeBlock(...a) {
    return blocks.removeBlock(...a);
  }
  /**
   * Loads a script by URL.
   * @param {string} url - script URL.
   * @returns {Promise}
   */
  loadScript(url) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = url;
      document.head.appendChild(script);
      script.onload = resolve;
    });
  }
  /**
   * Waits until an element renders, then return the element.
   * @param {string} selector - argument passed to querySelector.
   * @param {object} opts - options.
   * @param {boolean=} opts.markAsSeen - Whether it should mark resolved elements to be skipped next time or not.
   * @param {function=} opts.condition - A function that returns whether to resolve the selector or not.
   * @param {function=} opts.elementCondition - A function that returns whether to resolve the selector or not, given an element.
   * @param {function=} opts.reduxCondition - A function that returns whether to resolve the selector or not.
   * Use this as an optimization and do not rely on the behavior.
   * @param {string[]=} opts.reduxEvents - An array of redux events that must be dispatched before resolving the selector.
   * Use this as an optimization and do not rely on the behavior.
   * @returns {Promise<Element>} - element found.
   */
  waitForElement(selector, opts = {}) {
    const markAsSeen = !!opts.markAsSeen;
    if (!opts.condition || opts.condition()) {
      const firstQuery = document.querySelectorAll(selector);
      for (const element of firstQuery) {
        if (this._waitForElementSet.has(element)) continue;
        if (opts.elementCondition && !opts.elementCondition(element)) continue;
        if (markAsSeen) this._waitForElementSet.add(element);
        return Promise.resolve(element);
      }
    }
    const { reduxCondition, condition } = opts;
    let listener;
    let combinedCondition = () => {
      if (condition && !condition()) return false;
      if (this.redux.state) {
        if (reduxCondition && !reduxCondition(this.redux.state)) return false;
      }
      // NOTE: this may reach sooner than expected, if redux state is not available
      // because of timing issues. However this is just an optimization! It's fine
      // if it runs a little earlier. Just don't error out.
      return true;
    };
    if (opts.reduxEvents) {
      const oldCondition = combinedCondition;
      let satisfied = false;
      combinedCondition = () => {
        if (oldCondition && !oldCondition()) return false;
        return satisfied;
      };
      listener = ({ detail }) => {
        if (opts.reduxEvents.includes(detail.action.type)) {
          satisfied = true;
        }
      };
      this.redux.initialize();
      this.redux.addEventListener("statechanged", listener);
    }
    const promise = scratchAddons.sharedObserver.watch({
      query: selector,
      seen: markAsSeen ? this._waitForElementSet : null,
      condition: combinedCondition,
      elementCondition: opts.elementCondition || null,
    });
    if (listener) {
      promise.then((match) => {
        this.redux.removeEventListener("statechanged", listener);
        return match;
      });
    }
    return promise;
  }
  /**
   * editor mode (or null for non-editors).
   * @type {?string}
   */
  get editorMode() {
    const pathname = location.pathname.toLowerCase();
    const split = pathname.split("/").filter(Boolean);
    if (!split[0] || split[0] !== "projects") return null;
    if (split.includes("editor")) return "editor";
    if (split.includes("fullscreen")) return "fullscreen";
    if (split.includes("embed")) return "embed";
    return "projectpage";
  }

  /**
   * Copies an PNG image.
   * @param {string} dataURL - data url of the png image
   * @returns {Promise}
   */
  copyImage(dataURL) {
    if (!dataURL.startsWith(DATA_PNG)) return Promise.reject(new TypeError("Expected PNG data URL"));
    if (typeof Clipboard.prototype.write === "function") {
      // Chrome
      const blob = dataURLToBlob(dataURL);
      const items = [
        new ClipboardItem({
          "image/png": blob,
        }),
      ];
      return navigator.clipboard.write(items);
    } else {
      // Firefox needs Content Script
      return scratchAddons.methods.copyImage(dataURL).catch((err) => {
        return Promise.reject(new Error(`Error inside clipboard handler: ${err}`));
      });
    }
  }

  /**
   * Gets translation used by Scratch.
   * @param {string} key - Translation key.
   * @returns {string} Translation.
   */
  scratchMessage(key) {
    if (this.clientVersion === "scratch-www") {
      const locales = [window._locale ? window._locale.toLowerCase() : "en"];
      if (locales[0].includes("-")) locales.push(locales[0].split("-")[0]);
      if (locales.includes("pt") && !locales.includes("pt-br")) locales.push("pt-br");
      if (!locales.includes("en")) locales.push("en");
      for (const locale of locales) {
        if (window._messages[locale] && window._messages[locale][key]) {
          return window._messages[locale][key];
        }
      }
      console.warn("Unknown key: ", key);
      return "";
    }
    if (this.clientVersion === "scratchr2") {
      return window.django.gettext(key);
    }
  }

  /**
   * @private
   */
  get _eventTargetKey() {
    return "tab";
  }

  /**
   * Loads a Web Worker.
   * @async
   * @param {string} url - URL of the worker to load.
   * @returns {Promise<Worker>} - worker.
   */
  async loadWorker(url) {
    const resp = await fetch(url);
    const script = await resp.text();
    const workerScript = getWorkerScript(this, script, url);
    const blob = new Blob([workerScript], { type: "text/javascript" });
    const workerURL = URL.createObjectURL(blob);
    const worker = new Worker(workerURL);
    return new Promise((resolve) => worker.addEventListener("message", () => resolve(worker), { once: true }));
  }

  /**
   * Gets the hashed class name for a Scratch stylesheet class name.
   * @param {...*} args Unhashed class names.
   * @param {object} opts - options.
   * @param {String[]|String} opts.others - Non-Scratch class or classes to merge.
   * @returns {string} Hashed class names.
   */
  scratchClass(...args) {
    let res = "";
    args
      .filter((arg) => typeof arg === "string")
      .forEach((classNameToFind) => {
        if (scratchAddons.classNames.loaded) {
          res +=
            scratchAddons.classNames.arr.find(
              (className) =>
                className.startsWith(classNameToFind + "_") && className.length === classNameToFind.length + 6
            ) || "";
        } else {
          res += `scratchAddonsScratchClass/${classNameToFind}`;
        }
        res += " ";
      });
    if (typeof args[args.length - 1] === "object") {
      const options = args[args.length - 1];
      const classNames = Array.isArray(options.others) ? options.others : [options.others];
      classNames.forEach((string) => (res += string + " "));
    }
    res = res.slice(0, -1);
    // Sanitize just in case
    res = res.replace(/"/g, "");
    return res;
  }

  displayNoneWhileDisabled(el, { display = "" } = {}) {
    el.style.display = `var(--${this._addonId.replace(/-([a-z])/g, (g) =>
      g[1].toUpperCase()
    )}-_displayNoneWhileDisabledValue${display ? ", " : ""}${display})`;
  }

  get direction() {
    // https://github.com/LLK/scratch-l10n/blob/master/src/supported-locales.js
    const rtlLocales = ["ar", "ckb", "fa", "he"];
    const lang = scratchAddons.globalState.auth.scratchLang.split("-")[0];
    return rtlLocales.includes(lang) ? "rtl" : "ltr";
  }

  appendToSharedSpace({ space, element, order, scope }) {
    const q = document.querySelector.bind(document);
    const sharedSpaces = {
      stageHeader: {
        // Non-fullscreen stage header only
        element: () => q("[class^='stage-header_stage-size-row']"),
        from: () => [],
        until: () => [
          // Small/big stage buttons (for editor mode)
          q("[class^='stage-header_stage-size-toggle-group']"),
          // Full screen icon (for player mode)
          q("[class^='stage-header_stage-size-row']").lastChild,
        ],
      },
      fullscreenStageHeader: {
        // Fullscreen stage header only
        element: () => q("[class^='stage-header_stage-menu-wrapper']"),
        from: function () {
          let emptyDiv = this.element().querySelector(".sa-spacer");
          if (!emptyDiv) {
            emptyDiv = document.createElement("div");
            emptyDiv.style.marginLeft = "auto";
            emptyDiv.className = "sa-spacer";
            this.element().insertBefore(emptyDiv, this.element().lastChild);
          }
          return [emptyDiv];
        },
        until: () => [q("[class^='stage-header_stage-menu-wrapper']").lastChild],
      },
      afterGreenFlag: {
        element: () => q("[class^='controls_controls-container']"),
        from: () => [],
        until: () => [q("[class^='stop-all_stop-all']")],
      },
      afterStopButton: {
        element: () => q("[class^='controls_controls-container']"),
        from: () => [q("[class^='stop-all_stop-all']")],
        until: () => [],
      },
      afterCopyLinkButton: {
        element: () => q(".flex-row.subactions > .flex-row.action-buttons"),
        from: () => [q(".copy-link-button")],
        until: () => [],
      },
      afterSoundTab: {
        element: () => q("[class^='react-tabs_react-tabs__tab-list']"),
        from: () => [q("[class^='react-tabs_react-tabs__tab-list']").children[2]],
        until: () => [q(".s3devToolBar")],
      },
      forumsBeforePostReport: {
        element: () => scope.querySelector(".postfootright > ul"),
        from: () => [],
        until: function () {
          let reportButton = scope.querySelector(
            ".postfootright > ul > li.postreport, .postfootright > ul > li.pseudopostreport"
          );
          if (!reportButton) {
            // User is logged out, so there's no report button on the post footer
            // Create a pseudo post report button as a separator between this space
            // and the forumsAfterPostReport space.
            reportButton = Object.assign(document.createElement("li"), {
              className: "pseudopostreport",
              textContent: " 🞄 ",
            });
            this.element().appendChild(reportButton);
          }
          return [reportButton];
        },
      },
      forumsAfterPostReport: {
        element: () => scope.querySelector(".postfootright > ul"),
        from: function () {
          let reportButton = scope.querySelector(
            ".postfootright > ul > li.postreport, .postfootright > ul > li.pseudopostreport"
          );
          if (!reportButton) {
            // User is logged out. See comment on forumsBeforePostReport space
            reportButton = Object.assign(document.createElement("li"), {
              className: "pseudopostreport",
              textContent: " 🞄 ",
            });
            this.element().appendChild(reportButton);
          }
          return [reportButton];
        },
        until: () => [scope.querySelector(".postfootright > ul > li.postquote")],
      },
      beforeRemixButton: {
        element: () => q(".project-buttons"),
        from: () => [],
        until: () => [q(".project-buttons > .remix-button"), q(".project-buttons > .see-inside-button")],
      },
      studioCuratorsTab: {
        element: () => q(".studio-tabs div:nth-child(2)"),
        from: () => [],
        // .commenting-status only exists if account is muted
        until: () => [
          q(".studio-tabs div:nth-child(2) > .commenting-status"),
          q(".studio-tabs div:nth-child(2) > .studio-members"),
        ],
      },
    };

    const spaceInfo = sharedSpaces[space];
    const spaceElement = spaceInfo.element();
    if (!spaceElement) return false;
    const from = spaceInfo.from();
    const until = spaceInfo.until();

    element.dataset.saSharedSpaceOrder = order;

    let foundFrom = false;
    if (from.length === 0) foundFrom = true;

    // insertAfter = element whose nextSibling will be the new element
    // -1 means append at beginning of space (prepend)
    // This will stay null if we need to append at the end of space
    let insertAfter = null;

    const children = Array.from(spaceElement.children);
    for (let indexString of children.keys()) {
      const child = children[indexString];
      const i = Number(indexString);

      // Find either element from "from" before doing anything
      if (!foundFrom) {
        if (from.includes(child)) {
          foundFrom = true;
          // If this is the last child, insertAfter will stay null
          // and the element will be appended at the end of space
        }
        continue;
      }

      if (until.includes(child)) {
        // This is the first SA element appended to this space
        // If from = [] then prepend, otherwise append after
        // previous child (likely a "from" element)
        if (i === 0) insertAfter = -1;
        else insertAfter = children[i - 1];
        break;
      }

      if (child.dataset.saSharedSpaceOrder) {
        if (Number(child.dataset.saSharedSpaceOrder) > order) {
          // We found another SA element with higher order number
          // If from = [] and this is the first child, prepend.
          // Otherwise, append before this child.
          if (i === 0) insertAfter = -1;
          else insertAfter = children[i - 1];
          break;
        }
      }
    }

    if (!foundFrom) return false;
    // It doesn't matter if we didn't find an "until"

    // Separators in forum post spaces
    if (space === "forumsBeforePostReport") {
      element.appendChild(document.createTextNode(" | "));
    } else if (space === "forumsAfterPostReport") {
      element.prepend(document.createTextNode("| "));
    }

    if (insertAfter === null) {
      // This might happen with until = []
      spaceElement.appendChild(element);
    } else if (insertAfter === -1) {
      // This might happen with from = []
      spaceElement.prepend(element);
    } else {
      // Works like insertAfter but using insertBefore API.
      // nextSibling cannot be null because insertAfter
      // is always set to children[i-1], so it must exist
      spaceElement.insertBefore(element, insertAfter.nextSibling);
    }
    return true;
  }

  /**
   * Creates an item in the editor Blockly context menu.
   * @param {function} callback Returns new menu items.
   * @param {object} conditions - Show context menu when one of these conditions meet.
   */
  createBlockContextMenu(callback, { workspace = false, blocks = false, flyout = false, comments = false } = {}) {
    this._blockContextMenu.push({ callback, workspace, blocks, flyout, comments });
  }
}
