# frozen_string_literal: true

# Copyright (c) [2021-2023] SUSE LLC
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

require "yast"
require "dinstaller/question"

Yast.import "Pkg"

module DInstaller
  module Software
    module Callbacks
      # Callbacks related to media handling
      class Media
        # Constructor
        #
        # @param questions_client [DInstaller::DBus::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
          @questions_client = questions_client
          @logger = logger
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
        end

        # Media change callback
        #
        # @return [String]
        # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L620
        # rubocop:disable Metrics/ParameterLists
        def media_change(_error_code, error, _url, _product, _current, _current_label, _wanted,
          _wanted_label, _double_sided, _devices, _current_device)
          question = DInstaller::Question.new(
            error, options: [:Retry, :Skip], default_option: :Retry
          )
          questions_client.ask(question) do |question_client|
            (question_client.answer == :Retry) ? "" : "S"
          end
        end
      # rubocop:enable Metrics/ParameterLists

      private

        # @return [DInstaller::DBus::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
