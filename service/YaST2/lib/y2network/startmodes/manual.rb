# Copyright (c) [2019] SUSE LLC
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

# Vendored from yast2-network's network/src/lib/y2network/startmodes/manual.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "y2network/startmode"

module Y2Network
  module Startmodes
    # Manual startmode
    #
    # Interface will be set up if ip is called manually
    class Manual < Startmode
      include Yast::I18n

      def initialize
        textdomain "network"

        super("manual")
      end

      def to_human_string
        _("Manually")
      end

      def long_description
        _(
          "Started manually"
        )
      end
    end
  end
end
