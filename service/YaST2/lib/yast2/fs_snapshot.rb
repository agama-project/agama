# ***************************************************************************
#
# Copyright (c) [2015-2019] SUSE LLC
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File: fs_snapshot.rb
#
# Authors:
#  Imobach Gonzalez Sosa <igonzalezsosa@suse.com>

require "yast"
require "yast2/execute"

module Yast2
  # Represents that a Snapper configuration was attempted at the wrong time or
  # system, since it's only possible in a fresh installation after software
  # installation.
  class SnapperNotConfigurable < StandardError
    def initialize
      super "Programming error: Snapper cannot be configured at this point."
    end
  end

  # Class for configuring Snapper on a freshly installed system.
  #
  # It uses the Snapper's CLI because the DBus interface is not available during installation.
  class FsSnapshot
    include Yast::Logger

    Yast.import "Mode"

    class << self
      # Performs the final steps to configure snapper for the root filesystem on a
      # fresh installation.
      #
      # First part of the configuration must have been already done while the root
      # filesystem is created.
      #
      # This part here is what is left to do after the package installation in the
      # target system is complete.
      #
      # @raise [SnapperNotConfigurable] unless called in an already chrooted fresh
      #   installation
      def configure_snapper
        raise SnapperNotConfigurable if !Yast::Mode.installation || non_switched_installation?

        installation_helper_step4
        write_snapper_config
        update_etc_sysconfig_yast2
        setup_snapper_quota
      end

      # Whether Snapper should be configured at the end of installation
      #
      # @return [Boolean]
      def configure_on_install?
        !!@configure_on_install
      end

      # @see #configure_on_install?
      attr_writer :configure_on_install

    private

      # detects if module runs in initial stage before scr is switched to target system
      def non_switched_installation?
        Yast.import "Stage"
        return false unless Yast::Stage.initial

        !Yast::WFM.scr_chrooted?
      end

      # Executes the fourth step of the installation-helper of Snapper.
      #
      # Unfortunately the steps of the Snapper helper are not much descriptive.
      # The step 4 must be executed in the target system after installing the
      # packages and before using snapper for the first time.
      def installation_helper_step4
        Yast::Execute.on_target("/usr/lib/snapper/installation-helper", "--step", "4")
      end

      def write_snapper_config
        config = [
          "NUMBER_CLEANUP=yes", "NUMBER_LIMIT=2-10", "NUMBER_LIMIT_IMPORTANT=4-10", "TIMELINE_CREATE=no"
        ]
        Yast::Execute.on_target("/usr/bin/snapper", "--no-dbus", "set-config", *config)
      end

      def update_etc_sysconfig_yast2
        Yast::SCR.Write(Yast.path(".sysconfig.yast2.USE_SNAPPER"), "yes")
        Yast::SCR.Write(Yast.path(".sysconfig.yast2"), nil)
      end

      def setup_snapper_quota
        Yast::Execute.on_target("/usr/bin/snapper", "--no-dbus", "setup-quota")
      end
    end
  end
end
