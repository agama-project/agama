# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
  module DBus
    # Mixin to manage resolvables.
    module WithResolvables
      # Generates the serialized JSON of the given resolvables.
      #
      # @param patterns [Array<String>]
      # @param packages [Array<String>]
      #
      # @return [String]
      def serialize_resolvables(patterns: [], packages: [])
        patterns_json = patterns.map { |p| resolvable_json(p, type: "pattern") }
        packages_json = packages.map { |p| resolvable_json(p, type: "package") }
        JSON.pretty_generate(patterns_json + packages_json)
      end

      # JSON representation of the given resolvable.
      #
      # @param name [String]
      # @param type ["pattern", "package"]
      #
      # @return [Hash]
      def resolvable_json(name, type: "package")
        {
          name: name,
          type: type
        }
      end
    end
  end
end
