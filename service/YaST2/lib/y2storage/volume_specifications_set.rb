# Copyright (c) [2019] SUSE LLC
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
# with this program; if not, contact SUSE.
#
# To contact SUSE about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

module Y2Storage
  # Class that represents a set of all the {VolumeSpecification} objects that should
  # end up being located in the same disk device.
  class VolumeSpecificationsSet
    # Constructor
    #
    # @note take into account that `volumes` parameter could be modified. See {#push}.
    #
    # @param volumes [Array<VolumeSpecification>] see {#volumes}
    # @param type [Symbol] see {#type}
    def initialize(volumes, type)
      @volumes = Array(volumes)
      @type = type
    end

    # All the volume specifications included in the set
    #
    # @return [Array<VolumeSpecification>]
    attr_reader :volumes

    # Type of device that will be created to represent the set
    #
    # This represents the reason why the {VolumeSpecification} objects has been
    # grouped together
    #
    # @return [Symbol] :lvm, :separate_lvm, :partition
    attr_reader :type

    # Whether the volumes on this set should be created or skipped
    #
    # @see VolumeSpecification#proposed
    #
    # @return [Boolean]
    def proposed?
      volumes.any?(&:proposed?)
    end

    # Device name of the disk in which the volumes must be located
    #
    # @see VolumeSpecification#device
    #
    # @return [String, nil]
    def device
      volumes.map(&:device).compact.first
    end

    # @see #device
    #
    # @param name [String, nil]
    def device=(name)
      volumes.each { |vol| vol.device = name }
    end

    # For sets of type :separate_lvm, name of the volume group
    #
    # @return [String, nil]
    def vg_name
      volumes.first.separate_vg_name
    end

    # Adds a volume at the end of the set
    #
    # @param volume [VolumeSpecificationSet]
    def push(volume)
      volumes << volume
    end

    # Whether the set contains the volume specification for root
    #
    # @return [Boolean]
    def root?
      volumes.any?(&:root?)
    end

    # Total minimal size of all the volume specifications included in the set
    #
    # @return [DiskSize]
    def min_size
      DiskSize.sum(volumes.map(&:min_size))
    end
  end
end
