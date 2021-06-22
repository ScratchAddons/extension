import globalStateProxy from "./imports/global-state.js";
import localStateProxy from "./imports/local-state.js";
import BackgroundLocalizationProvider from "./l10n.js";

window.scratchAddons = {};

// Store addon objects for persistent scripts
scratchAddons.addonObjects = [];

// Store event targets for addon.* API events
scratchAddons.eventTargets = {
  auth: [],
  settings: [],
  self: [],
  storage: [],
};

// Event target for local background page events
scratchAddons.localEvents = new EventTarget();

// Load manifests into memory
scratchAddons.manifests = [];

// Other files may add their own global methods here so that addon-api files can access them
scratchAddons.methods = {};

scratchAddons.l10n = new BackgroundLocalizationProvider();
// Can't load translations here.

scratchAddons.globalState = globalStateProxy;
console.log(
  "%cscratchAddons.globalState",
  "font-weight: bold;",
  "initialized:\n",
  JSON.parse(JSON.stringify(scratchAddons.globalState))
);

scratchAddons.localState = localStateProxy;
console.log(
  "%cscratchAddons.localState",
  "font-weight: bold;",
  "initialized:\n",
  JSON.parse(JSON.stringify(scratchAddons.localState))
);
