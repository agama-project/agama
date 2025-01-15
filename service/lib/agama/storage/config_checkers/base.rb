# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/issue"

module Agama
  module Storage
    module ConfigCheckers
      # Base class for checking a config.
      class Base
        # @param storage_config [Storage::Config]
        # @param product_config [Agama::Config]
        def initialize(storage_config, product_config)
          @storage_config = storage_config
          @product_config = product_config
        end

        # List of issues (implemented by derived classes).
        #
        # @return [Array<Issue>]
        def issues
          raise "#issues is not defined"
        end

      private

        # @return [Storage::Config]
        attr_reader :storage_config

        # @return [Agama::Config]
        attr_reader :product_config

        # Creates an error issue.
        #
        # @param message [String]
        # @return [Issue]
        def error(message)
          Agama::Issue.new(
            message,
            source:   Agama::Issue::Source::CONFIG,
            severity: Agama::Issue::Severity::ERROR
          )
        end
      end
    end
  end
end
