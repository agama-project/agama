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
#
# @example Registering an error
#   list = Y2Issues::List.new
#   list << Y2Issues::Issue.new("Could not read network configuration", severity: :error)
module Y2Issues
end

require "y2issues/list"
require "y2issues/location"

# Issues types
require "y2issues/issue"
require "y2issues/invalid_value"
