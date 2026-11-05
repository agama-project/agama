# Copyright (c) 2018 SUSE LLC
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
require "yast/i18n"

Yast.import "Report"
Yast.import "Mode"
Yast.import "Label"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used when initializing the storage instance
    class Initialize
      include Yast
      include Yast::Logger
      include Yast::I18n

      # Constructor
      #
      # @param error [Storage::LockException]
      def initialize(error)
        textdomain "storage"

        @error = error
      end

      # Callback to ask the user whether to retry or abort when the storage lock
      # cannot be acquired.
      #
      # @return [Boolean] true if the user decides to retry.
      def retry?
        log.info "Storage subsystem is locked by process #{locker_pid}, asking to user whether to retry"

        headline = _("Accessing the Storage Subsystem Failed")

        answer = Yast::Report.yesno_popup(message,
          headline: headline,
          buttons:  buttons,
          focus:    focus_button)

        log.info "User answer: #{answer}"

        answer
      end

      private

      # @return [Storage::LockException]
      attr_reader :error

      # ID of the current process that has the lock
      #
      # @return [Integer]
      def locker_pid
        error.locker_pid
      end

      # Name of the current process that has the lock
      #
      # @return [String, nil] nil if the process is unknown.
      def locker_name
        full_path = Yast::SCR.Read(path(".target.symlink"), "/proc/#{locker_pid}/exe")
        return nil unless full_path

        full_path.split("/").last
      end

      # Message for the retry callback
      #
      # @return [String]
      def message
        if locker_name
          format(
            # TRANSLATORS: %{name} is replaced by the name of a process (e.g., yast2)
            # and %{pid} by the pid of a process (e.g., 5032).
            _("The storage subsystem is locked by the application \"%{name}\" (%{pid}).\n" \
              "You must quit that application before you can continue.\n\n" \
              "Would you like to abort or try again?"),
            name: locker_name,
            pid:  locker_pid
          )
        else
          _(
            "The storage subsystem is locked by an unknown application.\n" \
            "You must quit that application before you can continue.\n\n" \
            "Would you like to abort or try again?"
          )
        end
      end

      # Label for the retry button displayed by {#retry?}
      #
      # @return [String]
      def retry_button_label
        Yast::Label.RetryButton
      end

      # Label for the abort button displayed by {#retry?}
      #
      # @return [String]
      def abort_button_label
        Yast::Mode.installation ? Yast::Label.AbortInstallationButton : Yast::Label.AbortButton
      end

      # Buttons to retry or abort
      #
      # @return [Hash<Symbol, String>]
      def buttons
        { yes: retry_button_label, no: abort_button_label }
      end

      # Button with focus by default
      #
      # @note For AutoYaST, default must be :no to avoid constantly retry.
      #
      # @return [Symbol] :yes, :no
      def focus_button
        Yast::Mode.auto ? :no : :yes
      end
    end
  end
end
