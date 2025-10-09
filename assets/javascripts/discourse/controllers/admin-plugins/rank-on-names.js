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

  setInitialModel(prefixes) {
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

  #refresh() {
    this.prefixes = this.#sortPrefixes(this.prefixes);
  }

  #normalizePosition(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  @action
  startEdit(prefix) {
    prefix._edit = {
      group_name: prefix.group_name,
      prefix: prefix.prefix,
      position: prefix.position,
    };
    prefix.isEditing = true;
    this.#refresh();
  }

  @action
  cancelEdit(prefix) {
    delete prefix._edit;
    prefix.isEditing = false;
    this.#refresh();
  }

  @action
  updateEditField(prefix, field, event) {
    if (!prefix._edit) {
      return;
    }

    prefix._edit[field] = event?.target?.value;
    this.#refresh();
  }

  @action
  async saveEdit(prefix) {
    if (!prefix._edit) {
      return;
    }

    const payload = {
      group_name: prefix._edit.group_name?.trim(),
      prefix: prefix._edit.prefix?.trim(),
      position: this.#normalizePosition(prefix._edit.position),
    };

    if (!payload.group_name || !payload.prefix) {
      popupAjaxError(
        new Error(I18n.t("rank_on_names.errors.missing_required_fields"))
      );
      return;
    }

    try {
      const updated = await ajax(
        `/admin/plugins/rank-on-names/prefixes/${prefix.id}.json`,
        {
          type: "PUT",
          data: { prefix: payload },
        }
      );

      Object.assign(prefix, updated, { isEditing: false });
      delete prefix._edit;
      this.#refresh();
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  async deletePrefix(prefix) {
    if (
      !window.confirm(
        I18n.t("rank_on_names.delete_confirm", { group: prefix.group_name })
      )
    ) {
      return;
    }

    try {
      await ajax(`/admin/plugins/rank-on-names/prefixes/${prefix.id}.json`, {
        type: "DELETE",
      });
      this.prefixes = this.prefixes.filter((item) => item.id !== prefix.id);
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
      const created = await ajax(
        "/admin/plugins/rank-on-names/prefixes.json",
        {
          type: "POST",
          data: { prefix: payload },
        }
      );

      this.prefixes = this.#sortPrefixes([...this.prefixes, created]);
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
