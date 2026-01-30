# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
  module Storage
    module DASD
      module Configs
        # DASD device config.
        class Device
          FORMAT_ACTIONS = [:format, :format_if_needed, :not_format].freeze
          private_constat :FORMAT_ACTIONS

          DIAG_ACTIONS = [:enable, :disable, :keep].freeze
          private_constat :DIAG_ACTIONS

          # @return [String]
          attr_accessor :channel

          # @return [Boolean]
          attr_writer :active

          # @return [Symbol] See {FORMAT_ACTIONS}
          attr_writer :format_action

          # @return [Symbol] See {DIAG_ACTIONS}
          attr_writer :diag_action

          # @param channel [String]
          def initialize(channel)
            @channel = channel
            @active = true
            @format_action = :format_if_needed
            @diag_action = :keep
          end

          # @return [Boolean]
          def active?
            @active
          end

          # @param action [Symbol] see {FORMAT_ACTIONS}.
          def format_action=(action)
            return unless FORMAT_ACTIONS.include?(action)

            @format_action = action
          end

          # @param action [Symbol] See {DIAG_ACTIONS}.
          def diag_action=(action)
            return unless DIAG_ACTIONS.include?(action)

            @diag_action = action
          end
        end
      end
    end
  end
end
