export default async function ({ addon, global, console, msg }) {
  let isScratchR2 = addon.tab.clientVersion == "scratchr2";

  let textboxSelector = isScratchR2 ? "textarea[name='content']" : "[name='compose-comment']";

  while (true) {
    let textbox = await addon.tab.waitForElement(textboxSelector, { markAsSeen: true });
    var button;
    if (isScratchR2) {
      button = textbox.parentNode.parentNode.querySelector(".control-group:not(.tooltip) div[data-control='post'] a");
    } else {
      button = textbox.parentNode.parentNode.parentNode.querySelector(".compose-bottom-row .compose-post");
    }

    textbox.addEventListener("keyup", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.code == "Enter" || e.code == "NumpadEnter")) {
        button.click();
      }
    });
  }
}
