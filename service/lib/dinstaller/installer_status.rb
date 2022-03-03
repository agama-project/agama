# frozen_string_literal: true

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

# YaST specific code lives under this namespace
module DInstaller
  # This class represents the installer status
  class InstallerStatus
    attr_reader :id

    def initialize(id)
      @id = id
    end

    ERROR = new(0)
    PROBING = new(1)
    PROBED = new(2)
    INSTALLING = new(3)
    INSTALLED = new(4)
  end
end
