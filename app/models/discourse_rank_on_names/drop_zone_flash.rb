# frozen_string_literal: true

module ::DiscourseRankOnNames
  class DropZoneFlash < ActiveRecord::Base
    self.table_name = "rank_on_names_drop_zone_flashes"

    belongs_to :upload

    validates :group_name, presence: true, uniqueness: true
    validates :upload, presence: true
    validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }

    validate :upload_must_be_image

    before_validation :assign_default_position, on: :create

    scope :ordered, -> { order(:position, :id) }

    after_commit -> { ::DiscourseRankOnNames.clear_cache! }

    private

    def assign_default_position
      return if position.present?

      max_position = self.class.maximum(:position) || 0
      self.position = max_position + 1
    end

    def upload_must_be_image
      return unless upload

      extension = upload.extension&.downcase
      if extension.blank? || !::FileHelper.is_supported_image?("image.#{extension}")
        errors.add(:upload, :must_be_image)
      end
    end
  end
end
