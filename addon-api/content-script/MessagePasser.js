/**
 * Handles message passing for content scripts.
 */

export default class MessagePasser {
  constructor(addonObject) {
    this._addonId = addonObject.id;
  }

  sendMessage(message, callback) {
    let self = this;
    let mid = getuid();

    window.postMessage({
      addonId: self._addonId,
      payload: message,
      fromBackground: false,
      addonMessage: true,
      response: false,
      messageId: mid,
    });

    function onMessage(e) {
      if (!e.data.addonMessage) return;

      const {
        data: { payload, fromBackground, messageId },
      } = e;

      if (!fromBackground) return;
      if (messageId !== mid) return;

      window.removeEventListener("message", onMessage);

      callback(payload);
    }

    window.addEventListener("message", onMessage);
  }

  connect({ name = "" } = {}) {
    return new Port(name, this._addonId);
  }
}

class Port extends EventTarget {
  constructor(name, addonId) {
    super();
    this.name = name;
    this._portId = getuid();

    window.postMessage({
      addonConnect: true,
      name,
      portId: this._portId,
      addonId,
    });

    let self = this;

    function runMessageListeners(message) {
      self.dispatchEvent(Object.assign(new CustomEvent("message", {}), { message }));
    }

    function runDisconnectListeners() {
      self.dispatchEvent(new CustomEvent("disconnect", {}));
    }

    window.addEventListener(
      "message",
      (e) => {
        if (!e.data.addonPortMessage) return;
        if (!e.data.fromBackground) return;
        if (e.data.portId !== self._portId) return;

        if (e.data.disconnect) return runDisconnectListeners();

        runMessageListeners(e.data.payload);
      },
      false
    );
  }

  postMessage(m) {
    window.postMessage({
      portId: this._portId,
      payload: m,
      addonPortMessage: true,
    });
  }

  disconnect() {
    window.postMessage({
      portId: this._portId,
      disconnect: true,
      addonPortMessage: true,
    });
  }
}

function getuid() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-_=+{}[]()";
  const length = 20;

  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.round(Math.random() * chars.length)];
  }

  return id;
}
