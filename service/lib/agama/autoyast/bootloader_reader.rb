# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "y2users/config"
require "y2users/autoinst/reader"

# :nodoc:
module Agama
  module AutoYaST
    # Builds the Agama "root" section from an AutoYaST profile.
    class BootloaderReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "root" section.
      #
      # @return [Hash] Agama "root" section
      def read
        global = profile.fetch_as_hash("bootloader")
          .fetch_as_hash("global")
        return {} if global.empty?

        bootloader = {}
        bootloader["timeout"] = global["timeout"] if global["timeout"].is_a?(Integer)
        bootloader["extraKernelParams"] = global["append"] unless global["append"].to_s.empty?
        { "bootloader" => bootloader }
      end

    private

      attr_reader :profile
    end
  end
end
