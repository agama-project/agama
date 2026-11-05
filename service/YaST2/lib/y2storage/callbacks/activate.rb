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
require "yast2/popup"
require "y2storage/dialogs/callbacks/activate_luks"
require "y2storage/callbacks/issues_callback"
require "y2storage/storage_env"
require "y2storage/issue"
require "y2storage/disk_size"

Yast.import "Mode"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during libstorage-ng activation
    #
    # Note that this class provides an implementation for the specialized callbacks
    # `Storage::ActivateCallbacksLuks` instead of `Storage::ActivateCallbacks`. That specialized
    # callbacks receives a more generic parameter when activating LUKS devices.
    class Activate < Storage::ActivateCallbacksLuks
      include IssuesCallback

      include Yast::I18n

      include Yast::Logger

      def initialize
        textdomain "storage"

        super
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

      # Decides whether multipath should be activated
      #
      # The argument indicates whether libstorage-ng detected a multipath setup
      # in the system. Beware such detection is not reliable (see bsc#1082542).
      #
      # @param looks_like_real_multipath [Boolean] true if the system seems to
      #   contain a Multipath
      # @return [Boolean]
      def multipath(looks_like_real_multipath)
        return true if forced_multipath?
        return false unless looks_like_real_multipath

        message = _(
          "The system seems to have multipath hardware.\n" \
          "Do you want to activate multipath?"
        )

        Yast2::Popup.show(message, buttons: :yes_no) == :yes
      end

      # Decides whether a LUKS device should be activated
      #
      # @param info [Storage::LuksInfo]
      # @param attempt [Numeric]
      #
      # @return [Storage::PairBoolString]
      def luks(info, attempt)
        log.info("Trying to open luks UUID: #{info.uuid} (#{attempt} attempts)")

        return Storage::PairBoolString.new(false, "") if attempt == 1 && !activate_luks?

        info_presenter = InfoPresenter.new(info)

        luks_error(info_presenter, attempt) if attempt > 1

        dialog = Dialogs::Callbacks::ActivateLuks.new(info_presenter, attempt,
          always_skip: !activate_luks?)
        result = dialog.run

        activate = result == :accept
        password = activate ? dialog.encryption_password : ""

        @skip_decrypt = dialog.always_skip?

        Storage::PairBoolString.new(activate, password)
      end

      private

      # Error popup when the LUKS could not be activated
      #
      # @param info [InfoPresenter]
      # @param attempt [Numeric] current attempt
      def luks_error(info, attempt)
        message = format(
          _("The following encrypted device could not be activated (attempt number %{attempt}):\n\n" \
            "%{info}\n\n" \
            "Please, make sure you are entering the correct password."),
          attempt: attempt - 1,
          info:    info.to_text
        )

        Yast2::Popup.show(message, headline: :error, buttons: :ok)

        nil
      end

      # Creates a new issue from an error reported by libstorage-ng
      #
      # @see IssuesCallback#error
      #
      # @param message [String]
      # @param what [String]
      #
      # @return [Issue]
      def create_issue(message, what)
        Issue.new(message, description: description(what), details: what)
      end

      # Description of the issue
      #
      # @param what [String]
      # @return [String, nil]
      def description(what)
        needle = /Cannot activate LVs in VG .* while PVs appear on duplicate devices/i
        return nil unless what.match?(needle)

        duplicated_pv_description
      end

      # Human-readable description to use if the LVM tools report that the same PV is found more than
      # once.
      #
      # @return [String]
      def duplicated_pv_description
        result = _("The same LVM physical volume was found in several devices.\n")
        # The user already tried LIBSTORAGE_MULTIPATH_AUTOSTART (and is not
        # using AutoYaST), there is nothing else we can advise.
        return result.chomp if forced_multipath? && !Yast::Mode.auto

        result += _(
          "Maybe there are multipath devices in the system but multipath support " \
          "was not enabled.\n\n"
        )

        result += if Yast::Mode.auto
          _(
            "Use 'start_multipath' in the AutoYaST profile to enable multipath."
          )
        else
          _(
            "If YaST didn't offer the opportunity to enable multipath in a previous step, " \
            "try the 'LIBSTORAGE_MULTIPATH_AUTOSTART=ON' boot parameter.\n" \
            "More information at https://en.opensuse.org/SDB:Linuxrc"
          )
        end
        result
      end

      # Whether the activation of multipath has been forced via the
      # LIBSTORAGE_MULTIPATH_AUTOSTART boot parameter.
      #
      # @see StorageEnv#forced_multipath?
      #
      # @return [Boolean]
      def forced_multipath?
        StorageEnv.instance.forced_multipath?
      end

      # Whether to try the LUKS activation
      #
      # @return [Boolean]
      def activate_luks?
        StorageEnv.instance.activate_luks? && !@skip_decrypt
      end

      # Auxiliary class to present LUKS info
      class InfoPresenter
        # Constructor
        #
        # @param info [Storage::LuksInfo]
        def initialize(info)
          @info = info
        end

        # Converts LUKS info into text
        #
        # @return [String] e.g., "/dev/sda1 System (20 GiB)"
        def to_text
          text = [info.device_name]
          text << info.label unless info.label.empty?
          text << "(#{size.to_human_string})"

          text.join(" ")
        end

        private

        attr_reader :info

        # @return [DiskSize]
        def size
          @size ||= DiskSize.new(info.size)
        end
      end
    end
  end
end
