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

        def probe
          post("software/probe", nil)
        end

        def propose
          # TODO: implement it
          post("software/propose", nil)
        end

        def install
          # TODO: implement it
          post("software/install", nil)
        end

        def finish
          # TODO: implement it
          post("software/finish", nil)
        end

        def locale=(value)
          # TODO: implement it
          post("software/locale", value)
        end

        def config
          JSON.parse(get("software/config"))
        end

        def errors?
          # TODO: implement it together with checking type error
          JSON.parse(get("software/issues"))
        end

        def get_resolvables(_unique_id, _type, _optional)
          # TODO: implement on backend
          JSON.parse(get("software/config"))
        end

        def provisions_selected?(_provisions)
          # TODO: implement it, not sure how it should look like
          []
        end

        def package_available?(_name)
          # TODO: implement it, not sure how it should look like
          true
        end

        def package_installed?(_name)
          # TODO: implement it, not sure how it should look like
          true
        end

        def set_resolvables(_unique_id, type, resolvables, optional)
          # TODO: implement at backend proposal id
          data = {
            "names"    => resolvables,
            "type"     => type,
            "optional" => optional
          }
          JSON.parse(put("software/config"), data)
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

        def on_probe_finished(&block)
          # TODO: it was agreed to change this storage observation to have the code in rust part and call via dbus ruby part
        end
      end
    end
  end
end
