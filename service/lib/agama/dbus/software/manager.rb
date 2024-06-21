# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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
require "agama/dbus/base_object"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/locale"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_service_status"

module Agama
  module DBus
    module Software
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithServiceStatus
        include Interfaces::Progress
        include Interfaces::ServiceStatus
        include Interfaces::Issues
        include Interfaces::Locale

        PATH = "/org/opensuse/Agama/Software1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [Agama::Software]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          register_callbacks
          register_progress_callbacks
          register_service_status_callbacks
          @selected_patterns = {}
        end

        # List of software related issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.issues
        end

        SOFTWARE_INTERFACE = "org.opensuse.Agama.Software1"
        private_constant :SOFTWARE_INTERFACE

        dbus_interface SOFTWARE_INTERFACE do
          # value of result hash is category, description, icon, summary and order
          dbus_method :ListPatterns, "in Filtered:b, out Result:a{s(sssss)}" do |filtered|
            [
              backend.patterns(filtered).each_with_object({}) do |pattern, result|
                # make sure all attributes are already preloaded, adjust the "patterns" method
                # in service/lib/agama/software/manager.rb when changing this list
                value = [
                  pattern.category,
                  pattern.description,
                  pattern.icon,
                  pattern.summary,
                  pattern.order
                ]
                result[pattern.name] = value
              end
            ]
          end

          # selected patterns is hash with pattern name as id and 0 for user selected and
          # 1 for auto selected. Can be extended in future e.g. for mandatory patterns
          dbus_reader_attr_accessor :selected_patterns, "a{sy}"

          dbus_method(:AddPattern, "in id:s, out result:b") { |p| backend.add_pattern(p) }
          dbus_method(:RemovePattern, "in id:s, out result:b") { |p| backend.remove_pattern(p) }
          dbus_method(:SetUserPatterns, "in add:as, in remove:as, out wrong:as") do |add, remove|
            [backend.assign_patterns(add, remove)]
          end

          dbus_method :ProvisionsSelected, "in Provisions:as, out Result:ab" do |provisions|
            [provisions.map { |p| backend.provision_selected?(p) }]
          end

          dbus_method :IsPackageInstalled, "in Name:s, out Result:b" do |name|
            backend.package_installed?(name)
          end

          dbus_method :IsPackageAvailable, "in name:s, out result:b" do |name|
            backend.package_available?(name)
          end

          dbus_method(:UsedDiskSpace, "out SpaceSize:s") { backend.used_disk_space }

          dbus_signal(:ProbeFinished)

          dbus_method(:Probe) { probe }
          dbus_method(:Propose) { propose }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
        end

        def probe
          busy_while { backend.probe }
          self.ProbeFinished
        end

        def propose
          busy_while { backend.propose }

          nil # explicit nil as return value
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
        end

        def locale=(locale)
          busy_while do
            backend.locale = locale
          end
        end

      private

        # @return [Agama::Software]
        attr_reader :backend

        # Registers callback to be called
        def register_callbacks
          Agama::DBus::Clients::Locale.instance.on_language_selected do |language_ids|
            backend.languages = language_ids
            probe
          end

          nm_client = Agama::DBus::Clients::Network.new
          nm_client.on_connection_changed do |connected|
            probe if connected
          end

          backend.on_selected_patterns_change do
            self.selected_patterns = compute_patterns
          end

          backend.on_issues_change { issues_properties_changed }
        end

        USER_SELECTED_PATTERN = 0
        AUTO_SELECTED_PATTERN = 1
        def compute_patterns
          patterns = {}
          user_selected, auto_selected = backend.selected_patterns
          user_selected.each { |p| patterns[p] = USER_SELECTED_PATTERN }
          auto_selected.each { |p| patterns[p] = AUTO_SELECTED_PATTERN }

          patterns
        end
      end
    end
  end
end
