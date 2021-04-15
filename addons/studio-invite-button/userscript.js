export default async function ({ addon, global, console }) {
  // RegExp to test for a valid url and get the studio id
  const urlRegex = /^https?:\/\/scratch\.mit\.edu\/studios\/(\d+)\/comments($|\/)/;
  // invites a user to the studio
  function inviteToStudio(user) {
    return fetch(
      `https://scratch.mit.edu/site-api/users/curators-in/${
        urlRegex.exec(window.location.href)[1]
      }/invite_curator/?usernames=${user}`,
      {
        headers: {
          "x-csrftoken": addon.auth.csrfToken,
          "x-requested-with": "XMLHttpRequest",
          referer: "https://scratch.mit.edu",
        },
        body: null,
        method: "PUT",
      }
    );
  }
  // checks if the user is a manager and the URL is correct
  if (document.getElementById("description").classList.contains("editable") && urlRegex.test(window.location.href)) {
    Array.from(document.getElementsByClassName("comment")).forEach((comment) => {
      const inviteButton = document.createElement("span"); // create the button
      inviteButton.innerText = "Invite";
      inviteButton.classList.add("actions");
      inviteButton.style.visibility = "hidden";
      inviteButton.style.color = "rgb(157, 157, 157)";

      comment.querySelector(".actions-wrap").appendChild(inviteButton);
      comment.addEventListener("mouseover", () => {
        inviteButton.style.visibility = "visible"; // should only be visible when the mouse is hovering over the comment
      });
      comment.addEventListener("mouseout", () => {
        inviteButton.style.visibility = "hidden";
      });
      const listener = inviteButton.addEventListener("click", () => {
        inviteToStudio(comment.querySelector(".name").textContent.trim())
          .then((resp) => resp.text())
          .then((resp) => {
            try {
              const parsed = JSON.parse(resp);
              // handle the different possible responses
              if (parsed.status === "success") {
                inviteButton.innerHTML = "Invited!";
              } else if (parsed.message.endsWith("is already a curator of this studio")) {
                inviteButton.innerHTML = "This user is already a curator";
              } else {
                throw Error(0);
              }
            } catch (err) {
              inviteButton.innerHTML = "Whoops, something went wrong";
            }
            comment.querySelector(".reply").click();
            inviteButton.style.fontWeight = "bold";
            inviteButton.removeEventListener("click", listener);
            inviteButton.classList.remove("actions"); // after it's clicked it can't be clicked again
          });
      });
    });
  }
}
