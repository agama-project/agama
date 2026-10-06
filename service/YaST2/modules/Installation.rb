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
# File:
#  Installation.ycp
#
# Module:
#  Installation
#
# Summary:
#  provide installation related information
#
# Author:
#  Klaus Kaempf <kkaempf@suse.de>
#  Lukas Ocilka <locilka@suse.cz>
#
# $Id$
require "yast"
require "fileutils"

module Yast
  class InstallationClass < Module
    # usual mountpoint for the source (i.e. CD)
    SOURCEDIR = "/run/YaST2/mount".freeze

    def main
      Yast.import "Stage"
      Yast.import "Linuxrc"
      Yast.import "Directory"

      # current scr handle
      # used in installation.ycp and inst_finish.ycp
      @scr_handle = 0

      # Usual mountpoint for the destination.
      @destdir = "/"

      # Usual mountpoint for the destination seen from the (default) SCR.  It's
      # set to "/" when the SCR is restarted in the target system.
      @scr_destdir = "/"

      @yast2dir = "/var/lib/YaST2"

      @mountlog = Ops.add(Directory.logdir, "/y2logMount")

      # encoding for the language
      @encoding = "ISO-8859-1"

      # remember if user was informed about text fallback
      # see general/installation.ycp
      @shown_text_mode_warning = false

      # remember that hardware has already been probed
      @probing_done = false

      @_text_fallback = nil
      @_no_x11 = nil

      # --> configuration from installation.ycp

      # Second stage installation has been aborted by user
      @file_inst_aborted = Ops.add(Directory.vardir, "/second_stage_aborted")

      # Second stage installation has been killed or just somehow failed
      @file_inst_failed = Ops.add(Directory.vardir, "/second_stage_failed")

      # Installation scripts (YaST) will be started at boot time
      @run_yast_at_boot = Ops.add(Directory.vardir, "/runme_at_boot")

      # The current installation step (useful for restarting YaST or rebooting)
      @current_step = Ops.add(Directory.vardir, "/step")

      # Update instead on New Installation
      @file_update_mode = Ops.add(Directory.vardir, "/update_mode")

      # Live installation instead on standard Installation
      @file_live_install_mode = Ops.add(Directory.vardir, "/live_install_mode")

      # Second stage installation (Stage::cont())
      @restart_data_file = Ops.add(Directory.vardir, "/continue_installation")

      # Computer has been rebooted
      @reboot_file = Ops.add(Directory.vardir, "/reboot")

      # Just restarting YaST (handled by startup scripts)
      @restart_file = Ops.add(Directory.vardir, "/restart_yast")

      # Running YaST in upgrade mode (initiated from running system)
      @run_update_file = Ops.add(Directory.vardir, "/run_system_update")

      # A flag to know if current installation is restarting skipping dialogs or
      # recovering values until the step just before the yast restart was done
      @restarting_file = Ops.add(Directory.vardir, "/restarting_yast")

      # Network should be started before the installation starts (continues)
      # bugzilla #258742
      #
      # File contains a YCP map with services and their status when Installation was about to reboot
      # e.g., $[ "network" : true, "portmap" : false, "SuSEfirewall2" : true ]
      @reboot_net_settings = Ops.add(
        Directory.vardir,
        "/reboot_network_settings"
      )

      # <-- configuration from installation.ycp

      # Initial settings for variables used in Installation Mode dialog
      # These settings needs to be persistent during the installation
      @add_on_selected = false
      # Preselected by default
      # bugzilla #299207
      @productsources_selected = true

      #
      # variables to store data of the installation clients
      #

      # inst_license

      # The license has already been accepted, the respectiev radio button
      # can be preselected
      @license_accepted = false

      # These maps are used by several YaST modules.

      # Version of the targetsystem (currently installed one).
      #
      #
      # **Structure:**
      #
      #     $[
      #        "name" : (string) "openSUSE",
      #        "version" : (string) "10.1",
      #        "nameandversion" : (string) "openSUSE 10.1",
      #        "major" : (integer) 10,
      #        "minor" : (integer) 1,
      #      ]
      @installedVersion = {}

      # Version of system to update to (will be installed, or is
      # just being installed).
      #
      #
      # **Structure:**
      #
      #     $[
      #        "name" : (string) "openSUSE",
      #        "version" : (string) "11.0",
      #        "nameandversion" : (string) "openSUSE 11.0",
      #        "major" : (integer) 11,
      #        "minor" : (integer) 0,
      #      ]
      @updateVersion = {}

      # Global variables moved here to break dependencies
      # on yast2-update
      @update_backup_modified = true

      @update_backup_sysconfig = true

      @update_remove_old_backups = false

      @update_backup_path = "/var/adm/backup"

      # dirinstall-related

      @dirinstall_installing_into_dir = false

      @dirinstall_target = "/var/tmp/dirinstall"

      @dirinstall_target_time = 0

      # image-based installation

      # Installation is performed form image(s)
      @image_installation = false

      # Installation is performed only from image(s), no additional
      # RPM (de)installation
      @image_only = false
      Installation()
    end

    #---------------------------------------------------------------
    # constructor

    def Installation
      # get setup data from linuxrc
      # check setup/descr/info for CD type

      if Stage.cont
        @destdir = "/"
        @scr_destdir = "/"
      elsif Stage.initial
        @destdir = "/mnt"
        @scr_destdir = "/mnt"
      elsif WFM.scr_chrooted?
        @destdir = WFM.scr_root
        @scr_destdir = WFM.scr_root
      end

      nil
    end

    def Initialize
      arg_count = Builtins.size(WFM.Args)
      arg_no = 0

      @_text_fallback = false
      @_no_x11 = false

      while Ops.less_than(arg_no, arg_count)
        Builtins.y2debug("option #%1: %2", arg_no, WFM.Args(arg_no))

        case WFM.Args(arg_no)
        when "text_fallback"
          @_text_fallback = true
        when "no_x11"
          @_no_x11 = true
        else
          Builtins.y2milestone("skipping unknown option %1", WFM.Args(arg_no))
        end
        arg_no = Ops.add(arg_no, 1)
      end

      nil
    end

    # how we were booted (the type of the installation medium)
    # /etc/install.inf: InstMode
    def boot
      Linuxrc.InstallInf("InstMode") || "cd"
    end

    def restart!
      ::FileUtils.touch(@restart_file)
      ::FileUtils.touch(@restarting_file)
      :restart_yast
    end

    def restarting?
      ::File.exist?(@restarting_file)
    end

    def finish_restarting!
      ::FileUtils.remove_file(@restarting_file, true) if restarting?
    end

    # run X11 configuration after inital boot
    # this is false in case of:
    # installation via serial console
    # installation via ssh
    # installation via vnc
    #
    # Also see Arch::x11_setup_needed ().
    def x11_setup_needed
      !(Linuxrc.serial_console || Linuxrc.vnc || Linuxrc.usessh)
    end

    # no resources/packages for X11
    def text_fallback
      Initialize() if @_text_fallback.nil?
      @_text_fallback
    end

    # somehow, no X11 was started
    # no x11 or not enough memory for qt
    def no_x11
      Initialize() if @_no_x11.nil?
      @_no_x11
    end

    # Gets directory suitable for source mount. It ensures that directory exists.
    # It does not ensure unmounting previous content.
    #
    # @return [String]
    def sourcedir
      ::FileUtils.mkdir_p(SOURCEDIR) unless ::File.exist?(SOURCEDIR)

      SOURCEDIR
    end

    publish variable: :scr_handle, type: "integer"
    publish variable: :destdir, type: "string"
    publish variable: :scr_destdir, type: "string"
    publish variable: :yast2dir, type: "string"
    publish variable: :mountlog, type: "string"
    publish variable: :encoding, type: "string"
    publish variable: :shown_text_mode_warning, type: "boolean"
    publish variable: :probing_done, type: "boolean"
    publish variable: :file_inst_aborted, type: "string"
    publish variable: :file_inst_failed, type: "string"
    publish variable: :run_yast_at_boot, type: "string"
    publish variable: :current_step, type: "string"
    publish variable: :file_update_mode, type: "string"
    publish variable: :file_live_install_mode, type: "string"
    publish variable: :restart_data_file, type: "string"
    publish variable: :reboot_file, type: "string"
    publish variable: :restart_file, type: "string"
    publish variable: :run_update_file, type: "string"
    publish variable: :reboot_net_settings, type: "string"
    publish variable: :add_on_selected, type: "boolean"
    publish variable: :productsources_selected, type: "boolean"
    publish variable: :license_accepted, type: "boolean"
    publish variable: :installedVersion, type: "map <string, any>"
    publish variable: :updateVersion, type: "map <string, any>"
    publish variable: :update_backup_modified, type: "boolean"
    publish variable: :update_backup_sysconfig, type: "boolean"
    publish variable: :update_remove_old_backups, type: "boolean"
    publish variable: :update_backup_path, type: "string"
    publish variable: :dirinstall_installing_into_dir, type: "boolean"
    publish variable: :dirinstall_target, type: "string"
    publish variable: :dirinstall_target_time, type: "integer"
    publish variable: :image_installation, type: "boolean"
    publish variable: :image_only, type: "boolean"
    publish function: :Installation, type: "void ()"
    publish function: :boot, type: "string ()"
    publish function: :x11_setup_needed, type: "boolean ()"
    publish function: :text_fallback, type: "boolean ()"
    publish function: :no_x11, type: "boolean ()"
    publish function: :sourcedir, type: "string ()"
  end

  Installation = InstallationClass.new
  Installation.main
end
