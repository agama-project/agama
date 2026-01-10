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

require "agama/http/clients/base"

module Agama
  module HTTP
    module Clients
      # HTTP client to interact with the HTTP API.
      class Main < Base
        def install
          post("v2/action", '"install"')
        end

        # Sets a list of resolvables for installation.
        #
        # @param unique_id [String] Unique ID to identify the list.
        # @param type [String] Resolvable type (e.g., "package" or "pattern").
        # @param resolvables [Array<String>] Resolvables names.
        def set_resolvables(unique_id, type, resolvables)
          data = resolvables.map do |name|
            { "name" => name, "type" => type.to_s }
          end
          put("v2/private/resolvables/#{unique_id}", data)
        end
      end
    end
  end
end
