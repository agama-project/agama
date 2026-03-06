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
    module Configs
      # Mixin for configs with attributes to delete pre-existing devices.
      module WithDelete
        # @return [Boolean]
        attr_accessor :delete
        alias_method :delete?, :delete

        # @return [Boolean]
        attr_accessor :delete_if_needed
        alias_method :delete_if_needed?, :delete_if_needed

        # Sets initial value for attributes related to deleting.
        def initialize_delete
          @delete = false
          @delete_if_needed = false
        end
      end
    end
  end
end
