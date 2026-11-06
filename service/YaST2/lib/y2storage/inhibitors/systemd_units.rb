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
  # class to inhibit systemd mount and swap units
  class SystemdUnits
    include Yast::Logger

    def inhibit
      log.info "mask systemd units"
      Yast::Execute.locally!("/usr/lib/YaST2/bin/mask-systemd-units", "--mask")
    rescue Cheetah::ExecutionFailed => e
      log.error "masking systemd units failed #{e.message}"
    end

    def uninhibit
      log.info "unmask systemd units"
      Yast::Execute.locally!("/usr/lib/YaST2/bin/mask-systemd-units", "--unmask")
    rescue Cheetah::ExecutionFailed => e
      log.error "unmasking systemd units failed #{e.message}"
    end
  end
end
