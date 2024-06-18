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
      # Mixin to define the Progress D-Bus interface
      #
      # @note This mixin is expected to be included in a class inherited from {DBus::BaseObject}
      #   class and it requires a #backend method that returns an instance of a class including the
      #   {Agama::WithProgress} mixin.
      #
      # @example
      #   class Backend
      #     include Agama::WithProgress
      #   end
      #
      #   class Demo < Agama::DBus::BaseObject
      #     include Agama::DBus::Interfaces::Progress
      #
      #     def initialize
      #       super("org.test.Demo")
      #       register_progress_callbacks
      #     end
      #
      #     def backend
      #       @backend ||= Backend.new
      #     end
      #   end
      module Progress
        PROGRESS_INTERFACE = "org.opensuse.Agama1.Progress"

        # Total number of steps of the progress
        #
        # @return [Integer] 0 if no progress defined
        def progress_total_steps
          return 0 unless backend.progress

          backend.progress.total_steps
        end

        # Current step data
        #
        # @return [Array(Number,String)] Step id and description
        def progress_current_step
          current_step = backend.progress&.current_step
          return [0, ""] unless current_step

          [current_step.id, current_step.description]
        end

        # Whether the progress has finished
        #
        # @return [Boolean]
        def progress_finished
          return true unless backend.progress

          backend.progress.finished?
        end

        # Returns the known step descriptions
        #
        # @return [Array<String>]
        def progress_steps
          return [] unless backend.progress

          backend.progress.descriptions
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
          backend.on_progress_change do
            dbus_properties_changed(PROGRESS_INTERFACE, progress_properties, [])
          end

          backend.on_progress_finish do
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
