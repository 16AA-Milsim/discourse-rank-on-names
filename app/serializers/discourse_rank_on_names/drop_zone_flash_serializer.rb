# frozen_string_literal: true

module ::DiscourseRankOnNames
  class DropZoneFlashSerializer < ApplicationSerializer
    attributes :id,
               :group_name,
               :position,
               :upload_id,
               :upload_url,
               :css_class,
               :created_at,
               :updated_at

    def upload_url
      object.upload&.url
    end

    def css_class
      ::DiscourseRankOnNames.css_class_for_group_name(object.group_name)
    end
  end
end

