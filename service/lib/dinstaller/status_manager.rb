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
  # Manager for installation status
  #
  # It allows to change the installation status and to execute callbacks when the status changes.
  #
  # @example
  #   status_manager = StatusManager.new(Status::Error.new)
  #   status_manager.on_change { puts "changing status" }
  #   status_manager.change(Status::Installing.new)
  class StatusManager
    # Current status
    #
    # @return [Status::Base]
    attr_reader :status

    # Constructor
    #
    # @param status [Status::Base] initial status
    def initialize(status)
      @status = status
      @on_change_callbacks = []
    end

    # Whether the current status represents an error status
    #
    # @return [Boolean]
    def error?
      status.is_a?(Status::Error)
    end

    # Changes the current status
    #
    # Callbacks are called.
    #
    # @param status [Status::Base] new status
    def change(status)
      @status = status
      on_change_callbacks.each(&:call)
    end

    # Registers a callback to be called when the status changes
    def on_change(&block)
      @on_change_callbacks << block
    end

  private

    # Callbacks to be called when the status changes
    #
    # @return [Array<Proc>]
    attr_reader :on_change_callbacks
  end

  # Status of the service
  module Status
    def self.create(id)
      case id
      when 0
        Error.new
      when 1
        Probing.new
      when 2
        Probed.new
      when 3
        Installing.new
      when 4
        Installed.new
      end
    end

    # Status base class
    class Base
      # Status id
      #
      # @return [Integer]
      attr_reader :id

      # Constructor
      #
      # @param id [Integer] status id
      def initialize(id)
        @id = id
      end

      # Two status are equal if they have the same id
      #
      # @param other [Status::Base]
      # @return [Boolean]
      def ==(other)
        id == other.id
      end
    end

    # Error status
    class Error < Base
      # Error messages
      #
      # @return [Array<String>]
      attr_accessor :messages

      def initialize
        super(0)
        @messages = []
      end
    end

    # Probing status
    class Probing < Base
      def initialize
        super(1)
      end
    end

    # Probed status
    class Probed < Base
      def initialize
        super(2)
      end
    end

    # Installing status
    class Installing < Base
      def initialize
        super(3)
      end
    end

    # Installed status
    class Installed < Base
      def initialize
        super(4)
      end
    end
  end
end
