# Copyright (c) [2018] SUSE LLC
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

require "installation/autoinst_issues/issue"

module Y2Storage
  module AutoinstIssues
    # It was not possible to allocate the extra partitions needed for booting
    class CouldNotCreateBoot < ::Installation::AutoinstIssues::Issue
      # @param devices [Array<Planned::Devices>] see {#devices}
      def initialize(devices)
        super()

        textdomain "storage"
        @devices = devices
      end

      # List of extra partitions that where considered as needed for booting,
      # but that could not be added to the plan
      #
      # @return [Array<Planned::Devices>]
      attr_reader :devices

      # Problem severity
      #
      # @return [Symbol] :warn
      # @see Issue#severity
      def severity
        :warn
      end

      # Error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        if bios_boot?
          _(
            "AutoYaST cannot add a BIOS Boot partition to the described system. " \
            "It is strongly advised to use such a partition for booting from " \
            "GPT devices. Otherwise your system might not boot properly or " \
            "might face problems in the future."
          )
        else
          _(
            "Not possible to add the partitions recommended for booting " \
            "the described system. Your system might not boot properly."
          )
        end
      end

      # Whether any of the partitions that could not be added is a BIOS Boot one
      #
      # @return [Boolean]
      def bios_boot?
        devices.any? do |dev|
          dev.respond_to?(:partition_id) && dev.partition_id && dev.partition_id.is?(:bios_boot)
        end
      end
    end
  end
end
