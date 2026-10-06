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

require "agama/autoyast/users_profile_reader"

module Agama
  module AutoYaST
    # Builds the Agama "root" section from an AutoYaST profile.
    class RootReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "root" section.
      #
      # @return [Hash] Agama "root" section
      def read
        root_user = users_reader.root
        return {} unless root_user

        hsh = {}
        password = root_user["user_password"]

        if password
          hsh["password"] = password.to_s
          hsh["hashedPassword"] = true if root_user["encrypted"]
        end

        hsh = hsh.merge(setup_ssh(root_user))

        return {} if hsh.empty?

        { "root" => hsh }
      end

    private

      attr_reader :profile

      # @return [UsersProfileReader]
      def users_reader
        @users_reader ||= UsersProfileReader.new(profile)
      end

      def setup_ssh(root_user)
        hsh = {}
        keys = root_user["authorized_keys"] || []

        hsh["sshPublicKeys"] = keys unless keys.empty?

        hsh
      end
    end
  end
end
