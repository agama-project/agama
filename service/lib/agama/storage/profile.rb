# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

require "agama/storage/boot_settings"
require "agama/storage/settings"

module Agama
  module Storage
    # Settings used to calculate an storage proposal.
    class Profile
      # Boot settings.
      #
      # @return [BootSettings]
      attr_accessor :boot

      attr_accessor :drives
      attr_accessor :volume_groups
      attr_accessor :md_raids
      attr_accessor :btrfs_raids
      attr_accessor :nfs_mounts
      attr_accessor :original_graph

      def initialize
        @boot = BootSettings.new
        @drives = []
        @volume_groups = []
        @md_raids = []
        @btrfs_raids = []
        @nfs_mounts = []
      end

      # Creates a new proposal settings object from JSON hash according to schema.
      #
      # @param settings_json [Hash]
      # @param config [Config]
      #
      # @return [Settings]
      def self.new_from_json(settings_json, config:)
        Storage::SettingsConversions::FromJSON.new(settings_json).convert
      end

      # Generates a JSON hash according to schema.
      #
      # @return [Hash]
      def to_json_settings
        Storage::ProposalSettingsConversions::ToJSON.new(self).convert
      end

      # Device used for booting.
      #
      # @return [String, nil]
      def explicit_boot_device
        return nil unless boot.configure?

        boot.device
      end
    end
  end
end
