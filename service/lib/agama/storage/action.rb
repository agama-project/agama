# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module Storage
    # Represents an action to perform in the storage devices.
    class Action
      # @param action [Y2Storage::CompoundAction]
      # @param system_graph [Y2Storage::Devicegraph]
      def initialize(action, system_graph)
        @action = action
        @system_graph = system_graph
      end

      # Affected device
      #
      # @return [Y2Storage::Device]
      def device
        action.target_device
      end

      # Text describing the action.
      #
      # @return [String]
      def text
        action.sentence
      end

      # Whether the action affects to a Btrfs subvolume.
      #
      # @return [Boolean]
      def on_btrfs_subvolume?
        action.device_is?(:btrfs_subvolume)
      end

      # Whether the action deletes the device.
      #
      # @return [Boolean]
      def delete?
        action.delete?
      end

      # Whether the action resizes the device.
      #
      # @return [Boolean]
      def resize?
        return false unless device.exists_in_devicegraph?(system_graph)
        return false unless device.respond_to?(:size)

        system_graph.find_device(device.sid).size != device.size
      end

    private

      # @return [Y2Storage::CompoundAction]
      attr_reader :action

      # @return [Y2Storage::Devicegraph]
      attr_reader :system_graph
    end
  end
end
