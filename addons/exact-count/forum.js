export default async function ({ addon, global, console, msg }) {
  for (let userbox of document.querySelectorAll(".postleft dl")) {
    if (userbox.childNodes[6].nodeValue.includes("+")) {
      fetch("https://scratchdb.lefty.one/v2/forum/user/info/" + userbox.querySelector("a").innerText)
        .then((response) => response.json())
        .then((data) => {
          userbox.childNodes[6].nodeValue = msg(
              data.counts.total.count == 1 ? "post" : "posts",
              {num: data.counts.total.count}
          )
        });
    }
  }
}
