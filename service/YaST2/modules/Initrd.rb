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
#      modules/Initrd.ycp
#
# Module:
#      Bootloader installation and configuration
#
# Summary:
#      functions for initial ramdisk setup and creation
#
# Authors:
#      Jiri Srain <jsrain@suse.cz>
#
# $Id$
#
require "yast"
require "shellwords"

module Yast
  class InitrdClass < Module
    include Yast::Logger

    def main
      Yast.import "UI"

      Yast.import "Arch"
      Yast.import "Label"
      Yast.import "Misc"
      Yast.import "Mode"
      Yast.import "Stage"
      Yast.import "Directory"

      textdomain "base"

      # module variables

      # List of modules for Initrd
      @modules = []
      # For each of modules - true if should be inserted to initrd, false
      # otherwise. Used to keep order from first-stage installation
      @modules_to_store = {}
      # List of modules that were in sysconfig file when reading settings
      @read_modules = []
      # map of settings for modules for being contained in initrd
      @modules_settings = {}
      # true if settings were changed and initrd needs to be rebuilt,
      # false otherwise
      @changed = false
      # true if settings were already read, flase otherwise
      @was_read = false
      # List of modules which should be not added/removed to/from initrd
      @modules_to_skip = nil

      # List of fallback vga modes to be used when hwinfo --framebuffer
      # doesn't return any value
      @known_modes = [
        { "color" => 8, "height" => 200, "mode" => 816, "width" => 320 },
        { "color" => 16, "height" => 200, "mode" => 782, "width" => 320 },
        { "color" => 24, "height" => 200, "mode" => 783, "width" => 320 },
        { "color" => 8, "height" => 240, "mode" => 820, "width" => 320 },
        { "color" => 16, "height" => 240, "mode" => 821, "width" => 320 },
        { "color" => 24, "height" => 240, "mode" => 822, "width" => 320 },
        { "color" => 8, "height" => 400, "mode" => 817, "width" => 320 },
        { "color" => 16, "height" => 400, "mode" => 818, "width" => 320 },
        { "color" => 24, "height" => 400, "mode" => 819, "width" => 320 },
        { "color" => 8, "height" => 400, "mode" => 768, "width" => 640 },
        { "color" => 16, "height" => 400, "mode" => 829, "width" => 640 },
        { "color" => 24, "height" => 400, "mode" => 830, "width" => 640 },
        { "color" => 8, "height" => 480, "mode" => 769, "width" => 640 },
        { "color" => 16, "height" => 480, "mode" => 785, "width" => 640 },
        { "color" => 24, "height" => 480, "mode" => 786, "width" => 640 },
        { "color" => 8, "height" => 600, "mode" => 771, "width" => 800 },
        { "color" => 16, "height" => 600, "mode" => 788, "width" => 800 },
        { "color" => 24, "height" => 600, "mode" => 789, "width" => 800 },
        { "color" => 8, "height" => 768, "mode" => 773, "width" => 1024 },
        { "color" => 16, "height" => 768, "mode" => 791, "width" => 1024 },
        { "color" => 24, "height" => 768, "mode" => 792, "width" => 1024 },
        { "color" => 8, "height" => 1024, "mode" => 775, "width" => 1280 },
        { "color" => 16, "height" => 1024, "mode" => 794, "width" => 1280 },
        { "color" => 24, "height" => 1024, "mode" => 795, "width" => 1280 },
        { "color" => 8, "height" => 1200, "mode" => 837, "width" => 1600 },
        { "color" => 16, "height" => 1200, "mode" => 838, "width" => 1600 }
      ]
    end

    # module functions

    # read seettings from sysconfig
    # @return true on success
    def Read
      Reset()
      @was_read = true
      return true if Stage.initial && !Mode.update # nothing to read

      # test for missing files - probably an error - should never occur
      if SCR.Read(path(".target.size"), "/etc/sysconfig/kernel") == -1
        Builtins.y2error("sysconfig/kernel not found")
        return false
      end

      s_modnames = Convert.to_string(
        SCR.Read(path(".sysconfig.kernel.INITRD_MODULES"))
      )
      s_modnames = "" if s_modnames.nil?
      @modules = Builtins.splitstring(s_modnames, " ")
      @modules = Builtins.filter(@modules) { |m| m != "" }
      Builtins.foreach(@modules) do |m|
        Ops.set(@modules_settings, m, {})
        Ops.set(@modules_to_store, m, true)
      end
      @read_modules = deep_copy(@modules)
      true
    end

    # write settings to sysconfig, rebuild initrd images
    # @return true on success
    def Write
      Read() if !(@was_read || Mode.config)
      Update() if Mode.update
      Builtins.y2milestone(
        "Initrd::Write called, changed: %1, list: %2",
        @changed,
        ListModules()
      )
      # check whether it is neccessary to write initrd
      return true if !@changed && Mode.normal

      modules_written = false

      Builtins.foreach(@modules_settings) do |modname, optmap|
        next if !Ops.is_map?(optmap)

        if Ops.greater_than(Builtins.size(Convert.to_map(optmap)), 0)
          # write options to /etc/modules.conf
          p = Builtins.add(path(".modules.options"), modname)
          SCR.Write(p, Convert.to_map(optmap))
          modules_written = true
        end
      end

      SCR.Write(path(".modules"), nil) if modules_written

      # check modules that could be added during module's run (bug 26717)
      if SCR.Read(path(".target.size"), "/etc/sysconfig/kernel") != -1
        s_modnames = Convert.to_string(
          SCR.Read(path(".sysconfig.kernel.INITRD_MODULES"))
        )
        s_modnames = "" if s_modnames.nil?
        s_modules = Builtins.splitstring(s_modnames, " ")
        s_modules = Builtins.filter(s_modules) do |m|
          !Builtins.contains(@read_modules, m)
        end
        s_modules = Builtins.filter(s_modules) do |m|
          !Builtins.contains(@modules, m)
        end
        Builtins.y2milestone(
          "Modules %1 were added to initrd not using Initrd module",
          s_modules
        )
        Builtins.foreach(s_modules) { |m| AddModule(m, "") }
      end

      # save sysconfig
      SCR.Execute(
        path(".target.bash"),
        "/usr/bin/touch /etc/sysconfig/bootloader"
      )

      # FIXME: the modules are not written, remove them completely,
      # for now just log them without any change
      mods = Builtins.mergestring(ListModules(), " ")
      log.warn "Ignoring configured kernel modules: #{mods}" unless mods.empty?

      if SCR.Execute(
        path(".target.bash"),
        Builtins.sformat(
          "/usr/bin/dracut --force --regenerate-all >> %1 2>&1",
          File.join(Directory.logdir, "y2logmkinitrd").shellescape
        )
      ) != 0
        log = Convert.to_string(
          SCR.Read(
            path(".target.string"),
            Ops.add(Directory.logdir, "/y2logmkinitrd")
          )
        )
        # error report
        errorWithLogPopup(_("An error occurred during initrd creation."), log)
      end
      @changed = false
      true
    end

    def VgaModes
      all_modes = Convert.convert(
        SCR.Read(path(".probe.framebuffer")),
        from: "any",
        to:   "list <map>"
      )
      if all_modes.nil? || Builtins.size(all_modes) == 0
        Builtins.y2warning("Probing VGA modes failed, using fallback list")
        all_modes = deep_copy(@known_modes)
      end
      deep_copy(all_modes)
    end

    publish variable: :changed, type: "boolean"
    publish function: :Read, type: "boolean ()"
    publish function: :Write, type: "boolean ()"
    publish function: :VgaModes, type: "list <map> ()"

  private

    # Display error popup with log
    # FIXME: this is copy-paste from ../routines/popups.ycp
    # @param [String] header string error header
    # @param [String] log string logfile contents
    def errorWithLogPopup(header, log)
      log = "" if log.nil?
      text = RichText(Opt(:plainText), log)
      UI.OpenDialog(
        Opt(:decorated),
        VBox(
          HSpacing(75),
          # heading
          Heading(header),
          text, # e.g. `Richtext()
          ButtonBox(
            PushButton(Id(:ok_help), Opt(:default, :okButton), Label.OKButton)
          )
        )
      )

      UI.SetFocus(Id(:ok_help))
      UI.UserInput
      UI.CloseDialog

      nil
    end

    # Get the list of modules which don't belong to initrd
    # Initialize the list if was not initialized before according to the
    # architecture
    # @return a list of modules
    def getModulesToSkip
      if @modules_to_skip.nil?
        # usb and cdrom modules dont belong to initrd,
        # they're loaded by hotplug
        @modules_to_skip = [
          "input",
          "hid",
          "keybdev",
          "mousedev",
          "cdrom",
          "ide-cd",
          "sr_mod",
          "xfs_support",
          "xfs_dmapi",
          "ide-scsi"
        ]
        # some other modules don't belong to initrd on PPC
        if Arch.ppc
          ppc_modules_to_skip = ["reiserfs", "ext3", "jbd"]
          @modules_to_skip = Convert.convert(
            Builtins.merge(@modules_to_skip, ppc_modules_to_skip),
            from: "list",
            to:   "list <string>"
          )
        end
        # currently no disk controller modules are known to fail in initrd (bnc#719696), list removed
      end
      deep_copy(@modules_to_skip)
    end

    # reset settings to empty list of modules
    def Reset
      Builtins.y2milestone("Reseting initrd settings")
      @was_read = false
      @changed = false
      @modules = []
      @modules_to_store = {}
      @read_modules = []
      @modules_settings = {}

      nil
    end

    # List modules included in initrd
    # @return [Array] of strings with modulenames
    def ListModules
      Read() if !(@was_read || Mode.config)
      Builtins.filter(@modules) { |m| Ops.get(@modules_to_store, m, false) }
    end

    # add module to ramdisk
    # @param [String] modname name of module
    # @param [String] modargs arguments to be passes to module
    def AddModule(modname, modargs)
      log.warn "Initrd.AddModule() is deprecated, do not use (sysconfig.kernel.INITRD_MODULES " \
               "is not written anymore, see bnc#895084)"

      if Stage.initial && Builtins.size(@modules) == 0
        tmp_mods = Convert.to_string(
          SCR.Read(path(".etc.install_inf.InitrdModules"))
        )
        @modules = Builtins.splitstring(tmp_mods, " ") if !tmp_mods.nil? && tmp_mods != ""
        @was_read = true
      elsif !(@was_read || Mode.config)
        Read()
      end
      if !Builtins.contains(ListModules(), modname) ||
          (modname == "aic7xxx" &&
              !Builtins.contains(ListModules(), "aic7xxx_old")) ||
          (modname == "aic7xxx_old" &&
              !Builtins.contains(ListModules(), "aic7xxx"))
        if Builtins.contains(getModulesToSkip, modname)
          Builtins.y2milestone(
            "Module %1 is in list of modules not to insert to initrd",
            modname
          )
        else
          @changed = true
          Ops.set(@modules_to_store, modname, true)
          Ops.set(@modules_settings, modname, Misc.SplitOptions(modargs, {}))
          if Builtins.contains(@modules, modname)
            Builtins.y2milestone(
              "Module %1 from initial list added to initrd, now contains %2",
              modname,
              ListModules()
            )
          else
            @modules = Builtins.add(@modules, modname)
            Builtins.y2milestone(
              "Module %1 added to initrd, now contains %2",
              modname,
              ListModules()
            )
          end
        end
      else
        Builtins.y2milestone("Module %1 already present in initrd", modname)
      end
      nil
    end

    # Update read settings to new version of configuration files
    def Update
      # add other required changes here
      @modules = Builtins.filter(@modules) do |m|
        !Builtins.contains(getModulesToSkip, m)
      end
      @modules_settings = Builtins.filter(@modules_settings) do |k, _v|
        !Builtins.contains(getModulesToSkip, k)
      end
      @changed = true

      nil
    end
  end

  Initrd = InitrdClass.new
  Initrd.main
end
