export default async function ({ addon, global, console, msg }) {
  let wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const { redux } = addon.tab;
  let [, type, id] = location.pathname.split("/");

  if (type == "studios") {
    await redux.waitForState((state) => redux.state.studio.infoStatus == "FETCHED", {
      actions: ["SET_INFO"],
    });
  } else {
    await redux.waitForState((state) => state.preview.status.project === "FETCHED", {
      actions: ["SET_PROJECT_INFO"],
    });
  }

  const URL = `https://api.scratch.mit.edu/${
    type == "projects" ? `users/${redux.state.preview.projectInfo.author.username}/projects` : `studios`
  }/${id}/comments`;

  let getAllComments = () => [...redux.state.comments.comments];
  let getAllReplies = () => {
    let replies = [];

    for (let re of Object.values(redux.state.comments.replies)) {
      replies.push(...re);
    }

    return replies;
  };

  var newest = Date.now();

  while (true) {
    await wait(3000);
    var loopOffset = 40;
    var offset = -loopOffset;
    while (true) {
      offset += loopOffset;
      let res = await fetch(URL + `?offset=${offset}&limit=${loopOffset}`);
      let data = await res.json();

      let json = data.map((e) => {
        let time = new Date(e.datetime_created).getTime();
        if (time > newest) {
          return e;
        } else return undefined;
      });

      if (json.length == 0) return;
      let loadedComments = getAllComments().map((e) => e.id);

      for (let j in json) {
        let comment = json[j];
        if (!comment) continue;

        if (loadedComments.indexOf(comment.id) !== -1) {
          break;
        }

        redux.dispatch({ type: "ADD_NEW_COMMENT", comment });
      }

      if (json.length < loopOffset) break;
    }

    let comments = [...redux.state.comments.comments];

    for (let k in comments) {
      let comment = comments[k];
      offset = -loopOffset;
      while (true) {
        offset += loopOffset;
        let res = await fetch(URL + `/${comment.id}/replies?offset=${offset}&limit=${loopOffset}`);
        let data = await res.json();

        let json = data.map((e) => {
          let time = new Date(e.datetime_created).getTime();
          if (time > newest) {
            return e;
          } else return undefined;
        });

        if (json.length == 0) break;
        for (let reply of json) {
          if (!reply) continue;
          let loadedComments = getAllReplies().map((c) => c.id);

          if (loadedComments.indexOf(reply.id) !== -1) continue;

          redux.dispatch({ type: "ADD_NEW_COMMENT", comment: reply, topLevelCommentId: comment.id });
        }

        if (json.length < loopOffset) break;
      }
    }
  }
}
