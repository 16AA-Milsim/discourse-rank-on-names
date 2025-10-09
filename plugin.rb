# frozen_string_literal: true

# name: discourse-rank-on-names
# about: Prefix usernames with military rank abbreviations based on group membership
# version: 0.1
# authors: Codex & Darojax
# url: https://github.com/16AA-Milsim/discourse-rank-on-names

register_asset "stylesheets/common/discourse-rank-on-names.scss"
add_admin_route "rank_on_names.title", "rank-on-names"

root_path = File.expand_path("..", __FILE__)

after_initialize do
  require_relative "lib/discourse_rank_on_names"
  require_relative "app/models/discourse_rank_on_names/prefix"
  require_relative "app/serializers/discourse_rank_on_names/prefix_serializer"
  require_relative "app/controllers/discourse_rank_on_names/admin_prefixes_controller"

  Discourse::Application.routes.append do
    namespace :admin, constraints: StaffConstraint.new do
      get "plugins/rank-on-names" => "admin/plugins#index",
          as: :admin_plugins_rank_on_names

      namespace :plugins do
        scope path: "rank-on-names" do
          resources :prefixes,
                    controller: "/discourse_rank_on_names/admin_prefixes",
                    only: %i[index create update destroy]
        end
      end
    end
  end

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
