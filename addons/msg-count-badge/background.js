export default async function ({ addon, global, console, setTimeout, setInterval, clearTimeout, clearInterval }) {
  const setBadge = async () => {
    const msgCount = await addon.account.getMsgCount();
    addon.badge.text = msgCount;
  };
  setBadge();
  addon.badge.color = addon.settings.get("color");
  addon.settings.addEventListener("change", () => {
    addon.badge.color = addon.settings.get("color");
  });
  setInterval(setBadge, 60_000);
}
