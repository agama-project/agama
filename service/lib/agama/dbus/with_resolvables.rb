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
      # @param packages [Array<Y2Storage::Feature::Package>]
      #
      # @return [String]
      def serialize_resolvables(packages)
        packages_json = packages.map { |p| package_json(p) }
        JSON.pretty_generate(packages_json)
      end

      # JSON representation of the given package.
      #
      # @param package [Y2Storage::Feature::Package]
      #
      # @return [Hash]
      def package_json(package)
        {
          name:     package.name,
          type:     "package",
          optional: package.optional?
        }
      end
    end
  end
end
