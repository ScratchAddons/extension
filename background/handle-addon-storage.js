scratchAddons.methods.getAddonStorage = (addonId) =>
  new Promise((resolve) => handleMsg({ getAddonStorage: { addonId } }, resolve));
scratchAddons.methods.setAddonStorage = (addonId, storageDiff) =>
  new Promise((resolve) => handleMsg({ setAddonStorage: { addonId, storageDiff } }, resolve));
scratchAddons.methods.clearAddonStorage = (addonId) =>
  new Promise((resolve) => handleMsg({ clearAddonStorage: { addonId } }, resolve));

async function handleMsg(request, sendResponse) {
  if (request.getAddonStorage) {
    sendResponse((await getStorage())[request.getAddonStorage.addonId] || {});
  } else if (request.setAddonStorage) {
    let storage = await getStorage();
    storage[request.setAddonStorage.addonId] = {
      ...(storage[request.setAddonStorage.addonId] || {}),
      ...request.setAddonStorage.storageDiff,
    };
    chrome.storage.sync.set({ addonStorage: storage }, sendResponse);
  } else if (request.clearAddonStorage) {
    let storage = await getStorage();
    storage[request.clearAddonStorage.addonId] = {};
    chrome.storage.sync.set({ addonStorage: storage }, sendResponse);
  }
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMsg(request, sendResponse);
  return true;
});
function getStorage() {
  return new Promise((resolve, reject) =>
    chrome.storage.sync.get(["addonStorage"], (storage) => resolve(storage.addonStorage || {}))
  );
}
