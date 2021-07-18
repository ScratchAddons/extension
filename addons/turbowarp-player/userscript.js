export default async function ({ addon, console }) {
  let playerToggled = false;
  let scratchStage;
  let twIframe = document.createElement("iframe");
  twIframe.setAttribute("scrolling", "no");
  twIframe.setAttribute("allowtransparency", "true");
  twIframe.setAttribute("allowfullscreen", "true");
  twIframe.className = "sa-tw-iframe";

  const button = document.createElement("button");
  button.className = "button sa-tw-button";
  button.title = "TurboWarp";

  function removeIframe() {
    twIframe.remove();
    scratchStage.style.display = "";
    button.classList.remove("scratch");
  }

  button.onclick = () => {
    if (addon.settings.get("action") == "player") {
      playerToggled = !playerToggled;
      if (playerToggled) {
        let username = addon.auth.username ? "?username=" + addon.auth.username : "";
        twIframe.src = "//turbowarp.org/" + window.location.pathname.split("/")[2] + "/embed" + username;
        scratchStage.parentElement.prepend(twIframe);

        scratchStage.style.display = "none";
        button.classList.add("scratch");
        addon.tab.traps.vm.stopAll();
      } else removeIframe();
    } else {
      window.open("//turbowarp.org/" + window.location.pathname.split("/")[2], "_blank");
    }
  };

  let showAlert = true;
  while (true) {
    const seeInside = await addon.tab.waitForElement(".see-inside-button", {
      markAsSeen: true,
      reduxCondition: (state) => state.scratchGui.mode.isPlayerOnly,
    });

    seeInside.addEventListener("click", function seeInsideClick(event) {
      if (!playerToggled || !showAlert) return;

      if (confirm("Are you sure you want to see inside? Doing this will destroy the TurboWarp player.")) {
        showAlert = false;
      } else {
        event.stopPropagation();
      }
    });

    addon.tab.appendToSharedSpace({ space: "beforeRemixButton", element: button, order: 1 });

    scratchStage = document.querySelector(".guiPlayer");

    playerToggled = false;
    removeIframe();
  }
}
