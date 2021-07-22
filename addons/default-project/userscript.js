export default async function ({ addon, global, console, msg }) {
  addon.tab.addEventListener("urlChange", function main(e) {
    // We need to wait until we get a project id
    let id = location.pathname.replace(/\/projects\/([0-9]+)\/(.*)/g, "$1");

    if (!addon.tab.traps.vm || !id) return;

    addon.tab.traps.vm.downloadProjectId(addon.settings.get("projectId"));
  });
}
