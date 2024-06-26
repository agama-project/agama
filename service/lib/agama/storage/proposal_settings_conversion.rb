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

require "agama/storage/proposal_settings_conversion/from_schema"
require "agama/storage/proposal_settings_conversion/from_y2storage"
require "agama/storage/proposal_settings_conversion/to_schema"
require "agama/storage/proposal_settings_conversion/to_y2storage"

module Agama
  module Storage
    # Conversions for the proposal settings.
    module ProposalSettingsConversion
      # Performs conversion from Y2Storage.
      #
      # @param y2storage_settings [Y2Storage::ProposalSettings]
      # @param settings [Agama::Storage::ProposalSettings]
      #
      # @return [Agama::Storage::ProposalSettings]
      def self.from_y2storage(y2storage_settings, settings)
        FromY2Storage.new(y2storage_settings, settings).convert
      end

      # Performs conversion to Y2Storage.
      #
      # @param settings [Agama::Storage::ProposalSettings]
      # @param config [Agama::Config]
      #
      # @return [Y2Storage::ProposalSettings]
      def self.to_y2storage(settings, config:)
        ToY2Storage.new(settings, config: config).convert
      end

      # Performs conversion from Hash according to the JSON schema.
      #
      # @param schema_settings [Hash]
      # @param config [Agama::Config]
      #
      # @return [Agama::Storage::ProposalSettings]
      def self.from_schema(schema_settings, config:)
        FromSchema.new(schema_settings, config: config).convert
      end

      # Performs conversion according to the JSON schema.
      #
      # @param settings [Agama::Storage::ProposalSettings]
      # @return [Hash]
      def self.to_schema(settings)
        ToSchema.new(settings).convert
      end
    end
  end
end
