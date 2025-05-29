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

require "agama/storage/system"

module Agama
  module Storage
    # Class for automatically configuring storage.
    class Configurator
      # @param proposal [Storage::Proposal] Proposal manager used for calculating a proposal.
      def initialize(proposal)
        @proposal = proposal
      end

      # Configures storage.
      #
      # If no config is given, then it tries with several auto-generated configs.
      #
      # @param storage_json [Hash, nil] Storage config according to JSON schema.
      # @return [Boolean] Whether storage was correctly configured.
      def configure(storage_json = nil)
        configs = [storage_json || generate_configs].flatten
        # Repeat the first config if everything fails.
        configs << configs.first if configs.size > 1

        configs.each do |config|
          proposal.calculate_from_json(config)
          break if proposal.success?
        end

        proposal.success?
      end

    private

      MAX_CONFIGS = 5
      private_constant :MAX_CONFIGS

      # @return [Storage::Proposal]
      attr_reader :proposal

      # Generates JSON configs to use for configuring storage.
      #
      # @return [Array<Hash>]
      def generate_configs
        candidate_devices
          .first(MAX_CONFIGS)
          .map { |d| generate_config(d) }
      end

      # Generates the default storage JSON config for the given device.
      #
      # @param device [Y2Storage::BlkDevice]
      # @return [Hash]
      def generate_config(device)
        proposal.default_storage_json(device)
      end

      # Candidate devices to use for configuring storage.
      #
      # It there are BOSS devices, then the installation is only tried in such devices.
      #
      # The possible candidate devices are sorted, placing boot-optimized devices at the beginning
      # and removable devices (like USB) at the end.
      #
      # @return [Array<Y2Storage::BlkDevice>]
      def candidate_devices
        candidates = system.candidate_md_raids + system.candidate_drives

        boss = candidates.select(&:boss?)
        return boss if boss.any?

        removable, rest = candidates.partition { |d| maybe_removable?(d) }
        rest + removable
      end

      # Whether the given device is potentially a removable device.
      #
      # It's not always possible to detect whether a given device is physically removable or not
      # (e.g., a fixed device may be connected to the USB bus or an SD card may be internal), but
      # this returns true if the device is suspicious enough so it's better to avoid it in the
      # automatic proposal if possible.
      #
      # @param device [Y2Storage::BlkDevice]
      # @return [boolean]
      def maybe_removable?(device)
        return true if dev_is?(device, :sd_card?)
        return true if dev_is?(device, :usb?)
        return true if dev_is?(device, :firewire?)

        false
      end

      # Checks whether the given device returns true for the given method.
      #
      # @see #maybe_removable?
      #
      # @param device [Y2Storage::BlkDevice]
      # @param method [Symbol]
      #
      # @return [boolean]
      def dev_is?(device, method)
        return false unless device.respond_to?(method)

        device.public_send(method)
      end

      # @return [Storage::System]
      def system
        @system ||= Storage::System.new
      end
    end
  end
end
