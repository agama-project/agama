# Copyright (c) [2017-2021] SUSE LLC
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
require "storage"
require "y2issues/list"
require "y2storage/issue"
require "y2storage/issues_reporter"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during libstorage-ng commit
    class Commit < Storage::CommitCallbacks
      include Yast::Logger

      # Constructor
      #
      # @param widget [#add_action]
      def initialize(widget: nil)
        super()

        @widget = widget
      end

      # Updates the widget (if any) with the given message
      def message(message)
        widget&.add_action(message)
      end

      # Callback for libstorage-ng to report an error to the user.
      #
      # In addition to displaying the error, it offers the user the possibility
      # to ignore it and continue.
      #
      # @note If the user rejects to continue, the method will return false
      # which implies libstorage-ng will raise the corresponding exception for
      # the error.
      #
      # See Storage::Callbacks#error in libstorage-ng
      #
      # @param message [String] error title coming from libstorage-ng
      #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
      # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @return [Boolean] true will make libstorage-ng ignore the error, false
      #   will result in a libstorage-ng exception
      def error(message, what)
        # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception (bsc#1096758)
        message.force_encoding("UTF-8")
        what.force_encoding("UTF-8")

        log.info "libstorage-ng reported an error, asking the user whether to continue"
        log.info "Error details. Message: #{message}. What: #{what}."

        issues = Y2Issues::List.new([Issue.new(message, details: what)])
        reporter = IssuesReporter.new(issues)

        result = reporter.report(focus: :no)

        log.info "User answer: #{result}"
        result
      end

      private

      attr_reader :widget
    end
  end
end
