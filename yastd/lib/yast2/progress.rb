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
module Yast2
  # This class represents the installer status
  class Progress
    def initialize(dbus_obj)
      @dbus_obj = dbus_obj
      @total_pkgs = 0
      @remaining_pkgs = 0
    end

    def packages_to_install=(value)
      @total_pkgs = @remaining_pkgs = value
    end

    def package_installed
      @remaining_pkgs -= 1
      @dbus_obj.report_progress(
        # TODO: localization
        "Installing packages (#{@remaining_pkgs} remains)",
        1, 0, @total_pkgs, @total_pkgs - @remaining_pkgs
      )
    end
  end
end
