# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

module DInstaller
  module DBus
    # YaST D-Bus object (/org/opensuse/DInstaller/Manager1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Manager < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Manager1"
      private_constant :PATH

      MANAGER_INTERFACE = "org.opensuse.DInstaler.Manager1"
      private_constant :MANAGER_INTERFACE

      attr_reader :installer, :logger

      # @param installer [Yast2::Installer] YaST installer instance
      # @param args [Array<Object>] ::DBus::Object arguments
      def initialize(installer, logger)
        @installer = installer
        @logger = logger

        super(PATH)
      end

      dbus_interface MANAGER_INTERFACE do
        dbus_method :probe, "" do
          # TODO: do it assynchronous. How? ractors will have problem with sharing yast data.
          # For threads there are problem with race conditions. Like what yast will do if some variable change during installation?
        end

        dbus_method :commit, "" do
          # TODO: do it assynchronous
        end

        # Enum list for statuses. Possible values:
        # 0 : error ( it can be read from progress message )
        # 1 : probing
        # 2 : probed
        # 3 : installing
        # 4 : installed
        dbus_reader :status, "u"

        # Progress has struct with values:
        # s message
        # t total major steps to do
        # t current major step
        # t total minor steps. Can be zero which means no minor steps
        # t current minor step
        dbus_reader :progress, "(stttt)"
      end
    end
  end
end
