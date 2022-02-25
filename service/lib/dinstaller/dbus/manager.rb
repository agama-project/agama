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

        # @available_base_products = installer.products

        super(PATH)
      end

      dbus_interface MANAGER_INTERFACE do
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
