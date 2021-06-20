import Auth from "./Auth.js";
import Account from "./Account.js";
import Self from "./Self.js";
import Settings from "../common/Settings.js";

/**
 * An addon.
 *
 * @property {Self} self
 * @property {Auth} auth
 * @property {Account} account
 * @property {Settings} settings
 */
export default class Addon {
  /** @param {{ id: any; enabledLate: any; permissions?: string[] }} info */
  constructor(info) {
    this.self = new Self(this, info);
    this.auth = new Auth();
    this.account = new Account();
    this.settings = new Settings(this);
  }

  /** @type {void | string} */
  get _path() {
    throw new Error("Subclasses must implement this.");
  }
}
