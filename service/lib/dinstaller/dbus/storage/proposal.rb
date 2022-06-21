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

module DInstaller
  module DBus
    module Storage
      # D-Bus object to manage a storage proposal
      class Proposal < ::DBus::Object
        PATH = "/org/opensuse/DInstaller/Storage/Proposal1"
        private_constant :PATH

        INTERFACE = "org.opensuse.DInstaller.Storage.Proposal1"
        private_constant :INTERFACE

        # Constructor
        #
        # @param backend [DInstaller::Storage::Proposal]
        # @param logger [Logger]
        def initialize(backend, logger)
          @backend = backend
          @logger = logger

          super(PATH)

          backend.add_on_change_listener do
            dbus_properties_changed(INTERFACE, { "LVM" => lvm,
              "CandidateDevices" => candidate_devices,
              "AvailableDevices" => available_devices }, [])
          end
        end

        dbus_interface INTERFACE do
          dbus_reader :lvm, "b", dbus_name: "LVM"

          dbus_reader :candidate_devices, "as"

          # The first string is the name of the device (as expected by #Calculate for
          # the setting CandidateDevices), the second one is the label to represent that device in
          # the UI when further information is needed.
          #
          # TODO: this representation is a temporary solution. In the future we should likely
          # return more complex structures, probably with an interface similar to
          # com.redhat.Blivet0.Device or org.freedesktop.UDisks2.Block.
          dbus_reader :available_devices, "a(ssa{sv})"

          # result: 0 success; 1 error
          dbus_method :Calculate, "in settings:a{sv}, out result:u" do |settings|
            success = backend.calculate(to_proposal_properties(settings))

            success ? 0 : 1
          end
        end

        # List of disks available for installation
        #
        # Each device is represented by an array containing id and UI label. See the documentation
        # of the available_devices DBus reader.
        #
        # @see DInstaller::Storage::Proposal
        #
        # @return [Array<Array>]
        def available_devices
          backend.available_devices.map do |dev|
            [dev.name, backend.device_label(dev), {}]
          end
        end

        # @see DInstaller::Storage::Proposal
        def lvm
          backend.lvm?
        end

        # @see DInstaller::Storage::Proposal
        def candidate_devices
          backend.candidate_devices
        end

      private

        # @return [DInstaller::Storage::Proposal]
        attr_reader :backend

        # @return [Logger]
        attr_reader :logger

        # Equivalence between properties names in D-Bus and backend.
        PROPOSAL_PROPERTIES = {
          "LVM"              => "use_lvm",
          "CandidateDevices" => "candidate_devices"
        }.freeze
        private_constant :PROPOSAL_PROPERTIES

        # Converts settings from D-Bus to backend names
        #
        # @example
        #   settings = { "LVM" => true, "CandidateDevices" => ["/dev/sda"] }
        #   to_proposal_settings(settings) #=>
        #     { "use_lvm" => true, "candidate_devices" => ["/dev/sda"] }
        #
        # @param settings [Hash]
        def to_proposal_properties(settings)
          settings.each_with_object({}) do |e, h|
            h[PROPOSAL_PROPERTIES[e.first]] = e.last
          end
        end
      end
    end
  end
end
