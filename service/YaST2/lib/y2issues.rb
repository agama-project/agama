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

# This module offers a mechanism to register and report issues to the user.
#
# It includes:
#
# * A set of classes to represent the issues ({Y2Issues::Issue},
#   {Y2Issues::InvalidValue}).
# * A class to collect errors ({Y2Issues::List}).
# * A presenter to help when presenting the issues to the user ({Y2Issues::Presenter}).
#
# @example Registering an error
#   list = Y2Issues::List.new
#   list << Y2Issues::Issue.new("Could not read network configuration", severity: :error)
module Y2Issues
  # Reports the errors to the user
  #
  # This is a helper method that offers an stable API on top of {Reporter}. Depending on
  # Yast::Report settings, it may show a pop-up with the found issues and log them.
  #
  # @param issues [List] Issues list
  # @param warn [Symbol] what to do if the list of issues only contains warnings
  # @param error [Symbol] what to do if the list of issues contains some error
  # @return [Boolean] whether the process may continue, false means YaST is expected to abort
  # @see Y2Issues::Reporter
  def self.report(issues, warn: :ask, error: :abort)
    Reporter.new(issues).report(warn: warn, error: error)
  end
end

require "y2issues/list"
require "y2issues/presenter"
require "y2issues/location"
require "y2issues/reporter"

# Issues types
require "y2issues/issue"
require "y2issues/invalid_value"
