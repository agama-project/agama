# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2security/lsm"
require "yast2/execute"

module DInstaller
  # Backend class between dbus service and yast code
  class Security
    def initialize(logger)
      @logger = logger
    end

    def write(_progress)
      config.save
    end

    def probe(_progress)
      # TODO: hardcoded apparmor here instead of calling `.propose_default`
      # as we soon change it to value from config.yml
      config.select(:apparmor)
    end

  private

    def config
      Y2Security::LSM::Config.instance
    end
  end
end
