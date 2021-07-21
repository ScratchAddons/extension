import Addon from "../common/Addon.js";
import Notifications from "./Notifications.js";
import Badge from "./Badge.js";
import MessagePasser from "./MessagePasser.js";

/**
 * An addon that loads as a background script.
 * @extends Addon
 * @property {Notifications} [notifications]
 * @property {Badge} [badge]
 * @property {MessagePasser} [messaging]
 */
export default class BackgroundScriptAddon extends Addon {
  constructor(info) {
    super(info);
    const { permissions } = info;
    this._timeouts = [];
    this._intervals = [];
    this.self.restart = () => this._restart();
    if (permissions) {
      if (permissions.includes("notifications")) this.notifications = new Notifications(this);
      if (permissions.includes("badge")) this.badge = new Badge(this);
    }
    this.messaging = new MessagePasser(this);
  }
  _kill() {
    this.auth.dispose();
    this.settings.dispose();
    this.self.dispose();
    if (this.notifications) this.notifications.dispose();
    this._timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this._intervals.forEach((intervalId) => clearInterval(intervalId));
    this._revokeProxy();
  }

  /**
   * @private
   */
  get _path() {
    return chrome.runtime.getURL("");
  }
}
