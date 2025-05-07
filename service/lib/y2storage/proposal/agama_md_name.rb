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

module Y2Storage
  module Proposal
    # Mixin to calculate the values used at the fields Planned::Md#name and
    # Planned::CanBeMdMember#raid_name.
    #
    # Those fields must always have meaningful values since they are the only existing
    # mechanism to relate a planned MD and the devices used as members. But it is a limited
    # mechanism.
    #
    # First of all, specifying an MD name in the configuration is not mandatory at Agama (contrary
    # to AutoYaST). On the other hand, there is no way to specify the order of the members. The
    # field Planned::Md#devices_order is used by AutoYaST for that purpose, but is not suitable for
    # Agama.
    #
    # This mixin abuses the fields, making it possible to use them beyond their original purposes.
    # It opens the door to have RAIDs without a name and to specify the order of the members.
    module AgamaMdName
      # Value used at Planned::Md.name to identify the given RAID
      #
      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param config [Agama::Storage::Config]
      # @return [String]
      def md_name(md_config, config)
        return "/dev/md/#{md_config.name}" if md_config.name

        md_index = config.md_raids.index(md_config)
        "raid_#{md_index}"
      end

      # Value used at Planned::CanBeMdMember#raid_name to identify the target RAID and the
      # position of this device in the list of RAID members.
      #
      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param member_config [Agama::Storage::Configs::Partition, Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      # @return [String]
      def member_md_name(md_config, member_config, config)
        member_index = md_config.devices.index(member_config.alias)
        "#{member_index}**#{md_name(md_config, config)}"
      end

      # Whether the given planned device is a member of the given planned RAID.
      #
      # @param raid [Planned::Md]
      # @param member [Planned::Disk, Planned::Partition]
      # @return [Boolean]
      def md_name_match?(raid, member)
        return false unless member.respond_to?(:md_member?) && member.md_member?

        raid.name == member.raid_name.split("**").last
      end

      # Position of the given planned device into the list of members of its RAID.
      #
      # @param member [Planned::Disk, Planned::Partition]
      # @return [Integer]
      def md_member_index(member)
        member.raid_name.split("**").first.to_i
      end

      # Device name to use when creating the RAID in the target devicegraph
      #
      # @param raid [Planned::Md]
      # @param devicegraph [Devicegraph]
      def md_device_name(raid, devicegraph)
        return raid.name if raid.name.start_with?("/dev/")

        Y2Storage::Md.find_free_numeric_name(devicegraph)
      end
    end
  end
end
