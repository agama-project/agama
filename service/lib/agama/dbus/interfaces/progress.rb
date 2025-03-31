# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
      # Mixin to define the Progress D-Bus interface
      #
      # @note This mixin is expected to be included by a class which inherits from
      #   {DBus::BaseObject} and includes the {Agama::DBus::WithProgress} mixin.
      #
      # @example
      #   class Demo < Agama::DBus::BaseObject
      #     include Agama::DBus::WithProgress
      #     include Agama::DBus::Interfaces::Progress
      #
      #     def initialize
      #       super("org.test.Demo")
      #       register_progress_callbacks
      #     end
      #   end
      module Progress
        PROGRESS_INTERFACE = "org.opensuse.Agama1.Progress"

        # Total number of steps of the progress
        #
        # @return [Integer] 0 if no progress defined
        def progress_total_steps
          return 0 unless progress

          progress.total_steps
        end

        # Current step data
        #
        # @return [Array(Number,String)] Step id and description
        def progress_current_step
          current_step = progress&.current_step
          return [0, ""] unless current_step

          [current_step.id, current_step.description]
        end

        # Whether the progress has finished
        #
        # @return [Boolean]
        def progress_finished
          return true unless progress

          progress.finished?
        end

        # Returns the known step descriptions
        #
        # @return [Array<String>]
        def progress_steps
          return [] unless progress

          progress.descriptions
        end

        # D-Bus properties of the Progress interface
        #
        # @return [Hash]
        def progress_properties
          interfaces_and_properties[PROGRESS_INTERFACE]
        end

        # Registers callbacks to be called when the progress changes or finishes
        #
        # @note This method is expected to be called in the constructor.
        def register_progress_callbacks
          progress_manager.on_change do
            dbus_properties_changed(PROGRESS_INTERFACE, progress_properties, [])
          end

          progress_manager.on_finish do
            dbus_properties_changed(PROGRESS_INTERFACE, progress_properties, [])
          end
        end

        def self.included(base)
          base.class_eval do
            dbus_interface PROGRESS_INTERFACE do
              dbus_reader :progress_total_steps, "u", dbus_name: "TotalSteps"
              dbus_reader :progress_current_step, "(us)", dbus_name: "CurrentStep"
              dbus_reader :progress_finished, "b", dbus_name: "Finished"
              dbus_reader :progress_steps, "as", dbus_name: "Steps"
            end
          end
        end
      end
    end
  end
end
