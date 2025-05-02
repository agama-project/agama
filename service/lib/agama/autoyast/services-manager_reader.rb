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

require "yast"
Yast.import "URL"

# :nodoc:
module Agama
  module AutoYaST
    # Converts AutoYaST's <services-manager> section into post-install script(s). See the ScriptsReader
    # for a details.
    #
    # Conversion is not done in one-to-one manner. Several services can be joined into one post script.
    class ServicesManagerReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
        @index = 0
      end

      # Returns a hash with list of post-install script(s).
      #
      # @return [Hash] Agama "scripts" section
      def read
        # 1) create "post" => [... list of hashes defining a scipt ...]"
        # 2) each script has to contain name ("randomized/indexed" one or e.g. based on service name) and chroot option
        # 3) script body is one or two lines per service, particular command depends on AY's service type
        return {}
      end

    private

      attr_reader :profile

    end
  end
end
