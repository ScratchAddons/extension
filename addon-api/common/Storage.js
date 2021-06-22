import Listenable from "./Listenable.js";

/**
 * Manages settings.
 * @extends Listenable
 */
export default class Storage extends Listenable {
  constructor(addonObject) {
    super();
    this._addonId = addonObject.self.id;
  }
  /**
   * Gets addon's storage.
   * @returns {Promise} storage.
   */
  get() {
    return scratchAddons.methods.getAddonStorage(this._addonId);
  }
  /**
   * Set addon's storage.
   */
  set(storageDiff) {
    return scratchAddons.methods.setAddonStorage(this._addonId, storageDiff);
  }
  /**
   * clear addon's storage.
   */
  clear() {
    return scratchAddons.methods.clearAddonStorage(this._addonId);
  }

  get _eventTargetKey() {
    return "storage";
  }
}
