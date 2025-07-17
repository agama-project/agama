# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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

require "agama/question"
require "y2storage"

module Agama
  module Storage
    module Callbacks
      # Callbacks for multipath activation
      class ActivateMultipath
        # Constructor
        #
        # @param config [Agama::Config]
        # @param questions_client [Agama::DBus::Clients::Questions]
        # @param logger [Logger]
        def initialize(config, questions_client, logger)
          @config = config
          @questions_client = questions_client
          @logger = logger
        end

        # Asks whether to activate multipath devices
        #
        # @note The process waits until the question is answered.
        #
        # @param looks_like_real_multipath [Boolean] see {Callbacks::Activate#multipath}.
        # @return [Boolean]
        def call(looks_like_real_multipath)
          return true if Y2Storage::StorageEnv.instance.forced_multipath?

          start = config.data.dig("multipath", "start")
          return true if start == "yes"
          return false if start == "no"

          # Only the values "yes", "no" and "askIfFound" are supported.
          # At this point we are clearly in the third case.

          return false unless looks_like_real_multipath

          questions_client.ask(question) do |question_client|
            question_client.answer == :yes
          end
        end

      private

        # Current configuration of Agama
        # @return [Agama::Config]
        attr_reader :config

        # @return [Agama::DBus::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger

        # Question to ask for multipath activation
        #
        # @return [Question]
        def question
          text = "The system seems to have multipath hardware. " \
                 "Do you want to activate multipath?"

          Question.new(
            qclass:         "storage.activate_multipath",
            text:           text,
            options:        [:yes, :no],
            default_option: :yes
          )
        end
      end
    end
  end
end
