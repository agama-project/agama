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

module Agama
  # Handles everything related to registration of system to SCC, RMT or similar
  class Registration
    attr_reader :reg_code
    attr_reader :email

    # initializes registration with instance of software manager for query about products
    def initialize(software_manager)
      @software = software_manager
    end

    def register(code, email: nil)
    end

    def deregister
    end

    def disabled?
    end

    def optional?
    end
  end
end
