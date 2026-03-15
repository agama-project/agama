# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

module Agama
  # Class for running tasks in a sync or async way, preventing the execution of several tasks at the
  # same time.
  class TaskRunner
    # Error when an async task is already running.
    class BusyError < StandardError
      def initialize(running_task = nil, requested_task = nil)
        message = "Cannot start a new task while another is in progress: " \
                  "requested: '#{requested_task || "unknown"}', " \
                  "running: '#{running_task || "unknown"}'"
        super(message)
      end
    end

    def initialize
      @running_task = nil
      @running_thread = nil
    end

    # Runs the given block in a new thread.
    #
    # @raise [BusyError] If a previous async task is already running.
    #
    # @param task [String, nil] Description of the task to run.
    # @param block [Proc] Code to run in a separate thread.
    # @return [Thread] The new thread.
    def async_run(task = nil, &block)
      # Queue to safely communicate between threads. It is used to indicate to the main thread that
      # the task has started.
      ready = Queue.new
      perform_run(task) do
        @running_task = task
        @running_thread = Thread.new do
          ready.push(true) # Signaling to indicate the task has started.
          block.call
        end
      end
      ready.pop # Ensures the task has started.
      @running_thread
    end

    # Runs the given block in the main thread.
    #
    # @raise [BusyError] If a async task is running.
    #
    # @param task [String, nil] Description of the task to run.
    # @param block [Proc] Code to run.
    def run(task = nil, &block)
      perform_run(task, &block)
    end

    # Whether there is a task running in a separate thread.
    #
    # @return [Boolean]
    def busy?
      @running_thread&.alive? || false
    end

  private

    # Runs the given block.
    #
    # @raise [BusyError] If a async task is running.
    #
    # @param task [String, nil] Description of the task to run.
    # @param block [Proc] Code to run.
    def perform_run(task = nil, &block)
      raise BusyError.new(@running_task, task) if busy?

      block.call
    end
  end
end
