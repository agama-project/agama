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

require "agama/storage/config_conversions/from_model_conversions/size"
require "agama/storage/configs/size"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Mixin for size conversion.
        module WithSize
          # @return [Configs::Size, nil]
          def convert_size
            return Configs::Size.new_for_shrink_if_needed if model_json[:resizeIfNeeded]

            size_model = model_json[:size]
            return if size_model.nil?

            FromModelConversions::Size.new(size_model).convert
          end
        end
      end
    end
  end
end
