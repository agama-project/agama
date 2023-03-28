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

require "y2iscsi_client/authentication"

module DInstaller
  module DBus
    module Storage
      # Mixin for creating an iSCSI authentication object from D-Bus options
      module WithISCSIAuth
        # Creates an iSCSI authentication object
        #
        # @param dbus_options [Hash<String, String>] Options from a D-Bus call:
        #   @option Username [String] Username for authentication by target
        #   @option Password [String] Password for authentication by target
        #   @option ReverseUsername [String] Username for authentication by initiator
        #   @option ReversePassword [String] Username for authentication by inititator
        #
        # @return [Y2IscsiClient::Authentication]
        def iscsi_auth(dbus_options)
          Y2IscsiClient::Authentication.new.tap do |auth|
            auth.username = dbus_options["Username"]
            auth.password = dbus_options["Password"]
            auth.username_in = dbus_options["ReverseUsername"]
            auth.password_in = dbus_options["ReversePassword"]
          end
        end
      end
    end
  end
end
