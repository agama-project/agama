# Copyright (c) [2022-2023] SUSE LLC
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

require "yast"

# :nodoc:
module Yast
  # Replacement for the Yast::Package module
  #
  # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb
  class InstFunctionsClass < Module
    def main
      puts "Loading mocked module #{__FILE__}"
    end

    # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb#L56
    def ignored_features
      []
    end

    # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb#L83
    def reset_ignored_features; end

    # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb#L91
    def feature_ignored?(_feature_name)
      false
    end

    # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb#L107
    def second_stage_required?
      false
    end

    # @see https://github.com/yast/yast-installation/blob/279b7d108eab24082237cf5e3f02a31f58fef8da/src/modules/InstFunctions.rb#L137
    def self_update_explicitly_enabled?
      false
    end
  end

  InstFunctions = InstFunctionsClass.new
  InstFunctions.main
end
