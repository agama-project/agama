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
require "agama/software/callbacks/base"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Script callbacks
      class Script < Base
        include Yast::I18n

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackScriptProblem(
            Yast::FunRef.new(method(:script_problem), "string (string)")
          )
        end

        # DoneProvide callback
        #
        # @param description [String] Problem description
        # @return [String] "I" for ignore, "R" for retry and "C" for abort (not implemented)
        # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L620
        def script_problem(description)
          logger.debug "ScriptProblem callback: description: #{description}"

          message = _("There was a problem running a package script.")
          question = Agama::Question.new(
            qclass:  "software.script_problem",
            text:    message,
            options: [retry_label, continue_label],
            data:    { "details" => description }
          )
          questions_client.ask(question) do |question_client|
            (question_client.answer == retry_label.to_sym) ? "R" : "I"
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
