import Addon from "../common/Addon.js";
import Popup from "./Popup.js";
import MessagePasser from "./MessagePasser.js";

/**
 * An addon that loads as a popup.
 * @extends Addon
 * @property {Popup} popup
 * @property {MessagePasser} messaging
 */
export default class PopupAddon extends Addon {
  constructor(info) {
    super(info);
    this.popup = new Popup();
    this.messaging = new MessagePasser(info);
  }

  /**
   * @private
   */
  get _path() {
    return chrome.runtime.getURL("");
  }
}
