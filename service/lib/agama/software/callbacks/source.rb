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

require "yast"
require "agama/question"

Yast.import "Pkg"
Yast.import "URL"

module Agama
  module Software
    module Callbacks
      # Callbacks related to sources handling
      class Source
        include Yast::I18n

        # Constructor
        #
        # @param questions_client [Agama::DBus::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
          @questions_client = questions_client
          @logger = logger
          textdomain "yast"
        end

        # Register the callbacks
        def setup
          Pkg.CallbackSourceCreateError(
            fun_ref(method(:source_create_error), "symbol (string, symbol, string)")
          )
        end

        # Create source error callback
        #
        # @param url [String] Source URL
        # @param error [Symbol] Error (:NOT_FOUND, :IO, :INVALID, :REJECTED)
        # @param description [String] Problem description.
        # @return [Symbol] :RETRY or :ABORT (not implemented)
        def source_create_error(url, error, description)
          logger.debug(
            format(
              "Source create error: error: url: %s, error: %s, description: %s",
              Yast::URL.HidePassword(url),
              error,
              description
            )
          )

          message = case error
          when :NOT_FOUND
            _("Unable to retrieve the remote repository description.")
          when :IO
            _("An error occurred while retrieving the new metadata.")
          when :INVALID
            _("The repository is not valid.")
          when :REJECTED
            _("The repository metadata is invalid.")
          else
            _("An error occurred while creating the repository.")
          end

          question = Agama::Question.new(
            qclass:         "software.source_create_error",
            text:           message,
            options:        [:Retry],
            default_option: :Retry,
            data:           { "url" => url, "description" => description }
          )
          questions_client.ask(question) do |_question_client|
            :RETRY
          end
        end

      private

        # @return [Agama::DBus::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
