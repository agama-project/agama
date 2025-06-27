# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "json"

module Agama
  # :nodoc:
  module AutoYaST
    # Builds an Agama "localization" section from an AutoYaST profile.
    class LocalizationReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash to corresponds to Agama "l10n" section
      #
      # If there is no l10n information, it returns an empty hash.
      #
      # @return [Hash] Agama "localization" section
      def read
        localization = keyboard
          .merge(language)
          .merge(timezone)
        localization.empty? ? {} : { "localization" => localization }
      end

    private

      attr_reader :profile

      def keyboard
        ay_keymap = profile.fetch_as_hash("keyboard")["keymap"]
        return {} if ay_keymap.nil?

        keyboard = yast_keyboards.find { |k| k["alias"] == ay_keymap }
        keymap = if keyboard
          keyboard["code"]
        else
          ay_keymap
        end

        { "keyboard" => keymap.to_s }
      end

      def language
        section = profile.fetch_as_hash("language")
        lang = section["language"].to_s
        return {} if lang.empty?

        lang = lang.include?(".") ? lang : "#{lang}.UTF-8"
        { "language" => lang }
      end

      def timezone
        section = profile.fetch_as_hash("timezone")
        timezone = section["timezone"]
        return {} if timezone.nil?

        { "timezone" => timezone.to_s }
      end

      YAST_KEYBOARDS_MAP = "/usr/share/agama/yast-keyboards.json"

      def yast_keyboards
        return @keymaps_map if @keymaps_map

        local_path = File.expand_path("../../../share/yast-keyboards.json", __dir__)
        puts local_path
        path = if File.exist?(local_path)
          local_path
        else
          "/usr/share/agama/yast-keyboards.json"
        end

        @keymaps_map = JSON.parse(File.read(path))
      end
    end
  end
end
