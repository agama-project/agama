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

require "agama/dbus/storage/proposal_settings_conversion/from_dbus"
require "agama/dbus/storage/proposal_settings_conversion/to_dbus"

module Agama
  module DBus
    module Storage
      # Utility class offering methods to convert volumes between Agama and D-Bus formats
      #
      # @note In the future this class might be not needed if proposal volumes and templates are
      #   exported as objects in D-Bus.
      module ProposalSettingsConversion
        # Converts the given D-Bus settings to its equivalent Agama proposal settings
        #
        # @param dbus_settings [Hash]
        # @return [Agama::Storage::ProposalSettings]
        def self.from_dbus(dbus_settings, config:)
          FromDBus.new(dbus_settings, config: config).convert
        end

        def self.to_dbus(settings)
          ToDBus.new(settings).convert
        end
      end
    end
  end
end
