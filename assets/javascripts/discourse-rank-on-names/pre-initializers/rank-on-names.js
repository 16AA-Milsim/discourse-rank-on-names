import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-rank-on-names";
const RANK_PREFIX_KEY = "rank_prefix";
const prefixCache = Object.create(null);

/**
 * Stores the provided prefix in the cache for the supplied username.
 *
 * @param {string} username
 * @param {string|undefined|null} prefix
 * @returns {void}
 */
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
  } else {
    delete prefixCache[key];
  }
}

/**
 * Returns a prefix string for the provided username if one exists.
 *
 * @param {string} username
 * @returns {string|undefined}
 */
function lookupPrefix(username) {
  if (!username) {
    return undefined;
  }

  return prefixCache[username.toLowerCase()];
}

export default {
  name: "rank-on-names",
  before: "inject-discourse-objects",

  /**
   * Registers hooks that keep the rank prefix cache synchronized and ensures
   * usernames are formatted with their associated prefixes.
   *
   * @returns {void}
   */
  initialize() {
    withPluginApi((api) => {
      api.addTrackedPostProperties(RANK_PREFIX_KEY);

      /**
       * Mirrors the rank prefix from a record into the shared cache.
       *
       * @param {{username: string, rank_prefix?: string}} record
       * @returns {void}
       */
      const syncFromUserRecord = (record) => {
        rememberPrefix(record?.username, record?.[RANK_PREFIX_KEY]);
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
          rememberPrefix(this.username, this[RANK_PREFIX_KEY]);
        },
      });

      api.formatUsername((username) => {
        if (!username) {
          return "";
        }

        const prefix = lookupPrefix(username);

        if (prefix) {
          return `${prefix} ${username}`;
        }

        return username;
      });

      const currentUser = api.getCurrentUser?.();
      syncFromUserRecord(currentUser);
    });
  },
};
