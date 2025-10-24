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

module Agama
  # Represents the installation phase of the manager service and allows to configure callbacks to be
  # called when the installation phase value changes
  class InstallationPhase
    # Possible installation phase values
    STARTUP = "startup"
    CONFIG = "config"
    INSTALL = "install"
    FINISH = "finish"

    def initialize
      @value = STARTUP
      @on_change_callbacks = []
    end

    # Whether the current installation phase value is startup
    #
    # @return [Boolean]
    def startup?
      value == STARTUP
    end

    # Whether the current installation phase value is config
    #
    # @return [Boolean]
    def config?
      value == CONFIG
    end

    # Whether the current installation phase value is install
    #
    # @return [Boolean]
    def install?
      value == INSTALL
    end

    # Whether the current installation phase value is finish
    #
    # @return [Boolean]
    def finish?
      value == FINISH
    end

    # Sets the installation phase value to startup
    #
    # @note Callbacks are called.
    #
    # @return [self]
    def startup
      change_to(STARTUP)
      self
    end

    # Sets the installation phase value to config
    #
    # @note Callbacks are called.
    #
    # @return [self]
    def config
      change_to(CONFIG)
      self
    end

    # Sets the installation phase value to install
    #
    # @note Callbacks are called.
    #
    # @return [self]
    def install
      change_to(INSTALL)
      self
    end

    # Sets the installation phase value to finish
    #
    # @note Callbacks are called.
    #
    # @return [self]
    def finish
      change_to(FINISH)
      self
    end

    # Registers callbacks to be called when the installation phase value changes
    #
    # @param block [Proc]
    def on_change(&block)
      @on_change_callbacks << block
    end

  private

    # @return [STARTUP, CONFIG, INSTALL]
    attr_reader :value

    # Changes the installation phase value and runs the callbacks
    #
    # @param value [STARTUP, CONFIG, INSTALL]
    def change_to(value)
      @value = value
      @on_change_callbacks.each(&:call)
    end
  end
end
