# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
      # Conversions for a volume.
      module VolumeConversion
        # Performs conversion from D-Bus format.
        #
        # @param dbus_volume [Hash]
        # @param config [Agama::Config]
        # @param logger [Logger, nil]
        #
        # @return [Agama::Storage::Volume]
        def self.from_dbus(dbus_volume, config:, logger: nil)
          FromDBus.new(dbus_volume, config: config, logger: logger).convert
        end

        # Performs conversion to D-Bus format.
        #
        # @param volume [Agama::Storage::Volume]
        # @return [Hash]
        def self.to_dbus(volume)
          ToDBus.new(volume).convert
        end
      end
    end
  end
end
