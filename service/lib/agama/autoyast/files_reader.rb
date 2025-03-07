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
  module AutoYaST
    # Builds the Agama "files" section from an AutoYaST profile.
    class FilesReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash corresponding to Agama "files" section.
      #
      # If there is no files-related information, it returns an empty hash.
      #
      # @return [Hash] Agama "files" section
      def read
        return {} if profile["files"].nil?

        # files section contains list of file nodes.
        # supported file sub-elements:
        # - file_location (a file source)
        # - file_path (this one seems to be the only mandatory,
        #             a file destination or directory to be created if ends with '/')
        # - file_owner
        # - file_permissions
        #
        # unsupported for now:
        # - file_content
        # - file_script
        return {}
      end

    private

      attr_reader :profile

    end
  end
end
