# frozen_string_literal: true

module ::DiscourseRankOnNames
  GROUP_PREFIXES = {
    "Major" => "Maj",
    "Captain" => "Capt",
    "Lieutenant" => "Lt",
    "Second Lieutenant" => "2Lt",
    "Acting Second Lieutenant" => "A/2Lt",
    "Warrant Officer Class 2" => "WO2",
    "Colour Sergeant" => "CSgt",
    "Staff Sergeant" => "SSgt",
    "Sergeant" => "Sgt",
    "Acting Sergeant" => "A/Sgt",
    "Corporal" => "Cpl",
    "Acting Corporal" => "A/Cpl",
    "Bombardier" => "Bdr",
    "Acting Bombardier" => "A/Bdr",
    "Lance Corporal" => "LCpl",
    "Acting Lance Corporal" => "A/LCpl",
    "Lance Bombardier" => "LBdr",
    "Acting Lance Bombardier" => "A/LBdr",
    "Gunner" => "Gnr",
    "Private" => "Pte",
    "Recruit" => "Rec",
    "Squadron Leader" => "Sqn Ldr",
    "Flight Lieutenant" => "Flt Lt",
    "Flying Officer" => "Fg Off",
    "Pilot Officer" => "Plt Off",
    "Flight Sergeant Aircrew" => "FSAcr",
    "Sergeant Aircrew" => "SAcr",
  }.freeze

  GROUP_PRIORITY = GROUP_PREFIXES.keys.freeze
  CACHE_NAMESPACE = "rank_on_names:prefix".freeze

  module_function

  def clear_cache!
    keys = Discourse.cache.keys("#{CACHE_NAMESPACE}:*")
    return if keys.empty?

    Discourse.redis.pipelined { |pipeline| keys.each { |key| pipeline.del(key) } }
  end

  def prefix_for_basic_user(object)
    user = extract_user_from_basic_serializer_object(object)
    prefix_for_user(user)
  end

  def prefix_for_post(post)
    return nil unless post.respond_to?(:user)

    prefix_for_user(post.user)
  end

  def prefix_for_user(user)
    user_id = extract_user_id(user)
    return nil if user_id.blank?

    Discourse.cache.fetch(cache_key(user_id)) { select_prefix(group_names_for_user(user_id)) }
  end

  def group_names_for_user(user_id)
    GroupUser
      .joins(:group)
      .where(user_id: user_id, groups: { name: GROUP_PRIORITY })
      .pluck("groups.name")
  end

  def select_prefix(group_names)
    GROUP_PRIORITY.each do |group_name|
      return GROUP_PREFIXES[group_name] if group_names.include?(group_name)
    end

    nil
  end

  def invalidate_user(user)
    user_id = extract_user_id(user)
    return if user_id.blank?

    Discourse.cache.delete(cache_key(user_id))
  end

  def cache_key(user_id)
    "#{CACHE_NAMESPACE}:#{user_id}"
  end

  def extract_user_from_basic_serializer_object(object)
    if object.respond_to?(:user)
      object.user
    elsif object.respond_to?(:[])
      object[:user] || object["user"] || object
    else
      object
    end
  end

  def extract_user_id(user)
    if user.respond_to?(:id)
      user.id
    elsif user.is_a?(Hash)
      user[:id] || user["id"] || user[:user_id] || user["user_id"]
    end
  end
end
