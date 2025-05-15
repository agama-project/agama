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

require "agama/storage/config_conversions/from_model_conversions/drive"
require "agama/storage/configs/md_raid"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # RAID conversion from model according to the JSON schema.
        #
        # At this point in time, a RAID is totally equivalent to a drive
        class MdRaid < Drive
        private

          # @see Base
          # @return [Configs::Drive]
          def default_config
            Configs::MdRaid.new
          end
        end
      end
    end
  end
end
