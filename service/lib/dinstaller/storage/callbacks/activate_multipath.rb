# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require "dinstaller/question"

module DInstaller
  module Storage
    module Callbacks
      # Callbacks for multipath activation
      class ActivateMultipath
        # Constructor
        #
        # @param questions_client [DInstaller::DBus::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
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
          return false unless looks_like_real_multipath

          questions_client.ask(question) do |question_client|
            question_client.answer == :yes
          end
        end

      private

        # @return [DInstaller::DBus::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger

        # Question to ask for multipath activation
        #
        # @return [Question]
        def question
          text = "The system seems to have multipath hardware. " \
                 "Do you want to activate multipath?"

          Question.new(text, options: [:yes, :no])
        end
      end
    end
  end
end
