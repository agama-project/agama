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

require "logger"
require "yast"
require "agama/question"
require "agama/software/callbacks/base"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Provide callbacks
      class Provide < Base
        # From https://github.com/openSUSE/libzypp/blob/d90a93fc2a248e6592bd98114f82a0b88abadb72/zypp/ZYppCallbacks.h#L111
        NO_ERROR = 0
        NOT_FOUND = 1
        IO_ERROR = 2
        INVALID = 3

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackDoneProvide(
            Yast::FunRef.new(method(:done_provide), "string (integer, string, string)")
          )
        end

        # DoneProvide callback
        #
        # @return [String, nil] "I" for ignore, "R" for retry and "C" for abort (not implemented)
        # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L620
        def done_provide(error, reason, name)
          args = [error, reason, name]
          logger.debug "DoneProvide callback: #{args.inspect}"

          error_code = case error
          when NO_ERROR, NOT_FOUND
            # "Not found" (error 1) is handled by the MediaChange callback.
            nil
          when IO_ERROR
            "IO_ERROR"
          when INVALID
            "INVALID"
          else
            logger.warn "DoneProvide: unknown error: '#{error}'"
            nil
          end

          return nil if error_code.nil?

          question = Agama::Question.new(
            qclass:  "software.package_error.provide_error",
            text:    reason,
            options: [retry_label.to_sym, continue_label.to_sym],
            data:    { "package" => name, "error_code" => error_code }
          )

          questions_client.ask(question) do |answer|
            (answer.action == retry_label.to_sym) ? "R" : "I"
          end
        end
      end
    end
  end
end
