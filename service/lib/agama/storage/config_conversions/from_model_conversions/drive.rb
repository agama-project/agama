# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/with_encryption"
require "agama/storage/config_conversions/from_model_conversions/with_filesystem"
require "agama/storage/config_conversions/from_model_conversions/with_partitions"
require "agama/storage/config_conversions/from_model_conversions/with_ptable_type"
require "agama/storage/config_conversions/from_model_conversions/with_search"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Drive conversion from model according to the JSON schema.
        class Drive < Base
          include WithEncryption
          include WithFilesystem
          include WithPtableType
          include WithPartitions
          include WithSearch

          # @param model_json [Hash]
          # @param product_config [Agama::Config]
          # @param encryption_model [Hash, nil]
          def initialize(model_json, product_config, encryption_model = nil)
            super(model_json)
            @product_config = product_config
            @encryption_model = encryption_model
          end

        private

          alias_method :drive_model, :model_json

          # @return [Agama::Config]
          attr_reader :product_config

          # @return [Hash, nil]
          attr_reader :encryption_model

          # @see Base
          # @return [Configs::Drive]
          def default_config
            Configs::Drive.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              search:      convert_search,
              encryption:  convert_encryption,
              filesystem:  convert_filesystem,
              ptable_type: convert_ptable_type,
              partitions:  convert_partitions(encryption_model)
            }
          end
        end
      end
    end
  end
end
