# frozen_string_literal: true

module ::DiscourseRankOnNames
  class PrefixSerializer < ApplicationSerializer
    attributes :id,
               :group_name,
               :prefix,
               :position,
               :created_at,
               :updated_at
  end
end
