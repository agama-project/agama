# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
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
# File:  modules/Systemd.ycp
# Package:  yast2
# Summary:  systemd configuration
# Authors:  Ladislav Slezak <lslezak@suse.cz>
#
# $Id$
#
# Functions for setting systemd options
require "yast"
require "shellwords"

module Yast
  class SystemdClass < Module
    def main
      Yast.import "FileUtils"

      @systemd_path = "/usr/lib/systemd/systemd"
      @default_target_symlink = "/etc/systemd/system/default.target"
      @systemd_targets_dir = "/usr/lib/systemd/system"

      textdomain "base"
    end

    # Check whether systemd init is currently running
    # @return boolean true if systemd init is running
    def Running
      WFM.Read(path(".local.string"), "/proc/1/comm")&.chomp == "systemd"
    end

    publish function: :Running, type: "boolean ()"
  end

  Systemd = SystemdClass.new
  Systemd.main
end
