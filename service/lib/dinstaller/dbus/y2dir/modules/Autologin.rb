# encoding: utf-8

# ------------------------------------------------------------------------------
# Copyright (c) 2006-2012 Novell, Inc. All Rights Reserved.
#
#
# This program is free software; you can redistribute it and/or modify it under
# the terms of version 2 of the GNU General Public License as published by the
# Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail, you may find
# current contact information at www.novell.com.
# ------------------------------------------------------------------------------

# File:	modules/Autologin.ycp
# Package:	yast2
# Summary:	Autologin read/write routines
# Author:	Jiri Suchomel <jsuchome@suse.cz>
# Flags:	Stable
#
# $Id$
require "yast"

module Yast
  class AutologinClass < Module
    include Yast::Logger

    # Display managers that support autologin.
    # Notice that xdm does NOT support it!
    #
    # "autologin-support" is a pseudo-"provides" that maintainers of display
    # manager packages can add to indicate that the package has that
    # capability.
    DISPLAY_MANAGERS = ["autologin-support", "kdm", "gdm", "sddm", "lightdm"].freeze

    def main
      textdomain "pam"

      Yast.import "Package"
      Yast.import "Popup"

      # User to log in automaticaly
      @user = ""

      # Login without passwords?
      @pw_less = false

      # Is autologin used? Usualy true when user is not empty, but for the first
      # time (during installation), this can be true by default although user is ""
      # (depends on the control file)
      @used = false

      # Autologin settings modified?
      @modified = false

      # Pkg stuff initialized?
      @pkg_initialized = false
    end

    def available
      @available = supported? if @available.nil?
      @available
    end

    # Read autologin settings
    # @return used?
    def Read
      if SCR.Read(path(".target.size"), "/etc/sysconfig/displaymanager") == -1
        @available = false
        @user = ""
        @used = false
        return false
      end

      @available = supported?
      @user = Convert.to_string(
        SCR.Read(path(".sysconfig.displaymanager.DISPLAYMANAGER_AUTOLOGIN"))
      )
      @pw_less = Convert.to_string(
        SCR.Read(
          path(".sysconfig.displaymanager.DISPLAYMANAGER_PASSWORD_LESS_LOGIN")
        )
      ) == "yes"

      @user = "" if @user == nil || @user == ""

      @used = @user != ""
      @used
    end


    # Write autologin settings
    # @param [Boolean] write_only when true, suseconfig script will not be run
    # @return written anything?
    def Write(write_only)
      return false if !available || !@modified

      Builtins.y2milestone(
        "writing user %1 for autologin; pw_less is %2",
        @user,
        @pw_less
      )

      SCR.Write(
        path(".sysconfig.displaymanager.DISPLAYMANAGER_AUTOLOGIN"),
        @user
      )
      SCR.Write(
        path(".sysconfig.displaymanager.DISPLAYMANAGER_PASSWORD_LESS_LOGIN"),
        @pw_less ? "yes" : "no"
      )
      SCR.Write(path(".sysconfig.displaymanager"), nil)

      @modified = false
      true
    end

    # Disable autologin
    def Disable
      @user = ""
      @pw_less = false
      @used = false
      @modified = true

      nil
    end

    # Wrapper for setting the 'used' variable
    def Use(use)
      if @used != use
        @used = use
        @modified = true
      end

      nil
    end

    # Disable autologin and write it (used probably for automatic
    # disabling without asking)
    # @param [Boolean] write_only when true, suseconfig script will not be run
    # @return written anything?
    def DisableAndWrite(write_only)
      Disable()
      Write(write_only)
    end

    # Ask if autologin should be disabled (and disable it in such case)
    # @param [String] new The reason for disabling autologin (e.g. new set of users)
    # @return Is autologin used?
    def AskForDisabling(new)
      # popup text (%1 is user name, %2 is additional info,
      # like "Now LDAP was enabled")
      question = Builtins.sformat(
        _(
          "The automatic login feature is enabled for user %1.\n" +
            "%2\n" +
            "Disable automatic login?"
        ),
        @user,
        new
      )

      Disable() if @used && Popup.YesNo(question)
      @used
    end

    # Check if autologin is supported with the currently selected or installed
    # packages.
    #
    # @return Boolean
    def supported?
      supported = DISPLAY_MANAGERS.any? { |dm| Package.Available(dm) }

      if supported
        log.info("Autologin is supported")
      else
        log.info("Autologin is not supported: No package provides any of #{DISPLAY_MANAGERS}")
      end

      supported
    end

    publish :variable => :user, :type => "string"
    publish :variable => :pw_less, :type => "boolean"
    publish :variable => :used, :type => "boolean"
    publish :variable => :modified, :type => "boolean"
    publish :function => :Read, :type => "boolean ()"
    publish :function => :Write, :type => "boolean (boolean)"
    publish :function => :Disable, :type => "void ()"
    publish :function => :Use, :type => "void (boolean)"
    publish :function => :supported?, :type => "boolean ()"
    publish :function => :DisableAndWrite, :type => "boolean (boolean)"
    publish :function => :AskForDisabling, :type => "boolean (string)"
  end

  Autologin = AutologinClass.new
  Autologin.main
end
