# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "dbus"
require "dinstaller/dbus/base_object"

module DInstaller
  module DBus
    module Storage
      # Class representing a DASD in the D-Bus tree
      class Dasd < BaseObject
        # YaST representation of the DASD
        #
        # @return [Y2S390::Dasd]
        attr_reader :dasd

        # Constructor
        #
        # @param dasd [Y2S390::Dasd] See {#dasd}
        # @param path [DBus::ObjectPath] Path in which the object is exported
        # @param logger [Logger, nil]
        def initialize(dasd, path, logger: nil)
          super(path, logger: logger)
          @dasd = dasd
        end

        # The device channel id
        #
        # @return [String]
        def id
          dasd.id
        end

        # Whether the device is enabled
        #
        # @return [Boolean]
        def enabled
          !dasd.offline?
        end

        # The associated device name
        #
        # @return [String] empty if the device is not enabled
        def device_name
          dasd.device_name || ""
        end

        # Whether the device is formatted
        #
        # @return [Boolean]
        def formatted
          dasd.formatted?
        end

        # Whether the DIAG access method is enabled
        #
        # YaST traditionally displays #use_diag, which is always false for disabled devices (see
        # more info about the YaST behavior regarding DIAG at DInstaller::Storage::DASD::Manager).
        # But displaying #diag_wanted is surely more useful. For enabled DASDs both values match
        # and for disabled DASDs #diag_wanted is more informative.
        #
        # @return [Boolean]
        def diag
          dasd.diag_wanted
        end

        # The DASD type (EKCD, FBA)
        #
        # @return [String] empty if unknown
        def type
          dasd.type || ""
        end

        # Access type ('rw', 'ro')
        #
        # @return [String] empty if unknown
        def access_type
          dasd.access_type || ""
        end

        # Description of the partitions
        #
        # @return [String] empty if the information is unknown
        def partition_info
          dasd.partition_info || ""
        end

        # Sets the associated DASD object
        #
        # @note A properties changed signal is always emitted.
        #
        # @param value [Y2S390::Dasd]
        def dasd=(value)
          @dasd = value

          properties = interfaces_and_properties[DASD_DEVICE_INTERFACE]
          dbus_properties_changed(DASD_DEVICE_INTERFACE, properties, [])
        end

        # Interface name representing a DASD object
        DASD_DEVICE_INTERFACE = "org.opensuse.DInstaller.Storage1.DASD.Device"
        private_constant :DASD_DEVICE_INTERFACE

        dbus_interface DASD_DEVICE_INTERFACE do
          dbus_reader(:id, "s")
          dbus_reader(:enabled, "b")
          dbus_reader(:device_name, "s")
          dbus_reader(:formatted, "b")
          dbus_reader(:diag, "b")
          dbus_reader(:type, "s")
          dbus_reader(:access_type, "s")
          dbus_reader(:partition_info, "s")
        end
      end
    end
  end
end
