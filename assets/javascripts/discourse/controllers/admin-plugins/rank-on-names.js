import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { getURLWithCDN } from "discourse/lib/get-url";
import { popupAjaxError } from "discourse/lib/ajax-error";
import I18n from "I18n";

export default class AdminPluginsRankOnNamesController extends Controller {
  @service appEvents;

  @tracked prefixes = [];
  @tracked dropZoneFlashes = [];

  @tracked newGroupName = "";
  @tracked newPrefix = "";
  @tracked newPosition = "";
  @tracked isSavingNew = false;

  @tracked newDropZoneGroupName = "";
  @tracked newDropZonePosition = "";
  @tracked newDropZoneUpload = null;
  @tracked isSavingDropZone = false;

  @tracked disabled = false;

  setInitialModel(model = {}) {
    this.disabled = !!model.disabled;
    this.prefixes = this.#sortPrefixes(model.prefixes || []);
    this.dropZoneFlashes = this.#sortDropZoneFlashes(
      (model.drop_zone_flashes || []).map((flash) =>
        this.#normalizeDropZoneFlash(flash)
      )
    );
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

  #sortDropZoneFlashes(flashes) {
    return [...flashes].sort((a, b) => {
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

  #setDropZoneFlashes(flashes) {
    this.dropZoneFlashes = this.#sortDropZoneFlashes(
      (flashes || []).map((flash) => this.#normalizeDropZoneFlash(flash))
    );
  }

  #normalizeDropZoneFlash(flash) {
    if (!flash) {
      return flash;
    }

    return {
      ...flash,
      preview_url: flash.upload_url ? getURLWithCDN(flash.upload_url) : null,
    };
  }

  #broadcastDropZoneUpdate() {
    this.appEvents?.trigger?.(
      "rank-on-names:drop-zone-flashes-updated",
      this.dropZoneFlashes
    );
  }

  #normalizeInteger(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  #normalizePosition(value) {
    return this.#normalizeInteger(value);
  }

  #normalizeUpload(upload) {
    if (!upload) {
      return null;
    }

    const id = upload.id ?? upload.upload_id;
    const url = upload.url ?? upload.upload_url;

    if (!id || !url) {
      return null;
    }

    const normalizedId = this.#normalizeInteger(id);

    if (normalizedId === null) {
      return null;
    }

    return { id: normalizedId, url };
  }

  #uploadIdFor(upload, fallbackId) {
    const normalized = this.#normalizeUpload(upload);
    if (normalized?.id) {
      return normalized.id;
    }
    return this.#normalizeInteger(fallbackId);
  }

  #findPrefix(id) {
    return this.prefixes.find((item) => item.id === id);
  }

  #findDropZoneFlash(id) {
    return this.dropZoneFlashes.find((item) => item.id === id);
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

  #replaceDropZoneFlash(id, updater) {
    this.dropZoneFlashes = this.#sortDropZoneFlashes(
      this.dropZoneFlashes.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const updated = typeof updater === "function" ? updater(item) : updater;
        return this.#normalizeDropZoneFlash({ ...item, ...updated });
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

  @action
  startDropZoneEdit(id) {
    const current = this.#findDropZoneFlash(id);
    if (!current) {
      return;
    }

    this.#replaceDropZoneFlash(id, {
      isEditing: true,
      _edit: {
        group_name: current.group_name,
        position: current.position,
        upload: this.#normalizeUpload({
          id: current.upload_id,
          url: current.upload_url,
        }),
      },
    });
  }

  @action
  cancelDropZoneEdit(id) {
    this.#replaceDropZoneFlash(id, {
      isEditing: false,
      _edit: null,
    });
  }

  @action
  updateDropZoneEditField(id, field, event) {
    const value = event?.target?.value;
    const current = this.#findDropZoneFlash(id);
    if (!current?._edit) {
      return;
    }

    this.#replaceDropZoneFlash(id, (item) => ({
      _edit: { ...item._edit, [field]: value },
    }));
  }

  @action
  setDropZoneEditUpload(id, upload) {
    const current = this.#findDropZoneFlash(id);
    if (!current?._edit) {
      return;
    }

    const normalized = this.#normalizeUpload(upload);
    if (!normalized) {
      return;
    }

    this.#replaceDropZoneFlash(id, (item) => ({
      _edit: { ...item._edit, upload: normalized },
    }));
  }

  @action
  clearDropZoneEditUpload(id) {
    const current = this.#findDropZoneFlash(id);
    if (!current?._edit) {
      return;
    }

    this.#replaceDropZoneFlash(id, (item) => ({
      _edit: { ...item._edit, upload: null },
    }));
  }

  @action
  handleDropZoneUploadError(error) {
    popupAjaxError(error);
  }

  @action
  async saveDropZoneEdit(id) {
    const current = this.#findDropZoneFlash(id);
    if (!current?._edit) {
      return;
    }

    const payload = {
      group_name: current._edit.group_name?.trim(),
      position: this.#normalizePosition(current._edit.position),
    };

    const uploadId = this.#uploadIdFor(current._edit.upload, current.upload_id);

    if (!payload.group_name || !uploadId) {
      popupAjaxError(
        new Error(I18n.t("rank_on_names.errors.missing_flash_fields"))
      );
      return;
    }

    payload.upload_id = uploadId;

    try {
      const updated = await ajax(
        `/admin/plugins/rank-on-names/drop-zone-flashes/${id}.json`,
        {
          type: "PUT",
          data: { drop_zone_flash: payload },
        }
      );

      this.#replaceDropZoneFlash(id, {
        ...updated,
        isEditing: false,
        _edit: null,
      });
      this.#broadcastDropZoneUpdate();
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  async deleteDropZoneFlash(id) {
    const current = this.#findDropZoneFlash(id);
    if (!current) {
      return;
    }

    if (
      !window.confirm(
        I18n.t("rank_on_names.drop_zone_delete_confirm", {
          group: current.group_name,
        })
      )
    ) {
      return;
    }

    try {
      await ajax(
        `/admin/plugins/rank-on-names/drop-zone-flashes/${id}.json`,
        {
          type: "DELETE",
        }
      );
      this.#setDropZoneFlashes(
        this.dropZoneFlashes.filter((item) => item.id !== id)
      );
      this.#broadcastDropZoneUpdate();
    } catch (error) {
      popupAjaxError(error);
    }
  }

  @action
  setNewDropZoneUpload(upload) {
    this.newDropZoneUpload = this.#normalizeUpload(upload);
  }

  @action
  clearNewDropZoneUpload() {
    this.newDropZoneUpload = null;
  }

  @action
  async createDropZoneFlash() {
    const payload = {
      group_name: this.newDropZoneGroupName?.trim(),
      upload_id: this.#uploadIdFor(this.newDropZoneUpload, null),
      position: this.#normalizePosition(this.newDropZonePosition),
    };

    if (!payload.group_name || !payload.upload_id) {
      popupAjaxError(
        new Error(I18n.t("rank_on_names.errors.missing_flash_fields"))
      );
      return;
    }

    this.isSavingDropZone = true;

    try {
      const created = await ajax(
        "/admin/plugins/rank-on-names/drop-zone-flashes.json",
        {
          type: "POST",
          data: { drop_zone_flash: payload },
        }
      );

      this.#setDropZoneFlashes([...this.dropZoneFlashes, created]);
      this.newDropZoneGroupName = "";
      this.newDropZonePosition = "";
      this.newDropZoneUpload = null;
      this.#broadcastDropZoneUpdate();
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.isSavingDropZone = false;
    }
  }
}
