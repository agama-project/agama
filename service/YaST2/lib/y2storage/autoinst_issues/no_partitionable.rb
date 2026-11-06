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
    # Represents an AutoYaST situation where a partition table was specified for
    # a device not supporting partitions, like a so-called Xen virtual partition
    # (StrayBlkDevice in libstorage-ng).
    #
    # This is a fatal error because it surely implies a mismatch in the devices.
    class NoPartitionable < ::Installation::AutoinstIssues::Issue
      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      def initialize(section)
        super()

        textdomain "storage"

        @section = section
      end

      # Problem severity
      #
      # @return [Symbol] :fatal
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        if section.device
          format(
            # TRANSLATORS: %{device} is the kernel device name (eg. '/dev/sda1').
            # TRANSLATORS: %{type} is the type of partition table specified in the profile (eg. 'gpt')
            _("The device '%{device}' cannot contain a partition table (%{type} requested)."),
            device: section.device, type: section.disklabel
          )
        else
          format(
            # TRANSLATORS: %{type} is the type of partition table specified in the profile (eg. 'gpt')
            _(
              "No suitable device was found, none of the remaining devices can contain " \
              "a partition table (%s requested)."
            ),
            section.disklabel
          )
        end
      end
    end
  end
end
