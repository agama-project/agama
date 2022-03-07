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

require "singleton"
require "y2storage/storage_manager"

module DInstaller
  module Storage
    # Backend class to get the list of actions
    class Actions
      include Singleton

      def all
        main_actions + subvolume_actions
      end

      def text_for(action)
        action.sentence
      end

      def subvol_action?(action)
        action.device_is?(:btrfs_subvolume)
      end

    private

      def main_actions
        actions = self.actions.reject { |a| subvol_action?(a) }
        sort_actions(actions)
      end

      def subvolume_actions
        actions = self.actions.select { |a| subvol_action?(a) }
        sort_actions(actions)
      end

      def actions
        actiongraph = Y2Storage::StorageManager.instance.staging.actiongraph

        return [] unless actiongraph

        actiongraph.compound_actions
      end

      def sort_actions(actions)
        delete, other = actions.partition(&:delete?)
        delete.concat(other)
      end
    end
  end
end
