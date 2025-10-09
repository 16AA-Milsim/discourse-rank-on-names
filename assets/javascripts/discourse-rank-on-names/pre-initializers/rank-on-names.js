import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-rank-on-names";
const RANK_PREFIX_KEY = "rank_prefix";
const prefixCache = Object.create(null);
const DEBUG = (() => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.rankOnNamesDebug !== undefined) {
    return Boolean(window.rankOnNamesDebug);
  }

  try {
    return window.localStorage?.getItem("rankOnNamesDebug") === "true";
  } catch (e) {
    return false;
  }
})();
const LOG_PREFIX = "[RankOnNames]";

function log(...args) {
  if (!DEBUG) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(LOG_PREFIX, ...args);
}

function rememberPrefix(username, prefix) {
  if (!username) {
    return;
  }

  const key = username.toLowerCase();

  if (prefix === undefined) {
    return;
  }

  if (prefix) {
    prefixCache[key] = prefix;
    log("remember", username, prefix);
  } else {
    delete prefixCache[key];
    log("forget", username);
  }
}

function lookupPrefix(username) {
  if (!username) {
    return undefined;
  }

  const value = prefixCache[username.toLowerCase()];
  log("lookup", username, value);
  return value;
}

export default {
  name: "rank-on-names",
  before: "inject-discourse-objects",

  initialize() {
    withPluginApi((api) => {
      log("initializer invoked", api?.siteSettings?.rank_on_names_enabled);
      if (api?.siteSettings?.rank_on_names_enabled === false) {
        log("initializer aborted: setting disabled");
        return;
      }

      api.addTrackedPostProperties(RANK_PREFIX_KEY);

      const syncFromUserRecord = (record, visited = new WeakSet()) => {
        if (!record || typeof record !== "object") {
          log("sync skip invalid", record);
          return;
        }

        if (visited.has(record)) {
          log("sync skip visited", record?.username || record);
          return;
        }

        visited.add(record);

        const nestedUser = record.user;

        if (nestedUser && nestedUser !== record) {
          syncFromUserRecord(nestedUser, visited);
        }

        if (typeof record.username === "string") {
          rememberPrefix(record.username, record?.[RANK_PREFIX_KEY]);
        }
      };

      const seedDirectoryCollection = (collection) => {
        if (!collection) {
          return;
        }

        const visitItem = (item) => {
          if (!item) {
            log("seed skip empty item");
            return;
          }

          const visited = new WeakSet();
          syncFromUserRecord(item, visited);
          syncFromUserRecord(item.user, visited);
        };

        if (Array.isArray(collection)) {
          log("seed array", collection.length);
          collection.forEach(visitItem);
          return;
        }

        const content =
          collection.content ||
          collection.directoryItems ||
          collection.directory_items ||
          collection.models ||
          collection.toArray?.();

        if (Array.isArray(content)) {
          log("seed content array", content.length);
          content.forEach(visitItem);
        } else if (typeof content?.forEach === "function") {
          log("seed content iterable");
          content.forEach(visitItem);
        }
      };

      api.modifyClass("model:user", {
        pluginId: PLUGIN_ID,

        init() {
          this._super(...arguments);
          this.addObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.addObserver("usernameLower", this, this.rankOnNamesSyncCache);
          this.rankOnNamesSyncCache();
        },

        willDestroy() {
          this.removeObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.removeObserver("usernameLower", this, this.rankOnNamesSyncCache);
          this._super(...arguments);
        },

        rankOnNamesSyncCache() {
          log("user sync", this?.username);
          syncFromUserRecord(this);
        },
      });

      api.modifyClass("model:post", {
        pluginId: PLUGIN_ID,

        init() {
          this._super(...arguments);
          this.addObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.addObserver("username", this, this.rankOnNamesSyncCache);
          this.rankOnNamesSyncCache();
        },

        willDestroy() {
          this.removeObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.removeObserver("username", this, this.rankOnNamesSyncCache);
          this._super(...arguments);
        },

        rankOnNamesSyncCache() {
          log("post sync", this?.username);
          rememberPrefix(this.username, this[RANK_PREFIX_KEY]);
        },
      });

      api.formatUsername((username) => {
        if (!username) {
          log("format empty");
          return "";
        }

        const prefix = lookupPrefix(username);

        if (prefix) {
          log("format hit", username, prefix);
          return `${prefix} ${username}`;
        }

        log("format miss", username);
        return username;
      });

      const currentUser = api.getCurrentUser?.();
      log("sync current user", currentUser?.username);
      syncFromUserRecord(currentUser);

      api.modifyClass("service:store", {
        pluginId: PLUGIN_ID,

        _resultSet(type, result, findArgs) {
          const resultSet = this._super(...arguments);

          if (type === "directoryItem" && resultSet) {
            log("seed via resultSet", type);
            seedDirectoryCollection(resultSet);
          }

          return resultSet;
        },

        appendResults(resultSet, type, url) {
          const promise = this._super(...arguments);

          if (type === "directoryItem") {
            const finalize = () => seedDirectoryCollection(resultSet);

            if (promise?.finally) {
              log("appendResults finally", type);
              return promise.finally(finalize);
            }

            if (promise?.then) {
              log("appendResults then", type);
              return promise.then(
                (value) => {
                  finalize();
                  return value;
                },
                (error) => {
                  finalize();
                  throw error;
                }
              );
            }

            finalize();
          }

          log("appendResults passthrough", type);
          return promise;
        },
      });

      log("initializer complete");
    });
  },
};
