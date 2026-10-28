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

require "y2storage/proposal/autoinst_size"
require "y2storage/volume_specification_builder"

module Y2Storage
  module Proposal
    # This class parses the 'size' AutoYaST element and returns an
    # {Y2Storage::Proposal::AutoinstSize} object
    class AutoinstSizeParser
      # @return [ProposalSettings] Proposal settings
      attr_reader :proposal_settings

      # Constructor
      #
      # @param proposal_settings [ProposalSettings] Proposal settings
      def initialize(proposal_settings)
        @proposal_settings = proposal_settings
      end

      # Return AutoinstSize for a given AutoYaST 'size' element
      #
      # @example Parsing 'auto'
      #   parser = AutoinstSizeParser.new(ProposalSettings.new_for_current_product)
      #
      #   size_info = parser.parse("10GiB", "/", 1.GiB, 15.GiB)
      #   size_info.min #=> 10.GiB
      #   size_info.max #=> 10.GiB
      #
      # @param size_spec   [String] Size specification ("10GB", "auto", "max", etc.)
      # @param mount_point [String] Mount point
      # @param min         [DiskSize] Minimal size
      # @param max         [DiskSize] Maximal size
      # @return [AutoinstSize,nil] Object containing information about size; nil if size
      #   specification is "auto" and no predefined values were found.
      #
      # @see AutoinstSize
      def parse(size_spec, mount_point, min, max)
        size = size_spec.to_s.strip.downcase
        if size == "auto"
          auto_sizes_for(mount_point)
        else
          extract_sizes_for(size, min, max)
        end
      end

      private

      # Returns min and max sizes for a size specification
      #
      # @param size_spec [String]   Device size specification from AutoYaST
      # @param min       [DiskSize] Minimum disk size
      # @param max       [DiskSize] Maximum disk size
      # @return [[DiskSize,DiskSize,Integer]] min and max sizes and weight for the given partition
      #
      # @see SIZE_REGEXP
      def extract_sizes_for(size_spec, min, max)
        if ["", "max"].include?(size_spec)
          return AutoinstSize.new(size_spec, min: min, max: DiskSize.unlimited)
        end

        number, unit = size_to_components(size_spec)
        size =
          if unit == "%"
            percentage = number.to_f
            (max * percentage) / 100.0
          else
            DiskSize.parse(size_spec, legacy_units: true)
          end
        AutoinstSize.new(size_spec, min: size, max: size, percentage: percentage)
      rescue TypeError
        nil
      end

      # Regular expression to detect which kind of size is being used in an
      # AutoYaST <size> element
      INTEGER_SIZE_REGEXP = /^(\d)+$/
      INTEGER_SIZE_REGEXP_WITH_UNIT = /([\d,.]+)?([a-zA-Z%]+)/

      # Extracts number and unit from an AutoYaST size specification
      #
      # @example Using with percentages
      #   size_to_components("30%") # => [30.0, "%"]
      # @example Using with space units
      #   size_to_components("30GiB") # => [30.0, "GiB"]
      #
      # @return [[number,unit]] Number and unit
      def size_to_components(size_spec)
        return [size_spec.to_f, "B"] if INTEGER_SIZE_REGEXP.match(size_spec)

        number, unit = INTEGER_SIZE_REGEXP_WITH_UNIT.match(size_spec).values_at(1, 2)
        [number.to_f, unit]
      end

      # @return [nil,Array<DiskSize>]
      def auto_sizes_for(mount_point)
        return nil if mount_point.nil?

        spec = VolumeSpecification.for(mount_point, proposal_settings: proposal_settings)
        return nil if spec.nil?

        AutoinstSize.new(
          "auto",
          min:    spec.min_size,
          max:    spec.max_size,
          weight: spec.weight
        )
      end
    end
  end
end
