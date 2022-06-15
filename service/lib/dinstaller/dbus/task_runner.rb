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

module DInstaller
  module DBus
    # This class prevents many conflicting blocks to run at the same time
    #
    # Running a time consuming task (like software probing) on a separate thread allows the D-Bus
    # service to keep responsive meanwhile. However, as YaST is not thread safe, some incoming
    # request might conflict with the running process.
    #
    # Wrapping the potentially conflicting code with #run_thread or #run will protect
    # the conflicts by raising a DBus::Error.
    #
    # @example Run a long running task
    #   runner = TaskRunner.new
    #   runner.run_thread { long_running_task }
    #
    # @example Raise an error when a long running task is still alive
    #   runner = TaskRunner.new
    #   runner.run_thread { long_running_task }
    #   runner.run_thread { another_task } #=> <DBus::Error>
    #
    # @example Run a short task
    #   runner = TaskRunner.new
    #   runner.run { short_task }
    class TaskRunner
      def initialize
        @thread = nil
      end

      def run(&block)
        raise error if @thread&.alive?

        block.call
      end

      def run_thread(&block)
        raise error if @thread&.alive?

        @thread = Thread.new(&block)
      end

      def cleanup
        return if @thread.nil? || @thread.alive?

        @thread.join
        @thread = nil
      end

      def error
        DBus.error("org.opensuse.DInstaller.Error.Busy")
      end
    end
  end
end
