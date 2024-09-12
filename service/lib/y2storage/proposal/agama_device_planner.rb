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

require "agama/issue"
require "yast/i18n"
require "y2storage/planned"

module Y2Storage
  module Proposal
    # Base class used by Agama planners.
    class AgamaDevicePlanner
      include Yast::I18n

      # @!attribute [r] devicegraph
      #   Devicegraph to be used as starting point.
      #   @return [Devicegraph]
      attr_reader :devicegraph

      # @!attribute [r] issues_list
      #   List of issues to register any found problem
      #   @return [Array<Agama::Issue>]
      attr_reader :issues_list

      # Constructor
      #
      # @param devicegraph [Devicegraph] see {#devicegraph}
      # @param issues_list [Array<Agama::Issue>] see {#issues_list}
      def initialize(devicegraph, issues_list)
        textdomain "agama"

        @devicegraph = devicegraph
        @issues_list = issues_list
      end

      # Planned devices according to the given config.
      #
      # @return [Array] Array of planned devices.
      def planned_devices(_config)
        raise NotImplementedError
      end

    private

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      def configure_reuse(planned, config)
        device = config.found_device
        return unless device

        planned.assign_reuse(device)
        planned.reformat = reformat?(device, config)
      end

      # Whether to reformat the device.
      #
      # @param device [Y2Storage::BlkDevice]
      # @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @return [Boolean]
      def reformat?(device, config)
        return true if device.filesystem.nil?

        # TODO: reformat if the encryption has to be created.
        !config.filesystem&.reuse?
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [#encryption, #filesystem]
      def configure_block_device(planned, config)
        configure_encryption(planned, config.encryption) if config.encryption
        configure_filesystem(planned, config.filesystem) if config.filesystem
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::Filesystem]
      def configure_filesystem(planned, config)
        planned.mount_point = config.path
        planned.mount_by = config.mount_by
        planned.fstab_options = config.mount_options
        planned.mkfs_options = config.mkfs_options.join(",")
        planned.label = config.label
        configure_filesystem_type(planned, config.type) if config.type
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::FilesystemType]
      def configure_filesystem_type(planned, config)
        planned.filesystem_type = config.fs_type
        configure_btrfs(planned, config.btrfs) if config.btrfs
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::Btrfs]
      def configure_btrfs(planned, config)
        # TODO: we need to discuss what to do with transactional systems and the read_only
        # property. We are not sure whether those things should be configurable by the user.
        # planned.read_only = config.read_only?
        planned.snapshots = config.snapshots?
        planned.default_subvolume = config.default_subvolume
        planned.subvolumes = config.subvolumes
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param config [Agama::Storage::Configs::Encryption]
      def configure_encryption(planned, config)
        planned.encryption_password = config.password
        planned.encryption_method = config.method
        planned.encryption_pbkdf = config.pbkd_function
        planned.encryption_label = config.label
        planned.encryption_cipher = config.cipher
        planned.encryption_key_size = config.key_size

        check_encryption(planned)
      end

      # @see #configure_encryption
      def check_encryption(dev)
        issues_list << issue_missing_enc_password(dev) if missing_enc_password?(dev)
        issues_list << issue_available_enc_method(dev) unless dev.encryption_method.available?
        issues_list << issue_wrong_enc_method(dev) unless supported_enc_method?(dev)
      end

      # @see #check_encryption
      def missing_enc_password?(planned)
        return false unless planned.encryption_method&.password_required?

        planned.encryption_password.nil? || planned.encryption_password.empty?
      end

      # @see #check_encryption
      def supported_enc_method?(planned)
        planned.supported_encryption_method?(planned.encryption_method)
      end

      # @see #check_encryption
      def issue_missing_enc_password(planned)
        msg = format(
          # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          _("No passphrase provided (required for using the method '%{crypt_method}')."),
          crypt_method: planned.encryption_method.id.to_s
        )
        encryption_issue(msg)
      end

      # @see #check_encryption
      def issue_available_enc_method(planned)
        msg = format(
          # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          _("Encryption method '%{crypt_method}' is not available in this system."),
          crypt_method: planned.encryption_method.id.to_s
        )
        encryption_issue(msg)
      end

      # @see #check_encryption
      def issue_wrong_enc_method(planned)
        msg = format(
          # TRANSLATORS: 'crypt_method' is the name of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          _("'%{crypt_method}' is not a suitable method to encrypt the device."),
          crypt_method: planned.encryption_method.id.to_s
        )
        encryption_issue(msg)
      end

      # @see #check_encryption
      def encryption_issue(message)
        Agama::Issue.new(
          message,
          source:   Agama::Issue::Source::CONFIG,
          severity: Agama::Issue::Severity::ERROR
        )
      end

      # @param planned [Planned::Partition]
      # @param config [Agama::Storage::Configs::Size]
      def configure_size(planned, config)
        planned.min_size = config.min
        planned.max_size = config.max
        planned.weight = 100
      end

      # @param planned [Planned::Disk]
      # @param config [Agama::Storage::Configs::Drive]
      def configure_partitions(planned, config)
        partition_configs = config.partitions
          .reject(&:delete?)
          .reject(&:delete_if_needed?)

        planned.partitions = partition_configs.map do |partition_config|
          planned_partition(partition_config).tap { |p| p.disk = config.found_device.name }
        end
      end

      # @param config [Agama::Storage::Configs::Partition]
      # @return [Planned::Partition]
      def planned_partition(config)
        Planned::Partition.new(nil, nil).tap do |planned|
          planned.partition_id = config.id
          configure_reuse(planned, config)
          configure_block_device(planned, config)
          configure_size(planned, config.size)
        end
      end
    end
  end
end
