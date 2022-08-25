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

module DInstallerCli
  module Clients
    # D-Bus client for storage configuration
    class Storage < DInstaller::DBus::Clients::Base
      def initialize
        super

        @dbus_proposal = service.object("/org/opensuse/DInstaller/Storage/Proposal1")
        @dbus_proposal.introspect
      end

      def service_name
        @service_name ||= "org.opensuse.DInstaller"
      end

      # Devices available for the installation
      #
      # @return [Array<String>] name of the devices
      def available_devices
        dbus_proposal["org.opensuse.DInstaller.Storage.Proposal1"]["AvailableDevices"].map(&:first)
      end

      # Devices selected for the installation
      #
      # @return [Array<String>] name of the devices
      def candidate_devices
        dbus_proposal["org.opensuse.DInstaller.Storage.Proposal1"]["CandidateDevices"]
      end

      # Actions to perform in the storage devices
      #
      # @return [Array<String>]
      def actions
        dbus_proposal["org.opensuse.DInstaller.Storage.Proposal1"]["Actions"].map { |a| a["Text"] }
      end

      # Calculates the storage proposal with the given devices
      #
      # @param candidate_devices [Array<String>] name of the new candidate devices
      def calculate(candidate_devices)
        dbus_proposal.Calculate({ "CandidateDevices" => candidate_devices })
      end

    private

      # @return [::DBus::Object]
      attr_reader :dbus_proposal
    end
  end
end
