import AuthCommon from "../common/Auth.js";

export default class Auth extends AuthCommon {
  constructor(...args) {
    super(...args);
    this._refresh();
  }

  /**
   * @private
   */
  _getCookie(name) {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const cookie = cookies.find((c) => c.startsWith(`${name}=`));
    if (!cookie) return null;
    return cookie.slice(name.length + 1);
  }

  /**
   * @private
   */
  _refresh() {
    this._lastUsername = undefined;
    this._lastUserId = undefined;
    this._lastIsLoggedIn = undefined;
    this._lastXToken = undefined;
  }

  /**
   * @private
   */
  _waitUntilFetched() {
    return new Promise((resolve) => this.addEventListener("session", resolve, { once: true }));
  }

  /**
   * @private
   */
  _update(d) {
    this._lastUsername = d.user?.username || null;
    this._lastUserId = d.user?.id || null;
    this._lastIsLoggedIn = !!d.user;
    this._lastXToken = d.user?.token || null;
    this.dispatchEvent(new CustomEvent("session"));
    this.dispatchEvent(new CustomEvent("change"));
  }

  /**
   * @private
   */
  _fetchProperty(prop) {
    if (typeof this[prop] !== "undefined") return Promise.resolve(this[prop]);
    return this._waitUntilFetched().then(() => this[prop]);
  }

  /**
   * Fetch whether the user is logged in or not.
   * @returns {Promise<boolean>} - whether the user is logged in or not.
   */
  fetchIsLoggedIn() {
    return this._fetchProperty("_lastIsLoggedIn");
  }

  /**
   * Fetch current username.
   * @returns {Promise<?string>} - the username.
   */
  fetchUsername() {
    return this._fetchProperty("_lastUsername");
  }

  /**
   * Fetch current user ID.
   * @returns {Promise<?number>} - the user ID.
   */
  fetchUserId() {
    return this._fetchProperty("_lastUserId");
  }

  /**
   * Fetch X-Token used in new APIs.
   * @returns {Promise<?string>} - the X-Token.
   */
  fetchXToken() {
    return this._fetchProperty("_lastXToken");
  }

  /**
   * CSRF token used in APIs.
   * @type {string}
   */
  get csrfToken() {
    return this._getCookie("scratchcsrftoken");
  }

  /**
   * Language of the Scratch website.
   * @type {string}
   */
  get scratchLang() {
    return this._getCookie("scratchlanguage");
  }
}
