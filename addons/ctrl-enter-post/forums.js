export default async function ({ addon }) {
  let type = location.pathname.split("/")[2];

  let textarea = document.querySelector(type == "settings" ? "#id_signature" : "#id_body");
  let postButton = document.querySelector(type == "topic" ? ".button.grey:nth-child(1)" : "button");

  textarea.addEventListener("keyup", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.code == "Enter" || e.code == "NumpadEnter")) {
      postButton.click();
    }
  });
}
