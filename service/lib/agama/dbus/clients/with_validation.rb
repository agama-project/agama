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

require "agama/validation_error"

module Agama
  module DBus
    # Mixin to include in the clients of services that implement the Validation1 interface
    module WithValidation
      VALIDATION_IFACE = "org.opensuse.Agama1.Validation"
      private_constant :VALIDATION_IFACE

      # Returns the validation errors
      #
      # @return [Array<ValidationError>] Validation errors
      def errors
        dbus_object[VALIDATION_IFACE]["Errors"].map do |message|
          Agama::ValidationError.new(message)
        end
      end

      # Determines whether the service settings are valid or not
      #
      # @return [Boolean] true if the service has valid data; false otherwise
      def valid?
        dbus_object[VALIDATION_IFACE]["Valid"]
      end
    end
  end
end
