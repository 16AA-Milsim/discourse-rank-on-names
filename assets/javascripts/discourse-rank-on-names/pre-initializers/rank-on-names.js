import { withPluginApi } from "discourse/lib/plugin-api";
import { getURLWithCDN } from "discourse/lib/get-url";

const PLUGIN_ID = "discourse-rank-on-names";
const RANK_PREFIX_KEY = "rank_prefix";
const DROP_ZONE_KEY = "rank_drop_zone_flash";
const prefixCache = Object.create(null);
const dropZoneCache = Object.create(null);
const dropZoneClassUrlMap = Object.create(null);
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
const DROP_ZONE_STYLE_ELEMENT_ID = "rank-on-names-drop-zone-styles";

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

function rememberDropZone(username, dropZone) {
  if (!username) {
    return;
  }

  const key = username.toLowerCase();
  const previous = dropZoneCache[key];
  const previousClass = previous?.css_class
    ? `user-title--${previous.css_class}`
    : null;

  if (dropZone === undefined) {
    return;
  }

  if (dropZone) {
    dropZoneCache[key] = dropZone;
    log("remember drop zone", username, dropZone);
  } else {
    delete dropZoneCache[key];
    log("forget drop zone", username);
  }

  const nextClass = dropZone?.css_class
    ? `user-title--${dropZone.css_class}`
    : null;
  const nextUrl = dropZone?.upload_url ? getURLWithCDN(dropZone.upload_url) : null;

  if (previousClass && previousClass !== nextClass) {
    delete dropZoneClassUrlMap[previousClass];
  }

  if (nextClass && nextUrl) {
    dropZoneClassUrlMap[nextClass] = nextUrl;
  } else if (nextClass && !nextUrl) {
    delete dropZoneClassUrlMap[nextClass];
  }

  scheduleApplyDropZoneBadges();
}

function lookupPrefix(username) {
  if (!username) {
    return undefined;
  }

  const value = prefixCache[username.toLowerCase()];
  log("lookup", username, value);
  return value;
}

function lookupDropZone(username) {
  if (!username) {
    return undefined;
  }

  const value = dropZoneCache[username.toLowerCase()];
  log("lookup drop zone", username, value);
  return value;
}

function escapeForCss(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function applyDropZoneStyles(list) {
  if (typeof document === "undefined") {
    return;
  }

  let styleEl = document.getElementById(DROP_ZONE_STYLE_ELEMENT_ID);

  const removeExisting = () => {
    if (styleEl?.parentNode) {
      styleEl.remove();
      log("drop zone styles removed");
    }
  };

  if (!Array.isArray(list) || list.length === 0) {
    clearDropZoneClassMap();
    removeExisting();
    scheduleApplyDropZoneBadges();
    return;
  }

  const rules = [];
  clearDropZoneClassMap();

  list.forEach((item) => {
    const url = item?.upload_url;
    const cssClass = item?.css_class;

    if (!url || !cssClass) {
      return;
    }

    const className = `user-title--${cssClass}`;
    const escaped = escapeForCss(className);
    if (!escaped) {
      return;
    }

    const resolvedUrl = getURLWithCDN(url);
    const encodedUrl = JSON.stringify(resolvedUrl);

    dropZoneClassUrlMap[className] = resolvedUrl;

    rules.push(
      `.user-title.${escaped} { position: relative; padding-left: 22px; }
.user-title.${escaped}::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background-image: url(${encodedUrl}); background-size: contain; background-repeat: no-repeat; background-position: center; }`
    );
  });

  if (!rules.length) {
    removeExisting();
    scheduleApplyDropZoneBadges();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = DROP_ZONE_STYLE_ELEMENT_ID;
    styleEl.type = "text/css";
  }

  styleEl.textContent = rules.join("\n");
  log("drop zone rules applied", styleEl.textContent);

  if (!styleEl.parentNode) {
    (document.head || document.body)?.appendChild(styleEl);
  }

  log("drop zone styles applied", { count: rules.length });

  scheduleApplyDropZoneBadges();
}

function clearDropZoneClassMap() {
  Object.keys(dropZoneClassUrlMap).forEach((key) => delete dropZoneClassUrlMap[key]);
}

function applyDropZoneBadgesWithin(root) {
  if (!root?.querySelectorAll) {
    return;
  }

  for (const [className, url] of Object.entries(dropZoneClassUrlMap)) {
    root
      .querySelectorAll(`.user-title.${className}`)
      .forEach((element) => {
        element.style.setProperty("--rank-on-names-badge", `url("${url}")`);
      });
  }
}

let dropZoneBadgeApplyScheduled = false;

function scheduleApplyDropZoneBadges() {
  if (dropZoneBadgeApplyScheduled) {
    return;
  }

  dropZoneBadgeApplyScheduled = true;

  queueMicrotask(() => {
    dropZoneBadgeApplyScheduled = false;
    applyDropZoneBadgesWithin(document);
  });
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
      api.addTrackedPostProperties(DROP_ZONE_KEY);

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
          rememberDropZone(record.username, record?.[DROP_ZONE_KEY]);
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
          this.addObserver(DROP_ZONE_KEY, this, this.rankOnNamesSyncCache);
          this.addObserver("usernameLower", this, this.rankOnNamesSyncCache);
          this.rankOnNamesSyncCache();
        },

        willDestroy() {
          this.removeObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.removeObserver(DROP_ZONE_KEY, this, this.rankOnNamesSyncCache);
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
          this.addObserver(DROP_ZONE_KEY, this, this.rankOnNamesSyncCache);
          this.addObserver("username", this, this.rankOnNamesSyncCache);
          this.rankOnNamesSyncCache();
        },

        willDestroy() {
          this.removeObserver("rank_prefix", this, this.rankOnNamesSyncCache);
          this.removeObserver(DROP_ZONE_KEY, this, this.rankOnNamesSyncCache);
          this.removeObserver("username", this, this.rankOnNamesSyncCache);
          this._super(...arguments);
        },

        rankOnNamesSyncCache() {
          log("post sync", this?.username);
          rememberPrefix(this.username, this[RANK_PREFIX_KEY]);
          rememberDropZone(this.username, this[DROP_ZONE_KEY]);
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

      const dropZoneFlashes = api.site?.rank_drop_zone_flashes;
      if (Array.isArray(dropZoneFlashes)) {
        log("applying drop zone flashes", { count: dropZoneFlashes.length });
        applyDropZoneStyles(dropZoneFlashes);
      }

      api.onAppEvent(
        "rank-on-names:drop-zone-flashes-updated",
        (payload) => {
          log("drop zone flashes update event", {
            count: Array.isArray(payload) ? payload.length : 0,
          });
          applyDropZoneStyles(payload);
        }
      );

      if (typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                applyDropZoneBadgesWithin(node);
              }
            });
          });
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }

      api.registerValueTransformer(
        "poster-name-class",
        (classes = [], payload = {}) => {
          const username = payload?.user?.username;
          if (!username) {
            return classes;
          }

          const dropZone = lookupDropZone(username);
          if (dropZone?.css_class) {
            const className = `user-title--${dropZone.css_class}`;
            if (!classes.includes(className)) {
              return [...classes, className];
            }
          }

          return classes;
        }
      );

    });
  },
};
