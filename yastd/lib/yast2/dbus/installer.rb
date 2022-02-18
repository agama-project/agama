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

module Yast2
  module DBus
    # YaST D-Bus object (/org/opensuse/YaST/Installer1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Installer < ::DBus::Object
      PATH = "/org/opensuse/YaST/Installer1".freeze
      private_constant :PATH

      YAST_INSTALLER_INTERFACE = "org.opensuse.YaST.Installer1"
      private_constant :YAST_INSTALLER_INTERFACE
      attr_reader :installer, :logger

      # @param installer [Yast2::Installer] YaST installer instance
      # @param args [Array<Object>] ::DBus::Object arguments
      def initialize(installer, logger)
        @installer = installer
        @logger = logger

        # @available_base_products = installer.products

        super(PATH)
      end

      dbus_interface YAST_INSTALLER_INTERFACE do
        dbus_method :probe, "out result:u" do
          # TODO
          0
        end

        dbus_method :commit, "out result:u" do
          # TODO
          0
        end
      end
    end
  end
end
