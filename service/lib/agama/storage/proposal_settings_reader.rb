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

module Agama
  module Storage
    class ProposalSettingsReader
      def initialize(config)
        @config = config
      end

      def read
        settings = ProposalSettings.new
        config.fetch("storage", {}).each do |key, value|
          send(CONFIG_READERS[key], settings, value)
        end
      end

    private

      attr_reader :config

      CONFIG_READERS = {
        "lvm"          => :read_lvm,
        "encrypttion"  => :read_encryption,
        "space_policy" => :read_space_policy,
        "volumes"      => :read_volumes
      }.freeze

      private_constant :CONFIG_READERS

      def read_lvm(settings, value)
        settings.lvm.enabled = value
      end

      def read_encryption(settings, encryption)
        method = Y2Storage::EncryptionMethod.find(encryption.fetch("method", ""))
        pbkd_function = Y2Storage::PbkdFunction.find(encryption.fetch("pbkd_function", ""))

        settings.encryption.method = method if method
        settings.encryption.pbkd_function = pbkd_function if pbkd_function
      end

      def read_space_policy(settings, value)
        settings.space.policy = value.to_sym
      end

      def read_volumes(settings, volumes)
        builder = VolumeTemplatesBuilder.new_from_config(config)
        mount_paths = volumes.map { |v| v["mount_path"] }.compact

        settings.volumes = mount_paths.map { |mp| buider.for(mp) }
      end
    end
  end
end
