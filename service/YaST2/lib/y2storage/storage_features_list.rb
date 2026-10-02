# Copyright (c) [2016-2023] SUSE LLC
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
require "forwardable"
require "y2storage/storage_feature"
require "y2storage/yast_feature"

module Y2Storage
  # List of storage features
  #
  # This class provides an object-oriented collection of {StorageFeature}
  # objects (as opposed to the bit-mask based approach of libstorage-ng).
  class StorageFeaturesList
    include Yast::Logger
    include Enumerable
    extend Forwardable

    def_delegators :@features, :each, :empty?, :size, :length

    # Constructor
    def initialize(*features)
      @features = [*features].flatten
    end

    # Constructs a list of features from a libstorage-ng bit-field
    #
    # In libstorage-ng a set of features is representend by an integer
    # bit-field that must be processed to get the list of features, each one
    # represented by a bit-mask referenced by a constant.
    #
    # @param bits [Integer, nil] bit-field representing all the features that
    #   must be part of the list
    #
    # @return [StorageFeaturesList]
    def self.from_bitfield(bits)
      new(*StorageFeature.all.select { |f| f.in_bitfield?(bits) })
    end

    # Return a list of all software packages required for the storage features
    # included in the list.
    #
    # @return [Array<String>] list of package names
    def pkg_list
      return @pkg_list unless @pkg_list.nil?

      @pkg_list = []
      each do |feature|
        log.info("Feature #{feature.id} requires #{feature.pkg_list}")
        @pkg_list.concat(feature.pkg_list)
      end
      @pkg_list.uniq!

      log.info("Storage feature packages: #{@pkg_list}")

      @pkg_list
    end

    # Returns the list of required packages.
    #
    # @return [Array<Feature::Package>]
    def packages
      @features.flat_map(&:packages).uniq(&:name)
    end

    # Concatenate the give features into the current list
    #
    # @param other_list [#to_a]
    def concat(other_list)
      @features.concat(other_list.to_a)
    end
  end
end
