import tags from "../data/tags.js";

const isIframe = window.parent !== window;

export default async function ({ template }) {
  const AddonTag = Vue.extend({
    props: ["tag"],
    template,
    data() {
      return {};
    },
    computed: {
      tagInfo() {
        // Might return undefined, tag might not exist
        return tags.find((tag) => tag.matchName === this.tag);
      },
      shouldShow() {
        if (isIframe) return this.tagInfo && this.tagInfo.iframeAlwaysShow;
        return this.tagInfo && (!this.tagInfo.addonTabShow || this.tagInfo.addonTabShow[this.$root.selectedCategory]);
      },
      tagName() {
        return chrome.i18n.getMessage(this.tagInfo.name);
      },
      tagTooltip() {
        return chrome.i18n.getMessage(this.tagInfo.tooltipText);
      },
    },
  });
  return { "addon-tag": AddonTag };
}
