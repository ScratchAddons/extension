import Auth from "./Auth.js";
import Account from "./Account.js";
import Self from "./Self.js";
import Settings from "../common/Settings.js";
import Storage from "../common/Storage.js";

/**
 * An addon.
 * @property {Self} self
 * @property {Auth} auth
 * @property {Account} account
 * @property {Settings} settings
 */
export default class Addon {
  constructor(info) {
    this.self = new Self(this, info);
    this.auth = new Auth(this);
    this.account = new Account();
    this.settings = new Settings(this);
    this.storage = new Storage(this);
  }

  /**
   * @abstract
   * @private
   */
  get _path() {
    throw new Error("Subclasses must implement this.");
  }
}
