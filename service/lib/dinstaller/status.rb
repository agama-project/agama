# frozen_string_literal: true

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

module DInstaller
  # Installer status
  class Status
    ERROR = 0.freeze
    PROBING = 1.freeze
    PROBED = 2.freeze
    INSTALLING = 3.freeze
    INSTALLED = 4.freeze

    # @return [Integer]
    attr_reader :id

    # Constructor
    #
    # @param id [Integer] initial status
    def initialize(id)
      @id = id
      @on_change_callbacks = []
    end

    # Changes the status
    #
    # Callbacks are called.
    #
    # @param id [Integer] new status
    def change(id)
      @id = id
      on_change_callbacks.each(&:call)
    end

    # Registers a callback to be called when the status changes
    def on_change(&block)
      @on_change_callbacks << block
    end

  private

    # Callbacks to be called when the status changes
    #
    # @return [Array[Proc]]
    attr_reader :on_change_callbacks
  end
end
