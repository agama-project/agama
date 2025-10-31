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
      # HTTP client to interact with the network API.
      class Network < Base
        def proposal
          JSON.parse(get("proposal"))
        end

        def connections
          proposal.fetch("network", {}).fetch("connections", [])
        end

        def devices
          proposal.fetch("network", {}).fetch("devices", [])
        end

        def persist_connections
          post("network/connections/persist", { value: true })
        end

        def state
          proposal.fetch("network", {}).fetch("state", {})
        end
      end
    end
  end
end
