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

require "yast"
require "dbus"
Yast.import "PackagesProposal"

module DInstaller
  module DBus
    module Software
      # Software proposal D-Bus representation
      #
      # This class allows to change software proposal settings through D-Bus.
      #
      # @see Yast::PackagesProposal
      class Proposal < ::DBus::Object
        PATH = "/org/opensuse/DInstaller/Software/Proposal1"
        private_constant :PATH

        INTERFACE = "org.opensuse.DInstaller.Software.Proposal1"
        private_constant :INTERFACE

        TYPES = [:package, :pattern].freeze
        private_constant :TYPES

        # Constructor
        #
        # @param logger [Logger]
        def initialize(logger)
          @logger = logger
          @on_change_callbacks = []

          super(PATH)
        end

        dbus_interface INTERFACE do
          dbus_method :AddResolvables,
            "in Id:s, in Type:y, in Resolvables:as, in Optional:b" do |id, type, resolvables, opt|
            Yast::PackagesProposal.AddResolvables(id, TYPES[type], resolvables, optional: opt)
            changed
          end

          dbus_method :GetResolvables,
            "in Id:s, in Type:y, in Optional:b, out Resolvables:as" do |id, type, opt|
            [Yast::PackagesProposal.GetResolvables(id, TYPES[type], optional: opt)]
          end

          dbus_method :SetResolvables,
            "in Id:s, in Type:y, in Resolvables:as, in Optional:b" do |id, type, resolvables, opt|
            Yast::PackagesProposal.SetResolvables(id, TYPES[type], resolvables, optional: opt)
            changed
          end

          dbus_method :RemoveResolvables,
            "in Id:s, in Type:y, in Resolvables:as, in Optional:b" do |id, type, resolvables, opt|
            Yast::PackagesProposal.RemoveResolvables(id, TYPES[type], resolvables, optional: opt)
            changed
          end
        end

        def on_change(&block)
          @on_change_callbacks << block
        end

      private

        # @return [Logger]
        attr_reader :logger

        def changed
          @on_change_callbacks.each(&:call)
        end
      end
    end
  end
end
