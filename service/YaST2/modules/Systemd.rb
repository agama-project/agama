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
# Authors:  Ladislav Slezák <lslezak@suse.cz>
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

    # Check whether the systemd package is installed
    def Installed
      # check for systemd executable
      Ops.greater_or_equal(SCR.Read(path(".target.size"), @systemd_path), 0)
    end

    # Check whether systemd init is currently running
    # @return boolean true if systemd init is running
    def Running
      WFM.Read(path(".local.string"), "/proc/1/comm")&.chomp == "systemd"
    end

    # Set default runlevel for systemd (assumes systemd is installed)
    # @param [Integer] runlevel the default runlevel to set (integer in range 0..6)
    # @return [Boolean] true on success
    def SetDefaultRunlevel(selected_runlevel)
      if selected_runlevel.nil? || Ops.less_than(selected_runlevel, 0) ||
          Ops.greater_than(selected_runlevel, 6)
        Builtins.y2error(
          "Invalid default runlevel (must be in range 0..6): %1",
          selected_runlevel
        )
        return false
      end

      Builtins.y2milestone(
        "Setting systemd default runlevel: %1",
        selected_runlevel
      )

      # create symbolic link, -f to rewrite the current link (if exists)
      command = Builtins.sformat(
        "/bin/ln -s -f %1/runlevel%2.target %3",
        @systemd_targets_dir.shellescape,
        selected_runlevel.to_s.shellescape,
        @default_target_symlink.shellescape
      )
      Builtins.y2milestone("Executing: %1", command)

      res = Convert.to_integer(SCR.Execute(path(".target.bash"), command))
      Builtins.y2debug("Result: %1", res)

      ret = res == 0
      Builtins.y2milestone("Default runlevel set: %1", ret)

      ret
    end

    # Get the default runlevel for systemd
    # @return [Fixnum] the default runlevel (or nil on error or unknown runlevel)
    def DefaultRunlevel
      target = Convert.to_string(
        SCR.Read(path(".target.symlink"), @default_target_symlink)
      )
      Builtins.y2milestone("Default symlink points to: %1", target)

      if target.nil?
        Builtins.y2error(
          "Cannot read symlink target of %1",
          @default_target_symlink
        )
        return nil
      end

      # check runlevel<number>.target
      runlevel = Builtins.regexpsub(target, "/runlevel([0-6]).target$", "\\1")
      if !runlevel.nil?
        ret = Builtins.tointeger(runlevel)
        Builtins.y2milestone("Default runlevel: %1", ret)

        return ret
      end

      # check runlevel specified by a symbolic name
      # (this is written in systemd documentation how to change the default,
      # YaST should also support this style in case users do a manual change)
      runlevel_name = Builtins.regexpsub(target, "/([^/]*).target$", "\\1")
      if !runlevel_name.nil?
        Builtins.y2milestone(
          "Detected default runlevel name: %1",
          runlevel_name
        )
        mapping = {
          "poweroff"   => 0,
          "rescue"     => 1,
          # this is ambiguous, runlevels 2 and 4 also point to multi-user
          # assume runlevel 3 in this case (the most probable)
          "multi-user" => 3,
          "graphical"  => 5,
          "reboot"     => 6
        }

        ret = Ops.get(mapping, runlevel_name)
        Builtins.y2milestone("Default runlevel: %1", ret)

        return ret
      end

      Builtins.y2error("Cannot determine the default runlevel")
      nil
    end

    publish function: :Installed, type: "boolean ()"
    publish function: :Running, type: "boolean ()"
    publish function: :SetDefaultRunlevel, type: "boolean (integer)"
    publish function: :DefaultRunlevel, type: "integer ()"
  end

  Systemd = SystemdClass.new
  Systemd.main
end
