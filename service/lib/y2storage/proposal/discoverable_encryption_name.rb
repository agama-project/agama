# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require "y2storage/partition_id"
require "y2storage/proposal/discoverable_partition_id"

Yast.import "Arch"

module Y2Storage
  module Proposal
    # Class to find the device mapper name defined by the Discoverable Partitions Specification
    # (DPS) for an encryption device.
    #
    # The specification requires the encryption device of the partitions with a DPS type to be named
    # "root", "usr", "home", "srv", "var" or "tmp" (for /var/tmp). The name "swap" is used for swap
    # partitions. Using the same names than the specification avoids conflicts with the devices that
    # systemd-gpt-auto-generator sets up for those partitions.
    #
    # @see DiscoverablePartitionId
    # @see https://uapi-group.org/specifications/specs/discoverable_partitions_specification/
    class DiscoverableEncryptionName
      # Device mapper names indexed by mount path
      NAMES = {
        "/"        => "root",
        "/usr"     => "usr",
        "/home"    => "home",
        "/srv"     => "srv",
        "/var"     => "var",
        "/var/tmp" => "tmp",
        "swap"     => "swap"
      }.freeze
      private_constant :NAMES

      # @param arch [#x86_64, #i386, #aarch64, ...] object to query the current architecture, see
      #   {DiscoverablePartitionId}
      def initialize(arch = Yast::Arch)
        @arch = arch
      end

      # Device mapper name for the given encryption
      #
      # The name only applies if the encryption is over a partition that has the DPS id for the
      # mount point of the encryption (see {DiscoverablePartitionId}, which also takes care of the
      # type of the partition table), and no other device is using the name already. This method
      # does not modify the encryption.
      #
      # @param encryption [Encryption]
      # @return [String, nil] nil if there is no DPS name for the encryption.
      def for(encryption)
        path = encryption.mount_point&.path
        name = NAMES[path]
        return unless name

        partition = encryption.blk_device
        return unless partition.is?(:partition) && discoverable?(partition, path)
        return if name_in_use?(encryption, name)

        name
      end

    private

      # @return [#x86_64, #i386, #aarch64, ...]
      attr_reader :arch

      # Whether the partition has the id defined by DPS for the given mount path
      #
      # @param partition [Partition]
      # @param path [String]
      # @return [Boolean]
      def discoverable?(partition, path)
        id = DiscoverablePartitionId.new(arch).for(path, partition.partition_table)
        !id.nil? && partition.id == id
      end

      # Whether another device is using the given device mapper name
      #
      # @param encryption [Encryption]
      # @param name [String]
      # @return [Boolean]
      def name_in_use?(encryption, name)
        encryption.devicegraph.blk_devices.any? do |device|
          device.sid != encryption.sid && device.dm_table_name == name
        end
      end
    end
  end
end
