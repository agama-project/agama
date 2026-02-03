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
          # Possible format actions.
          module FormatAction
            FORMAT = :format
            FORMAT_IF_NEEDED = :format_if_needed
            NONE = :none

            # @return [Array<Symbol>]
            def self.all
              [FORMAT, FORMAT_IF_NEEDED, NONE]
            end
          end

          # Possible DIAG actions.
          module DiagAction
            ENABLE = :enable
            DISABLE = :disable
            NONE = :none

            # @return [Array<Symbol>]
            def self.all
              [ENABLE, DISABLE, NONE]
            end
          end

          # @return [String, nil]
          attr_accessor :channel

          # @return [Boolean]
          attr_writer :active

          # @return [Symbol] See {FormatAction}
          attr_reader :format_action

          # @return [Symbol] See {DiagAction}
          attr_reader :diag_action

          # @param channel [String, nil]
          def initialize(channel = nil)
            @channel = channel
            @active = true
            @format_action = FormatAction::FORMAT_IF_NEEDED
            @diag_action = DiagAction::NONE
          end

          # @return [Boolean]
          def active?
            @active
          end

          # @param action [Symbol] see {FormatAction}.
          def format_action=(action)
            return unless FormatAction.all.include?(action)

            @format_action = action
          end

          # @param action [Symbol] See {DiagAction}.
          def diag_action=(action)
            return unless DiagAction.all.include?(action)

            @diag_action = action
          end
        end
      end
    end
  end
end
