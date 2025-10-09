import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import I18n from "I18n";

export default class AdminPluginsRankOnNamesController extends Controller {
  @tracked prefixes = [];
  @tracked newGroupName = "";
  @tracked newPrefix = "";
  @tracked newPosition = "";
  @tracked isSavingNew = false;

  @tracked disabled = false;

  setInitialModel(prefixes, disabled = false) {
    this.disabled = disabled;
    this.prefixes = this.#sortPrefixes(prefixes || []);
  }

  #sortPrefixes(prefixes) {
    return [...prefixes].sort((a, b) => {
      const aPos = a.position || 0;
      const bPos = b.position || 0;
      if (aPos === bPos) {
        return (a.id || 0) - (b.id || 0);
      }
      return aPos - bPos;
    });
  }

  #setPrefixes(prefixes) {
    this.prefixes = this.#sortPrefixes(prefixes);
  }

  #normalizePosition(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  #findPrefix(id) {
    return this.prefixes.find((item) => item.id === id);
  }

  #replacePrefix(id, updater) {
    this.prefixes = this.#sortPrefixes(
      this.prefixes.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const updated = typeof updater === "function" ? updater(item) : updater;
        return { ...item, ...updated };
      })
    );
  }

  @action
  startEdit(id) {
    const current = this.#findPrefix(id);
    if (!current) {
      return;
    }

    this.#replacePrefix(id, {
      isEditing: true,
      _edit: {
        group_name: current.group_name,
        prefix: current.prefix,
        position: current.position,
      },
    });
  }

  @action
  cancelEdit(id) {
    this.#replacePrefix(id, {
      isEditing: false,
      _edit: null,
    });
  }

  @action
  updateEditField(id, field, event) {
    const value = event?.target?.value;
    const current = this.#findPrefix(id);
    if (!current?._edit) {
      return;
    }

    this.#replacePrefix(id, (item) => ({
      _edit: { ...item._edit, [field]: value },
    }));
  }

  @action
  async saveEdit(id) {
    const current = this.#findPrefix(id);
    if (!current?._edit) {
      return;
    }

    const payload = {
      group_name: current._edit.group_name?.trim(),
      prefix: current._edit.prefix?.trim(),
      position: this.#normalizePosition(current._edit.position),
    };

    if (!payload.group_name || !payload.prefix) {
      popupAjaxError(
        new Error(I18n.t("rank_on_names.errors.missing_required_fields"))
      );
      return;
    }

    try {
      const updated = await ajax(
        `/admin/plugins/rank-on-names/prefixes/${id}.json`,
        {
          type: "PUT",
          data: { prefix: payload },
        }
      );

      this.#replacePrefix(id, {
        ...updated,
        isEditing: false,
        _edit: null,
      });
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  async deletePrefix(id) {
    const current = this.#findPrefix(id);
    if (!current) {
      return;
    }

    if (
      !window.confirm(
        I18n.t("rank_on_names.delete_confirm", { group: current.group_name })
      )
    ) {
      return;
    }

    try {
      await ajax(`/admin/plugins/rank-on-names/prefixes/${id}.json`, {
        type: "DELETE",
      });
      this.#setPrefixes(this.prefixes.filter((item) => item.id !== id));
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  async createPrefix() {
    const payload = {
      group_name: this.newGroupName?.trim(),
      prefix: this.newPrefix?.trim(),
      position: this.#normalizePosition(this.newPosition),
    };

    if (!payload.group_name || !payload.prefix) {
      popupAjaxError(
        new Error(I18n.t("rank_on_names.errors.missing_required_fields"))
      );
      return;
    }

    this.isSavingNew = true;

    try {
      const created = await ajax("/admin/plugins/rank-on-names/prefixes.json", {
        type: "POST",
        data: { prefix: payload },
      });

      this.#setPrefixes([...this.prefixes, created]);
      this.newGroupName = "";
      this.newPrefix = "";
      this.newPosition = "";
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.isSavingNew = false;
    }
  }
}
