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

require "eventmachine"
require "dinstaller/manager"
require "dinstaller/dbus/service"
require "dinstaller/dbus/users_service"

module DInstaller
  module DBus
    # Set up and run a given D-Bus service
    #
    # @example Run the manager service
    #   runner = ServiceRunner.new(:manager)
    #   runner.run
    #
    # @example Run the users service
    #   runner = ServiceRunner.new(:users)
    #   runner.run
    class ServiceRunner
      SERVICES_MAP = {
        users: DInstaller::DBus::UsersService
      }.freeze
      private_constant :SERVICES_MAP

      # @param name [Symbol,String] Service name (:manager, :users, etc.)
      # @param logger [Logger] Service logger
      def initialize(name, logger: Logger.new($stdout))
        @name = name || :manager
        @logger = logger
      end

      # Run the Service
      #
      # This method listens for D-Bus calls.
      def run
        service = if name == :manager
          setup_manager(logger)
        else
          setup_service(name, logger)
        end

        service.export
        EventMachine.run do
          EventMachine::PeriodicTimer.new(0.1) { service.dispatch }
        end
      end

    private

      attr_reader :name, :logger

      # Set up the manager service
      #
      # @param logger [Logger] Service logger
      # @return [DInstaller::DBus::Service] Manager service
      def setup_manager(logger)
        manager = DInstaller::Manager.new(logger)
        manager.setup
        service = DInstaller::DBus::Service.new(manager, logger)
        manager.probe # probe after export, so we can report on DBus
        manager.progress.on_change { service.dispatch } # make single thread more responsive
        service
      end

      # Set up a service
      #
      # @param name [String] Service name (ie, "users")
      # @param logger [Logger] Service logger
      # @return [#export,#dispatch] Class that implements #export and #dispatch methods.
      def setup_service(name, logger)
        klass = SERVICES_MAP[name]
        raise "Service not found" unless klass

        klass.new(logger)
      end
    end
  end
end
