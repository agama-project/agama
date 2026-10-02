# Copyright (c) [2017] SUSE LLC
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

require "installation/autoinst_profile/section_with_attributes"

module Y2Storage
  module AutoinstProfile
    # Thin object oriented layer on top of a <raid_options> section of the
    # AutoYaST profile.
    class RaidOptionsSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :persistent_superblock },
          { name: :chunk_size },
          { name: :parity_algorithm },
          { name: :raid_type },
          { name: :device_order },
          { name: :raid_name }
        ]
      end

      define_attr_accessors

      # @!attribute persistent_superblock
      #   @return [Boolean] undocumented attribute. Is present in the profile
      #     scheme but has been ignored for years and years. Persistent
      #     superblocks are the default for RAID since 2011 and there is no code
      #     in the old or the current libstorage to enforce the opposite.

      # @!attribute chunk_size
      #   @return [String] RAID's chunk size

      # @!attribute parity_algorithm
      #   @return [String] Parity algorithm

      # @!attribute raid_type
      #   @return [String] RAID level

      # @!attribute device_order
      #   @return [Array<String>] Ordered list of devices to be used

      # @!attribute raid_name
      #   @return [String] undocumented attribute

      # @param parent [#parent,#section_name] parent section
      def initialize(parent = nil)
        super

        @device_order = []
      end

      # Method used by {.new_from_hashes} to populate the attributes
      #
      # @param hash [Hash] see {.new_from_hashes}
      def init_from_hashes(hash)
        super
        @device_order = hash["device_order"] if hash["device_order"].is_a?(Array)
      end

      # Clones RAID device options into an AutoYaST <raid_options> profile section
      #
      # @param device [Md] RAID device
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [RaidOptionsSection] RAID options section
      def self.new_from_storage(device, parent = nil)
        result = new(parent)
        result.init_from_raid(device)
        result
      end

      # Method used by {.new_from_storage} to populate the attributes when
      # cloning RAID options
      #
      # @param md [Md] RAID device
      def init_from_raid(md)
        @raid_name = md.name unless md.numeric?
        @raid_type = clone_md_level(md).to_s
        # A number will be interpreted as KB, so we explicitly set the unit.
        @chunk_size = "#{md.chunk_size.to_i}B"
        @parity_algorithm = md.md_parity.to_s
        @device_order = md.sorted_devices.map(&:name)
      end

      # RAID parity, according to the value of {#parity_algorithm}
      #
      # If possible, finds the corresponding MD parity, no matter if a legacy or modern
      # representation is used at {#parity_algorithm} (see {MdParity.find_with_legacy}).
      #
      # @return [MdParity, nil] nil if {#parity_algorithm} is blank or it's impossible to infer
      #   the corresponding RAID parity
      def md_parity
        return nil if parity_algorithm.nil? || parity_algorithm.empty?

        MdParity.find_with_legacy(parity_algorithm)
      end

      private

      # MD level to be used at {#init_from_raid}
      #
      # This is a temporary method, created in the context of bsc#1215022, to avoid creating
      # entries with "<raid_type>linear</raid_type>" in the AutoYaST profile when cloning the
      # system. That may lead to the false impression that creation of linear RAIDs with YaST
      # is supported.
      #
      # In more modern branches, the case of linear RAIDs will probably be handled differently.
      #
      # @param md [Md] RAID device
      # @return [MdLevel]
      def clone_md_level(md)
        md.md_level.is?(:linear) ? MdLevel::UNKNOWN : md.md_level
      end
    end
  end
end
