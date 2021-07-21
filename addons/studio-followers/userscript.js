import { createModal, createUser } from "./lib.js";

export default async function ({ addon, global, console, msg }) {
  const { redux } = addon.tab;
  // Same waitForState as studio-tools
  await redux.waitForState(
    (state) => state.studio?.infoStatus === "FETCHED" && state.studio?.rolesStatus === "FETCHED",
    {
      actions: ["SET_INFO", "SET_ROLES"],
    }
  );
  const members = [...redux.state.managers.items, ...redux.state.curators.items].map((member) => member.username);

  // TODO: consider logging into another account within the same session, like studio-tools does
  const isOwner = redux.state.studio.owner === redux.state.session.session?.user?.id;
  const isManager = redux.state.studio.manager || isOwner;
  if (!isManager) return;
  const itemPageLimit = 28;
  const data = {
    followers: {
      offset: -itemPageLimit,
      activated: false,
      grid: null,
      gridScrollPosition: 0,
      moreButton: null,
      fetchedAll: false,
    },
    following: {
      offset: -itemPageLimit,
      activated: false,
      grid: null,
      gridScrollPosition: 0,
      moreButton: null,
      fetchedAll: false,
    },
  };
  let currentType = "followers";

  const modal = createModal(addon, msg("modal-title"), msg, (nextType) => {
    if (nextType === currentType) return;
    data[currentType].gridScrollPosition = data[currentType].grid.parentElement.scrollTop;
    data[nextType].grid.style.display = null;
    data[nextType].grid.parentElement.scrollTop = data[nextType].gridScrollPosition;
    if (!data[nextType].activated) {
      data[nextType].activated = true;
      loadData(nextType);
    }
    data[currentType].grid.style.display = "none";
    currentType = nextType;
  });

  document.body.appendChild(modal);

  data.followers.grid = modal.querySelector(".followers");
  data.following.grid = modal.querySelector(".following");

  let isFetching = false;
  async function loadData(type) {
    if (isFetching) return;
    if (data[type].fetchedAll) return;
    if (data[type].moreButton) data[type].moreButton.classList.add("mod-mutating");
    isFetching = true;
    data[type].offset += itemPageLimit;
    const res = await fetch(
      `https://api.scratch.mit.edu/users/${await addon.auth.fetchUsername()}/${type}?offset=${
        data[type].offset
      }&limit=${itemPageLimit}`
    );
    if (!res.ok) {
      // Cooldown in case something went wrong
      setTimeout(() => (isFetching = false), 1000);
    }
    const json = await res.json();
    const username = json.map((follower) => {
      const user = createUser(follower, addon, msg, members);
      data[type].grid.appendChild(user);
      return follower.username;
    });
    if (data[type].moreButton) data[type].moreButton.remove();
    if (json.length < itemPageLimit) data[type].fetchedAll = true;
    else if (data[type].grid.parentNode.getAttribute("data-scrollable") !== "true") {
      const moreButton = document.createElement("div");
      data[type].moreButton = moreButton;
      data[type].grid.appendChild(moreButton);
      moreButton.className = "studio-grid-load-more";
      const moreButtonInner = document.createElement("button");
      moreButton.appendChild(moreButtonInner);
      moreButtonInner.className = "button";
      moreButtonInner.innerText = addon.tab.scratchMessage("general.loadMore");
      moreButtonInner.addEventListener("click", (e) => {
        loadData(type);
        e.stopPropagation();
      });
    }
    isFetching = false;
    return username;
  }

  async function init() {
    let btn = document.getElementById("sa-studio-followers-btn");
    if (btn) {
      // Show button again
      btn.style.display = "";
      return;
    }

    btn = document.createElement("button");
    btn.className = "button";
    btn.id = "sa-studio-followers-btn";
    btn.innerText = msg("button");
    btn.addEventListener("click", () => {
      modal.style.display = modal.style.display === "none" ? null : "none";
      if (!data[currentType].activated) {
        data[currentType].activated = true;
        loadData(currentType);
      }
    });

    addon.tab.appendToSharedSpace({ space: "studioCuratorsTab", element: btn, order: 0 });
  }

  addon.tab.addEventListener("urlChange", (e) => {
    // Studios page dynamically changes the url
    if (location.pathname.split("/")[3] === "curators") {
      init();
    } else {
      let button = document.getElementById("sa-studio-followers-btn");
      if (button) button.style.display = "none";
    }
  });

  if (location.pathname.split("/")[3] === "curators") {
    init();
  }

  // Infinite scrolling

  function checkVisible(el, container) {
    const { bottom, height, top } = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
  }

  let flex = data.followers.grid.parentNode; // div.user-projects-modal-content

  flex.addEventListener(
    "scroll",
    (e) => {
      let els = Array.from(data[currentType].grid.childNodes);
      if (checkVisible(els[els.length - 1], flex) && flex.getAttribute("data-scrollable") === "true") {
        loadData(currentType);
      }
    },
    { passive: true }
  );
}
