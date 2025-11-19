# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/issue"

module Agama
  module DBus
    module Interfaces
      # Mixin to define the Issues D-Bus interface
      #
      # @note This mixin is expected to be included in a class that inherits from {DBus::BaseObject}
      # and it requires a #issues method that returns an array of {Issue} objects.
      module Issues
        ISSUES_INTERFACE = "org.opensuse.Agama1.Issues"

        # Issues with the D-Bus format
        #
        # @return [Array<Array(String, String)>] The description, kind and details of each issue.
        def dbus_issues
          issues.map do |issue|
            [issue.description, issue.kind.to_s, issue.details.to_s]
          end
        end

        # Emits the signal for properties changed
        def issues_properties_changed
          dbus_properties_changed(ISSUES_INTERFACE,
            interfaces_and_properties[ISSUES_INTERFACE], [])
        end

        def self.included(base)
          base.class_eval do
            dbus_interface ISSUES_INTERFACE do
              # @see {#dbus_issues}
              dbus_reader :dbus_issues, "a(sss)", dbus_name: "All"
            end
          end
        end
      end
    end
  end
end
