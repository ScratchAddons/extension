export default async function ({ template }) {
  const ColorInput = Vue.extend({
    props: ["value", "addon", "setting", "no_alpha"],
    template,
    data() {
      return {
        isOpen: false,
        color: this.value,
        canCloseOutside: false,
        formats: "",
        opening: false,
        loadColorPicker: false, // #2090 tempfix
      };
    },
    ready() {
      if (!this.loadColorPicker) return;
      if (this.no_alpha) {
        this.formats = "hex,rgb,hsv,hsl";
      } else {
        this.formats = "hex,hex8,rgb,hsv,hsl";
      }
      this.$els.pickr.addEventListener("input", (e) => {
        this.color = "#" + e.detail.value;
        if (this.value !== this.color) {
          this.$parent.addonSettings[this.addon._addonId][this.setting.id] = "#" + this.$els.pickr.hex8;
          this.$parent.updateSettings(this.addon, { wait: 250, settingId: this.setting.id });
        }
      });
      this.$root.$on("close-pickers", (except) => {
        if (this.isOpen && this !== except) {
          const addon = this.$parent.addon;
          const setting = this.$parent.setting;
          this.toggle(addon, setting, false, {
            // I trust callers
            callCloseDropdowns: false,
            callClosePickers: false,
          });
        }
      });
    },
    computed: {
      noAlphaString() {
        return String(this.no_alpha);
      },
    },
    methods: {
      toggle(addon, setting, value = !this.isOpen, { callCloseDropdowns = true, callClosePickers = true } = {}) {
        if (!this.loadColorPicker) return;
        this.isOpen = value;
        this.opening = true;
        if (callClosePickers)
          this.$root.closePickers({ isTrusted: true }, this, {
            callCloseDropdowns: false,
          });
        if (callCloseDropdowns) this.$root.closeResetDropdowns({ isTrusted: true }); // close other dropdowns
        this.opening = false;
        this.$els.pickr._valueChanged();
        this.color = "#" + this.$els.pickr.hex8;
        if (this.value !== this.color) {
          this.$parent.addonSettings[addon._addonId][setting.id] = "#" + this.$els.pickr.hex8;
          this.$parent.updateSettings(addon, { wait: 250, settingId: setting.id });
        }
        this.canCloseOutside = false;
        setTimeout(() => {
          this.canCloseOutside = true;
        }, 0);
      },
    },
    watch: {
      value() {
        this.color = this.value;
        // ?. is #2090 tempfix, 4 lines below as well
        this.$els.pickr?._valueChanged();
      },
      isOpen() {
        this.$els.pickr?._valueChanged();
      },
      loadColorPicker() {
        this.$options.ready[0].call(this);
      },
    },
  });
  return { picker: ColorInput };
}
