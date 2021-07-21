import Listenable from "./Listenable.js";

/**
 * Authentication related utilities.
 * @extends Listenable
 */
export default class Auth extends Listenable {
  /**
   * Fetch whether the user is logged in or not.
   * @returns {Promise<boolean>} - whether the user is logged in or not.
   */
  fetchIsLoggedIn() {
    return Promise.resolve(scratchAddons.globalState.auth.isLoggedIn);
  }
  /**
   * Fetch current username.
   * @returns {Promise<?string>} - the username.
   */
  fetchUsername() {
    return Promise.resolve(scratchAddons.globalState.auth.username);
  }
  /**
   * Fetch current user ID.
   * @returns {Promise<?number>} - the user ID.
   */
  fetchUserId() {
    return Promise.resolve(scratchAddons.globalState.auth.userId);
  }
  /**
   * Fetch X-Token used in new APIs.
   * @returns {Promise<?string>} - the X-Token.
   */
  fetchXToken() {
    return Promise.resolve(scratchAddons.globalState.auth.xToken);
  }
  /**
   * CSRF token used in APIs.
   * @type {string}
   */
  get csrfToken() {
    return scratchAddons.globalState.auth.csrfToken;
  }
  /**
   * Language of the Scratch website.
   * @type {string}
   */
  get scratchLang() {
    return scratchAddons.globalState.auth.scratchLang;
  }

  /**
   * @private
   */
  get _eventTargetKey() {
    return "auth";
  }
}
