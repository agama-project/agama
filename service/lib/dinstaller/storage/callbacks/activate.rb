# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2storage/callbacks/issues_callback"
require "dinstaller/storage/callbacks/activate_multipath"
require "dinstaller/storage/callbacks/activate_luks"

module DInstaller
  module Storage
    module Callbacks
      # Callbacks to manage devices activation
      class Activate < ::Storage::ActivateCallbacksLuks
        include Y2Storage::Callbacks::IssuesCallback

        # Constructor
        #
        # @param questions_manager [QuestionsManager]
        # @param logger [Logger]
        def initialize(questions_manager, logger)
          super()

          @questions_manager = questions_manager
          @logger = logger
          @issues = Y2Issues::List.new
        end

        # Messages are ignored to not bother the user
        #
        # See Storage::Callbacks#message in libstorage-ng
        def message(_message); end

        # Decides whether multipath should be activated
        #
        # @see ActivateMultipath
        #
        # @param looks_like_real_multipath [Boolean] true if the system seems to contain a multipath
        #   device.
        # @return [Boolean]
        def multipath(looks_like_real_multipath)
          callback = ActivateMultipath.new(questions_manager, logger)

          callback.call(looks_like_real_multipath)
        end

        # Decides whether a LUKS device should be activated
        #
        # @see ActivateLuks
        #
        # @param info [Storage::LuksInfo]
        # @param attempt [Numeric]
        #
        # @return [Storage::PairBoolString] Whether to activate the device and the password
        def luks(info, attempt)
          callback = ActivateLuks.new(questions_manager, logger)

          activate, password = callback.call(info, attempt)

          ::Storage::PairBoolString.new(activate, password)
        end

      private

        # @return [QuestionsManager]
        attr_reader :questions_manager

        # @return [Logger]
        attr_reader :logger

        # Mixin Y2Storage::Callbacks::IssuesCallback expects a #log method
        alias_method :log, :logger
      end
    end
  end
end
