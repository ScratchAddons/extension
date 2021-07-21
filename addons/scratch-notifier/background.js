import commentEmojis from "./comment-emojis.js";

export default async function ({ addon, global, console, setTimeout, setInterval, clearTimeout, clearInterval, msg }) {
  let msgCount = null;
  let lastDateTime = null;
  let lastAuthChange; // Used to check if auth changed while waiting for promises to resolve
  const emojis = {
    addcomment: "comment",
    forumpost: "forum",
    loveproject: "heart",
    favoriteproject: "star",
    followuser: "follow",
    curatorinvite: "studio-add",
    remixproject: "remix",
    studioactivity: "studio",
    becomeownerstudio: "adminusers",
  };

  checkCount();
  setInterval(checkCount, 5000);

  async function checkCount() {
    if (!(await addon.auth.fetchIsLoggedIn())) return;
    const previousLastAuthChange = lastAuthChange;
    const newCount = await addon.account.getMsgCount();
    if (previousLastAuthChange !== lastAuthChange) return;
    if (newCount === null) return;
    if (msgCount !== newCount) {
      const oldMsgCount = msgCount;
      msgCount = newCount;
      if (msgCount !== oldMsgCount) checkMessages();
    }
  }

  async function notifyMessage({
    emoji,
    messageType,
    actor,
    fragment,
    commentee,
    commentUrl,
    title,
    element_id,
    parent_title,
  }) {
    let text = "";
    let url;
    if (messageType.startsWith("addcomment/")) {
      url = commentUrl;
      if (title.length > 20) title = `${title.substring(0, 17).trimEnd()}...`;
      var notificationTitle;
      switch (messageType.split("/")[1]) {
        case "ownProjectNewComment":
          notificationTitle = msg("notif-own-project", { actor, title });
          text = fragment;
          break;
        case "projectReplyToSelf":
          notificationTitle = msg("notif-project-reply", { actor, title });
          text = fragment;
          break;
        case "ownProjectReplyToOther":
          notificationTitle = msg("notif-own-project-reply", { actor, commentee, title });
          text = fragment;
          break;
        case "ownProfileNewComment":
          notificationTitle = msg("notif-profile", { actor });
          text = fragment;
          break;
        case "ownProfileReplyToSelf":
          notificationTitle = msg("notif-own-profile-reply", { actor });
          text = fragment;
          break;
        case "ownProfileReplyToOther":
          notificationTitle = msg("notif-own-profile-reply-other", { actor, commentee });
          text = fragment;
          break;
        case "otherProfileReplyToSelf":
          notificationTitle = msg("notif-profile-reply", { actor, title });
          text = fragment;
          break;
        case "studio":
          notificationTitle = msg("notif-studio-reply", { actor, title });
          text = fragment;
          break;
        default:
          notificationTitle = msg("notif-comment");
          break;
      }
    } else {
      switch (messageType) {
        case "forumpost":
          notificationTitle = msg("notif-forum", { title });
          url = `https://scratch.mit.edu/discuss/topic/${element_id}/unread/`;
          break;
        case "loveproject":
          notificationTitle = msg("notif-love", { actor, title });
          url = `https://scratch.mit.edu/users/${actor}/`;
          break;
        case "favoriteproject":
          notificationTitle = msg("notif-fav", { actor, title });
          url = `https://scratch.mit.edu/users/${actor}/`;
          break;
        case "followuser":
          notificationTitle = msg("notif-follow", { actor });
          url = `https://scratch.mit.edu/users/${actor}/`;
          break;
        case "curatorinvite":
          notificationTitle = msg("notif-invite", { actor, title });
          url = `https://scratch.mit.edu/studios/${element_id}/curators/`;
          break;
        case "becomeownerstudio":
          notificationTitle = msg("notif-promotion", { actor, title });
          url = `https://scratch.mit.edu/studios/${element_id}/curators/`;
          break;
        case "remixproject":
          notificationTitle = msg("notif-remix", { actor, parent_title, title });
          url = `https://scratch.mit.edu/projects/${element_id}/`;
          break;
        case "studioactivity":
          notificationTitle = msg("notif-studio", { title });
          url = `https://scratch.mit.edu/studios/${element_id}/activity`;
          break;
        default:
          notificationTitle = msg("notif-generic");
          break;
      }
    }

    const soundSetting = addon.settings.get("notification_sound");
    if (soundSetting === "addons-ping") new Audio(addon.self.dir + "/ping.mp3").play();

    const notifId = await addon.notifications.create({
      type: "basic",
      title: notificationTitle,
      iconUrl: emoji ? `../../images/icons/${emoji}.svg` : "/images/icon.png",
      message: text,
      buttons: [
        {
          title: msg("open"),
        },
        {
          title: msg("clear"),
        },
      ],
      silent: soundSetting === "system-default" ? false : true,
    });
    if (!notifId) return;
    const onClick = (e) => {
      if (e.detail.id === notifId) {
        chrome.tabs.create({ url });
        addon.notifications.clear(notifId);
        if (addon.settings.get("mark_as_read_when_clicked") === true) markAsRead();
      }
    };
    const onButtonClick = (e) => {
      if (e.detail.id === notifId) {
        if (e.detail.buttonIndex === 0) openMessagesPage();
        else markAsRead();
        addon.notifications.clear(notifId);
      }
    };
    addon.notifications.addEventListener("click", onClick);
    addon.notifications.addEventListener("buttonclick", onButtonClick);
    addon.notifications.addEventListener(
      "close",
      (e) => {
        if (e.detail.id === notifId) {
          addon.notifications.removeEventListener("click", onClick);
          addon.notifications.removeEventListener("buttonclicked", onButtonClick);
        }
      },
      { once: true }
    );
  }

  async function openMessagesPage() {
    chrome.tabs.query(
      {
        url: "https://scratch.mit.edu/messages*",
      },
      (tabs) => {
        if (tabs[0]) {
          chrome.windows.update(tabs[0].windowId, {
            focused: true,
          });
          chrome.tabs.update(tabs[0].id, {
            active: true,
            url: "https://scratch.mit.edu/messages/",
          });
        } else {
          chrome.tabs.create({
            url: "https://scratch.mit.edu/messages/",
          });
        }
        msgCount = 0;
      }
    );
  }

  function markAsRead() {
    addon.account.clearMessages();
    msgCount = 0;
  }

  async function checkMessages() {
    const username = await addon.auth.fetchUsername();
    const previousLastAuthChange = lastAuthChange;
    const messages = await addon.account.getMessages();
    if (lastAuthChange !== previousLastAuthChange) return;
    if (messages === null) return;
    if (lastDateTime === null) lastDateTime = new Date(messages[0].datetime_created).getTime();
    else {
      for (const message of messages) {
        if (new Date(message.datetime_created).getTime() <= lastDateTime) break;
        let messageType = message.type;
        let commentUrl;
        if (message.type === "addcomment") {
          messageType += "/";
          if (message.comment_type === 0) {
            // Project comment
            const replyFor = message.commentee_username;
            if (replyFor === null) messageType += "ownProjectNewComment";
            else if (replyFor === username) messageType += "projectReplyToSelf";
            else messageType += "ownProjectReplyToOther";
            commentUrl = `https://scratch.mit.edu/projects/${message.comment_obj_id}/#comments-${message.comment_id}`;
          } else if (message.comment_type === 1) {
            const profile = message.comment_obj_title;
            const replyFor = message.commentee_username;
            if (profile === username) {
              if (replyFor === null) messageType += "ownProfileNewComment";
              else if (replyFor === username) messageType += "ownProfileReplyToSelf";
              else messageType += "ownProfileReplyToOther";
            } else {
              messageType += "otherProfileReplyToSelf";
            }
            commentUrl = `https://scratch.mit.edu/users/${message.comment_obj_title}/#comments-${message.comment_id}`;
          } else if (message.comment_type === 2) {
            messageType += "studio";
            commentUrl = `https://scratch.mit.edu/studios/${message.comment_obj_id}/comments/#comments-${message.comment_id}`;
          }
        }

        // Return if this notification type is muted
        if (message.type === "addcomment") {
          if (
            messageType === "addcomment/ownProjectNewComment" ||
            messageType === "addcomment/ownProjectReplyToOther"
          ) {
            if (addon.settings.get("commentsonmyprojects_notifications") === false) continue;
          } else {
            if (addon.settings.get("commentsforme_notifications") === false) continue;
          }
        } else {
          try {
            if (addon.settings.get(`${message.type}_notifications`) === false) continue;
          } catch {
            // If setting doesn't exist
            console.warn(`Unexpected message type: ${message.type}`);
            continue;
          }
        }

        const messageInfo = {
          emoji: emojis[message.type],
          messageType,
          actor: message.actor_username,
          fragment: htmlToText(message.comment_fragment), // Comments only
          commentee: message.commentee_username, // Comments only
          commentUrl, // Comments only
          title:
            message.comment_obj_title ||
            message.topic_title ||
            message.title ||
            message.project_title ||
            message.gallery_title,
          element_id: message.comment_id || message.gallery_id || message.project_id || message.topic_id,
          parent_title: message.parent_title, // Remixes only
        };
        notifyMessage(messageInfo);
      }
      lastDateTime = new Date(messages[0].datetime_created).getTime();
    }
  }

  function htmlToText(html) {
    if (html === undefined) return;
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    let value = txt.value;
    const matches = value.match(/<img([\w\W]+?)[\/]?>/g);
    if (matches) {
      for (const match of matches) {
        const src = match.match(/\<img.+src\=(?:\"|\')(.+?)(?:\"|\')(?:.+?)\>/)[1];
        const splitString = src.split("/");
        const imageName = splitString[splitString.length - 1];
        if (commentEmojis[imageName]) {
          value = value.replace(match, commentEmojis[imageName]);
        }
      }
    }
    value = value.replace(/<[^>]*>?/gm, ""); // Remove remaining HTML tags
    value = value.replace(/\n/g, " ").trim(); // Remove newlines
    if (html.length === 250) value += "..."; // Add ellipsis if shortened
    return value;
  }

  addon.auth.addEventListener("change", function () {
    msgCount = null;
    lastDateTime = null;
    lastAuthChange = Date.now();
    checkCount();
  });
}
