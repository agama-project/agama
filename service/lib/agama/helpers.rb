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

module Agama
  # This module contains some reusable utility methods
  #
  # We might consider turning some of them into proper classes if needed.
  module Helpers
    # Run a block in the target system
    #
    # @param block [Proc] Block to run on the target system
    def on_target(&block)
      Yast.import "WFM"
      old_handle = Yast::WFM.SCRGetDefault
      # chroot directly to /mnt instead of Installation.destdir to avoid unnecessary deps
      handle = Yast::WFM.SCROpen("chroot=/mnt:scr", false)
      Yast::WFM.SCRSetDefault(handle)

      begin
        block.call
      rescue StandardError => e
        logger.error "Error while running on target tasks: #{e.inspect}"
      ensure
        Yast::WFM.SCRSetDefault(old_handle)
        Yast::WFM.SCRClose(handle)
      end
    end
  end
end
