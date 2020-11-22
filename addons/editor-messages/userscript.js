export default async function ({ addon, global, console }) {
  const messages = document.createElement("a");
  messages.href = "/messages/";
  messages.title = addon.tab.scratchMessage("general.messages");
  messages.classList.add("sa-editormessages");
  let messageCount = document.createElement("span");
  messageCount.classList.add("sa-editormessages-count");
  messages.appendChild(messageCount);
  const setMessages = async () => {
    const msgCount = await addon.account.getMsgCount();
    messageCount.innerText = msgCount;
    if (msgCount == 0) {
      messageCount.setAttribute("style", `display: none;`);
    } else {
      messageCount.setAttribute("style", "");
    }
  };
  if (addon.tab.editorMode === "editor") {
    setMessages();
    setInterval(setMessages, 5000);
  } else {
    addon.tab.addEventListener("urlChange", function thisFunction() {
      if (addon.tab.editorMode === "editor") {
        setMessages();
        setInterval(setMessages, 5000);
        addon.tab.removeEventListener("urlChange", thisFunction);
      }
    });
  }

  while (true) {
    let nav = await addon.tab.waitForElement("[class^='menu-bar_account-info-group'] > [href^='/my']", {
      markAsSeen: true,
    });
    document.querySelector("[class^='menu-bar_account-info-group']").insertBefore(messages, nav);
  }
}
