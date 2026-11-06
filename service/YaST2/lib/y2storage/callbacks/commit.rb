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

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during libstorage-ng commit
    #
    # This is only used as a fallback default when StorageManager#commit is called without
    # explicit callbacks - Agama always provides its own (Agama::Storage::Callbacks::Commit),
    # which reports errors through its D-Bus questions mechanism instead. #error below is
    # therefore never actually reached by Agama; it only exists to give this default fallback
    # safe (non-interactive) behavior instead of silently crashing or hanging.
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

      # Callback for libstorage-ng to report an error.
      #
      # There is no interactive UI to ask the user in this default fallback, so the error is
      # just logged and the commit is aborted (telling libstorage-ng not to ignore the error).
      #
      # See Storage::Callbacks#error in libstorage-ng
      #
      # @param message [String] error title coming from libstorage-ng
      #   (in the ASCII-8BIT encoding! see https://sourceforge.net/p/swig/feature-requests/89/)
      # @param what [String] details coming from libstorage-ng (in the ASCII-8BIT encoding!)
      # @return [Boolean] always false, libstorage-ng will raise the corresponding exception
      def error(message, what)
        # force the UTF-8 encoding to avoid Encoding::CompatibilityError exception (bsc#1096758)
        message.force_encoding("UTF-8")
        what.force_encoding("UTF-8")

        log.error "libstorage-ng reported an error. Message: #{message}. What: #{what}."

        false
      end

      private

      attr_reader :widget
    end
  end
end
