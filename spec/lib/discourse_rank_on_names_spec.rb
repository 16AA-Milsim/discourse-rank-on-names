# frozen_string_literal: true

require "rails_helper"
require_relative "../../lib/discourse_rank_on_names"
require_relative "../../db/migrate/20250304120000_create_rank_on_names_prefixes"
require_relative "../../db/migrate/20250304121000_create_rank_on_names_drop_zone_flashes"

class << SiteSetting
  attr_accessor :rank_on_names_enabled unless method_defined?(:rank_on_names_enabled)
end

RSpec.describe ::DiscourseRankOnNames do
  before(:all) do
    prefixes_migration = CreateRankOnNamesPrefixes.new
    drop_zone_migration = CreateRankOnNamesDropZoneFlashes.new
    prefixes_migration.up unless ActiveRecord::Base.connection.table_exists?("rank_on_names_prefixes")
    drop_zone_migration.up unless ActiveRecord::Base.connection.table_exists?("rank_on_names_drop_zone_flashes")
  end

  fab!(:group_one) { Fabricate(:group, name: "1-1_Section") }
  fab!(:group_two) { Fabricate(:group, name: "1-2_Section") }
  fab!(:user) { Fabricate(:user) }
  fab!(:upload_one) do
    Fabricate(:upload, original_filename: "flash1.png", extension: "png")
  end
  fab!(:upload_two) do
    Fabricate(:upload, original_filename: "flash2.png", extension: "png")
  end

  before do
    ::DiscourseRankOnNames::DropZoneFlash.delete_all
    ::DiscourseRankOnNames::Prefix.delete_all
    ::DiscourseRankOnNames.clear_cache!
    SiteSetting.rank_on_names_enabled = true
    group_one.add(user)
    group_two.add(user)
    described_class::DropZoneFlash.create!(
      group_name: group_two.name,
      upload: upload_two,
      position: 2
    )
    described_class::DropZoneFlash.create!(
      group_name: group_one.name,
      upload: upload_one,
      position: 1
    )
  end

  it "selects the highest priority drop zone flash for the user" do
    flash = described_class.drop_zone_flash_for_user(user)
    expect(flash[:group_name]).to eq(group_one.name)
    expect(flash[:css_class]).to eq(described_class.css_class_for_group_name(group_one.name))
    expect(flash[:upload_url]).to eq(upload_one.url)
  end

  it "returns nil when no drop zone flashes are configured for the user" do
    group_one.remove(user)
    group_two.remove(user)
    expect(described_class.drop_zone_flash_for_user(user)).to be_nil
  end

  it "respects cache invalidation when drop zone flashes change" do
    expect(described_class.drop_zone_flash_for_user(user)[:group_name]).to eq(group_one.name)
    described_class::DropZoneFlash.find_by!(group_name: group_one.name).destroy!
    ::DiscourseRankOnNames.invalidate_user(user)
    flash = described_class.drop_zone_flash_for_user(user)
    expect(flash[:group_name]).to eq(group_two.name)
  end
end
