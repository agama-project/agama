# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

module Agama
  module Storage
    module Callbacks
      # Callback for a storage commit error
      class CommitError
        # Constructor
        #
        # @param questions_client [Agama::HTTP::Clients::Questions]
        # @param logger [Logger, nil]
        def initialize(questions_client, logger: nil)
          @questions_client = questions_client
          @logger = logger || Logger.new($stdout)
        end

        # Generates a question to display the error and to ask to the user whether to ignore the
        # error and continue.
        #
        # @note The process waits until the question is answered.
        #
        # @param message [string] Error message
        # @param details [string] Error details
        #
        # @return [Boolean] true to ignore the error and continue
        def call(message, details)
          logger.info "Storage commit error, asking to the user whether to continue"
          logger.info "Error message: #{message}"
          logger.info "Error details: #{details}"

          question = question(message, details)

          questions_client.ask(question) do |answer|
            action = answer.action
            logger.info "User answer: #{action}"
            action == :yes
          end
        end

      private

        # @return [Agama::HTTP::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger

        # Question to ask to continue
        #
        # @return [Question]
        def question(message, details)
          text = "There was an error performing the following action: #{message}. " \
                 "Do you want to continue with the rest of storage actions?"

          Question.new(
            qclass:         "storage.commit_error",
            text:           text,
            options:        [:yes, :no],
            default_option: :no,
            data:           { "details" => details }
          )
        end
      end
    end
  end
end
