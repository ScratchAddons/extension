/**
 * Handles message passing. Mimics chrome.runtime message passing.
 */

export default class MessagePasser {
  constructor(addonObject) {
    this._addonId = addonObject.id;
  }

  sendMessage(message, callback) {
    let self = this;

    chrome.runtime.sendMessage(
      {
        addonId: self._addonId,
        payload: message,
        addonMessage: true,
      },
      callback
    );
  }

  connect({ name = "" } = {}) {
    return new Port(name, this._addonId);
  }
}

class Port extends EventTarget {
  constructor(name, addonId) {
    super();
    this.name = name;

    this._port = chrome.runtime.connect({
      name: JSON.stringify({
        addonConnect: true,
        name,
        addonId,
      }),
    });

    let self = this;

    function runMessageListeners(message) {
      self.dispatchEvent(Object.assign(new CustomEvent("message", {}), { message }));
    }

    function runDisconnectListeners() {
      self.dispatchEvent(new CustomEvent("disconnect", {}));
    }

    this._port.onMessage.addListener(function (m) {
      runMessageListeners(m);
    });

    this._port.onDisconnect.addListener(function () {
      runDisconnectListeners();
    });
  }

  disconnect() {
    this._port.disconnect();
  }

  postMessage(...a) {
    this._port.postMessage(...a);
  }
}
