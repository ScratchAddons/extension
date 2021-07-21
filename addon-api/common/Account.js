import Listenable from "./Listenable.js";

/**
 * Handles accounts.
 * @extends Listenable
 */
export default class Account extends Listenable {
  constructor() {
    super();
  }
  /**
   * Fetches message count.
   * @returns {Promise<?number>} - current message count.
   */
  getMsgCount() {
    return scratchAddons.methods.getMsgCount();
  }
  /**
   * Fetches messages.
   * @returns {Promise<object[]>} - current messages.
   */
  getMessages(...args) {
    return scratchAddons.methods.getMessages(...args);
  }
  /**
   * Clears unread messages.
   * @returns {Promise}
   */
  clearMessages() {
    return scratchAddons.methods.clearMessages();
  }
}
