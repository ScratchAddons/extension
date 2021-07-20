import loadVueComponent from "../../libraries/common/load-vue-components.js";

(async () => {
  let components = await loadVueComponent(["webpages/settings/component"]);

  vue = window.vue = new Vue({
    el: "body",
    components,
  });
})();
