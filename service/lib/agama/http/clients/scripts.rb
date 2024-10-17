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

require "uri"
require "net/http"
require "json"

module Agama
  module HTTP
    module Clients
      # HTTP client to interact with the scripts API.
      class Scripts
        def initialize
          @base_url = "http://localhost/api/"
        end

        # Runs the scripts
        def run(group)
          Net::HTTP.post(uri("scripts/run"), group.to_json, headers)
        end

      private

        def uri(path)
          URI.join(@base_url, path)
        end

        def headers
          @headers = {
            "Content-Type": "application/json",
            Authorization:  "Bearer #{auth_token}"
          }
        end

        def auth_token
          File.read("/run/agama/token")
        end
      end
    end
  end
end
