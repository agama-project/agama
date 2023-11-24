# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "agama/dbus/bus"
require "agama/dbus/clients/locale"
require "agama/dbus/storage"
require "agama/storage"
require "agama/ui_locale"

module Agama
  module DBus
    # D-Bus service (org.opensuse.Agama.Storage1)
    #
    # It connects to the system D-Bus and answers requests on objects below
    # `/org/opensuse/Agama/Storage1`.
    class StorageService
      SERVICE_NAME = "org.opensuse.Agama.Storage1"
      private_constant :SERVICE_NAME

      # @param config [Config] Configuration object
      # @param logger [Logger]
      def initialize(config, logger = nil)
        @config = config
        @logger = logger || Logger.new($stdout)
      end

      # D-Bus connection
      #
      # @return [::DBus::Connection]
      def bus
        Bus.current
      end

      # Starts storage service. It does more then just #export method.
      def start
        export
        # TODO: test if we need to pass block with additional actions
        @ui_locale = UILocale.new(Clients::Locale.instance)
      end

      # Exports the storage proposal object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }
        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      # Call this from some main loop to dispatch the D-Bus messages
      def dispatch
        bus.dispatch_message_queue
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      def manager
        @manager ||= Agama::Storage::Manager.new(config, logger)
      end

      # @return [::DBus::ObjectServer]
      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      # @return [Array<::DBus::Object>]
      def dbus_objects
        @dbus_objects ||= [Agama::DBus::Storage::Manager.new(manager, logger)]
      end
    end
  end
end
