# frozen_string_literal: true

module ::DiscourseRankOnNames
  class AdminPrefixesController < ::Admin::AdminController
    def index
      prefixes = Prefix.ordered
      render_json_dump(prefixes: serialize_data(prefixes, PrefixSerializer))
    end

    def create
      prefix = Prefix.new(prefix_params)

      if prefix.save
        render_serialized(prefix, PrefixSerializer, root: false)
      else
        render_json_error(prefix)
      end
    end

    def update
      prefix = find_prefix

      if prefix.update(prefix_params)
        render_serialized(prefix, PrefixSerializer, root: false)
      else
        render_json_error(prefix)
      end
    end

    def destroy
      find_prefix.destroy!
      render_json_dump(success: true)
    end

    private

    def find_prefix
      Prefix.find(params[:id])
    end

    def prefix_params
      permitted =
        params
          .require(:prefix)
          .permit(:group_name, :prefix, :position)
          .to_h
          .symbolize_keys

      if permitted[:position].present?
        permitted[:position] = permitted[:position].to_i
      else
        permitted.delete(:position)
      end

      permitted
    end
  end
end
