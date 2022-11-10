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

require "dinstaller/dbus/clients/base"
require "dinstaller/dbus/clients/with_service_status"
require "dinstaller/dbus/clients/with_progress"
require "dinstaller/dbus/clients/with_validation"

module DInstaller
  module DBus
    module Clients
      # D-Bus client for storage configuration
      class Storage < Base
        include WithServiceStatus
        include WithProgress
        include WithValidation

        PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1"
        private_constant :PROPOSAL_IFACE

        def initialize
          super

          @dbus_object = service["/org/opensuse/DInstaller/Storage1"]
          @dbus_object.introspect

          @dbus_proposal = service.object("/org/opensuse/DInstaller/Storage/Proposal1")
          @dbus_proposal.introspect
        end

        # @return [String]
        def service_name
          @service_name ||= "org.opensuse.DInstaller.Storage"
        end

        # Starts the probing process
        #
        # If a block is given, the method returns immediately and the probing is performed in an
        # asynchronous way.
        #
        # @param done [Proc] Block to execute once the probing is done
        def probe(&done)
          dbus_object.Probe(&done)
        end

        # Performs the packages installation
        def install
          dbus_object.Install
        end

        # Cleans-up the storage stuff after installation
        def finish
          dbus_object.Finish
        end

        # Devices available for the installation
        #
        # @return [Array<String>] name of the devices
        def available_devices
          dbus_proposal[PROPOSAL_IFACE]["AvailableDevices"]
            .map(&:first)
        end

        # Devices selected for the installation
        #
        # @return [Array<String>] name of the devices
        def candidate_devices
          dbus_proposal[PROPOSAL_IFACE]["CandidateDevices"]
        end

        # Actions to perform in the storage devices
        #
        # @return [Array<String>]
        def actions
          dbus_proposal[PROPOSAL_IFACE]["Actions"].map do |a|
            a["Text"]
          end
        end

        # Calculates the storage proposal with the given devices
        #
        # @param candidate_devices [Array<String>] name of the new candidate devices
        def calculate(candidate_devices)
          dbus_proposal.Calculate({ "CandidateDevices" => candidate_devices })
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object

        # @return [::DBus::Object]
        attr_reader :dbus_proposal
      end
    end
  end
end
