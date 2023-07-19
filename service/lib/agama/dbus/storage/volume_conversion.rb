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

require "agama/dbus/storage/volume_conversion/from_dbus"
require "agama/dbus/storage/volume_conversion/to_dbus"

module Agama
  module DBus
    module Storage
      # Utility class offering methods to convert volumes between Agama and D-Bus formats
      #
      # @note In the future this class might be not needed if proposal volumes and templates are
      #   exported as objects in D-Bus.
      module VolumeConversion
        # Converts the given D-Bus volume to its equivalent Agama::Volume object
        #
        # @param dbus_volume [Hash]
        # @return [Storage::Volume]
        def from_dbus(dbus_volume, config: nil)
          FromDBus.new(dbus_volume, config: config).convert
        end

        # Converts the given volume to its equivalent D-Bus volume

        # @param volume [Storage::Volume]
        # @return [Hash]
        def to_dbus(volume)
          ToDBus.new(volume).convert
        end
      end
    end
  end
end
