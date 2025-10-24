# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/config_conversions/from_model_conversions/encryption"
require "agama/storage/model_refuse_encryption"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Mixin for encryption conversion.
        module WithEncryption
          include ModelRefuseEncryption

          # @return [Configs::Encryption, nil]
          def convert_encryption
            # Do not encrypt a device that is not really going to be used
            return if model_json[:name] && !model_json[:mountPath]

            # Do not encrypt a reused device
            return if model_json[:name] && model_json.dig(:filesystem, :reuse)

            # Do not encrypt partitions that would become useless if encrypted
            return if refuse_encryption?

            return if encryption_model.nil?

            FromModelConversions::Encryption.new(encryption_model).convert
          end

          # @return [Boolean]
          def refuse_encryption?
            path = model_json[:mountPath]
            return false unless path

            refuse_encryption_path?(path)
          end
        end
      end
    end
  end
end
