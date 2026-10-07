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
# File:  modules/Directory.ycp
# Package:  yast2
# Summary:  Definitions of basic directories
# Authors:  Michal Svec <msvec@suse.cz>
#
# $Id$
require "yast"

module Yast
  class DirectoryClass < Module
    def main
      textdomain "base"

      @yast2dir = "/usr/share/YaST2"
      @execcompdir = "/usr/lib/YaST2"

      # Directory for binaries and scripts
      @bindir = "/usr/lib/YaST2/bin"
      @ybindir = @bindir

      # Directory for log files
      @logdir = "/var/log/YaST2"

      # Directory for variable data
      @vardir = "/var/lib/YaST2"

      # Directory for configuration data
      @etcdir = "/etc/YaST2"

      # Directory with agents
      @agentdir = Ops.add(@execcompdir, "/servers_non_y2")

      # Directory for data
      # @deprecated since it does not honor Y2DIR. Use #find_data_file instead
      @datadir = Ops.add(@yast2dir, "/data")
      @ydatadir = @datadir

      # Directory for schema (RNC,DTD,RNG)
      @schemadir = Ops.add(@yast2dir, "/schema")

      # Directory for includes
      @includedir = Ops.add(@yast2dir, "/include")
      @yncludedir = @includedir

      # Directory for images
      @imagedir = Ops.add(@yast2dir, "/images")

      # Directory for themes
      @themedir = Ops.add(@yast2dir, "/theme")

      # Directory for locales
      @localedir = Ops.add(@yast2dir, "/locale")

      # Directory for clients
      @clientdir = Ops.add(@yast2dir, "/clients")

      # Directory for modules
      @moduledir = Ops.add(@yast2dir, "/modules")

      # Directory for SCR definition files
      @scrconfdir = Ops.add(@yast2dir, "/scrconf")

      # Directory for desktop files
      @desktopdir = "/usr/share/applications/YaST2"

      # Base directory for icons
      #
      @icondir = Ops.add(@themedir, "/current/icons/")

      # Directory for temporary files
      # Must be updated with ResetTmpDir() call after the SCR change!
      @tmpdir = "/tmp"

      # Directory needed for custom installation workflows
      # It can be set to the path containing additional file on a CDROM
      @custom_workflow_dir = ""
      Directory()
    end

    # Set temporary directory
    def ResetTmpDir
      @tmpdir = Convert.to_string(SCR.Read(path(".target.tmpdir")))
      if @tmpdir == "" || @tmpdir.nil?
        Builtins.y2error("Failed to set temporary directory: %1", @tmpdir)
        @tmpdir = "/tmp"
      end

      nil
    end

    # Constructor
    def Directory
      ResetTmpDir()

      nil
    end

    # Find an existing file in any of the YaST data directories
    #
    # @param relative_path [String] name of the file to find
    # @return [String] full path of the file if it's found, nil otherwise
    def find_data_file(relative_path)
      possible_paths = Yast.y2paths.map { |p| File.join(p, "data", relative_path) }
      possible_paths.find { |p| File.exist?(p) }
    end

    publish variable: :bindir, type: "string"
    publish variable: :ybindir, type: "string"
    publish variable: :logdir, type: "string"
    publish variable: :vardir, type: "string"
    publish variable: :etcdir, type: "string"
    publish variable: :agentdir, type: "string"
    # @deprecated since it does not honor Y2DIR. Use #find_data_file instead
    publish variable: :datadir, type: "string"
    # @deprecated since it's an alias for the deprecated #datadir
    publish variable: :ydatadir, type: "string"
    publish variable: :schemadir, type: "string"
    publish variable: :includedir, type: "string"
    publish variable: :yncludedir, type: "string"
    publish variable: :imagedir, type: "string"
    publish variable: :themedir, type: "string"
    publish variable: :localedir, type: "string"
    publish variable: :clientdir, type: "string"
    publish variable: :moduledir, type: "string"
    publish variable: :scrconfdir, type: "string"
    publish variable: :desktopdir, type: "string"
    # @deprecated Use just a plain icon name without suffix,
    # the UI will automatically find the best suitable icon.
    publish variable: :icondir, type: "string"
    publish variable: :tmpdir, type: "string"
    publish variable: :custom_workflow_dir, type: "string"
    publish function: :ResetTmpDir, type: "void ()"
    publish function: :Directory, type: "void ()"
  end

  Directory = DirectoryClass.new
  Directory.main
end
