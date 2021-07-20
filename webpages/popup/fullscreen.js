import loadVueComponent from "../../libraries/common/load-vue-components.js";
import loadPopup from "../popup-loader.js";

const addonId = location.search.substring(1);
let components = await loadVueComponent([
  {
    url: `popups/${addonId}/popup`,
    params: await loadPopup(addonId),
  },
]);

const vue = new Vue({
  el: "body",
  components,
  data: { addonId },
});
