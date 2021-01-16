(async function () {
  const folderNames = await (await fetch("/addons/addons.json")).json();
  await scratchAddons.l10n.load(folderNames);
  const useDefault = scratchAddons.l10n.locale.startsWith("en");
  for (const folderName of folderNames) {
    if (folderName.startsWith("//")) continue;
    const manifest = await (await fetch(`/addons/${folderName}/addon.json`)).json();
    if (manifest.l10n && !useDefault) {
      for (const prop of ["name", "description"]) {
        if (manifest[prop]) manifest[prop] = scratchAddons.l10n.get(`${folderName}/@${prop}`, {}, manifest[prop]);
      }
      if (manifest.info) {
        for (const info of manifest.info || []) {
          info.text = scratchAddons.l10n.get(`${folderName}/@info-${info.id}`, {}, info.text);
        }
      }
      if (manifest.popup) {
        manifest.popup.name = scratchAddons.l10n.get(`${folderName}/@popup-name`, {}, manifest.popup.name);
      }
    }

    for (const preset of manifest.presets || []) {
      for (const prop of ["name", "description"]) {
        if (manifest.l10n && preset[prop] && !useDefault) {
          preset[prop] = scratchAddons.l10n.get(`${folderName}/@preset-${prop}-${preset.id}`, {}, preset[prop]);
        }
      }
    }
    manifest.settings = handleSettings(manifest.settings);
    function handleSettings(settings) {
      for (const option of settings || []) {
        if (manifest.l10n && !useDefault) {
          option.name = scratchAddons.l10n.get(
            `${folderName}/@settings-name-${option.id}`,
            {
              commentIcon: "@comment.svg",
              forumIcon: "@forum.svg",
              heartIcon: "@heart.svg",
              starIcon: "@star.svg",
              followIcon: "@follow.svg",
              studioAddIcon: "@studio-add.svg",
              studioIcon: "@studio.svg",
              remixIcon: "@remix.svg",
            },
            option.name
          );
        }
        switch (option.type) {
          case "string":
            if (manifest.l10n && !useDefault) {
              option.default = scratchAddons.l10n.get(`${folderName}/@settings-default-${option.id}`, {}, option.default);
            }
            break;
          case "select":
            option.potentialValues = option.potentialValues.map((value) => {
              if (value && value.id) {
                if (manifest.l10n && !useDefault) {
                  value.name = scratchAddons.l10n.get(
                    `${folderName}/@settings-select-${option.id}-${value.id}`,
                    {},
                    value.name
                  );
                }
                return value;
              }
              return { name: value, id: value };
            });
            break;
          case "dynamic-length":
            for (let temp of option.template) {
              temp.name = scratchAddons.l10n.get(
                `${folderName}/@settings-dynamic-temp-${temp.id}`,
                {},
                temp.name
              );
            }
            for (let def of option.defaults) {
              def.forEach((item, i) => {
                if (item.id)
                  item = scratchAddons.l10n.get(
                    `${folderName}/@settings-dynamic-${option.id}-${item.id}`,
                    {},
                    item.value
                  );

                let defval = JSON.parse(JSON.stringify(option.template[i]));
                defval.default = item;
                def[i] = defval;
              });
            }
            console.log(option);
            break;
        }
      }
      return settings;
    }
    scratchAddons.manifests.push({ addonId: folderName, manifest });
  }
  scratchAddons.localState.ready.manifests = true;
  scratchAddons.localEvents.dispatchEvent(new CustomEvent("manifestsReady"));
})();
