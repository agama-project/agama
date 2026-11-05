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
    # Represent an AutoYaST situation where a set of planned devices were reduced
    # in order to fit in the available space.
    #
    # This is just a warning although the user should adjust the profile accordingly.
    class ShrinkedPlannedDevices < ::Installation::AutoinstIssues::Issue
      extend Yast::I18n

      # @return [Array<Proposal::DeviceShrinkage>] List of objects containing
      #   information about shrinking devices.
      attr_reader :device_shrinkages

      # @param device_shrinkages [Array<device_shrinkages_info>] List of objects containing
      #   information about shrinking devices.
      def initialize(device_shrinkages)
        super()

        textdomain "storage"

        @device_shrinkages = device_shrinkages
      end

      # Return problem severity
      #
      # @return [Symbol] :warn
      def severity
        :warn
      end

      # Size difference between planned and real devices
      #
      # @return [DiskSize] Size difference
      def diff
        DiskSize.sum(device_shrinkages.map(&:diff))
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        description = format(
          # TRANSLATORS: %{diff} will be replaced by a size (eg. '4 GiB');
          # %{device_type} is a device type ('partitions' or 'logical volumes').
          _("Some additional space (%{diff}) was required for new %{device_type}. " \
            "As a consequence, the size of some devices will be adjusted as follows: "),
          diff: diff.to_human_string, device_type: device_type
        )
        details = device_shrinkages.map { |i| device_details(i) }.join(", ")
        description + details
      end

      private

      # Build a string containing a device shrinkage details
      #
      # @param device_shrinkage [Proposal::DeviceShrinkage] Shrinkage information
      def device_details(device_shrinkage)
        format(
          # TRANSLATORS: identifier: partition/logical volume (eg. /dev/sda1, /dev/system/root);
          # size and diff: disk space (eg. 5.00 GiB)
          _("%{identifier} to %{size} (-%{diff})"),
          identifier: device_identifier(device_shrinkage.real),
          size:       device_shrinkage.real.size.to_human_string,
          diff:       device_shrinkage.diff.to_human_string
        )
      end

      # Return an identifier for a device
      #
      # If a mountpoint is defined, it will be preferred as identifier. Otherwise, the device
      # name will be used.
      #
      # @param device [Y2Storage::Partition, Y2Storage::LvmLv] Partition or logical volume
      # @return [String] Device identifier
      def device_identifier(device)
        if device.filesystem_mountpoint && !device.filesystem_mountpoint.empty?
          device.filesystem_mountpoint
        else
          device.name
        end
      end

      # @return [Hash<String, String>] Device types translations
      DEVICE_TYPES_MAP = {
        "Partition" => N_("partitions"),
        "LvmLv"     => N_("logical volumes")
      }.freeze

      # Determine a device type which should be shown to the user
      #
      # @see DEVICE_TYPES_MAP
      def device_type
        first_planned = device_shrinkages.first.real
        class_name = first_planned.class.name
        DEVICE_TYPES_MAP[class_name.split("::").last]
      end
    end
  end
end
