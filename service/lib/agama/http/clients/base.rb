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
      # Base for HTTP clients.
      class Base
        def initialize(logger)
          @base_url = "http://localhost/api/"
          @logger = logger
        end

        # send POST request with given data and path.
        # @param path [String] path relatived to `api`` endpoint.
        # @param data [#to_json] data to send in request
        def post(path, data)
          response = request_with_retry do
            Net::HTTP.post(uri(path), data.to_json, headers)
          end
          return response unless response.is_a?(Net::HTTPClientError)

          @logger.warn "server returned #{response.code} with body: #{response.body}"
        end

        # send GET request with given path.
        # @param path [String] path relatived to `api`` endpoint.
        # @return [Net::HTTPResponse, nil] Net::HTTPResponse if it is not an Net::HTTPClientError
        def get(path)
          response = request_with_retry do
            Net::HTTP.get(uri(path), headers)
          end
          return response unless response.is_a?(Net::HTTPClientError)

          @logger.warn "server returned #{response.code} with body: #{response.body}"
        end

        # send PUT request with given data and path.
        # @param path [String] path relatived to `api`` endpoint.
        # @param data [#to_json] data to send in request
        def put(path, data)
          response = request_with_retry do
            Net::HTTP.put(uri(path), data.to_json, headers)
          end
          return unless response.is_a?(Net::HTTPClientError)

          @logger.warn "server returned #{response.code} with body: #{response.body}"
        end

        # send PATCH request with given data and path.
        # @param path [String] path relatived to `api`` endpoint.
        # @param data [#to_json] data to send in request
        def patch(path, data)
          url = uri(path)
          response = request_with_retry do
            http = Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https")
            http.patch(url, data.to_json, headers)
          end
          return response unless response.is_a?(Net::HTTPClientError)

          @logger.warn "server returned #{response.code} with body: #{response.body}"
        end

      protected

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

        CONNECT_ATTEMPTS = 10

        # Performs a request and retries if it fails.
        #
        # During initialization, it might happen that Agama's web server is not available.
        # This method retries the block if the connection is not possible.
        #
        # @return [Object] value returned by the block
        def request_with_retry(&block)
          attempt = 1
          begin
            block.call
          rescue Errno::ECONNREFUSED => e
            @logger.warn "Failed to contact Agama's server with error #{e} " \
                         "(attempt #{attempt} of #{CONNECT_ATTEMPTS})."
            raise if attempt == CONNECT_ATTEMPTS

            sleep 1
            attempt += 1
            retry
          end
        end
      end
    end
  end
end
