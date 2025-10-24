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
      # HTTP client to interact with the software API.
      class Software < Base
        def products
          JSON.parse(get("software/products"))
        end

        def proposal
          JSON.parse(get("software/proposal"))
        end

        def config
          JSON.parse(get("software/config"))
        end

        def add_patterns(patterns)
          config_patterns = config["patterns"] || {}
          selected = config_patterns.select { |_k, v| v }.keys
          modified = false

          patterns.each do |pattern|
            unless selected.include?(pattern)
              config_patterns[pattern] = true
              modified = true
            end
          end
          return unless modified

          put("software/config", { "patterns" => config_patterns })
        end
      end
    end
  end
end
