# frozen_string_literal: true

# name: discourse-rank-on-names
# about: Prefix usernames with military rank abbreviations based on group membership
# version: 0.1
# authors: Codex & Darojax
# url: https://github.com/16AA-Milsim/discourse-rank-on-names

register_asset "stylesheets/common/discourse-rank-on-names.scss"

after_initialize do
  require_relative "lib/discourse_rank_on_names"

  ::DiscourseRankOnNames.clear_cache!

  add_to_serializer(:basic_user, :rank_prefix) do
    ::DiscourseRankOnNames.prefix_for_basic_user(object)
  end

  add_to_serializer(:post, :rank_prefix) { ::DiscourseRankOnNames.prefix_for_post(object) }
  add_to_serializer(:current_user, :rank_prefix) { ::DiscourseRankOnNames.prefix_for_user(object) }
  add_to_serializer(:user, :rank_prefix) { ::DiscourseRankOnNames.prefix_for_user(object) }
  add_to_serializer(:user_card, :rank_prefix) { ::DiscourseRankOnNames.prefix_for_user(object) }

  group_change_handler = proc { |user, group, **| ::DiscourseRankOnNames.invalidate_user(user) }

  DiscourseEvent.on(:user_added_to_group, &group_change_handler)
  DiscourseEvent.on(:user_removed_from_group, &group_change_handler)
end
