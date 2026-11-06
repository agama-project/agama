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

require "y2storage/storage_enum_wrapper"
require "y2storage/storage_manager"

module Y2Storage
  module Filesystems
    # Class to represent all the possible name schemas to use when mounting a
    # filesystem or when referencing an encryption device in the crypttab file
    #
    # For the concrete meaning of each possible value, check the corresponding
    # documentation of {Mountable#mount_by} and {Encryption#mount_by}.
    #
    # This is a wrapper for the Storage::MountByType enum
    class MountByType
      include StorageEnumWrapper
      include Yast::I18n
      extend Yast::I18n

      wrap_enum "MountByType"

      # Hash with the properties for each mount by type.
      #
      # Keys are the symbols representing the types and values are hashes that
      # can contain:
      # - `:name` for human string
      # - `:stability` to rate how stable is the corresponding name
      PROPERTIES = {
        device: {
          name:      N_("Device Name"),
          stability: 1
        },
        path:   {
          name:      N_("Device Path"),
          stability: 2
        },
        id:     {
          name:      N_("Device ID"),
          stability: 3
        },
        label:  {
          name:      N_("Volume Label"),
          stability: 4
        },
        uuid:   {
          name:      N_("UUID"),
          stability: 5
        }
      }.freeze

      # Human readable text for a mount by
      #
      # @note A default value is returned in case there is no a name
      #   defined for the mount by type. The value is translated.
      #
      # @return [String]
      def to_human_string
        textdomain "storage"

        name.nil? ? to_s : _(name)
      end

      # Full path of the udev by-* link for this type, given a value of the
      # referenced attribute
      #
      # @param value [String, nil] label, uuid, path or id of the device to point to
      # @return [String, nil] nil if it's not possible to build the path of an udev
      #   link that points to the device
      def udev_name(value)
        return nil if value.nil? || value.empty? || is?(:device)

        File.join("/dev", "disk", "by-#{to_sym}", value)
      end

      class << self
        alias_method :storage_all, :all

        # Redefined `.storage_all` method that filter out unsupported values
        def all
          storage_all.reject { |t| [PARTUUID, PARTLABEL].include?(t) }
        end

        # Type corresponding to the given fstab spec
        #
        # @param spec [String] content of the first column of an /etc/fstab entry
        # @return [MountByType, nil] nil if the string doesn't match any known format
        def from_fstab_spec(spec)
          if spec.start_with?("UUID=", "/dev/disk/by-uuid/")
            UUID
          elsif spec.start_with?("LABEL=", "/dev/disk/by-label/")
            LABEL
          elsif spec.start_with?("/dev/disk/by-id/")
            ID
          elsif spec.start_with?("/dev/disk/by-path/")
            PATH
          elsif spec.start_with?("/dev/")
            DEVICE
          end
        end

        # Most adequate mount_by value to the given device, from the list of
        # possible candidate values
        #
        # @param device [#stable_name?] device that will be referenced
        # @param candidates [Array<MountByType>] list of acceptable values, it
        #   must contain at least DEVICE (since it should always be possible to
        #   use the kernel name to reference a device)
        # @return [MountByType]
        def best_for(device, candidates)
          return default if candidates.include?(default)

          # DEVICE is always a candidate
          return DEVICE if device.stable_name?

          # Again, we are sure that at least DEVICE will be found here
          candidates.max_by { |type| PROPERTIES[type.to_sym][:stability] }
        end

        private

        # Default value, according to the system configuration
        def default
          StorageManager.instance.configuration.default_mount_by
        end
      end

      private

      # Name of the mount by type, if defined
      #
      # @return [String, nil] nil if the name is not defined.
      def name
        return nil if PROPERTIES[to_sym].nil?

        PROPERTIES[to_sym][:name]
      end
    end
  end
end
