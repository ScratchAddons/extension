export default async function ({ template }) {
  const ResetDropdown = Vue.extend({
    props: ["addon", "setting", "label", "defaultLabel"],
    template,
    data() {
      return {
        isResetDropdown: true,
        isOpen: false,
      };
    },
    ready() {
      this.$root.$on("close-reset-dropdowns", (except) => {
        if (this.isOpen && this !== except) {
          this.isOpen = false;
        }
      });
    },
    methods: {
      toggle() {
        this.isOpen = !this.isOpen;
        this.$root.closePickers({ isTrusted: true }, null, {
          callCloseDropdowns: false,
        });
        this.$root.closeResetDropdowns({ isTrusted: true }, this); // close other dropdowns
      },
      resetToDefault() {
        this.$parent.addonSettings[this.addon._addonId][this.setting.id] = this.setting.default;
        this.$parent.updateSettings(this.addon, { settingId: this.setting.id });
        this.toggle();
      },
      resetToPreset(preset) {
        this.$parent.addonSettings[this.addon._addonId][this.setting.id] = preset.values[this.setting.id];
        this.$parent.updateSettings(this.addon, { settingId: this.setting.id });
        this.toggle();
      },
    },
  });
  return { "reset-dropdown": ResetDropdown };
}
