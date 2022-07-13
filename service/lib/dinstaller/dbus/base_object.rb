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
    # Base class for DBus objects
    class BaseObject < ::DBus::Object
      # Constructor
      #
      # @param path [::DBus::ObjectPath]
      # @param logger [Logger, nil]
      def initialize(path, logger: nil)
        @logger = logger || Logger.new($stdout)
        super(path)
      end

      # Generates information about interfaces and properties of the object
      #
      # Returns a hash containing interfaces names as keys. Each value is the same hash that would
      # be returned by the org.freedesktop.DBus.Properties.GetAll() method for that combination of
      # object path and interface. If an interface has no properties, the empty hash is returned.
      #
      # @return [Hash]
      def interfaces_and_properties
        get_all_method = self.class.make_method_name("org.freedesktop.DBus.Properties", :GetAll)

        intfs.keys.each_with_object({}) do |interface, hash|
          hash[interface] = public_send(get_all_method, interface).first
        end
      end

    private

      # @return [Logger]
      attr_reader :logger
    end
  end
end
