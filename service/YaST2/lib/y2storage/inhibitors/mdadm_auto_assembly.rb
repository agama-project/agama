# Copyright (c) 2018 SUSE LLC
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

require "yast2/execute"

module Y2Storage
  # class to inhibit mdadm from doing auto assembly
  class MdadmAutoAssembly
    include Yast::Logger

    # location of udevadm program
    UDEVADM_BIN = "/usr/bin/udevadm".freeze

    def inhibit
      log.info "set udev ANACONDA property"

      begin
        Yast::Execute.locally!(UDEVADM_BIN, "control", "--property=ANACONDA=yes")
      rescue Cheetah::ExecutionFailed => e
        log.error "disabling mdadm auto assembly failed #{e.message}"
      end
    end

    def uninhibit
      log.info "unset udev ANACONDA property"

      begin
        Yast::Execute.locally!(UDEVADM_BIN, "control", "--property=ANACONDA=")
      rescue Cheetah::ExecutionFailed => e
        log.error "enabling mdadm auto assembly failed #{e.message}"
      end
    end
  end
end
