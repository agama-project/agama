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

require "cheetah"
require "fileutils"

module DInstaller
  module DBus
    # This class takes care of setting up the D-Installer D-Bus server
    #
    # @example Find the current server or start a new if it is not running
    #   manager = DBusManager.new
    #   manager.find_or_start_server
    class ServerManager
      # @return [String] Command to start the D-Bus server
      START_CMD = "/usr/bin/dbus-daemon --print-address " \
                  "--config-file %{config} --fork --systemd-activation"
      private_constant :START_CMD

      # @return [String] Default run directory path
      DEFAULT_RUN_DIRECTORY = "/run/d-installer"
      private_constant :DEFAULT_RUN_DIRECTORY

      attr_reader :run_directory

      def initialize(run_directory: DEFAULT_RUN_DIRECTORY)
        @run_directory = run_directory
      end

      # Finds the current D-Bus server or starts a new one
      #
      # @return [Integer,nil] PID of the server process or nil if it
      #   was not possible to start a new one
      def find_or_start_server
        find_server || start_server
      end

      # Starts a D-Bus server
      #
      # @return [Integer,nil] PID of the new server. Returns nil if it failed to start
      #   the server.
      def start_server
        FileUtils.mkdir_p(run_directory)

        output = Cheetah.run(
          "/usr/bin/dbus-daemon",
          "--config-file", config_file,
          "--address", address,
          "--fork", "--systemd-activation",
          "--print-pid",
          stdout: :capture
        )
        pid = output.strip
        File.write(pid_file, pid)
        pid.to_i
      rescue Cheetah::ExecutionFailed => e
        puts "Could not start the DBus daemon: #{e.message}"
        nil
      end

      # Gets the PID of the running server
      #
      # @return [Integer,nil] PID of the process if it exists, nil otherwise.
      def find_server
        return nil unless File.exist?(pid_file)

        pid = File.read(pid_file).to_i
        return nil if pid.zero?

        begin
          Process.getpgid(pid)
          pid
        rescue Errno::ESRCH
          nil
        end
      end

      # Returns the D-Bus address
      #
      # @return [String]
      def address
        @address ||= "unix:path=#{File.join(run_directory, "bus")}"
      end

    private

      # Returns the path to the configuration file
      #
      # It prefers a local configuration under `share/dbus.conf`. Otherwise, it falls back to a
      # system-wide location.
      def config_file
        file = File.join(Dir.pwd, "share", "dbus.conf")
        return file if File.exist?(file)

        "/usr/share/dbus-1/d-installer.conf"
      end

      def pid_file
        @pid_file ||= File.join(run_directory, "bus.pid")
      end
    end
  end
end
