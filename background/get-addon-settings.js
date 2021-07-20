chrome.storage.sync.get(["addonSettings", "addonsEnabled"], ({ addonSettings = {}, addonsEnabled = {} }) => {
  const func = () => {
    let madeAnyChanges = false;

    for (const { manifest, addonId } of scratchAddons.manifests) {
      // TODO: we should be using Object.create(null) instead of {}
      const settings = addonSettings[addonId] || {};
      let madeChangesToAddon = false;
      if (manifest.settings) {
        if (addonId === "discuss-button" && typeof settings.buttonName !== "undefined") {
          // Transition v1.16.0 modes to v1.17.0 settings
          madeChangesToAddon = true;
          madeAnyChanges = true;

          let option = manifest.settings.find((option) => option.id === "items");
          settings.items = option.default;
          settings.items.splice(3, 0, [settings.buttonName, "/discuss"]);
          if (settings.removeIdeasBtn) settings.items.splice(2, 1);

          settings.items = settings.items.map((item) => ({ name: item[0], url: item[1] }));
          delete settings.removeIdeasBtn;
          delete settings.buttonName;
        }

        for (const option of manifest.settings) {
          if (settings[option.id] === undefined) {
            madeChangesToAddon = true;
            madeAnyChanges = true;
            // Transition v1.16.5 to v1.17.0
            // Users of scratchr2 addon will get "scratchr2" version of old-studio-layout
            if (addonId === "old-studio-layout" && option.id === "version" && addonsEnabled.scratchr2) {
              settings.version = "scratchr2";
              continue;
            }
            settings[option.id] = option.default;
            if (option.type === "table") {
              settings[option.id] = settings[option.id].map((items) => {
                let setting = {};
                items.forEach((item, i) => (setting[option.row[i].name] = item));
                return setting;
              });
            }
          } else if (option.type === "positive_integer" || option.type === "integer") {
            // ^ else means typeof can't be "undefined", so it must be number
            if (typeof settings[option.id] !== "number") {
              // This setting was stringified, see #2142
              madeChangesToAddon = true;
              madeAnyChanges = true;
              const number = Number(settings[option.id]);
              // Checking if NaN just in case
              const newValue = Number.isNaN(number) ? option.default : number;
              settings[option.id] = newValue;
            }
          }
        }
      }

      if (addonsEnabled[addonId] === undefined) addonsEnabled[addonId] = !!manifest.enabledByDefault;

      if (madeChangesToAddon) {
        console.log(`Changed settings for addon ${addonId}`);
        addonSettings[addonId] = settings; // In case settings variable was a newly created object
      }
    }

    if (madeAnyChanges) chrome.storage.sync.set({ addonSettings, addonsEnabled });
    scratchAddons.globalState.addonSettings = addonSettings;
    scratchAddons.localState.addonsEnabled = addonsEnabled;
    scratchAddons.localState.ready.addonSettings = true;
  };

  if (scratchAddons.localState.ready.manifests) func();
  else scratchAddons.localEvents.addEventListener("manifestsReady", func);
});
