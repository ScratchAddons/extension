export default async function ({ addon, global, console }) {
  fetch("https://api.scratch.mit.edu" + document.location.pathname).then(function(response) {
    return response.json()
  }).then(function(text) {
    while(true) {
      const element = await addon.tab.waitForElement(".share-date", {markAsSeen:true});
      let dateMod = new Date(text.history.modified)
    element.setAttribute("title", `Modified: ${dateMod.toLocaleString('en-us',{month:'short'})} ${dateMod.getDay()}, ${dateMod.getFullYear()}`)
    }
  });
}
