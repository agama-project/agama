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
          # it is noop, probe already do proposal
          # post("software/propose", nil)
        end

        def install
          http = Net::HTTP.new("localhost")
          # FIXME: we need to improve it as it can e.g. wait for user interaction.
          http.read_timeout = 3 * 60 * 60 # set timeout to three hours for rpm installation
          response = http.post("/api/software/install", "", headers)

          return unless response.is_a?(Net::HTTPClientError)

          @logger.warn "server returned #{response.code} with body: #{response.body}"
        end

        def finish
          post("software/finish", nil)
        end

        def locale=(value)
          # TODO: implement it
          post("software/locale", value)
        end

        def config
          JSON.parse(get("v2/config"))
        end

        def selected_product
          config.dig("product", "id")
        end

        def errors?
          # TODO: severity as integer is nasty for http API
          JSON.parse(get("software/issues/software"))&.select { |i| i["severity"] == 1 }&.any?
        end

        def get_resolvables(unique_id, type, optional)
          JSON.parse(get("software/resolvables/#{unique_id}?type=#{type}&optional=#{optional}"))
        end

        # (Yes, with a question mark. Bad naming.)
        # @return [Array<String>] Those names that are selected for installation
        def provisions_selected?(provisions)
          provisions.select do |prov|
            package_installed?(prov)
          end
        end

        def package_available?(_name)
          JSON.parse(get("software/available?tag=#{name}"))
        end

        def package_installed?(name)
          JSON.parse(get("software/selected?tag=#{name}"))
        end

        def set_resolvables(unique_id, type, resolvables, optional)
          data = {
            "names"    => resolvables,
            "type"     => type,
            "optional" => optional
          }
          put("software/resolvables/#{unique_id}", data)
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
          # TODO: it was agreed to change this storage observation to have the code
          # in rust part and call via dbus ruby part
        end
      end
    end
  end
end
