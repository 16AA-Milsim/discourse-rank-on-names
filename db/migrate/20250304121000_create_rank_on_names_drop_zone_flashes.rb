# frozen_string_literal: true

class CreateRankOnNamesDropZoneFlashes < ActiveRecord::Migration[7.0]
  def up
    create_table :rank_on_names_drop_zone_flashes do |t|
      t.string :group_name, null: false
      t.integer :upload_id, null: false
      t.integer :position, null: false
      t.timestamps
    end

    add_index :rank_on_names_drop_zone_flashes, :group_name, unique: true
    add_index :rank_on_names_drop_zone_flashes, :upload_id
    add_foreign_key :rank_on_names_drop_zone_flashes, :uploads
  end

  def down
    drop_table :rank_on_names_drop_zone_flashes
  end
end
