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

require "y2storage/proposal/lvm_helper"
require "y2storage/proposal_settings"

module Y2Storage
  module Proposal
    # LVM helper for Agama.
    class AgamaLvmHelper < LvmHelper
      # Constructor
      def initialize(lvm_lvs)
        super(lvm_lvs, guided_settings)
      end

    private

      # Method used by the constructor to somehow simulate a typical Guided Proposal
      def guided_settings
        # Despite the "current_product" part in the name of the constructor, it only applies
        # generic default values that are independent of the product (there is no YaST
        # ProductFeatures mechanism in place).
        Y2Storage::ProposalSettings.new_for_current_product.tap do |target|
          target.lvm_vg_strategy = :use_needed
          target.lvm_vg_reuse = false
          # TODO: Add encryption options.
          target.encryption_password = nil
          # target.encryption_pbkdf
          # target.encryption_method
        end
      end
    end
  end
end
