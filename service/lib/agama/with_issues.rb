# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
  # Mixin for managing issues, see {Issue}
  module WithIssues
    # The list of current issues
    #
    # @return [Array<Issue>]
    def issues
      @issues || []
    end

    # Whether there are errors
    #
    # @return [Boolean]
    def errors?
      issues.any?(&:error?)
    end

    # Sets the list of current issues
    #
    # @param issues [Array<Issue>]
    def issues=(issues)
      @issues = issues
      @on_issues_change_callbacks&.each(&:call)
    end

    # Registers a callback to be called when the list of issues changes
    #
    # @param block [Proc]
    def on_issues_change(&block)
      @on_issues_change_callbacks ||= []
      @on_issues_change_callbacks << block
    end
  end
end
