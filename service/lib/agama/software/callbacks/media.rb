# frozen_string_literal: true

# Copyright (c) [2021-2025] SUSE LLC
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

require "logger"
require "yast"
require "agama/question"
require "agama/software/callbacks/base"
require "agama/software/repository"

Yast.import "Pkg"
Yast.import "URL"

module Agama
  module Software
    module Callbacks
      # Callbacks related to media handling
      class Media < Base
        def initialize(questions_client, logger)
          super
          # retry counter
          self.attempt = 0
        end

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackMediaChange(
            Yast::FunRef.new(
              method(:media_change),
              "string (string, string, string, string, integer, string, integer, string, " \
              "boolean, list <string>, integer)"
            )
          )
          Yast::Pkg.CallbackStartProvide(
            Yast::FunRef.new(method(:start_provide), "void (string, integer, boolean)")
          )
        end

        # @param name [String] name of the package to download
        # @param size [Integer] download size
        # @param _remote [Boolean] true if the package is downloaded from a remote repository,
        #   false for local packages
        def start_provide(name, size, _remote)
          self.attempt = 1
          logger.debug("Downloading #{name}, size: #{size}")
        end

        # Media change callback
        #
        # @return [String]
        # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L620
        # rubocop:disable Metrics/ParameterLists, Metrics/MethodLength
        def media_change(error_code, error, url, product, current, current_label, wanted,
          wanted_label, double_sided, devices, current_device)
          logger.debug(
            format("MediaChange callback: error_code: %s, error: %s, url: %s, product: %s, " \
                   "current: %s, current_label: %s, wanted: %s, wanted_label: %s, " \
                   "double_sided: %s, devices: %s, current_device: %s",
              error_code,
              error,
              Yast::URL.HidePassword(url),
              product,
              current,
              current_label,
              wanted,
              wanted_label,
              double_sided,
              devices,
              current_device)
          )

          # "IO" = IO error (scratched DVD or HW failure)
          # "IO_SOFT" = network timeout
          # in other cases automatic retry usually does not make much sense
          if ["IO", "IO_SOFT"].include?(error_code) && attempt <= Repository::RETRY_COUNT
            self.attempt += 1
            logger.debug("Retry in #{Repository::RETRY_DELAY} seconds, attempt #{attempt}...")
            sleep(Repository::RETRY_DELAY)

            # retry
            return ""
          end

          question = Agama::Question.new(
            qclass:  "software.package_error.medium_error",
            text:    error,
            options: [retry_label.to_sym, continue_label.to_sym],
            data:    { "url" => url }
          )
          questions_client.ask(question) do |answer|
            if answer.action == retry_label.to_sym
              self.attempt += 1
              ""
            else
              "S"
            end
          end
        end
      # rubocop:enable Metrics/ParameterLists, Metrics/MethodLength

      private

        attr_accessor :attempt
      end
    end
  end
end
