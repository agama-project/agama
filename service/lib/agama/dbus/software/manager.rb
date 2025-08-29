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
require "agama/dbus/base_object"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/locale"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_progress"
require "agama/dbus/with_service_status"

module Agama
  module DBus
    module Software
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithProgress
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
          @conflicts = []
        end

        # List of software related issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.issues
        end

        def only_required
          case backend.proposal.only_required
          when nil then 0
          when false then 1
          when true then 2
          else
            @logger.warn(
              "Unexpected value in only_required #{backend.proposal.only_required.inspect}"
            )
            0
          end
        end

        def only_required=(flag)
          value = case flag
          when 0 then nil
          when 1 then false
          when 2 then true
          else
            @logger.warn "Unexpected value in only_required #{flag.inspect}"
          end
          backend.proposal.only_required = value
          # propose again after changing solver flag
          propose
        end

        SOFTWARE_INTERFACE = "org.opensuse.Agama.Software1"
        private_constant :SOFTWARE_INTERFACE

        dbus_interface SOFTWARE_INTERFACE do
          # Flag for proposing required only dependencies
          # Propose is called automatically whenever the value is assigned.
          # value mapping 0 for not set, 1 for false and 2 for true
          dbus_accessor :only_required, "u"

          # array of repository properties: pkg-bindings ID, alias, name, URL, product dir, enabled
          # and loaded flag
          dbus_method :ListRepositories, "out Result:a(issssbb)" do
            [
              backend.repositories.repositories.map do |repo|
                [
                  repo.repo_id,
                  repo.repo_alias,
                  repo.name,
                  repo.raw_url.uri.to_s,
                  repo.product_dir,
                  repo.enabled?,
                  !!repo.loaded?
                ]
              end
            ]
          end

          # set user specified repositories properties
          dbus_method :SetUserRepositories, "in repos:aa{sv}" do |repos|
            @logger.info "Setting user repositories #{repos.inspect}"
            backend.repositories.user_repositories = repos
          end

          # set user specified repositories properties
          dbus_method :ListUserRepositories, "out repos:aa{sv}" do
            [backend.repositories.user_repositories]
          end

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

          dbus_reader_attr_accessor :conflicts, "a(ussa(uss))"

          dbus_method :SolveConflicts, "in solutions:a(uu)" do |solutions|
            ret = backend.proposal.solve_conflicts(solutions)
            # update the user selected patterns, patterns might be unselected as
            # part of the conflict resolution
            backend.update_selected_patterns
            ret
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

        def ssl_fingerprints
          ssl_storage.fingerprints.map { |f| [f.sum, f.value] }
        end

        def ssl_fingerprints=(new_fps)
          fps = new_fps.map { |f| SSL::Fingerprint.new(f[0], f[1]) }
          ssl_storage.fingerprints.replace(fps)
        end

        SECURITY_INTERFACE = "org.opensuse.Agama.Security"
        private_constant :SECURITY_INTERFACE

        dbus_interface SECURITY_INTERFACE do
          # List of SSL fingerprints serialized into type and its value
          dbus_accessor :ssl_fingerprints, "a(ss)"
        end

      private

        def ssl_storage
          SSL::Storage.instance
        end
        # @return [Agama::Software]
        attr_reader :backend

        # Registers callback to be called
        def register_callbacks
          nm_client = Agama::DBus::Clients::Network.new
          nm_client.on_connection_changed do |connected|
            probe if connected
          end

          backend.on_selected_patterns_change do
            self.selected_patterns = compute_patterns
          end

          backend.proposal.on_conflicts_change do |conflicts|
            self.conflicts = conflicts.map do |conflict|
              [
                conflict["id"], conflict["description"], conflict["details"] || "",
                conflict["solutions"].map do |solution|
                  [solution["id"], solution["description"], solution["details"] || ""]
                end
              ]
            end
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
