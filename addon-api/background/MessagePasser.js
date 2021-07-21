/**
 * Handles message passing for background scripts.
 */

export default class MessagePasser extends EventTarget {
  constructor(addonObject) {
    super();
    this._addonId = addonObject.self.id;

    let self = this;

    function runMessageListeners(message, sender, sendResponse) {
      self.dispatchEvent(
        Object.assign(new CustomEvent("message", {}), {
          message,
          sender,
          sendResponse,
        })
      );
    }

    function runConnectListeners(port) {
      self.dispatchEvent(
        Object.assign(new CustomEvent("connect", {}), {
          port,
        })
      );
    }

    chrome.runtime.onMessage.addListener((m, { url = "" }, sr) => {
      if (!m.addonMessage) return;
      let { payload, addonId } = m;

      if (addonId !== self._addonId) return;

      runMessageListeners(
        payload,
        {
          addonId,
          id: addonId,
          url,
        },
        sr
      );
    });

    chrome.runtime.onConnect.addListener(function (port) {
      try {
        JSON.parse(port.name);
      } catch {
        return;
      }
      const data = JSON.parse(port.name);
      if (data.addonId !== self._addonId) return;
      if (!data.addonConnect) return;

      runConnectListeners(new Port(port, data.name));
    });
  }
}

class Port extends EventTarget {
  constructor(port, name) {
    super();
    this._port = port;
    this.name = name;

    let self = this;

    this._port.onMessage.addListener(function (message) {
      self.dispatchEvent(
        Object.assign(new CustomEvent("message", {}), {
          message,
        })
      );
    });

    this._port.onDisconnect.addListener(function () {
      self.dispatchEvent(new CustomEvent("disconnect", {}));
    });
  }

  disconnect() {
    this._port.disconnect();
  }

  postMessage(...a) {
    this._port.postMessage(...a);
  }
}
