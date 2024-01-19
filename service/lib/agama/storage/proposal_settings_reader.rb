# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "y2storage/encryption_method"
require "y2storage/pbkd_function"
require "agama/storage/volume_templates_builder"
require "agama/storage/space_settings"

module Agama
  module Storage
    # Proposal settings reader.
    class ProposalSettingsReader
      # @param config [Agama::Config]
      def initialize(config)
        @config = config
      end

      # Reads the proposal settings from the control file.
      #
      # @return [ProposalSettings]
      def read
        ProposalSettings.new.tap do |settings|
          config.data.fetch("storage", {}).each do |key, value|
            reader = READERS[key]
            send(reader, settings, value) if reader
          end
        end
      end

    private

      # @return [Agama::Config]
      attr_reader :config

      # Settings from control file and their readers.
      READERS = {
        "lvm"          => :lvm_reader,
        "encryption"   => :encryption_reader,
        "space_policy" => :space_policy_reader,
        "volumes"      => :volumes_reader
      }.freeze

      private_constant :READERS

      # @param settings [Agama::Storage::ProposalSettings]
      # @param value [Boolean]
      def lvm_reader(settings, value)
        settings.lvm.enabled = value
      end

      # @param settings [Agama::Storage::ProposalSettings]
      # @param encryption [Hash]
      def encryption_reader(settings, encryption)
        method = Y2Storage::EncryptionMethod.find(encryption.fetch("method", ""))
        pbkd_function = Y2Storage::PbkdFunction.find(encryption.fetch("pbkd_function", ""))

        settings.encryption.method = method if available_method?(method)
        settings.encryption.pbkd_function = pbkd_function if pbkd_function
      end

      # @param method [Y2Storage::EncryptionMethod::Base, nil]
      # @return [Boolean]
      def available_method?(method)
        return false unless method

        EncryptionSettings.available_methods.include?(method)
      end

      # @param settings [Agama::Storage::ProposalSettings]
      # @param value [String]
      def space_policy_reader(settings, value)
        policy = value.to_sym
        return unless SpaceSettings.policies.include?(policy)

        settings.space.policy = policy
      end

      # @param settings [Agama::Storage::ProposalSettings]
      # @param volumes [Array<Hash>]
      def volumes_reader(settings, volumes)
        builder = VolumeTemplatesBuilder.new_from_config(config)
        mount_paths = volumes.map { |v| volume_path(v) }.compact

        settings.volumes = mount_paths.map { |mp| builder.for(mp) }
      end

      def volume_path(volume)
        return volume if volume.is_a?(String)

        volume["mount_path"]
      end
    end
  end
end
