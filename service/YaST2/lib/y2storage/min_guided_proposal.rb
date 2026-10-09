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

require "y2storage/guided_proposal"

module Y2Storage
  # Class to calculate the storage proposal but performing only one attempt with
  # the min target
  #
  # @see GuidedProposal
  class MinGuidedProposal < GuidedProposal
    private

    # Tries to perform a proposal
    #
    # Settings might be completed with default values for candidate devices and root device.
    #
    # @return [true,  nil]
    def try_proposal
      complete_settings

      try_with_target(:min)
    rescue Error => e
      log.info "Failed to make a minimal proposal"
      log.info "Error: #{e.message}"
    end
  end
end
