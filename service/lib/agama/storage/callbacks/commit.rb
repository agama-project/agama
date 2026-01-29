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

require "storage"
require "agama/storage/callbacks/commit_error"

module Agama
  module Storage
    module Callbacks
      # Callbacks used during the storage commit
      class Commit < ::Storage::CommitCallbacks
        # Constructor
        #
        # @param questions_client [Agama::HTTP::Clients::Questions]
        # @param logger [Logger, nil]
        def initialize(questions_client, logger: nil)
          super()

          @questions_client = questions_client
          @logger = logger || Logger.new($stdout)
        end

        # Messages are ignored
        #
        # Commit messages are used to report the progress of the commit actions.
        def message(_message); end

        # Callback to report an error to the user.
        #
        # @param message [String] error title coming from libstorage-ng
        #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
        # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
        # @return [Boolean] true for ignoring the error and continue, false to abort the rest of
        #   storage actions.
        def error(message, what)
          # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception (bsc#1096758)
          message = message.dup.force_encoding("UTF-8")
          details = what.dup.force_encoding("UTF-8")

          error_callback = CommitError.new(questions_client, logger: logger)
          error_callback.call(message, details)
        end

      private

        # @return [Agama::HTTP::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
