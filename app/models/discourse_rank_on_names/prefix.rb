# frozen_string_literal: true

module ::DiscourseRankOnNames
  class Prefix < ActiveRecord::Base
    self.table_name = "rank_on_names_prefixes"

    validates :group_name, presence: true, uniqueness: true
    validates :prefix, presence: true
    validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }

    before_validation :assign_default_position, on: :create

    scope :ordered, -> { order(:position, :id) }

    after_commit -> { ::DiscourseRankOnNames.clear_cache! }

    private

    def assign_default_position
      return if position.present?

      max_position = self.class.maximum(:position) || 0
      self.position = max_position + 1
    end
  end
end
