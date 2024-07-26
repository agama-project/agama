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
require "y2users/config"
require "y2users/autoinst/reader"

# :nodoc:
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
        root_user = config.users.find { |u| u.name == "root" }
        return {} unless root_user

        hsh = { "password" => root_user.password.value.to_s }
        public_key = root_user.authorized_keys.first
        hsh["sshPublicKey"] = public_key if public_key
        { "root" => hsh }
      end

    private

      attr_reader :profile

      # @return [Y2Users::Config] Users configuration
      def config
        return @config if @config

        reader = Y2Users::Autoinst::Reader.new(profile)
        result = reader.read
        @config = result.config
      end
    end
  end
end
