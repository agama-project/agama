# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "y2storage"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/volume_converter"

module DInstaller
  module Storage
    # Utility class offering methods to convert between Y2Storage::ProposalSettings objects and
    # DInstaller::ProposalSettings ones
    class ProposalSettingsConverter
      # Constructor
      #
      # @param default_specs [Array<Y2Storage::VolumeSpecification] list of default volume
      #   specifications
      def initialize(default_specs: [])
        @default_specs = default_specs
      end

      # Returns the Y2Storage::VolumeSpecification object that is equivalent to the given
      # DInstaller::Volume one
      #
      # @param settings [ProposalSettings]
      # @return [Y2Storage::ProposalSettings]
      def to_y2storage(settings)
        ToY2Storage.new(settings, default_specs).convert
      end

    private

      # @see #initialize
      attr_reader :default_specs

      # Internal class to generate a Y2Storage::ProposalSettings object
      class ToY2Storage
        # Constructor
        #
        # @param settings see {#settings}
        # @param default_specs see #{default_specs}
        def initialize(settings, default_specs)
          @settings = settings
          @default_specs = default_specs
        end

        def convert
          # Despite the "current_product" part in the name of the constructor, it only applies
          # generic default values that are independent of the product (there is no YaST
          # ProductFeatures mechanism in place).
          y2storage_settings = Y2Storage::ProposalSettings.new_for_current_product
          y2storage_settings.use_lvm = settings.use_lvm?
          y2storage_settings.encryption_password = settings.encryption_password

          devices = settings.candidate_devices
          y2storage_settings.candidate_devices = devices if devices&.any?

          volume_specs = calculate_volume_specs
          # If no volumes are specified, just leave the default ones (hardcoded at Y2Storage)
          y2storage_settings.volumes = volume_specs if volume_specs.any?

          y2storage_settings
        end

      private

        # @see ProposalSettingsConverter#to_y2storage
        attr_reader :settings
        # @see ProposalSettingsConverter#initialize
        attr_reader :default_specs

        # Calculate volume specs for the storage proposal settings
        #
        # @return [Array<Y2Storage::VolumeSpecification>]
        def calculate_volume_specs
          return default_specs if settings.volumes.none?

          included_specs + missing_specs
        end

        # Volume specs representing the volumes included in the settings
        #
        # @return [Array<Y2Storage::VolumeSpecification>]
        def included_specs
          settings.volumes.map { |v| volume_converter.to_y2storage(v) }
        end

        # Volume specs that do not match any of the volumes in the settings
        #
        # @return [Array<Y2Storage::VolumeSpecification>]
        def missing_specs
          specs = default_specs.select do |spec|
            settings.volumes.none? { |v| v.mounted_at?(spec.mount_point) }
          end
          specs.each do |spec|
            next unless spec.proposed_configurable

            spec.proposed = false
          end

          specs
        end

        # Object to perform the conversion of the volumes
        def volume_converter
          @volume_converter ||= VolumeConverter.new(default_specs: default_specs)
        end
      end
    end
  end
end
