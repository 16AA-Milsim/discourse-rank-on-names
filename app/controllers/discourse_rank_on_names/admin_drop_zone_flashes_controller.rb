# frozen_string_literal: true

module ::DiscourseRankOnNames
  class AdminDropZoneFlashesController < ::Admin::AdminController
    def index
      flashes = DropZoneFlash.includes(:upload).ordered
      render_json_dump(
        drop_zone_flashes: serialize_data(flashes, DropZoneFlashSerializer)
      )
    end

    def create
      ensure_enabled!
      flash = DropZoneFlash.new(flash_params)

      if flash.save
        render_serialized(flash, DropZoneFlashSerializer, root: false)
      else
        render_json_error(flash)
      end
    end

    def update
      ensure_enabled!
      flash = find_flash

      if flash.update(flash_params)
        render_serialized(flash, DropZoneFlashSerializer, root: false)
      else
        render_json_error(flash)
      end
    end

    def destroy
      ensure_enabled!
      find_flash.destroy!
      render_json_dump(success: true)
    end

    private

    def ensure_enabled!
      raise Discourse::InvalidAccess unless SiteSetting.rank_on_names_enabled
    end

    def find_flash
      DropZoneFlash.find(params[:id])
    end

    def flash_params
      permitted =
        params
          .require(:drop_zone_flash)
          .permit(:group_name, :upload_id, :position)
          .to_h
          .symbolize_keys

      if permitted[:upload_id].present?
        permitted[:upload_id] = permitted[:upload_id].to_i
      end

      if permitted[:position].present?
        permitted[:position] = permitted[:position].to_i
      else
        permitted.delete(:position)
      end

      permitted
    end
  end
end
