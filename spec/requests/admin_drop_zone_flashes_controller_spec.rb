# frozen_string_literal: true

require "rails_helper"
require_relative "../../app/controllers/discourse_rank_on_names/admin_drop_zone_flashes_controller"
require_relative "../../app/models/discourse_rank_on_names/drop_zone_flash"
require_relative "../../app/serializers/discourse_rank_on_names/drop_zone_flash_serializer"
require_relative "../../lib/discourse_rank_on_names"
require_relative "../../db/migrate/20250304121000_create_rank_on_names_drop_zone_flashes"

class << SiteSetting
  attr_accessor :rank_on_names_enabled unless method_defined?(:rank_on_names_enabled)
end

RSpec.describe ::DiscourseRankOnNames::AdminDropZoneFlashesController,
               type: :request do
  before(:all) do
    migration = CreateRankOnNamesDropZoneFlashes.new
    migration.up unless ActiveRecord::Base.connection.table_exists?("rank_on_names_drop_zone_flashes")

    Discourse::Application.routes.append do
      namespace :admin, constraints: StaffConstraint.new do
        namespace :plugins do
          scope path: "rank-on-names" do
            resources :drop_zone_flashes,
                      path: "drop-zone-flashes",
                      controller: "/discourse_rank_on_names/admin_drop_zone_flashes",
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
  fab!(:upload) do
    Fabricate(:upload, original_filename: "flash.png", extension: "png")
  end

  before do
    sign_in(admin)
    SiteSetting.rank_on_names_enabled = true
  end

  def flash_payload(attrs = {})
    {
      drop_zone_flash: {
        group_name: "Test_Group",
        upload_id: upload.id,
        position: 42,
      }.merge(attrs),
    }
  end

  it "lists drop zone flashes" do
    get "/admin/plugins/rank-on-names/drop-zone-flashes.json"
    expect(response.status).to eq(200)
    expect(response.parsed_body["drop_zone_flashes"]).to be_an(Array)
  end

  it "creates a drop zone flash" do
    expect {
      post "/admin/plugins/rank-on-names/drop-zone-flashes.json",
           params: flash_payload
    }.to change { ::DiscourseRankOnNames::DropZoneFlash.count }.by(1)

    expect(response.status).to eq(200)
    body = response.parsed_body
    expect(body["group_name"]).to eq("Test_Group")
    expect(body["upload_id"]).to eq(upload.id)
  end

  it "updates a drop zone flash" do
    flash =
      ::DiscourseRankOnNames::DropZoneFlash.create!(
        group_name: "Test_Group",
        upload: upload,
        position: 10
      )

    new_upload =
      Fabricate(:upload, original_filename: "flash2.png", extension: "png")

    put "/admin/plugins/rank-on-names/drop-zone-flashes/#{flash.id}.json",
        params:
          flash_payload(
            group_name: "Updated_Group",
            upload_id: new_upload.id,
            position: 5
          )

    expect(response.status).to eq(200)

    flash.reload
    expect(flash.group_name).to eq("Updated_Group")
    expect(flash.upload_id).to eq(new_upload.id)
    expect(flash.position).to eq(5)
  end

  it "deletes a drop zone flash" do
    flash =
      ::DiscourseRankOnNames::DropZoneFlash.create!(
        group_name: "Test_Group",
        upload: upload,
        position: 10
      )

    expect {
      delete "/admin/plugins/rank-on-names/drop-zone-flashes/#{flash.id}.json"
    }.to change { ::DiscourseRankOnNames::DropZoneFlash.count }.by(-1)

    expect(response.status).to eq(200)
  end
end
