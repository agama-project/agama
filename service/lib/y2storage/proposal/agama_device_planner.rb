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

require "y2storage/planned"
require "agama/issue"

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

      # Planned devices according to the given settings.
      #
      # @return [Array] Array of planned devices.
      def planned_devices(_setting)
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
      # @param settings [#encryption, #filesystem]
      def configure_device(planned, settings)
        configure_encryption(planned, settings.encryption) if settings.encryption
        configure_filesystem(planned, settings.filesystem) if settings.filesystem
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Configs::Filesystem]
      def configure_filesystem(planned, settings)
        planned.mount_point = settings.path
        planned.mount_by = settings.mount_by
        planned.fstab_options = settings.mount_options
        planned.mkfs_options = settings.mkfs_options.join(",")
        planned.label = settings.label
        configure_filesystem_type(planned, settings.type) if settings.type
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Configs::FilesystemType]
      def configure_filesystem_type(planned, settings)
        planned.filesystem_type = settings.fs_type
        configure_btrfs(planned, settings.btrfs) if settings.btrfs
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Configs::Btrfs]
      def configure_btrfs(planned, settings)
        # TODO: we need to discuss what to do with transactional systems and the read_only
        # property. We are not sure whether those things should be configurable by the user.
        # planned.read_only = settings.read_only?
        planned.snapshots = settings.snapshots?
        planned.default_subvolume = settings.default_subvolume
        planned.subvolumes = settings.subvolumes
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Configs::Encryption]
      def configure_encryption(planned, settings)
        planned.encryption_password = settings.password
        planned.encryption_method = settings.method
        planned.encryption_pbkdf = settings.pbkd_function
        planned.encryption_label = settings.label
        planned.encryption_cipher = settings.cipher
        planned.encryption_key_size = settings.key_size

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
      # @param settings [Agama::Storage::Configs::Size]
      def configure_size(planned, settings)
        planned.min_size = settings.min
        planned.max_size = settings.max
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
          configure_device(planned, config)
          configure_size(planned, config.size)
        end
      end
    end
  end
end
