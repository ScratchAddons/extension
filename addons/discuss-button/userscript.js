export default async function ({ addon, global, console }) {
  const searchItem = await addon.tab.waitForElement(".search", {
    markAsSeen: true,
    reduxCondition: (state) => {
      if (!state.scratchGui) return true;
      return state.scratchGui.mode.isPlayerOnly;
    },
  });
  const scratchr2List = document.querySelector(".site-nav");

  function createItem({ name, url }, last) {
    const li = document.createElement("li");
    li.className = "link";
    if (last) li.classList.add("last");

    const a = document.createElement("a");
    a.href = url.startsWith("javascript") ? "" : url;
    li.append(a);

    const span = document.createElement("span");
    span.innerText = name;
    a.append(span);

    return li;
  }
  function removeAllItems() {
    if (scratchr2List) {
      while (scratchr2List.firstChild) {
        scratchr2List.removeChild(scratchr2List.lastChild);
      }
      return;
    }
    while (!searchItem.previousSibling.classList.contains("logo")) {
      searchItem.previousSibling.remove();
    }
  }
  function init() {
    removeAllItems();
    let items = addon.settings.get("items");
    items.forEach((item, i) => {
      if (scratchr2List) {
        scratchr2List.append(createItem(item, i + 1 === items.length));
        return;
      }
      searchItem.parentElement.insertBefore(createItem(item), searchItem);
    });
  }
  init();
  addon.settings.addEventListener("change", init);
}
