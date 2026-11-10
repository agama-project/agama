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

Yast.import "Arch"

module Y2Storage
  module Proposal
    # Class to find the partition id defined by the Discoverable Partitions Specification (DPS) for
    # a mount point.
    #
    # Only the mount points that libstorage-ng knows about are supported: /, /usr, /home, /srv,
    # /var, /var/tmp and swap. The ids for / and /usr depend on the architecture.
    #
    # DPS only exists for GPT partition tables, so no id is returned for other partition tables.
    # Note that the swap id is also valid in other tables, but only in GPT it is the id defined by
    # DPS.
    #
    # @see https://uapi-group.org/specifications/specs/discoverable_partitions_specification/
    class DiscoverablePartitionId
      # Ids for the mount points that do not depend on the architecture
      FIXED_IDS = {
        "/home"    => PartitionId::LINUX_HOME,
        "/srv"     => PartitionId::LINUX_SERVER_DATA,
        "/var"     => PartitionId::LINUX_VAR,
        "/var/tmp" => PartitionId::LINUX_VAR_TMP,
        "swap"     => PartitionId::SWAP
      }.freeze
      private_constant :FIXED_IDS

      # Ids for the mount points that depend on the architecture, indexed by mount point and by the
      # name of the method of Yast::Arch that identifies the architecture.
      ARCH_IDS = {
        "/"    => {
          x86_64:  PartitionId::LINUX_ROOT_X86_64,
          i386:    PartitionId::LINUX_ROOT_X86,
          aarch64: PartitionId::LINUX_ROOT_AARCH64,
          arm:     PartitionId::LINUX_ROOT_ARM,
          ppc32:   PartitionId::LINUX_ROOT_PPC32,
          # Only little endian is supported by the products
          ppc64:   PartitionId::LINUX_ROOT_PPC64LE,
          riscv64: PartitionId::LINUX_ROOT_RISCV64,
          s390_32: PartitionId::LINUX_ROOT_S390,
          s390_64: PartitionId::LINUX_ROOT_S390X
        },
        "/usr" => {
          x86_64:  PartitionId::LINUX_USR_X86_64,
          i386:    PartitionId::LINUX_USR_X86,
          aarch64: PartitionId::LINUX_USR_AARCH64,
          arm:     PartitionId::LINUX_USR_ARM,
          ppc32:   PartitionId::LINUX_USR_PPC32,
          ppc64:   PartitionId::LINUX_USR_PPC64LE,
          riscv64: PartitionId::LINUX_USR_RISCV64,
          s390_32: PartitionId::LINUX_USR_S390,
          s390_64: PartitionId::LINUX_USR_S390X
        }
      }.freeze
      private_constant :ARCH_IDS

      # @param arch [#x86_64, #i386, #aarch64, ...] object to query the current architecture, see
      #   Yast::Arch
      def initialize(arch = Yast::Arch)
        @arch = arch
      end

      # Partition id for the given mount point
      #
      # @param mount_point [String, nil]
      # @param ptable [PartitionTables::Base] Partition table in which the partition is going to be
      #   created.
      #
      # @return [PartitionId, nil] nil if there is no DPS id for the mount point (or for the current
      #   architecture), or if the partition table is not GPT.
      def for(mount_point, ptable)
        return unless ptable.type.is?(:gpt)

        id_for(mount_point)
      end

    private

      # @return [#x86_64, #i386, #aarch64, ...]
      attr_reader :arch

      # @param mount_point [String, nil]
      # @return [PartitionId, nil]
      def id_for(mount_point)
        return FIXED_IDS[mount_point] if FIXED_IDS.key?(mount_point)

        arch_ids = ARCH_IDS[mount_point]
        return unless arch_ids

        arch_ids.find { |name, _id| arch.public_send(name) }&.last
      end
    end
  end
end
