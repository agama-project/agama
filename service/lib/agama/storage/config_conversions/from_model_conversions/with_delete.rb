# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Mixin for delete properties conversion.
        module WithDelete
          # TODO: do not delete if the volume is used by other device (VG, RAID, etc).
          # @return [Boolean]
          def convert_delete
            # Do not mark to delete if the volume is used.
            return false if model_json[:mountPath]

            model_json[:delete]
          end

          # TODO: do not delete if the volume is used by other device (VG, RAID, etc).
          # @return [Boolean]
          def convert_delete_if_needed
            # Do not mark to delete if the volume is used.
            return false if model_json[:mountPath]

            model_json[:deleteIfNeeded]
          end
        end
      end
    end
  end
end
