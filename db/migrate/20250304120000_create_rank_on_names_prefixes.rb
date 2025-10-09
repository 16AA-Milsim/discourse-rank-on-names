# frozen_string_literal: true

class CreateRankOnNamesPrefixes < ActiveRecord::Migration[7.0]
  DEFAULT_PREFIXES = {
    "Major" => "Maj",
    "Captain" => "Capt",
    "Lieutenant" => "Lt",
    "Second_Lieutenant" => "2Lt",
    "Acting_Second_Lieutenant" => "A/2Lt",
    "Warrant_Officer_Class_2" => "WO2",
    "Colour_Sergeant" => "CSgt",
    "Staff_Sergeant" => "SSgt",
    "Sergeant" => "Sgt",
    "Acting_Sergeant" => "A/Sgt",
    "Corporal" => "Cpl",
    "Acting_Corporal" => "A/Cpl",
    "Bombardier" => "Bdr",
    "Acting_Bombardier" => "A/Bdr",
    "Lance_Corporal" => "LCpl",
    "Acting_Lance_Corporal" => "A/LCpl",
    "Lance_Bombardier" => "LBdr",
    "Acting_Lance_Bombardier" => "A/LBdr",
    "Gunner" => "Gnr",
    "Private" => "Pte",
    "Recruit" => "Rec",
    "Squadron_Leader" => "Sqn Ldr",
    "Flight_Lieutenant" => "Flt Lt",
    "Flying_Officer" => "Fg Off",
    "Pilot_Officer" => "Plt Off",
    "Flight_Sergeant_Aircrew" => "FSAcr",
    "Sergeant_Aircrew" => "SAcr",
  }.freeze

  def up
    create_table :rank_on_names_prefixes do |t|
      t.string :group_name, null: false
      t.string :prefix, null: false
      t.integer :position, null: false
      t.timestamps
    end

    add_index :rank_on_names_prefixes, :group_name, unique: true

    DEFAULT_PREFIXES.each_with_index do |(group_name, prefix), index|
      execute <<~SQL
        INSERT INTO rank_on_names_prefixes (group_name, prefix, position, created_at, updated_at)
        VALUES ('#{group_name}', '#{prefix}', #{index + 1}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (group_name) DO NOTHING
      SQL
    end
  end

  def down
    drop_table :rank_on_names_prefixes
  end
end
