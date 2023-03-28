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

require "agama/dbus/interfaces/progress"

module DInstaller
  module DBus
    module Clients
      # Mixin for clients of services that define the Progress D-Bus interface
      #
      # Provides methods to interact with the API of the Progress interface.
      #
      # @note This mixin is expected to be included in a class inherited from {Clients::Base} and
      #   it requires a #dbus_object method that returns a {::DBus::Object} implementing the
      #   Progress interface.
      module WithProgress
        # Registers a callback to run when the progress changes
        #
        # @param block [Proc]
        # @yieldparam total_steps [Integer]
        # @yieldparam current_step [Integer]
        # @yieldparam message [String]
        # @yieldparam finished [Boolean]
        def on_progress_change(&block)
          on_properties_change(dbus_object) do |interface, changes, _|
            if interface == Interfaces::Progress::PROGRESS_INTERFACE
              total_steps = changes["TotalSteps"]
              current_step = changes["CurrentStep"][0]
              message = changes["CurrentStep"][1]
              finished = changes["Finished"]
              block.call(total_steps, current_step, message, finished)
            end
          end
        end
      end
    end
  end
end
