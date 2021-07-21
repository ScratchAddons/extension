export default async ({ addon, console, msg }) => {
  const { redux } = addon.tab;
  await redux.waitForState(
    (state) => state.studio?.infoStatus === "FETCHED" && state.studio?.rolesStatus === "FETCHED",
    // In vanilla SET_FETCH_STATUS is only used for "bad status",
    // so we can ignore.
    {
      actions: ["SET_INFO", "SET_ROLES"],
    }
  );

  const studioId = redux.state.studio.id;

  const MAX_MANAGERS = 40;

  let isOwner = false;
  let isManager = false;
  let isCurator = false;
  let canLeave = false;
  const checkPermissions = () => {
    isOwner = redux.state.studio.owner === redux.state.session.session?.user?.id;
    isManager = redux.state.studio.manager || isOwner;
    isCurator = redux.state.studio.curator;
    canLeave = (isCurator || isManager) && !isOwner;
  };
  checkPermissions();

  const makeAdder = (headerMsg, btnMsg, cb, optDisable) => {
    const disabledMessage = optDisable && optDisable();

    const adderSec = document.createElement("div");
    adderSec.className = "studio-adder-section";

    const adderHeader = document.createElement("h3");
    const adderHeaderSpan = document.createElement("span");
    adderHeaderSpan.textContent = msg(headerMsg);
    adderHeader.appendChild(adderHeaderSpan);
    adderSec.appendChild(adderHeader);

    const adderRow = document.createElement("div");
    adderRow.className = "studio-adder-row";

    const inputTag = document.createElement("input");
    inputTag.type = "text";
    inputTag.placeholder = msg("username");
    adderRow.appendChild(inputTag);

    const btn = document.createElement("button");
    btn.className = "button";
    btn.title = msg("added-by");

    const btnSpan = document.createElement("span");
    btnSpan.textContent = msg(btnMsg);
    btn.addEventListener("click", () => {
      inputTag.setAttribute("disabled", true);
      cb(inputTag.value.trim());
      inputTag.removeAttribute("disabled");
    });

    if (disabledMessage) {
      inputTag.setAttribute("disabled", true);
      btn.setAttribute("disabled", true);
      inputTag.title = disabledMessage;
    }

    btn.appendChild(btnSpan);
    adderRow.appendChild(btn);
    adderSec.appendChild(adderRow);
    return adderSec;
  };

  const isOkay = (r, optResult) => {
    let err = "";
    if (r.status >= 500) err = "server-down";
    else if (r.status >= 300) err = "unknown-error";
    switch (r.status) {
      case 404: {
        err = "not-curator";
        break;
      }
      case 401:
      case 403: {
        err = "401";
        break;
      }
      case 400: {
        if (optResult?.message === "too many owners") {
          err = "too-many-managers";
          break;
        }
      }
    }
    if (err) {
      alert(msg(err));
      return false;
    }
    return true;
  };
  let leaveSection = null;
  let pSec = null;
  let rSec = null;
  const render = () => {
    leaveSection?.remove();
    pSec?.remove();
    rSec?.remove();
    const tabName = location.pathname.split("/")[3];
    if (isManager && tabName === "curators") {
      pSec = makeAdder(
        "promote-new",
        "promote-btn",
        async (u) => {
          if (!/^[\w-]{3,20}$/g.test(u)) return alert(msg("invalid-username"));
          const r = await fetch(`/site-api/users/curators-in/${studioId}/promote/?usernames=${u}`, {
            method: "PUT",
            credentials: "include",
            headers: {
              "X-CSRFToken": addon.auth.csrfToken,
            },
          });
          let result = await r.text();
          try {
            // Can sometimes fail so we don't really care
            result = JSON.parse(result);
          } catch (e) {}
          if (!isOkay(r, result)) return;
          alert(msg("promoted", { username: u }));
          // we don't bother updating redux ourselves
          location.reload();
        },
        () => {
          if (redux.state.studio.managers < MAX_MANAGERS) return null;
          return msg("max-managers-reached", { max: MAX_MANAGERS });
        }
      );

      rSec = makeAdder("remove-new", "remove-btn", async (u) => {
        if (!/^[\w-]{3,20}$/g.test(u)) return alert(msg("invalid-username"));
        const r = await fetch(`/site-api/users/curators-in/${studioId}/remove/?usernames=${u}`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "X-CSRFToken": addon.auth.csrfToken,
          },
        });
        if (!isOkay(r)) return;
        alert(msg("removed", { username: u }));
        // we don't bother updating redux ourselves
        location.reload();
      });

      addon.tab.appendToSharedSpace({ space: "studioCuratorsTab", element: pSec, order: 1 });
      addon.tab.appendToSharedSpace({ space: "studioCuratorsTab", element: rSec, order: 2 });
    }

    if (canLeave) {
      /*<button class="button x-button studio-follow-button"><span>Follow Studio</span></button>*/
      leaveSection = document.createElement("div");
      leaveSection.className = "studio-info-section sa-leave-section";

      let leaveBtn = document.createElement("button");
      leaveBtn.className = "button sa-leave-button";
      leaveBtn.title = msg("added-by");
      leaveSection.appendChild(leaveBtn);

      const leaveSpan = document.createElement("span");
      leaveSpan.textContent = msg("leave-new");
      leaveBtn.appendChild(leaveSpan);

      leaveBtn.addEventListener("click", async () => {
        if (!confirm(msg("leave-confirm"))) return;
        const u = await addon.auth.fetchUsername();
        const r = await fetch(`/site-api/users/curators-in/${studioId}/remove/?usernames=${u}`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "X-CSRFToken": addon.auth.csrfToken,
          },
        });
        if (!isOkay(r)) return;
        // we don't bother updating redux ourselves
        location.reload();
      });

      const studioInfo = document.querySelector(".studio-info");
      const followButton = document.querySelector(".studio-follow-button");
      studioInfo.insertBefore(leaveSection, followButton.parentNode.nextSibling);
    }
  };
  render();
  addon.tab.addEventListener("urlChange", render);
  redux.addEventListener("statechanged", (e) => {
    if (e.detail.action.type === "SET_ROLES") {
      checkPermissions();
      render();
    }
  });
};
