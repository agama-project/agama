# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

module Agama
  module DBus
    module Interfaces
      # Mixin to define the Validation D-Bus interface
      #
      # @example Update the validation on a D-Bus call
      #   class Backend
      #     def validate
      #       ["Some error"]
      #     end
      #   end
      #
      #   class Demo < Agama::DBus::BaseObject
      #     include Agama::DBus::Interfaces::Validation
      #
      #     dbus_interface "org.opensuse.DInstaller.Demo1" do
      #       dbus_reader :errors, "as", dbus_name: "Errors"
      #       dbus_method :Foo, "out result:u" do
      #         # do some stuff
      #         update_validation # run this method is the validation can change
      #         0
      #       end
      #     end
      #   end
      #
      # @note This mixin is expected to be included in a class that inherits from {DBus::BaseObject}
      # and it requires a #backend method that returns an object that implements a #validate method.
      module Validation
        VALIDATION_INTERFACE = "org.opensuse.DInstaller.Validation1"

        # D-Bus properties of the Validation1 interface
        #
        # @return [Hash]
        def validation_properties
          interfaces_and_properties[VALIDATION_INTERFACE]
        end

        # Updates the validation and raise the `PropertiesChanged` signal
        def update_validation
          @errors = nil
          dbus_properties_changed(VALIDATION_INTERFACE, validation_properties, [])
        end

        # Returns the validation errors
        #
        # @return [Array<String>] Validation error messages
        def errors
          @errors ||= backend.validate.map(&:message)
        end

        # Determines whether the service settings are valid or not
        #
        # @return [Boolean] true if the service has valid data; false otherwise
        def valid?
          errors.empty?
        end

        def self.included(base)
          base.class_eval do
            dbus_interface VALIDATION_INTERFACE do
              dbus_reader :errors, "as"
              dbus_reader :valid?, "b", dbus_name: "Valid"
            end
          end
        end
      end
    end
  end
end
