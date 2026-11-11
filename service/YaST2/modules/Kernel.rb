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
# File:  modules/Kernel.ycp
# Package:  Installation
# Summary:  Kernel related functions and data
# Authors:  Klaus Kaempf <kkaempf@suse.de>
#    Arvin Schnell <arvin@suse.de>
#
# $Id$
#
# <ul>
# <li>determine kernel rpm</li>
# <li>determine flags</li>
# <li>determine hard reboot</li>
# </ul>
require "yast"

module Yast
  class KernelClass < Module
    include Yast::Logger

    # default configuration file for Kernel modules loaded on boot
    MODULES_CONF_FILE = "yast.conf".freeze

    # directory where configuration for Kernel modules loaded on boot is stored
    MODULES_DIR = "/etc/modules-load.d/".freeze

    # SCR path for reading/writing Kernel modules
    MODULES_SCR = Path.new(".kernel_modules_to_load")

    def main
      Yast.import "Arch"
      Yast.import "Mode"
      Yast.import "PackagesProposal"
      Yast.import "Popup"
      Yast.import "Stage"
      Yast.import "FileUtils"
      Yast.import "ProductFeatures"

      textdomain "base"

      # kernel packages and binary

      @kernel_probed = false

      # the name of the kernel binary below '/boot'.
      @binary = "vmlinuz"

      # a list kernels to be installed.
      @kernel_packages = []

      # the final kernel to be installed after verification and
      # availability checking
      @final_kernel = ""

      # kernel commandline

      @cmdline_parsed = false

      # string the kernel vga paramter
      @vgaType = ""

      # if "suse_update" given in cmdline
      @suse_update = false

      # string the kernel command line
      # Don't write it directly, @see: AddCmdLine()
      @cmdLine = ""

      # modules loaded on boot

      # Kernel modules configured to be loaded on boot
      @modules_to_load = nil
      @modules_to_load_old = nil

      # kernel was reinstalled

      #  A flag to indicate if a popup informing about the kernel change should be displayed
      @inform_about_kernel_change = false

      # other variables

      # fallback map for kernel
      @fallbacks = {
        "kernel-pae"       => "kernel-default",
        "kernel-desktop"   => "kernel-default",
        # fallback for PPC (#302246)
        "kernel-iseries64" => "kernel-ppc64"
      }
    end

    #---------------------------------------------------------------
    # local defines

    # Hide passwords in command line option string
    # @param [String] in input string
    # @return [String] outpit string
    def HidePasswords(in_)
      ret = ""

      if in_.nil?
        ret = nil
      else
        parts = Builtins.splitstring(in_, " ")

        first = true
        Builtins.foreach(parts) do |p|
          cmdopt = p
          if Builtins.regexpmatch(p, "^INST_PASSWORD=")
            cmdopt = "INST_PASSWORD=******"
          elsif Builtins.regexpmatch(p, "^FTPPASSWORD=")
            cmdopt = "FTPPASSWORD=********"
          end
          if first
            first = false
          else
            ret = Ops.add(ret, " ")
          end
          ret = Ops.add(ret, cmdopt)
        end
      end

      ret
    end

    # AddCmdLine ()
    # @param [String] name of parameter
    # @param  string  args of parameter
    #
    # add "name=args" to kernel boot parameters
    # add just "name" if args = ""
    # @see #cmdLine
    def AddCmdLine(name, arg)
      ParseInstallationKernelCmdline() if !@cmdline_parsed
      @cmdLine = Ops.add(Ops.add(@cmdLine, " "), name)
      @cmdLine = Ops.add(Ops.add(@cmdLine, "="), arg) if arg != ""
      Builtins.y2milestone("cmdLine '%1'", HidePasswords(@cmdLine))
      nil
    end

    # Parse the installation-time kernel command line
    # - the `vga` parameter is separated, see {#GetVgaType}
    # - some specific parameters are ignored
    # - the rest is passed on to @cmdLine for which {#GetCmdLine} is a reader
    # @return [void]
    def ParseInstallationKernelCmdline
      @cmdline_parsed = true
      return if !(Stage.initial || Stage.cont)

      # Check if /etc/install.inf exists
      tmp = if !SCR.Dir(path(".etc.install_inf")).empty?
        SCR.Read(path(".etc.install_inf.Cmdline")).to_s
      # else check if there is agama specific filtered kernel options
      elsif ::File.exist?("/run/agama/cmdline.d/kernel.conf")
        WFM.Read(path(".local.string"), "/run/agama/cmdline.d/kernel.conf").to_s
      else
        # not using dedicated agent in order to use the same parser for cmdline
        # independently on whether it comes from /proc/cmdline or /etc/install.inf
        # use local read as it does not make sense to depend on binding it to chroot
        WFM.Read(path(".local.string"), "/proc/cmdline").to_s
      end

      Builtins.y2milestone(
        "cmdline from install.inf is: %1",
        HidePasswords(tmp)
      )
      if !tmp.nil?
        # extract extra boot parameters given in installation
        ExtractCmdlineParameters(tmp)
      end

      nil
    end

    # Get the vga= kernel parameter
    # @return [String] the vga= kernel parameter
    def GetVgaType
      ParseInstallationKernelCmdline() if !@cmdline_parsed
      @vgaType
    end

    # Get the kernel command line
    # @return [String] the command line
    def GetCmdLine
      ParseInstallationKernelCmdline() if !@cmdline_parsed
      @cmdLine
    end

    #---------------------------------------------------------------

    # functions related to kernel's modules loaded on boot

    # Resets the internal cache
    def reset_modules_to_load
      @modules_to_load = nil
    end

    # Returns hash of kernel modules to be loaded on boot
    # - key is the config file
    # - value is list of modules in that particular file
    #
    # @return [Hash] of modules
    def modules_to_load
      read_modules_to_load if @modules_to_load.nil?

      @modules_to_load
    end

    # Returns whether the given kernel module is included in list of modules
    # to be loaded on boot
    #
    # @param [String] kernel module
    # @return [Boolean] whether the given module is in the list
    def module_to_be_loaded?(kernel_module)
      modules_to_load.values.any? { |m| m.include?(kernel_module) }
    end

    # Add a kernel module to the list of modules to load after boot
    # @param string module name
    def AddModuleToLoad(name)
      Builtins.y2milestone("Adding module to be loaded at boot: %1", name)

      @modules_to_load[MODULES_CONF_FILE] << name unless module_to_be_loaded?(name)
    end

    # Remove a kernel module from the list of modules to load after boot
    # @param [String] name string the name of the module
    def RemoveModuleToLoad(name)
      modules_to_load

      return true unless module_to_be_loaded?(name)

      Builtins.y2milestone("Removing module to be loaded at boot: %1", name)
      @modules_to_load.each do |_key, val|
        val.delete(name)
      end
    end

    # SaveModuleToLoad ()
    # save the sysconfig variable to /etc/modules-load.d/*.conf configuration files
    # @return [Boolean] true on success
    def SaveModulesToLoad
      modules_to_load

      unless FileUtils.Exists(MODULES_DIR)
        log.warn "Directory #{MODULES_DIR} does not exist, creating"

        unless SCR::Execute(path(".target.mkdir"), MODULES_DIR)
          log.error "Cannot create directory #{MODULES_DIR}"
          return false
        end
      end

      success = true

      @modules_to_load.each do |file, modules|
        # The content hasn't changed
        next if modules.sort == @modules_to_load_old[file].sort

        if !register_modules_agent(file)
          Builtins.y2error("Cannot register new SCR agent for #{file_path} file")
          success = false
          next
        end

        SCR::Write(MODULES_SCR, modules)
        SCR.UnregisterAgent(MODULES_SCR)
      end

      success
    end

    # kernel was reinstalled stuff

    #  Get inform_about_kernel_change.
    def GetInformAboutKernelChange
      @inform_about_kernel_change
    end

    #  Display popup about new kernel that was installed
    def InformAboutKernelChange
      if GetInformAboutKernelChange()
        # inform the user that he/she has to reboot to activate new kernel
        Popup.Message(_("Reboot your system\nto activate the new kernel.\n"))
      end
      @inform_about_kernel_change
    end

    # gets if YaST should propose hibernation aka Kernel resume parameter
    # @return [Boolean] true if hibernation should be proposed
    def propose_hibernation?
      # Do not support s390. (jsc#SLE-6926)
      return false unless Arch.i386 || Arch.x86_64

      true
    end

    publish function: :AddCmdLine, type: "void (string, string)"
    publish function: :GetVgaType, type: "string ()"
    publish function: :GetCmdLine, type: "string ()"
    publish function: :GetInformAboutKernelChange, type: "boolean ()"
    publish function: :InformAboutKernelChange, type: "boolean ()"

    # Handling for Kernel modules loaded on boot
    publish function: :AddModuleToLoad, type: "void (string)"
    publish function: :RemoveModuleToLoad, type: "void (string)"
    publish function: :SaveModulesToLoad, type: "boolean ()"
    publish function: :reset_modules_to_load, type: "void ()"
    publish function: :modules_to_load, type: "map <string, list> ()"

  private

    # Registers new SCR agent for a file given as parameter
    #
    # @param [String] file name in directory defined in MODULES_DIR
    def register_modules_agent(file_name)
      full_path = File.join(MODULES_DIR, file_name)

      SCR::RegisterAgent(
        MODULES_SCR,
        term(
          :ag_anyagent,
          term(
            :Description,
            term(
              :File,
              full_path
            ),
            # Comments
            "#\n",
            # Read-only?
            false,
            term(
              :List,
              term(:String, "^\n"),
              "\n"
            )
          )
        )
      )
    end

    # Loads the current configuration of Kernel modules
    # to be loaded on boot to the internal cache
    #
    # @return [Hash] with the configuration
    def read_modules_to_load
      @modules_to_load = { MODULES_CONF_FILE => [] }

      if FileUtils.Exists(MODULES_DIR)
        config_files = SCR::Read(path(".target.dir"), MODULES_DIR)
      else
        log.error "Cannot read modules to load on boot, directory #{MODULES_DIR} does not exist"
      end

      if config_files.nil?
        log.error "Cannot read config files from #{MODULES_DIR}"
        config_files = []
      end

      config_files.each do |file_name|
        next unless file_name =~ /^.+\.conf$/

        if !register_modules_agent(file_name)
          log.error "Cannot register new SCR agent for #{file_path} file"
          next
        end

        @modules_to_load[file_name] = SCR::Read(MODULES_SCR)
        SCR.UnregisterAgent(MODULES_SCR)
      end

      @modules_to_load_old = deep_copy(@modules_to_load)
      @modules_to_load
    end

    # @param [String] line to parse
    # @return [Array<String>] line splitted to individual params, respecting quotes there
    def list_of_params(line)
      line = line.delete("\n")
      cmdlist = []
      parse_index = 0
      in_quotes = false
      after_backslash = false
      current_param = ""
      while parse_index < line.size
        current_char = line[parse_index]
        in_quotes = !in_quotes if current_char == "\"" && !after_backslash
        if current_char == " " && !in_quotes
          cmdlist << current_param
          current_param = ""
        else
          current_param << current_char
        end
        # For the in-kernel parser, a backslash is a regular character.
        # For this parser, it is a "stupid escape": the first backslash
        # does not escape the second one.
        after_backslash = current_char == "\\"
        parse_index += 1
      end
      cmdlist << current_param
    end

    S390_ZIPL_ARGS = ["User", "init", "ramdisk_size"].freeze
    # constructs list of keys to discard from command line
    # @param [Array<String>] list of command line entries
    # @return [Array<String>] list of keys to discard
    def params_to_discard(cmdlist)
      discardlist = []
      # some systems (pseries) can autodetect the serial console
      if cmdlist.include?("AUTOCONSOLE")
        # NOTE: `console` is the only value that depends on the input argument.
        discardlist << "console"
        discardlist << "AUTOCONSOLE"
      end

      # add special key filtering for s390
      # bnc#462276 Extraneous parameters in /etc/zipl.conf from the installer
      discardlist.concat(S390_ZIPL_ARGS) if Arch.s390

      # get rid of live-installer-specific parameters
      discardlist.push("initrd", "ramdisk_size", "ramdisk_blocksize", "liveinstall", "splash", "quiet", "lang") if Mode.live_installation

      # TODO: is it still needed?
      # backdoor to re-enable update on UL/SLES
      if cmdlist.include?("suse_update")
        discardlist << "suse_update"
        @suse_update = true
      end

      discardlist
    end

    # @param  [String] cmdline to parse
    #
    # @return  [void]
    # Filters out yast2 specific boot parameters and sets
    # Parameters to the important cmdline parts.
    def ExtractCmdlineParameters(line)
      return unless line

      # list of parameters to be discarded (yast internals)
      cmdlist = list_of_params(line)

      discardlist = params_to_discard(cmdlist)

      cmdlist.each do |parameter|
        next unless parameter
        next if parameter.empty?

        key, value = parameter.split("=", 2)
        next unless key

        value ||= ""
        next if discardlist.include?(key)

        if key == "vga"
          if value.match?(/^(((0x)?\h+)|(ask)|(ext)|(normal))$/)
            @vgaType = value
          else
            Builtins.y2warning("Incorrect VGA kernel parameter: %1", value)
          end
        else
          AddCmdLine(key, value)
        end
      end

      nil
    end
  end

  Kernel = KernelClass.new
  Kernel.main
end
