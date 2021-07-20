import { escapeHTML } from "../../libraries/common/cs/autoescaper.js";
import loadVueComponent from "../../libraries/common/load-vue-components.js";

export default async ({ template, addon, msg, safeMsg }) => {
  let components = await loadVueComponent([{ url: "popups/scratch-messaging/comment", params: { msg, safeMsg } }]);

  const scratchMessaging = Vue.extend({
    template,
    components,
    data() {
      return {
        mounted: true, // Always true

        stMessages: [],
        messages: [],
        comments: {},
        error: null,

        username: null,
        msgCount: null,

        messagesReady: false,
        commentsReady: false,
        commentsProgress: 0,
        showAllMessages: false,
        showingMessagesAmt: null,
        markedAsRead: false,

        follows: [],
        studioInvites: [],
        studioPromotions: [],
        forumActivity: [],
        studioActivity: [],
        remixes: [],
        profiles: [],
        studios: [],
        projects: [],

        // For UI
        messageTypeExtended: {
          stMessages: false,
          follows: false,
          studioInvites: false,
          studioPromotions: false,
          forumActivity: false,
          studioActivity: false,
          remixes: false,
        },

        uiMessages: {
          stMessagesMsg: msg("stMessages"),
          followsMsg: msg("follows"),
          studioInvitesMsg: msg("studio-invites"),
          forumMsg: msg("forum"),
          studioActivityMsg: msg("studio-activity"),
          remixesMsg: msg("remixes"),
          yourProfileMsg: msg("your-profile"),
          loadingMsg: msg("loading"),
          loggedOutMsg: msg("logged-out"),
          loadingCommentsMsg: msg("loading-comments"),
          reloadMsg: msg("reload"),
          dismissMsg: msg("dismiss"),
          noUnreadMsg: msg("no-unread"),
          showMoreMsg: msg("show-more"),
          markAsReadMsg: msg("mark-as-read"),
          markedAsReadMsg: msg("marked-as-read"),
          openMessagesMsg: msg("open-messages"),
          studioPromotionsMsg: msg("studio-promotions"),
        },
      };
    },
    watch: {
      showAllMessages(newVal) {
        this.commentsReady = false;
        this.commentsProgress = 0;
        this.follows = [];
        this.studioInvites = [];
        this.studioPromotions = [];
        this.forumActivity = [];
        this.studioActivity = [];
        this.remixes = [];
        this.profiles = [];
        this.studios = [];
        this.projects = [];
        this.analyzeMessages(newVal);
      },
    },
    computed: {
      profilesOrdered() {
        // Own profile first, then others
        return [
          ...this.profiles.filter((profile) => profile.username === this.username),
          ...this.profiles.filter((profile) => profile.username !== this.username),
        ];
      },
      projectsOrdered() {
        // Projects with comments first, then others
        return [
          ...this.projects.filter((proj) => proj.unreadComments !== 0),
          ...this.projects.filter((proj) => proj.unreadComments === 0),
        ];
      },
      canShowMoreMessages() {
        return (
          this.messagesReady &&
          this.commentsReady &&
          this.showAllMessages === false &&
          this.messages.length > this.showingMessagesAmt
        );
      },
    },
    created() {
      document.title = msg("popup-title");
      (async () => {
        let fetched = await this.getData();
        if (fetched) this.analyzeMessages();
        else {
          const interval = setInterval(async () => {
            fetched = await this.getData();
            if (fetched) {
              clearInterval(interval);
              this.analyzeMessages();
            }
          }, 500);
        }
      })();
    },
    methods: {
      getData() {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ scratchMessaging: "getData" }, (res) => {
            if (res) {
              this.stMessages = (Array.isArray(res.stMessages) ? res.stMessages : []).map((alert) => ({
                ...alert,
                datetime_created: new Date(alert.datetime_created).toDateString(),
              }));
              this.messages = res.messages;
              this.msgCount = res.lastMsgCount;
              this.username = res.username;
              this.error = res.error;
              resolve(res.error ? false : true);
            }
          });
        });
      },

      // For UI
      markAsRead() {
        chrome.runtime.sendMessage({ scratchMessaging: "markAsRead" });
        this.markedAsRead = true;
      },
      dismissAlert(id) {
        const confirmation = confirm(msg("stMessagesConfirm"));
        if (!confirmation) return;
        chrome.runtime.sendMessage({ scratchMessaging: { dismissAlert: id } }, (res) => {
          if (res && !res.error) {
            this.stMessages.splice(
              this.stMessages.findIndex((alert) => alert.id === id),
              1
            );
          }
        });
      },
      reloadPage() {
        location.reload();
      },

      // Objects
      getProjectObject(projectId, title) {
        const search = this.projects.find((obj) => obj.id === projectId);
        if (search) return search;
        const obj = {
          id: projectId,
          title,
          unreadComments: 0,
          commentChains: [],
          loveCount: 0,
          favoriteCount: 0,
          loversAndFavers: [],
          loadedComments: false,
        };
        this.projects.push(obj);
        return obj;
      },
      getProfileObject(username) {
        const search = this.profiles.find((obj) => obj.username === username);
        if (search) return search;
        const obj = {
          username,
          unreadComments: 0,
          commentChains: [],
          loadedComments: false,
        };
        this.profiles.push(obj);
        return obj;
      },
      getStudioObject(studioId, title) {
        const search = this.studios.find((obj) => obj.id === studioId);
        if (search) return search;
        const obj = {
          id: studioId,
          title,
          unreadComments: 0,
          commentChains: [],
          loadedComments: false,
        };
        this.studios.push(obj);
        return obj;
      },

      // Comments
      isCommentUnread: function (commentId) {
        const realCommentId = Number(commentId.substring(2));
        const messageIndex = this.messages.findIndex((msg) => msg.comment_id === realCommentId);
        if (messageIndex === -1) return false;
        else if (messageIndex < this.msgCount) {
          if (this.comments[commentId].childOf) {
            if (this.isCommentUnread(this.comments[commentId].childOf)) return false;
            else return true;
          } else return true;
        } else return false;
      },
      checkCommentLocation(resourceType, resourceId, commentIds, elementObject) {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              scratchMessaging: {
                retrieveComments: {
                  resourceType,
                  resourceId,
                  commentIds: commentIds,
                },
              },
            },
            (comments) => {
              if (comments?.failed) {
                // Sometimes incorrect (e.g. server is actually down)
                // but this works
                this.error = "loggedOut";
                resolve();
                return;
              }
              if (Object.keys(comments).length === 0) elementObject.unreadComments = 0;
              for (const commentId of Object.keys(comments)) {
                const commentObject = comments[commentId];
                Vue.set(this.comments, commentId, commentObject);
              }

              // Preserve chronological sort when using JSON API
              const parentComments = Object.entries(comments).filter((c) => c[1].childOf === null);
              const sortedParentComments = parentComments.sort((a, b) => new Date(b[1].date) - new Date(a[1].date));
              const sortedIds = sortedParentComments.map((arr) => arr[0]);
              const resourceGetFunction =
                resourceType === "project"
                  ? "getProjectObject"
                  : resourceType === "user"
                  ? "getProfileObject"
                  : "getStudioObject";
              const resourceObject = this[resourceGetFunction](resourceId);
              for (const sortedId of sortedIds) resourceObject.commentChains.push(sortedId);

              elementObject.loadedComments = true;
              resolve();
            }
          );
        });
      },

      async analyzeMessages(showAll = false) {
        const commentLocations = {
          0: [], // Projects
          1: [], // Profiles
          2: [], // Studios
        };
        let realMsgCount = this.msgCount - this.stMessages.length;
        const messagesToCheck =
          realMsgCount > 40 ? this.messages.length : showAll ? this.messages.length : realMsgCount;
        this.showingMessagesAmt = messagesToCheck;
        for (const message of this.messages.slice(0, messagesToCheck)) {
          if (message.type === "followuser") {
            this.follows.push(message.actor_username);
          } else if (message.type === "curatorinvite") {
            this.studioInvites.push({
              actor: message.actor_username,
              studioId: message.gallery_id,
              studioTitle: message.title,
            });
          } else if (message.type === "becomeownerstudio") {
            this.studioPromotions.push({
              actor: message.actor_username,
              studioId: message.gallery_id,
              studioTitle: message.gallery_title,
            });
          } else if (message.type === "forumpost") {
            // We only want one message per forum topic
            if (!this.forumActivity.find((obj) => obj.topicId === message.topic_id)) {
              this.forumActivity.push({
                topicId: message.topic_id,
                topicTitle: message.topic_title,
              });
            }
          } else if (message.type === "remixproject") {
            this.remixes.push({
              parentTitle: message.parent_title,
              remixTitle: message.title,
              actor: message.actor_username,
              projectId: message.project_id,
            });
          } else if (message.type === "studioactivity") {
            // We only want one message per studio
            if (!this.studioActivity.find((obj) => obj.studioId === message.gallery_id)) {
              this.studioActivity.push({
                studioId: message.gallery_id,
                studioTitle: message.title,
              });
            }
          } else if (message.type === "loveproject") {
            const projectObject = this.getProjectObject(message.project_id, message.title);
            projectObject.loveCount++;
            const findLover = projectObject.loversAndFavers.find((obj) => obj.username === message.actor_username);
            if (findLover) findLover.loved = true;
            else projectObject.loversAndFavers.push({ username: message.actor_username, loved: true, faved: false });
          } else if (message.type === "favoriteproject") {
            const projectObject = this.getProjectObject(message.project_id, message.project_title);
            projectObject.favoriteCount++;
            const findFaver = projectObject.loversAndFavers.find((obj) => obj.username === message.actor_username);
            if (findFaver) findFaver.faved = true;
            else projectObject.loversAndFavers.push({ username: message.actor_username, loved: false, faved: true });
          } else if (message.type === "addcomment") {
            const resourceId = message.comment_type === 1 ? message.comment_obj_title : message.comment_obj_id;
            let location = commentLocations[message.comment_type].find((obj) => obj.resourceId === resourceId);
            if (!location) {
              location = { resourceId, commentIds: [] };
              commentLocations[message.comment_type].push(location);
            }
            location.commentIds.push(message.comment_id);
            let resourceObject;
            if (message.comment_type === 0)
              resourceObject = this.getProjectObject(resourceId, message.comment_obj_title);
            else if (message.comment_type === 1) resourceObject = this.getProfileObject(resourceId);
            else if (message.comment_type === 2)
              resourceObject = this.getStudioObject(resourceId, message.comment_obj_title);
            resourceObject.unreadComments++;
          }
        }
        this.messagesReady = true;

        const locationsToCheckAmt =
          commentLocations[0].length + commentLocations[1].length + commentLocations[2].length;
        let locationsChecked = 0;
        for (const profile of this.profilesOrdered) {
          const location = commentLocations[1].find((obj) => obj.resourceId === profile.username);
          if (location) {
            await this.checkCommentLocation("user", location.resourceId, location.commentIds, profile);
            locationsChecked++;
            this.commentsProgress = Math.round((locationsChecked / locationsToCheckAmt) * 100);
          }
        }
        for (const studio of this.studios) {
          const location = commentLocations[2].find((obj) => obj.resourceId === studio.id);
          if (location) {
            await this.checkCommentLocation("gallery", location.resourceId, location.commentIds, studio);
            locationsChecked++;
            this.commentsProgress = Math.round((locationsChecked / locationsToCheckAmt) * 100);
          }
        }
        for (const project of this.projectsOrdered) {
          const location = commentLocations[0].find((obj) => obj.resourceId === project.id);
          if (location) {
            await this.checkCommentLocation("project", location.resourceId, location.commentIds, project);
            locationsChecked++;
            this.commentsProgress = Math.round((locationsChecked / locationsToCheckAmt) * 100);
          }
        }
        this.commentsReady = true;
      },
      studioInviteHTML(invite) {
        const actor = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/users/${invite.actor}/"
        >${invite.actor}</a>`;
        const title = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/studios/${invite.studioId}/curators/"
            style="text-decoration: underline"
        >${escapeHTML(invite.studioTitle)}</a>`;
        return safeMsg("curate-invite", { actor, title });
      },
      studioPromotionHTML(promotion) {
        const actor = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/users/${promotion.actor}/"
        >${promotion.actor}</a>`;
        const title = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/studios/${promotion.studioId}/curators/"
            style="text-decoration: underline"
        >${escapeHTML(promotion.studioTitle)}</a>`;
        return safeMsg("studio-promotion", { actor, title });
      },
      forumHTML(forumTopic) {
        const title = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/discuss/topic/${forumTopic.topicId}/unread/"
            style="text-decoration: underline"
        >${escapeHTML(forumTopic.topicTitle)}</a>`;
        return safeMsg("forum-new-post", { title });
      },
      studioActivityHTML(studio) {
        const title = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/studios/${studio.studioId}/activity/"
            style="text-decoration: underline"
        >${escapeHTML(studio.studioTitle)}</a>`;
        return safeMsg("new-activity", { title });
      },
      remixHTML(remix) {
        const actor = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/users/${remix.actor}/"
        >${remix.actor}</a>`;
        const title = `<a target="_blank"
            rel="noopener noreferrer"
            href="https://scratch.mit.edu/projects/${remix.projectId}/"
            style="text-decoration: underline"
        >${escapeHTML(remix.remixTitle)}</a>`;
        return safeMsg("remix-as", {
          actor,
          title,
          parentTitle: escapeHTML(remix.parentTitle),
        });
      },
      othersProfile(username) {
        return msg("others-profile", { username });
      },
      studioText(title) {
        return msg("studio", { title });
      },
      projectLoversAndFavers(project) {
        // First lovers&favers, then favers-only, then lovers only. Lower is better
        const priorityOf = (obj) => (obj.loved && obj.faved ? 0 : obj.faved ? 1 : 2);
        let str = "";
        const arr = project.loversAndFavers.slice(0, 20).sort((a, b) => {
          const priorityA = priorityOf(a);
          const priorityB = priorityOf(b);
          if (priorityA > priorityB) return 1;
          else if (priorityB > priorityA) return -1;
          else return 0;
        });
        arr.forEach((obj, i) => {
          if (obj.loved) str += `<img class="small-icon colored" src="../../images/icons/heart.svg">`;
          if (obj.faved) str += `<img class="small-icon colored" src="../../images/icons/star.svg">`;
          str += " ";
          str += `<a href="https://scratch.mit.edu/users/${obj.username}/">${obj.username}</a>`;
          if (i !== arr.length - 1) str += "<br>";
        });
        return str;
      },
    },
  });
  return { "scratch-messaging": scratchMessaging };
};
