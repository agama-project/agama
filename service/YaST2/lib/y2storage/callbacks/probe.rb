# Copyright (c) [2018-2021] SUSE LLC
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
require "y2storage/callbacks/issues_callback"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during libstorage-ng probe
    class Probe < Storage::ProbeCallbacksV3
      include IssuesCallback

      include Yast::I18n

      include Yast::Logger

      def initialize
        textdomain "storage"

        super()
      end

      # Callback for libstorage-ng to show a message to the user.
      #
      # Currently it performs no action, we don't want to bother the regular
      # user with information about every single step. Libstorage-ng is
      # already writing that information to the YaST logs.
      #
      # @param message [String] message text (in the ASCII-8BIT encoding!,
      #   see https://sourceforge.net/p/swig/feature-requests/89/,
      #   it is recommended to force it to the UTF-8 encoding before
      #   doing anything with the string to avoid the Encoding::CompatibilityError
      #   exception!)
      # See Storage::Callbacks#message in libstorage-ng
      def message(message); end

      # Callback for missing commands during probing.
      #
      # @param message [String] error title coming from libstorage-ng
      #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
      # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @param command [String] missing command coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @param used_features [Integer] used features bit field as integer coming from libstorage-ng
      #
      # @return [Boolean] true will make libstorage-ng ignore the error, false
      #   will result in a libstorage-ng exception
      def missing_command(message, what, command, used_features)
        # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception
        message.force_encoding("UTF-8")
        what.force_encoding("UTF-8")
        command.force_encoding("UTF-8")

        log.info "libstorage-ng reported a missing command"
        log.info "Error details. message: #{message}. what: #{what}. command: #{command}. "\
                 "used_features: #{used_features}."

        error(message, what)
      end

      # Initialization
      def begin
        @again = false
      end

      # Should probing be run again?
      #
      # @return [Boolean] Whether probing should be run again
      def again?
        @again
      end
    end
  end
end
