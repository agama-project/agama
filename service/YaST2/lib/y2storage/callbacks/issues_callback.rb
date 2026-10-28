# Copyright (c) [2021] SUSE LLC
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
require "y2storage/issue"
require "y2issues/list"

module Y2Storage
  module Callbacks
    # Mixin for registering issues when libstorage-ng reports errors
    module IssuesCallback
      include Yast::Logger

      # List of issues from errors reported by libstorage-ng
      #
      # @return [Y2Issues::List]
      attr_reader :issues

      def initialize
        super

        @issues = Y2Issues::List.new
      end

      # Callback for libstorage-ng to handle errors
      #
      # See Storage::Callbacks#error in libstorage-ng
      #
      # Errors are stored in the list of issues.
      #
      # @param message [String] error title coming from libstorage-ng
      #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
      # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
      #
      # @return [true] makes libstorage-ng to ignore the error
      def error(message, what)
        # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception (bsc#1096758)
        message.force_encoding("UTF-8")
        what.force_encoding("UTF-8")

        log.info "libstorage-ng reported an error, generating an issue"
        log.info "Error details. Message: #{message}. What: #{what}."

        issues << create_issue(message, what)

        true
      end

      private

      # Creates a new issue from an error reported by libstorage-ng
      #
      # @param message [String]
      # @param what [String]
      #
      # @return [Issue]
      def create_issue(message, what)
        Issue.new(message, details: what)
      end
    end
  end
end
