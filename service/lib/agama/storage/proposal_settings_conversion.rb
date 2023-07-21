# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "agama/storage/proposal_settings_conversion/from_y2storage"
require "agama/storage/proposal_settings_conversion/to_y2storage"

module Agama
  module Storage
    # Utility class offering methods to convert between Y2Storage::ProposalSettings objects and
    # Agama::ProposalSettings ones
    module ProposalSettingsConversion
      def self.from_y2storage(settings, config:)
        FromY2Storage.new(settings, config: config).convert
      end

      # Returns the Y2Storage::VolumeSpecification object that is equivalent to the given
      # Agama::Volume one
      #
      # @param settings [ProposalSettings]
      # @return [Y2Storage::ProposalSettings]
      def self.to_y2storage(settings)
        ToY2Storage.new(settings).convert
      end
    end
  end
end
