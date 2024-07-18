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

require "y2storage/proposal/space_maker"
require "y2storage/proposal_settings"

module Y2Storage
  module Proposal
    class AgamaSpaceMaker < SpaceMaker
      # Initialize.
      def initialize(disk_analyzer, settings, config)
        super(disk_analyzer, guided_settings(settings, config))
      end

      def guided_settings(settings, _config)
        # Despite the "current_product" part in the name of the constructor, it only applies
        # generic default values that are independent of the product (there is no YaST
        # ProductFeatures mechanism in place).
        Y2Storage::ProposalSettings.new_for_current_product.tap do |target|
          target.space_settings.strategy = :bigger_resize
          target.space_settings.actions = []

          boot_device = settings.explicit_boot_device || implicit_boot_device(settings)

          target.root_device = boot_device
          target.candidate_devices = [boot_device].compact
        end
      end

      private

      def implicit_boot_device(settings)
        # TODO
        "/dev/sda"
      end
    end
  end
end
