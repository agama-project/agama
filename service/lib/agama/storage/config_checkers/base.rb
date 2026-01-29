# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
require "agama/storage/issue_classes"

module Agama
  module Storage
    module ConfigCheckers
      # Base class for checking a config.
      class Base
        # List of issues (implemented by derived classes).
        #
        # @return [Array<Issue>]
        def issues
          raise "#issues is not defined"
        end

      private

        # Creates an issue.
        #
        # @param message [String]
        # @param kind [Symbol, nil] if nil or ommited, default value defined by Agama::Issue
        # @return [Issue]
        def error(message, kind: nil)
          Agama::Issue.new(message, kind: kind)
        end
      end
    end
  end
end
