let dateNow = Date.now();

export default async function ({ template, msg, safeMsg }) {
  const Comment = Vue.extend({
    template,
    props: ["comment-id", "comments-obj", "is-parent", "unread", "resource-type", "resource-id"],
    data() {
      return {
        replying: false,
        replyBoxValue: "",
        deleted: false,
        deleteStep: 0,
        postingComment: false,
        messages: {
          openNewTabMsg: msg("open-new-tab"),
          deleteMsg: msg("delete"),
          deleteConfirmMsg: msg("delete-confirm"),
          replyMsg: msg("reply"),
          postingMsg: msg("posting"),
          postMsg: msg("post"),
          cancelMsg: msg("cancel"),
        },
      };
    },
    methods: {
      postComment() {
        const shouldCaptureComment = (value) => {
          // From content-scripts/cs.js
          const regex = / scratch[ ]?add[ ]?ons/;
          // Trim like scratchr2
          const trimmedValue = " " + value.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
          const limitedValue = trimmedValue.toLowerCase().replace(/[^a-z /]+/g, "");
          return regex.test(limitedValue);
        };
        if (shouldCaptureComment(this.replyBoxValue)) {
          alert(
            chrome.i18n
              .getMessage("captureCommentError", ["$1"])
              .replace("$1", chrome.i18n.getMessage("captureCommentPolicy"))
          );
          return;
        }
        this.postingComment = true;
        const parent_pseudo_id = this.isParent ? this.commentId : this.thisComment.childOf;
        const parent_id = Number(parent_pseudo_id.substring(2));
        chrome.runtime.sendMessage(
          {
            scratchMessaging: {
              postComment: {
                resourceType: this.resourceType,
                resourceId: this.resourceId,
                content: this.replyBoxValue,
                parent_id,
                commentee_id: this.thisComment.authorId,
                commenteeUsername: this.thisComment.author,
              },
            },
          },
          (res) => {
            this.postingComment = false;
            dateNow = Date.now();
            if (res.error) {
              const errorCode =
                {
                  isEmpty: "comment-error-empty",
                  // Two errors can be raised for rate limit;
                  // isFlood is the actual error, 429 is the status code
                  // ratelimit error will be unnecessary when #2505 is implemented
                  isFlood: "comment-error-ratelimit",
                  429: "comment-error-ratelimit",
                  isBad: "comment-error-filterbot-generic",
                  hasChatSite: "comment-error-filterbot-chat",
                  isSpam: "comment-error-filterbot-spam",
                  replyLimitReached: "comment-error-reply-limit",
                  // isDisallowed, isIPMuted, isTooLong, isNotPermitted use default error
                  500: "comment-error-down",
                  503: "comment-error-down",
                }[res.error] || "send-error";
              let errorMsg = msg(errorCode);
              if (res.muteStatus) {
                errorMsg = msg("comment-mute") + " ";
                errorMsg += msg("comment-cannot-post-for", {
                  mins: Math.max(Math.ceil((res.muteStatus.muteExpiresAt - Date.now() / 1000) / 60), 1),
                });
              }
              alert(errorMsg);
            } else {
              this.replying = false;
              const newCommentPseudoId = `${this.resourceType[0]}_${res.commentId}`;
              Vue.set(this.commentsObj, newCommentPseudoId, {
                author: res.username,
                authorId: res.userId,
                content: res.content,
                date: new Date().toISOString(),
                children: null,
                childOf: parent_pseudo_id,
              });
              this.commentsObj[parent_pseudo_id].children.push(newCommentPseudoId);
              this.replyBoxValue = "";
            }
          }
        );
      },
      deleteComment() {
        if (this.deleteStep === 0) {
          setTimeout(() => (this.deleteStep = 1), 250);
          setTimeout(() => {
            if (this.deleteStep === 1) this.deleteStep = 0;
          }, 5000);
          return;
        }
        this.deleted = true;
        const previousContent = this.thisComment.content;
        this.thisComment.content = safeMsg("deleting");
        chrome.runtime.sendMessage(
          {
            scratchMessaging: {
              deleteComment: {
                resourceType: this.resourceType,
                resourceId: this.resourceId,
                commentId: Number(this.commentId.substring(2)),
              },
            },
          },
          (res) => {
            if (res.error) {
              alert(msg("delete-error"));
              this.thisComment.content = previousContent;
              this.deleteStep = 0;
              this.deleted = false;
            } else {
              if (this.isParent) this.thisComment.children = [];
              this.thisComment.content = safeMsg("deleted");
            }
          }
        );
      },
    },
    computed: {
      thisComment() {
        return this.commentsObj[this.commentId];
      },
      replyBoxLeftMsg() {
        return msg("chars-left", { num: 500 - this.replyBoxValue.length });
      },
      username() {
        return this.$parent.username;
      },
      commentTimeAgo() {
        const timeFormatter = new Intl.RelativeTimeFormat("en", {
          localeMatcher: "best fit",
          numeric: "auto",
          style: "short",
        });
        const commentTimestamp = new Date(this.thisComment.date).getTime();
        const timeDiffSeconds = (dateNow - commentTimestamp) / 1000;
        let options;
        if (timeDiffSeconds < 60) return timeFormatter.format(0, "second");
        else if (timeDiffSeconds < 3600) options = { unit: "minute", divideBy: 60 };
        else if (timeDiffSeconds < 86400) options = { unit: "hour", divideBy: 60 * 60 };
        else options = { unit: "day", divideBy: 60 * 60 * 24 };
        return timeFormatter.format(-Math.round(timeDiffSeconds / options.divideBy), options.unit);
      },
      commentURL() {
        const urlPath =
          this.resourceType === "user" ? "users" : this.resourceType === "gallery" ? "studios" : "projects";
        const commentPath = this.resourceType === "gallery" ? "comments/" : "";
        return `https://scratch.mit.edu/${urlPath}/${
          this.resourceId
        }/${commentPath}#comments-${this.commentId.substring(2)}`;
      },
    },
    watch: {
      replying(newVal) {
        if (newVal === true) this.$el.querySelector("textarea").focus();
      },
    },
  });
  return { comment: Comment };
}
