import Component from "@glimmer/component";
import { action } from "@ember/object";
import { getOwner } from "@ember/owner";
import DButton from "discourse/components/d-button";
import UppyUpload from "discourse/lib/uppy/uppy-upload";
import { getURLWithCDN } from "discourse/lib/get-url";
import I18n from "I18n";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";

export default class DropZoneFlashUpload extends Component {
  static nextId = 0;

  inputId = null;

  uppyUpload = null;

  constructor(owner, args) {
    super(owner, args);
    const unique =
      this.args.id ||
      `drop-zone-flash-upload-${DropZoneFlashUpload.nextId++}`;
    this.inputId = unique;
    this.uppyUpload = new UppyUpload(getOwner(this), {
      id: unique,
      type: "rank_drop_zone_flash",
      validateUploadedFilesOptions: { imagesOnly: true },
      uploadDone: (upload) => {
        this.args.onUpload?.(upload);
      },
      uploadError: (error) => {
        this.args.onUploadError?.(error);
      },
    });
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.uppyUpload?.teardown();
  }

  get isBusy() {
    return (
      this.uppyUpload?.uploading ||
      this.uppyUpload?.processing ||
      this.args.disabled
    );
  }

  get buttonLabel() {
    if (this.uppyUpload?.uploading || this.uppyUpload?.processing) {
      const progress = Math.round(this.uppyUpload?.uploadProgress || 0);
      return I18n.t("rank_on_names.drop_zone.uploading", { progress });
    }

    return I18n.t("rank_on_names.drop_zone.select_image");
  }

  get buttonIcon() {
    return this.uppyUpload?.uploading ? "spinner" : "plus";
  }

  get previewUrl() {
    const url = this.args.upload?.url || this.args.upload?.upload_url;
    if (!url) {
      return null;
    }

    return getURLWithCDN(url);
  }

  get previewAlt() {
    return I18n.t("rank_on_names.drop_zone.preview_alt", {
      group: this.args.groupName || "",
    });
  }

  get showRemoveButton() {
    return typeof this.args.onRemove === "function" && !!this.previewUrl;
  }

  @action
  setupInput(element) {
    this.uppyUpload?.setup(element);
  }

  @action
  chooseFile() {
    this.uppyUpload?.openPicker();
  }

  @action
  removeUpload() {
    this.args.onRemove?.();
  }

  <template>
    <div class="rank-on-names-upload">
      <input
        id={{this.inputId}}
        class="rank-on-names-upload__input"
        accept="image/*"
        type="file"
        disabled={{this.isBusy}}
        {{didInsert this.setupInput}}
      />
      <DButton
        @action={{this.chooseFile}}
        @translatedLabel={{this.buttonLabel}}
        @icon={{this.buttonIcon}}
        @spinner={{this.uppyUpload?.uploading}}
        @buttonClass="btn-small"
        @disabled={{this.isBusy}}
      />
      {{#if this.previewUrl}}
        <img
          src={{this.previewUrl}}
          alt={{this.previewAlt}}
          width="16"
          height="16"
          class="rank-on-names-upload__preview"
        />
      {{/if}}
      {{#if this.showRemoveButton}}
        <DButton
          @action={{this.removeUpload}}
          @icon="xmark"
          @buttonClass="btn-small"
          @label="rank_on_names.drop_zone.clear_image"
          @disabled={{this.args.disabled}}
        />
      {{/if}}
    </div>
  </template>
}
