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
require "agama/storage/volume"

module Agama
  module Storage
    # Utility class offering methods to convert between Y2Storage::VolumeSpecification objects and
    # Agama::Volume ones
    class VolumeConverter
      # Constructor
      #
      # @param default_specs [Array<Y2Storage::VolumeSpecification] list of default volume
      #   specifications
      def initialize(default_specs: [])
        @default_specs = default_specs
      end

      # Returns the Y2Storage::VolumeSpecification object that is equivalent to the given
      # Agama::Volume one
      #
      # @param volume [Volume]
      # @return [Y2Storage::VolumeSpecification]
      def to_y2storage(volume)
        ToY2Storage.new(volume, default_specs).convert
      end

      # Returns the Agama::Volume object that is equivalent to the given
      # Y2Storage::VolumeSpecification one
      #
      # @param spec [Y2Storage::VolumeSpecification]
      # @param devices [Array<Y2Storage::Planned::Device] planned devices generated during the
      #   latest proposal attempt
      # @return [Volume]
      def to_dinstaller(spec, devices: [])
        ToDInstaller.new(spec, default_specs, devices).convert
      end

    private

      # @see #initialize
      attr_reader :default_specs

      # Internal class to generate a Y2Storage volume specification
      class ToY2Storage
        # Constructor
        #
        # @param volume see {#volume}
        # @param default_specs see #{default_specs}
        def initialize(volume, default_specs)
          @volume = volume
          @default_specs = default_specs
        end

        # @see VolumeConverter#to_y2storage
        def convert
          spec = default_specs.find { |s| volume.mounted_at?(s.mount_point) }
          # If there is no spec for the volume, then the volume is optional
          spec ||= Y2Storage::VolumeSpecification.new({ "proposed_configurable" => true })

          spec.mount_point = volume.mount_point
          spec.proposed = true
          spec.fs_type = volume.fs_type if volume.fs_type
          spec.snapshots = volume.snapshots if configure_snapshots?(spec)

          configure_sizes(spec)
        end

      private

        # @see VolumeConverter#to_y2storage
        attr_reader :volume

        # @see VolumeConverter#initialize
        attr_reader :default_specs

        # Whether snapshots should be configured
        #
        # @param spec [Y2Storage::VolumeSpecification]
        # @return [Boolean]
        def configure_snapshots?(spec)
          spec.snapshots_configurable? && !volume.snapshots.nil?
        end

        # Whether size limits are fixed
        #
        # @param spec [Y2Storage::VolumeSpecification]
        # @return [Boolean]
        def fixed_size_limits?(spec)
          # A volume from D-Bus is not created from a spec, so it does not contain relevant
          # information to know whether the volume has adaptive sizes. Let's use a new volume
          # created from spec to check about adaptive sizes.
          !Volume.new(spec).adaptive_sizes? || !!volume.fixed_size_limits
        end

        # Configures size related attributes
        #
        # @param spec [Y2Storage::VolumeSpecification] The spec is modified
        def configure_sizes(spec)
          fixed_size_limits = fixed_size_limits?(spec)

          spec.ignore_fallback_sizes = fixed_size_limits
          spec.ignore_snapshots_sizes = fixed_size_limits
          return spec unless fixed_size_limits

          spec.min_size = volume.min_size if volume.min_size
          spec.max_size = volume.max_size if volume.max_size
          spec
        end
      end

      # Internal class to generate a DInstaller volume
      class ToDInstaller
        # Constructor
        #
        # @param spec see {#spec}
        # @param default_specs see #{default_specs}
        # @param devices see {#devices}
        def initialize(spec, default_specs, devices)
          @spec = spec
          @default_specs = default_specs
          @devices = devices
        end

        # @see VolumeConverter#to_y2storage
        def convert
          Volume.new(spec).tap do |volume|
            volume.assign_size_relevant_volumes(default_specs)
            planned = devices.find { |d| planned_device_match?(d, volume) }
            if planned
              volume.device_type = planned.respond_to?(:lv_type) ? :lvm_lv : :partition
              volume.min_size = planned.min
              volume.max_size = planned.max
            end
          end
        end

      private

        # @see VolumeConverter#to_y2storage
        attr_reader :spec

        # @see VolumeConverter#initialize
        attr_reader :default_specs

        # @see VolumeConverter#initialize
        attr_reader :devices

        # Whether the given planned device corresponds to the volume
        def planned_device_match?(device, volume)
          device.respond_to?(:mount_point) && volume.mounted_at?(device.mount_point)
        end
      end
    end
  end
end
