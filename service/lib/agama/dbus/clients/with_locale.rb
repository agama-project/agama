# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module DBus
    module Clients
      # Mixin for clients of services that define the Locale D-Bus interface
      #
      # Provides a method to interact with the API of the Locale interface.
      #
      # @note This mixin is expected to be included in a class inherited from {Clients::Base} and
      #   it requires a #dbus_object method that returns a {::DBus::Object} implementing the
      #   Locale interface.
      module WithLocale
        # Changes the service locale
        #
        # @param locale [String] new locale
        def locale=(locale)
          dbus_object.SetLocale(locale)
        end
      end
    end
  end

end
