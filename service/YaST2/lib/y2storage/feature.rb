# Copyright (c) [2023-2026] SUSE LLC
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
require "storage"

module Y2Storage
  # Generalization of the concept of {StorageFeature}.
  #
  # In libstorage-ng the concept of "feature" is used to communicate the usage of some
  # functionality that may require the presence in the system of some packages and tools.
  #
  # The sibling concept of {YastFeature} makes it possible for Y2Storage to add its own
  # requirements.
  #
  # This is the abstract base class for both.
  class Feature
    # Nested class to represent a package associated to a feature
    class Package
      Yast.import "Package"

      # Constructor
      #
      # @param name [String] see {#name}
      # @param optional [Boolean] see {#optional?}
      def initialize(name, optional: false)
        @name = name
        @optional = optional
      end

      # @return [String] name of the package
      attr_reader :name

      # Whether installation of the package can be skipped if the package is not
      # available
      #
      # See the comment in {StorageFeature::OPTIONAL_PACKAGES} for more details
      #
      # @return [Boolean]
      def optional?
        !!@optional
      end

      # Check if a package is an optional package that is unavailable.
      # See also bsc#1039830
      #
      # @return [Boolean] true if package is optional and unavailable,
      #                   false if not optional or if available.
      def unavailable_optional?
        optional? && !Yast::Package.Available(name)
      end
    end

    include Yast::Logger

    # Constructor
    #
    # @param id [Symbol] see {#id}
    # @param packages [Array<Package>] see {#all_packages}
    def initialize(id, packages)
      @id = id
      @all_packages = packages
    end

    # Symbol representation of the feature
    #
    # For StorageFeature objects, this has the same form than the corresponding constant
    # name in libstorage-ng, eg. :UF_NTFS
    #
    # @return [Symbol]
    attr_reader :id
    alias_method :to_sym, :id

    # List of available packages associated to the feature
    #
    # @return [Array<Feature::Package>]
    def packages
      return @packages unless @packages.nil?

      unavailable, @packages = all_packages.partition(&:unavailable_optional?)
      if unavailable.any?
        log.warn("WARNING: Skipping unavailable support packages #{unavailable.map(&:name)}")
      end

      @packages
    end

    # Names of the packages that should be installed if the feature is going to be used
    #
    # @return [Array<String>]
    def pkg_list
      packages.map(&:name)
    end

    # Drop the cache about which packages related to the feature are available
    def drop_cache
      @packages = nil
    end

    private

    # All packages that would be relevant for the feature, no matter if they are really available
    # @return [Array<Feature::Package>]
    attr_reader :all_packages
  end
end
