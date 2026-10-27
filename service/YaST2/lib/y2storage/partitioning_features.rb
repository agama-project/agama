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

require "yast"

Yast.import "ProductFeatures"

module Y2Storage
  # Mixin that allows to load features from partitioning section of control file
  module PartitioningFeatures
    # Assign the value of a specific feature into an object attribute.
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param to [Symbol, String] attribute name where to store the feature value
    # @param source [Hash] from where to read the features
    #
    # @example
    #   settings.use_lvm #=> nil
    #   settings.load_feature(:proposal_lvm, to: :use_lvm)
    #   settings.use_lvm #=> false
    #
    # When :to parameter is not indicated, the last value of feature path is considered
    # the attribute name:
    #
    # @example
    #   settings.lvm #=> nil
    #   settings.load_feature(:proposal, :lvm)
    #   settings.lvm #=> false
    #
    # By default, the feature is loaded from the content of the <partitioning> section of
    # the product features. The argument :source can be used to provide the content of any
    # other section or subsection:
    #
    # @example
    #   settings.lvm #=> nil
    #   settings.load_feature(:lvm, source: {lvm: true})
    #   settings.lvm #=> true
    #
    def load_feature(*feature, to: nil, source: partitioning_section)
      value = feature(*feature, source: source)
      set_feature(*feature, to, value)
    end

    # Assign an integer feature (see {#load_feature})
    # For backwards compatibility reasons, features with a value of zero are ignored.
    #
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param to [Symbol, String] attribute name where to store the feature value
    # @param source [Hash] from where to read the features
    def load_integer_feature(*feature, to: nil, source: partitioning_section)
      value = feature(*feature, source: source)
      return nil if value.nil?

      value = value.to_i
      set_feature(*feature, to, value) if value >= 0
    end

    # Assign a size feature (see {#load_feature})
    # The feature value is converted to a {DiskSize}.
    #
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param to [Symbol, String] attribute name where to store the feature value
    # @param source [Hash] from where to read the features
    def load_size_feature(*feature, to: nil, source: partitioning_section)
      value = feature(*feature, source: source)
      return nil if value.nil?

      begin
        value = DiskSize.parse(value, legacy_units: true)
      rescue TypeError
        value = nil
      end
      set_feature(*feature, to, value) if value && value > DiskSize.zero
    end

    # Assign subvolumes from "subvolumes" section (see {#load_feature})
    # The list of subvolumes is converted to a list of {SubvolSpecification}
    #
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param to [Symbol, String] attribute name where to store the feature value
    # @param source [Hash] from where to read the features
    def load_subvolumes_feature(*feature, to: nil, source: partitioning_section)
      value = feature(*feature, source: source)
      value = SubvolSpecification.list_from_control_xml(value)
      set_feature(*feature, to, value) if value
    end

    # Assign volumes from "volumes" section (see {#load_feature})
    # The list of volumes is converted to a list of {VolumeSpecification}
    #
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param to [Symbol, String] attribute name where to store the feature value
    # @param source [Hash] from where to read the features
    def load_volumes_feature(*feature, to: nil, source: partitioning_section)
      value = feature(*feature, source: source)
      return nil if value.nil?

      value = value.map { |v| VolumeSpecification.new(v) }
      set_feature(*feature, to, value)
    end

    # Read a feature and returns the raw value
    #
    # @param feature [List<Symbol, String>] feature path (e.g., [:proposal, :lvm])
    # @param source [Hash] from where to read the features
    def feature(*feature, source: partitioning_section)
      feature = feature.map(&:to_s)
      Yast::Ops.get(source, feature)
    end

    private

    def set_feature(*feature, to, value)
      attr = to || feature.last
      send(:"#{attr}=", value) unless value.nil?
    end

    def partitioning_section
      Yast::ProductFeatures.GetSection("partitioning")
    end
  end
end
