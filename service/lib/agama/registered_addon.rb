# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
  # Handles everything related to registration of system to SCC, RMT or similar.
  class RegisteredAddon
    # Name (id) of the addon product, e.g. "sle-ha"
    #
    # @return [String]
    attr_reader :name

    # Version of the addon, e.g. "16.0"
    #
    # @return [String]
    attr_reader :version

    # Code used for registering the addon.
    #
    # @return [String] empty string if the registration code is not required
    attr_reader :reg_code

    def initialize(name, version, reg_code = "")
      @name = name
      @version = version
      @reg_code = reg_code
    end
  end
end
