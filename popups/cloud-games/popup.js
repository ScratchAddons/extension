export default async ({ template, addon, msg, safeMsg }) => {
  // TODO: support setting this via settings page
  const url = "https://scratch.mit.edu/studios/539952/";
  const studioId = url.match(/\d+/)?.[0];
  const shouldFailEarly = !studioId || isNaN(studioId);

  const CloudGames = Vue.extend({
    props: [],
    template,
    data() {
      return {
        projects: [],
        loaded: false,
        messages: { noUsersMsg: msg("no-users") },
        projectsChecked: 0,
        error: shouldFailEarly ? "general-error" : null,
      };
    },
    computed: {
      projectsSorted() {
        return this.projects.sort((b, a) => {
          if (a.amt !== b.amt) return a.amt - b.amt;
          return a.timestamp - b.timestamp;
        });
      },
      loadingMsg() {
        return msg("loading", { done: this.projectsChecked, amount: this.projects.length || "?" });
      },
      errorMessage() {
        return this.error && msg(this.error);
      },
    },
    methods: {
      setCloudDataForProject(projectObject, i) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            const res = await fetch(
              `https://clouddata.scratch.mit.edu/logs?projectid=${projectObject.id}&limit=40&offset=0`
            );
            const json = await res.json();
            const dateNow = Date.now();
            const usersSet = new Set();
            for (const varChange of json) {
              if (dateNow - varChange.timestamp > 60000) break;
              usersSet.add(varChange.user);
            }
            projectObject.timestamp = json[0]?.timestamp || 0;
            projectObject.amt = usersSet.size;
            projectObject.users = Array.from(usersSet);
            this.projectsChecked++;
            if (this.projectsChecked / this.projects.length > 0.5) {
              // Show UI even tho it's not ready, if a majority of projects loaded
              this.loaded = true;
            }
            resolve();
          }, i * 125);
        });
      },
      settingsHTML() {
        const link = document.createElement("a");
        link.target = "_blank";
        link.href = chrome.runtime.getURL("/webpages/settings/index.html#addon-cloud-games");
        link.textContent = msg("addon-settings");
        return safeMsg("change-studio", {
          settings: link.outerHTML,
        });
      },
    },
    async created() {
      document.title = msg("popup-title");
      if (shouldFailEarly) return;
      let res;
      try {
        res = await fetch(`https://api.scratch.mit.edu/studios/${studioId}/projects/?limit=40`);
      } catch (e) {
        console.warn("Error when fetching studios: ", e);
        this.error = "server-error";
        return;
      }
      if (res.status >= 500) {
        this.error = "server-error";
        return;
      }
      if (res.status >= 400) {
        this.error = "general-error";
        return;
      }
      const projects = await res.json();
      if (projects.length === 0) {
        this.error = "no-projects";
        return;
      }
      // TODO: add currently opened game to projects array. Sort function should put it on top
      this.projects = projects
        .map((project) => ({ title: project.title, id: project.id, amt: 0, users: [], extended: true }))
        .reverse();
      await Promise.all(this.projects.map((project, i) => this.setCloudDataForProject(project, i)));
    },
  });
  return { "cloud-games": CloudGames };
};
