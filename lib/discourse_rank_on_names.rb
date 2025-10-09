# frozen_string_literal: true

module ::DiscourseRankOnNames
  LOG_PREFIX = "[RankOnNames]".freeze
  DEBUG_LOGGING = ENV["RANK_ON_NAMES_DEBUG"] == "1"

  def log(message, payload = nil)
    return unless DEBUG_LOGGING

    Rails.logger.debug do
      msg = "#{LOG_PREFIX} #{message}"
      payload ? "#{msg} -- #{payload.inspect}" : msg
    end
  end

  DEFAULT_GROUP_PREFIXES = {
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

  CACHE_NAMESPACE = "rank_on_names:prefix".freeze

  module_function

  module_function :log

  def clear_cache!
    log("clear_cache requested")
    keys = Discourse.cache.keys("#{CACHE_NAMESPACE}:*")
    keys << prefix_list_cache_key unless keys.include?(prefix_list_cache_key)
    return if keys.empty?

    log("clear_cache keys", keys: keys)

    Discourse.redis.pipelined do |pipeline|
      keys.each { |cache_key| pipeline.del(cache_key) }
    end
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
    return nil unless enabled?

    user_id = extract_user_id(user)
    return nil if user_id.blank?

    log("prefix_for_user", user_id: user_id)
    Discourse.cache.fetch(cache_key(user_id)) { select_prefix(group_names_for_user(user_id)) }
  end

  def group_names_for_user(user_id)
    names_of_interest = enabled? ? ordered_prefixes.map(&:first) : []
    log("group_names_for_user", user_id: user_id, names_of_interest: names_of_interest)
    return [] if names_of_interest.empty?

    GroupUser
      .joins(:group)
      .where(user_id: user_id, groups: { name: names_of_interest })
      .pluck("groups.name")
  end

  def enabled?
    enabled = SiteSetting.rank_on_names_enabled
    log("enabled?", enabled: enabled)
    enabled
  end

  def select_prefix(group_names)
    log("select_prefix", group_names: group_names)
    ordered_prefixes.each do |group_name, prefix|
      return prefix if group_names.include?(group_name)
    end

    log("select_prefix miss", group_names: group_names)

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

  def ordered_prefixes
    Discourse.cache.fetch(prefix_list_cache_key) do
      prefixes = ::DiscourseRankOnNames::Prefix.ordered.pluck(:group_name, :prefix)
      prefixes = DEFAULT_GROUP_PREFIXES.to_a if prefixes.blank?
      log("ordered_prefixes", prefixes: prefixes)
      prefixes
    end
  end

  def prefix_list_cache_key
    "#{CACHE_NAMESPACE}:list"
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
