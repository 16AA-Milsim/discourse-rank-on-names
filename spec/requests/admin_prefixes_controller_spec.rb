# frozen_string_literal: true

require "rails_helper"
require_relative "../../app/controllers/discourse_rank_on_names/admin_prefixes_controller"
require_relative "../../app/models/discourse_rank_on_names/prefix"
require_relative "../../app/serializers/discourse_rank_on_names/prefix_serializer"
require_relative "../../db/migrate/20250304120000_create_rank_on_names_prefixes"
require_relative "../../lib/discourse_rank_on_names"

class << SiteSetting
  attr_accessor :rank_on_names_enabled unless method_defined?(:rank_on_names_enabled)
end

RSpec.describe ::DiscourseRankOnNames::AdminPrefixesController, type: :request do
  before(:all) do
    migration = CreateRankOnNamesPrefixes.new
    migration.up unless ActiveRecord::Base.connection.table_exists?("rank_on_names_prefixes")

    Discourse::Application.routes.append do
      namespace :admin, constraints: StaffConstraint.new do
        namespace :plugins do
          scope path: "rank-on-names" do
            resources :prefixes,
                      controller: "/discourse_rank_on_names/admin_prefixes",
                      only: %i[index create update destroy]
          end
        end
      end
    end

    Rails.application.reload_routes!
  end

  after(:all) do
    Rails.application.reload_routes!
  end
  fab!(:admin) { Fabricate(:admin) }

  before do
    sign_in(admin)
    SiteSetting.rank_on_names_enabled = true
  end

  def prefix_payload(attrs = {})
    {
      prefix: {
        group_name: "Test_Group",
        prefix: "TG",
        position: 99,
      }.merge(attrs),
    }
  end

  it "lists prefixes" do
    get "/admin/plugins/rank-on-names/prefixes.json"
    expect(response.status).to eq(200)
    body = response.parsed_body
    expect(body["prefixes"]).to be_an(Array)
    expect(body["drop_zone_flashes"]).to be_an(Array)
  end

  it "creates a prefix" do
    expect {
      post "/admin/plugins/rank-on-names/prefixes.json", params: prefix_payload
    }.to change { ::DiscourseRankOnNames::Prefix.count }.by(1)

    expect(response.status).to eq(200)
    body = response.parsed_body
    expect(body["group_name"]).to eq("Test_Group")
    expect(body["prefix"]).to eq("TG")
  end

  it "updates a prefix" do
    prefix = ::DiscourseRankOnNames::Prefix.create!(
      group_name: "Test_Group",
      prefix: "TG",
      position: 10
    )

    put "/admin/plugins/rank-on-names/prefixes/#{prefix.id}.json",
        params: prefix_payload(prefix: "TG-Updated", position: 5)

    expect(response.status).to eq(200)
    expect(prefix.reload.prefix).to eq("TG-Updated")
    expect(prefix.position).to eq(5)
  end

  it "deletes a prefix" do
    prefix = ::DiscourseRankOnNames::Prefix.create!(
      group_name: "Test_Group",
      prefix: "TG",
      position: 10
    )

    expect {
      delete "/admin/plugins/rank-on-names/prefixes/#{prefix.id}.json"
    }.to change { ::DiscourseRankOnNames::Prefix.count }.by(-1)

    expect(response.status).to eq(200)
  end
end
