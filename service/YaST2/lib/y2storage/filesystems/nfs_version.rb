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
require "yast2/equatable"

module Y2Storage
  module Filesystems
    # This class represents the version of a NFS device
    class NfsVersion
      extend Yast::I18n
      include Yast2::Equatable

      textdomain "storage"

      # Properties for each NFS version
      VERSIONS = {
        "any" => {
          name: N_("Any")
        },
        "3"   => {
          name: N_("NFSv3")
        },
        "4"   => {
          name: N_("NFSv4")
        },
        "4.1" => {
          name: N_("NFSv4.1")
        },
        "4.2" => {
          name: N_("NFSv4.2")
        }
      }.freeze

      private_constant :VERSIONS

      # Version value
      #
      # @return [string]
      attr_reader :value

      eql_attr :value

      # All known versions
      #
      # @return [Array<NfsVersion>]
      def self.all
        @all ||= VERSIONS.keys.map { |v| new(v) }
      end

      # Find a version by the given value
      #
      # @param value [String] e.g., "4.1", "any", etc
      # @return [NfsVersion, nil]
      def self.find_by_value(value)
        value = "4" if value == "4.0"

        all.find { |v| v.value == value }
      end

      # Name of the version
      #
      # @return [String]
      def name
        VERSIONS[value][:name]
      end

      # Whether the version represents any version
      #
      # @return [Boolean]
      def any?
        value == "any"
      end

      # Whether the system infrastructure associated to NFSv4 (e.g. enabled NFS4_SUPPORT in
      # sysconfig/nfs) is needed in order to use this version of the protocol.
      #
      # @return [Boolean]
      def need_v4_support?
        value.start_with?("4")
      end

      private

      # Constructor
      #
      # @param value [string] e.g., "3", "4.1", etc.
      def initialize(value = "any")
        @value = value
      end
    end
  end
end
