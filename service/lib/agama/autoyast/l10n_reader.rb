#!/usr/bin/env ruby
# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "yast"

# :nodoc:
module Agama
  # :nodoc:
  module AutoYaST
    # Extracts the localization information from an AutoYaST profile.
    class L10nReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # @return [Hash] Agama "l10n" section
      def read
        l10n = keyboard
          .merge(languages)
          .merge(timezone)
        l10n.empty? ? {} : { "l10n" => l10n }
      end

    private

      attr_reader :profile

      def keyboard
        section = profile.fetch_as_hash("keyboard")
        keymap = section["keymap"]
        return {} if keymap.nil?

        { "keyboard" => keymap.to_s }
      end

      def languages
        section = profile.fetch_as_hash("language")
        primary = section["language"]
        secondary = section["languages"].to_s.split(",").map(&:strip)

        languages = []
        languages.push(primary.to_s) unless primary.nil?
        languages.concat(secondary)

        with_encoding = languages.map do |lang|
          lang.include?(".") ? lang : "#{lang}.UTF-8"
        end

        with_encoding.empty? ? {} : { "languages" => with_encoding.uniq }
      end

      def timezone
        section = profile.fetch_as_hash("timezone")
        timezone = section["timezone"]
        return {} if timezone.nil?

        { "timezone" => timezone.to_s }
      end
    end
  end
end
