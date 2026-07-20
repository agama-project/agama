# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require "agama/copyable"

module Agama
  module Storage
    module Configs
      # Mixin for configs with search.
      module WithSearch
        # Needed when a search returns multiple devices and the configuration needs to be replicated
        # for each one.
        include Copyable

        # @return [Search, nil]
        attr_accessor :search

        # Assigned device according to the search.
        #
        # @see ConfigSolvers::Search
        #
        # @return [Y2Storage::Device, nil]
        def found_device
          search&.device
        end

        # Whether the device is going to be created.
        #
        # @return [Boolean]
        def create?
          return true unless search

          search.create_device?
        end

        # Whether the config is skipped.
        #
        # @return [Boolean]
        def skipped?
          search&.skip_device? || false
        end
      end
    end
  end
end
