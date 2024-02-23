# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require "agama/storage/volume_conversion/from_y2storage"
require "agama/storage/volume_conversion/to_y2storage"

module Agama
  module Storage
    # Conversions for a volume
    module VolumeConversion
      # Performs conversion from Y2Storage format.
      #
      # @param spec [Y2Storage::VolumeSpecification]
      # @param config [Agama::Config]
      # @param backup [Agama::Storage::ProposalSettings]
      #
      # @return [Agama::Storage::Volume]
      def self.from_y2storage(spec, config:, backup: nil)
        FromY2Storage.new(spec, config: config, backup: backup).convert
      end

      # Performs conversion to Y2Storage format.
      #
      # @param volume [Agama::Storage::Volume]
      # @return [Y2Storage::VolumeSpecification]
      def self.to_y2storage(volume)
        ToY2Storage.new(volume).convert
      end
    end
  end
end
