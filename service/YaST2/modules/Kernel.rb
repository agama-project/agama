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
      Yast.import "Pkg"

      Yast.import "Arch"
      Yast.import "Mode"
      Yast.import "Linuxrc"
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

    # Simple check any graphical desktop was selected
    def IsGraphicalDesktop
      # Get patterns set for installation during desktop selection
      # (see DefaultDesktop::packages_proposal_ID_patterns for the first argument)
      pt = PackagesProposal.GetResolvables("DefaultDesktopPatterns", :pattern)
      Builtins.contains(pt, "x11")
    end

    #---------------------------------------------------------------

    # specifies limit of memory which can be addressed without pae on 32-bit system
    PAE_LIMIT = 3_221_225_472
    # select kernel depending on architecture and system type.
    #
    # @return [void]
    def ProbeKernel
      kernel_desktop_exists = ((Mode.normal || Mode.repair) &&
        Pkg.PkgInstalled("kernel-desktop")) ||
        Pkg.PkgAvailable("kernel-desktop")
      Builtins.y2milestone(
        "Desktop kernel available: %1",
        kernel_desktop_exists
      )

      @kernel_packages = ["kernel-default"]

      # add Xen paravirtualized drivers to a full virtualized host
      xen = Convert.to_boolean(SCR.Read(path(".probe.is_xen")))
      if xen.nil?
        Builtins.y2warning("XEN detection failed, assuming XEN is NOT running")
        xen = false
      end

      Builtins.y2milestone("Detected XEN: %1", xen)

      if Arch.is_uml
        Builtins.y2milestone("ProbeKernel: UML")
        @kernel_packages = ["kernel-um"]
      elsif Arch.is_xen
        # kernel-xen contains PAE kernel (since oS11.0)
        @kernel_packages = ["kernel-xen"]
      elsif Arch.i386
        # get flags from WFM /proc/cpuinfo (for pae and tsc tests below)

        cpuinfo_flags = Convert.to_string(
          SCR.Read(path(".proc.cpuinfo.value.\"0\".\"flags\""))
        ) # check only first processor
        cpuflags = []

        # bugzilla #303842
        if cpuinfo_flags
          cpuflags = cpuinfo_flags.empty? ? [] : cpuinfo_flags.split
        else
          Builtins.y2error("Cannot read cpuflags")
          Builtins.y2milestone(
            "Mounted: %1",
            SCR.Execute(path(".target.bash_output"), "/usr/bin/mount -l")
          )
        end

        # check for "roughly" >= 4GB memory (see bug #40729)
        memories = Convert.to_list(SCR.Read(path(".probe.memory")))
        memsize = Ops.get_integer(
          memories,
          [0, "resource", "phys_mem", 0, "range"],
          0
        )
        Builtins.y2milestone("Physical memory %1", memsize)

        # for memory > 4GB and PAE support we install kernel-pae,
        # PAE kernel is needed if NX flag exists as well (bnc#467328)
        if (Ops.greater_or_equal(memsize, PAE_LIMIT) ||
            Builtins.contains(cpuflags, "nx")) &&
            Builtins.contains(cpuflags, "pae")
          Builtins.y2milestone("Kernel switch: PAE detected")
          if kernel_desktop_exists && IsGraphicalDesktop()
            @kernel_packages = ["kernel-desktop"]

            # add PV drivers
            if xen
              Builtins.y2milestone("Adding Xen PV drivers: xen-kmp-desktop")
              @kernel_packages = Builtins.add(
                @kernel_packages,
                "xen-kmp-desktop"
              )
            end
          else
            @kernel_packages = ["kernel-pae"]

            # add PV drivers
            if xen
              Builtins.y2milestone("Adding Xen PV drivers: xen-kmp-pae")
              @kernel_packages = Builtins.add(@kernel_packages, "xen-kmp-pae")
            end
          end
        # add PV drivers
        elsif xen
          Builtins.y2milestone("Adding Xen PV drivers: xen-kmp-default")
          @kernel_packages = Builtins.add(@kernel_packages, "xen-kmp-default")
        end
      elsif Arch.x86_64
        if kernel_desktop_exists && IsGraphicalDesktop()
          @kernel_packages = ["kernel-desktop"]
          if xen
            Builtins.y2milestone("Adding Xen PV drivers: xen-kmp-desktop")
            @kernel_packages = Builtins.add(@kernel_packages, "xen-kmp-desktop")
          end
        elsif xen
          Builtins.y2milestone("Adding Xen PV drivers: xen-kmp-default")
          @kernel_packages = Builtins.add(@kernel_packages, "xen-kmp-default")
        end
      elsif Arch.ppc
        @binary = "vmlinux"

        @kernel_packages = if Arch.board_iseries
          ["kernel-iseries64"]
        elsif Arch.ppc32
          ["kernel-default"]
        else
          ["kernel-ppc64"]
        end
      elsif Arch.s390
        @kernel_packages = ["kernel-default"]
        @binary = "image"
      end

      @kernel_probed = true
      Builtins.y2milestone("ProbeKernel determined: %1", @kernel_packages)

      nil
    end

    # Set a custom kernel.
    # @param custom_kernels a list of kernel packages
    def SetPackages(custom_kernels)
      custom_kernels = deep_copy(custom_kernels)
      # probe to avoid later probing
      ProbeKernel() if !@kernel_probed
      @kernel_packages = deep_copy(custom_kernels)

      nil
    end

    # functinos related to kernel packages

    # Het the name of kernel binary under /boot
    # @return [String] the name of the kernel binary
    def GetBinary
      ProbeKernel() if !@kernel_probed
      @binary
    end

    # Get the list of kernel packages
    # @return a list of kernel packages
    def GetPackages
      ProbeKernel() if !@kernel_probed
      deep_copy(@kernel_packages)
    end

    # Compute kernel package
    # @return [String] selected kernel
    def ComputePackage
      packages = GetPackages()
      the_kernel = Ops.get(packages, 0, "")
      Builtins.y2milestone("Selecting '%1' as kernel package", the_kernel)

      # Check for provided kernel packages in installed system
      if Mode.normal || Mode.repair
        while the_kernel != "" && !Pkg.PkgInstalled(the_kernel)
          the_kernel = Ops.get(@fallbacks, the_kernel, "")
          Builtins.y2milestone("Not provided, falling back to '%1'", the_kernel)
        end
      else
        while the_kernel != "" && !Pkg.PkgAvailable(the_kernel)
          the_kernel = Ops.get(@fallbacks, the_kernel, "")
          Builtins.y2milestone(
            "Not available, falling back to '%1'",
            the_kernel
          )
        end
      end

      if the_kernel == ""
        Builtins.y2warning(
          "%1 not available, using kernel-default",
          @kernel_packages
        )

        @final_kernel = "kernel-default"
      else
        @final_kernel = the_kernel
      end
      @final_kernel
    end

    def GetFinalKernel
      ComputePackage() if @final_kernel == ""
      @final_kernel
    end

    # Compute kernel package for the specified base kernel package
    # @param [String] base string the base kernel package name (eg. kernel-default)
    # @param [Boolean] check_avail boolean if true, additional packages are checked for
    #  for being available on the medias before adding to the list
    # @return a list of all kernel packages (including the base package) that
    #  are to be installed together with the base package
    def ComputePackagesForBase(base, _check_avail)
      # NOTE: kernel-*-nongpl packages have been dropped, use base only
      ret = [base]

      Builtins.y2milestone("Packages for base %1: %2", base, ret)
      deep_copy(ret)
    end

    # Compute kernel packages
    # @return [Array] of selected kernel packages
    def ComputePackages
      kernel = ComputePackage()

      ret = ComputePackagesForBase(kernel, true)

      if Ops.greater_than(Builtins.size(@kernel_packages), 1)
        # get the extra packages
        extra_pkgs = Builtins.remove(@kernel_packages, 0)

        # add available extra packages
        Builtins.foreach(extra_pkgs) do |pkg|
          if Pkg.IsAvailable(pkg)
            ret = Builtins.add(ret, pkg)
            Builtins.y2milestone("Added extra kernel package: %1", pkg)
          else
            Builtins.y2warning(
              "Extra kernel package '%1' is not available",
              pkg
            )
          end
        end
      end

      Builtins.y2milestone("Computed kernel packages: %1", ret)

      deep_copy(ret)
    end

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

    #  Set inform_about_kernel_change.
    def SetInformAboutKernelChange(value)
      @inform_about_kernel_change = value

      nil
    end

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
    publish function: :ProbeKernel, type: "void ()"
    publish function: :SetPackages, type: "void (list <string>)"
    publish function: :GetBinary, type: "string ()"
    publish function: :GetPackages, type: "list <string> ()"
    publish function: :ComputePackage, type: "string ()"
    publish function: :GetFinalKernel, type: "string ()"
    publish function: :ComputePackagesForBase, type: "list <string> (string, boolean)"
    publish function: :ComputePackages, type: "list <string> ()"
    publish function: :SetInformAboutKernelChange, type: "void (boolean)"
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
