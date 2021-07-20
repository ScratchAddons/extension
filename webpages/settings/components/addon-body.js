import loadVueComponent from "../../../libraries/common/load-vue-components.js";

const isIframe = window.parent !== window;

export default async function ({ template }) {
  let components = await loadVueComponent([
    "webpages/settings/components/addon-setting",
    "webpages/settings/components/addon-tag",
  ]);

  const AddonBody = Vue.extend({
    props: ["addon", "groupId", "groupExpanded", "visible"],
    template,
    components,
    data() {
      return {
        expanded: this.getDefaultExpanded(),
        everExpanded: this.getDefaultExpanded(),
      };
    },
    computed: {
      shouldShow() {
        return this.visible && (this.$root.searchInput === "" ? this.groupExpanded : true);
      },
      addonIconSrc() {
        const map = {
          editor: "puzzle",
          community: "web",
          theme: "brush",
          easterEgg: "egg-easter",
          popup: "popup",
        };
        return `../../images/icons/${map[this.addon._icon]}.svg`;
      },
      addonSettings() {
        return this.$root.addonSettings;
      },
    },
    methods: {
      getDefaultExpanded() {
        return isIframe ? false : this.groupId === "enabled";
      },
      devShowAddonIds(event) {
        if (!this.$root.versionName.endsWith("-prerelease") || !event.ctrlKey) return;
        event.stopPropagation();
        Vue.set(this.addon, "_displayedAddonId", this.addon._addonId);
      },
      loadPreset(preset) {
        if (window.confirm(chrome.i18n.getMessage("confirmPreset"))) {
          for (const property of Object.keys(preset.values)) {
            this.$root.addonSettings[this.addon._addonId][property] = preset.values[property];
          }
          this.$root.updateSettings(this.addon);
          console.log(`Loaded preset ${preset.id} for ${this.addon._addonId}`);
        }
      },
      loadDefaults() {
        if (window.confirm(chrome.i18n.getMessage("confirmReset"))) {
          for (const property of this.addon.settings) {
            this.$root.addonSettings[this.addon._addonId][property.id] = property.default;
          }
          this.$root.updateSettings(this.addon);
          console.log(`Loaded default values for ${this.addon._addonId}`);
        }
      },
      toggleAddonRequest(event) {
        const toggle = () => {
          // Prevents selecting text when the shift key is being held down
          event.preventDefault();

          const newState = !this.addon._enabled;
          this.addon._wasEverEnabled = this.addon._enabled || newState;
          this.addon._enabled = newState;
          // Do not extend when enabling in popup mode, unless addon has warnings
          this.expanded =
            isIframe && !this.expanded && (this.addon.info || []).every((item) => item.type !== "warning")
              ? false
              : event.shiftKey
              ? false
              : newState;
          chrome.runtime.sendMessage({ changeEnabledState: { addonId: this.addon._addonId, newState } });
        };

        const requiredPermissions = (this.addon.permissions || []).filter((value) =>
          this.$root.browserLevelPermissions.includes(value)
        );
        if (!this.addon._enabled && this.addon.tags.includes("danger")) {
          const confirmation = confirm(chrome.i18n.getMessage("dangerWarning", [this.addon.name]));
          if (!confirmation) return;
        }
        if (!this.addon._enabled && requiredPermissions.length) {
          const result = requiredPermissions.every((p) => this.$root.grantedOptionalPermissions.includes(p));
          if (result === false) {
            if (isIframe) {
              this.$root.addonToEnable = this.addon;
              document.querySelector(".popup").style.animation = "dropDown 1.6s 1";
              this.$root.showPopupModal = true;
            } else
              chrome.permissions.request(
                {
                  permissions: requiredPermissions,
                },
                (granted) => {
                  if (granted) {
                    console.log("Permissions granted!");
                    toggle();
                  }
                }
              );
          } else toggle();
        } else toggle();
      },
      msg(...params) {
        return this.$root.msg(...params);
      },
    },
    watch: {
      groupId(newValue) {
        // Happens when going from "example" addon to real addon
        this.expanded = this.getDefaultExpanded();
      },
      searchInput(newValue) {
        if (newValue === "") this.expanded = this.getDefaultExpanded();
        else this.expanded = false;
      },
      expanded(newValue) {
        if (newValue === true) this.everExpanded = true;
      },
    },
  });
  return { "addon-body": AddonBody };
}
