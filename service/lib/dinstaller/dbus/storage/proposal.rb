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
require "dinstaller/storage/proposal"

module DInstaller
  module DBus
    module Storage
      # D-Bus object to manage a storage proposal
      class Proposal < ::DBus::Object
        PATH = "/org/opensuse/DInstaller/Storage/Proposal1"
        private_constant :PATH

        INTERFACE = "org.opensuse.DInstaller.Storage.Proposal1"
        private_constant :INTERFACE

        def initialize(logger)
          @logger = logger

          super(PATH)
        end

        dbus_interface INTERFACE do
          dbus_reader :lvm, "b", dbus_name: "LVM"

          dbus_reader :candidate_devices, "as"

          dbus_reader :available_devices, "as"
          # result: 0 success; 1 error
          dbus_method :Calculate, "in settings:a{sv}, out result:u" do |settings|
            backend.calculate(to_proposal_properties(settings))

            PropertiesChanged(INTERFACE, settings, [])

            backend.success? ? 0 : 1
          end
        end

        def available_devices
          backend.available_devices.map(&:name)
        end

        def lvm
          backend.lvm?
        end

        def candidate_devices
          backend.candidate_devices
        end

      private

        PROPOSAL_PROPERTIES = {
          "LVM"              => "use_lvm",
          "CandidateDevices" => "candidate_devices"
        }.freeze

        private_constant :PROPOSAL_PROPERTIES

        def to_proposal_properties(settings)
          settings.each_with_object({}) do |e, h|
            h[PROPOSAL_PROPERTIES[e.first]] = e.last
          end
        end

        def backend
          @backend ||= ::DInstaller::Storage::Proposal.instance
        end
      end
    end
  end
end
