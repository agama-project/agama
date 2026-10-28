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

# Vendored from yast2-network's network/src/lib/y2network/startmodes/auto.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "y2network/startmode"

module Y2Network
  module Startmodes
    # Auto start mode
    #
    # Interface  will  be  set  up  as  soon as it is available (and service network was started).
    # This either happens at boot time when network is starting or via hotplug when a interface
    # is added to the system (by adding a device or loading a driver).
    # To be backward compliant onboot, on and boot are aliases for auto.
    # TODO: when reading use that aliases
    class Auto < Startmode
      include Yast::I18n

      def initialize(alias_name: nil)
        textdomain "network"

        super("auto", alias_name: alias_name)
      end

      def to_human_string
        _("At Boot Time")
      end

      def long_description
        _(
          "Started automatically at boot"
        )
      end
    end
  end
end
