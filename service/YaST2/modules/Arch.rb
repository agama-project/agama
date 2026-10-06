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
# File:  modules/Arch.ycp
# Module:  yast2
# Summary:  Architecture, board and bios data
# Authors:  Klaus Kaempf <kkaempf@suse.de>
# Flags:  Stable
#
# $Id$
require "yast"

module Yast
  # Representing architecture information yast have.
  #
  # rubocop:disable Naming/VariableNumber
  # Reason for disable is that API is stable and some method names follows domain conventions
  class ArchClass < Module
    def main
      # local variables

      @_architecture = nil

      @_board_compatible = nil

      @_checkgeneration = ""

      @_has_pcmcia = nil

      @_is_laptop = nil

      @_is_uml = nil

      @_has_smp = nil

      # Xen domain (dom0 or domU)
      @_is_xen = nil

      # Xen dom0
      @_is_xen0 = nil

      # KVM
      @_is_kvm = nil

      # zKVM
      @_is_zkvm = nil

      # zVM
      @_is_zvm = nil
    end

    # ************************************************************
    # system architecture

    # Returns full architecture type
    # (one of i386, sparc, sparc64, ppc, ppc64, alpha, s390_32, s390_64, ia64, x86_64, arm, aarch64, risv64)
    #
    # @return [String] architecture
    def architecture
      if @_architecture.nil?
        @_architecture = Convert.to_string(
          SCR.Read(path(".probe.architecture"))
        )
      end
      @_architecture
    end

    # true for all x86 compatible architectures
    def i386
      architecture == "i386"
    end

    # true for all 32bit sparc architectures
    # @see #sparc
    # @see #sparc64
    def sparc32
      architecture == "sparc"
    end

    # true for all 64bit sparc architectures
    # @see #sparc
    # @see #sparc32
    def sparc64
      architecture == "sparc64"
    end

    # true for all sparc architectures (32 or 64 bit)
    # @see #sparc32
    # @see #sparc64
    def sparc
      sparc32 || sparc64
    end

    # true for all 32bit ppc architectures
    # @see #ppc
    # @see #ppc64
    def ppc32
      architecture == "ppc"
    end

    # true for all 64bit ppc architectures
    # @see #ppc
    # @see #ppc32
    def ppc64
      architecture == "ppc64"
    end

    # true for all ppc architectures (32 or 64 bit)
    # @see #ppc32
    # @see #ppc64
    def ppc
      ppc32 || ppc64
    end

    # true for all alpha architectures
    def alpha
      architecture == "alpha"
    end

    # true for all 32bit S/390 architectures
    # @see #s390
    # @see #s390_64
    def s390_32
      architecture == "s390_32"
    end

    # true for all 64bit S/390 architectures
    # @see #s390
    # @see #s390_32
    def s390_64
      architecture == "s390_64"
    end

    # true for all S/390 architectures (32 or 64 bit)
    # @see #s390_32
    # @see #s390_64
    def s390
      s390_32 || s390_64
    end

    # true for all IA64 (itanium) architectures
    # @deprecated Itanium is no longer supported
    def ia64
      architecture == "ia64"
    end

    # true for all x86-64 (AMD Hammer) architectures
    def x86_64
      architecture == "x86_64"
    end

    # true for all 32-bit ARM architectures
    def arm
      architecture == "arm"
    end

    # true for all aarch64 (ARM64) architectures
    def aarch64
      architecture == "aarch64"
    end

    # true for all riscv64 (RISC-V 64-bit) architectures
    def riscv64
      architecture == "riscv64"
    end

    # Returns general architecture type (one of sparc, ppc, s390, i386, alpha, ia64, x86_64, arm, aarch64)
    #
    # @return [String] arch_short
    def arch_short
      if sparc
        "sparc"
      elsif ppc
        "ppc"
      elsif s390
        "s390"
      else
        architecture
      end
    end

    # ************************************************************
    # general system board types (initialized in constructor)

    def board_compatible
      if @_board_compatible.nil?
        @_checkgeneration = ""
        systemProbe = Convert.convert(
          SCR.Read(path(".probe.system")),
          from: "any",
          to:   "list <map>"
        )
        systemProbe = [] if systemProbe.nil?

        Builtins.foreach(systemProbe) do |entry|
          checksys = Ops.get_string(entry, "system", "")
          @_checkgeneration = Ops.get_string(entry, "generation", "")
          @_board_compatible = checksys if checksys != ""
        end
        Builtins.y2milestone("_board_compatible '%1' \n", @_board_compatible)
        @_board_compatible = "wintel" if i386 || x86_64
        # hwinfo expects CHRP/PReP/iSeries/MacRISC*/PowerNV in /proc/cpuinfo
        # there is no standard for the board identification
        # Cell and Maple based boards have no CHRP in /proc/cpuinfo
        # Pegasos and Cell do have CHRP in /proc/cpuinfo, but Pegasos2 should no be handled as CHRP
        # Efika is handled like Pegasos for the time being

        if ppc && (@_board_compatible.nil? || @_board_compatible == "CHRP")
          device_type = Convert.to_map(
            SCR.Execute(
              path(".target.bash_output"),
              "/usr/bin/echo -n `/usr/bin/cat /proc/device-tree/device_type`",
              {}
            )
          )
          model = Convert.to_map(
            SCR.Execute(
              path(".target.bash_output"),
              "/usr/bin/echo -n `/usr/bin/cat /proc/device-tree/model`",
              {}
            )
          )
          board = Ops.get_string(model, "stdout", "")
          Builtins.y2milestone(
            "model %1 , device_type %2\n",
            model,
            device_type
          )
          # catch remaining IBM boards
          if Builtins.issubstring(
            Ops.get_string(device_type, "stdout", ""),
            "chrp"
          )
            @_board_compatible = "CHRP"
          end
          # Maple has its own way of pretenting OF1275 compliance
          @_board_compatible = "CHRP" if ["Momentum,Maple-D", "Momentum,Maple-L", "Momentum,Maple"].include?(board)
          # Pegasos has CHRP in /proc/cpuinfo and 'chrp' in /proc/device-tree/device_type
          if board == "Pegasos2" ||
              Builtins.issubstring(
                Builtins.tolower(Ops.get_string(device_type, "stdout", "")),
                "pegasos2"
              )
            @_board_compatible = "Pegasos"
          end
          # Efika has CHRP in /proc/cpuinfo and 'efika' in /proc/device-tree/device_type
          if Builtins.issubstring(Builtins.tolower(board), "efika") ||
              Builtins.issubstring(
                Builtins.tolower(Ops.get_string(device_type, "stdout", "")),
                "efika"
              )
            @_board_compatible = "Pegasos"
          end
        end
        # avoid future re-probing if probing failed
        # also avoid passing nil outside the module
        @_board_compatible = "" if fun_ref(method(:board_compatible), "string ()").nil?
      end
      @_board_compatible
    end

    # true for all PPC "MacRISC" boards
    def board_mac
      ppc &&
        (board_compatible == "MacRISC" || board_compatible == "MacRISC2" ||
          board_compatible == "MacRISC3" ||
          board_compatible == "MacRISC4")
    end

    # true for all "NewWorld" PowerMacs
    def board_mac_new
      # board_mac calls board_compatible which initializes _checkgeneration
      board_mac && @_checkgeneration == "NewWorld"
    end

    # true for all "OldWorld" powermacs
    def board_mac_old
      # board_mac calls board_compatible which initializes _checkgeneration
      board_mac && @_checkgeneration == "OldWorld"
    end

    # true for all "CHRP" ppc boards
    def board_chrp
      ppc && board_compatible == "CHRP"
    end

    # true for all baremetal Power8 systems
    # https://github.com/open-power/docs
    def board_powernv
      ppc && board_compatible == "PowerNV"
    end

    # true for all "iSeries" ppc boards
    def board_iseries
      ppc && board_compatible == "iSeries"
    end

    # true for all "PReP" ppc boards
    def board_prep
      ppc && board_compatible == "PReP"
    end

    # true for all "Pegasos" and "Efika" ppc boards
    def board_pegasos
      ppc && board_compatible == "Pegasos"
    end

    # true for all "Windows/Intel" compliant boards (x86 based)
    def board_wintel
      board_compatible == "wintel"
    end

    # ************************************************************
    # BIOS stuff

    # true if the system supports PCMCIA
    # But modern notebook computers do not have it. See also Bugzilla #151813#c10
    # @see #is_laptop
    # @return true if the system supports PCMCIA
    def has_pcmcia
      @_has_pcmcia = Convert.to_boolean(SCR.Read(path(".probe.has_pcmcia"))) if @_has_pcmcia.nil?
      @_has_pcmcia
    end

    # true if the system runs on laptop
    #
    # @return if the system is a laptop
    def is_laptop
      if @_is_laptop.nil?
        system = Convert.convert(
          SCR.Read(path(".probe.system")),
          from: "any",
          to:   "list <map>"
        )
        formfactor = Ops.get_string(system, [0, "formfactor"], "")
        @_is_laptop = formfactor == "laptop"
      end
      @_is_laptop
    end

    # Whether the system is running over a virtualized environment
    #
    # @return [Boolean]
    def is_virtual
      return @_is_virtual unless @_is_virtual.nil?

      @_is_virtual = SCR.Read(path(".target.string"), "/proc/cpuinfo")
        .to_s.match?("^flags.*hypervisor.*\n")
    end

    # ************************************************************
    # UML stuff

    # true if UML
    # @deprecated
    # @return true if the system is UML
    def is_uml
      @_is_uml = Convert.to_boolean(SCR.Read(path(".probe.is_uml"))) if @_is_uml.nil?
      @_is_uml
    end

    # ************************************************************
    # XEN stuff

    # Whether the Xen kernel is running
    #
    # @see https://wiki.xen.org/wiki/Xen_Project_Software_Overview
    #
    # @return [Boolean] true if the Xen kernel is running; false otherwise
    def is_xen
      return @_is_xen unless @_is_xen.nil?

      @_is_xen = SCR.Read(path(".target.stat"), "/proc/xen")["isdir"] || false
    end

    # Whether it is a Xen host (dom0)
    #
    # @see #is_xen
    # @see #is_xenU
    # @see https://wiki.xen.org/wiki/Dom0
    #
    # @return [Boolean] true if it is a Xen dom0; false otherwise
    def is_xen0
      return @_is_xen0 unless @_is_xen0.nil?

      @_is_xen0 = is_xen && xen_capabilities.include?("control_d")
    end

    # Whether it is a Xen guest (domU)
    #
    # @see #is_xen
    # @see #is_xen0
    # @see https://wiki.xen.org/wiki/DomU
    #
    # @return [Boolean] true if it is a Xen domU; false otherwise
    def is_xenU
      is_xen && !is_xen0
    end

    # Whether a Xen guest is paravirtualized (PV) or not (HVM)
    #
    # @see #is_xenU
    # @see https://wiki.xen.org/wiki/DomU
    #
    # @return [Boolean] true if it is a PV Xen domU; false otherwise
    def paravirtualized_xen_guest?
      return false unless is_xenU

      SCR.Read(path(".target.string"), "/sys/hypervisor/guest_type").strip == "PV"
    end

    # Convenience method to retrieve the /proc/xen/capabilities content
    #
    # @return [String]
    def xen_capabilities
      SCR.Read(path(".target.string"), "/proc/xen/capabilities").to_s
    end

    # ************************************************************
    # KVM stuff

    # true if KVM is running
    #
    # @return true if we are running on KVM hypervisor
    def is_kvm
      if @_is_kvm.nil?
        # KVM hypervisor has /dev/kvm file
        stat = Convert.to_map(SCR.Read(path(".target.stat"), "/dev/kvm"))
        Builtins.y2milestone("stat /dev/kvm: %1", stat)

        @_is_kvm = Ops.greater_than(Builtins.size(stat), 0)
      end

      @_is_kvm
    end

    # ************************************************************
    # zKVM stuff

    # zKVM means KVM on IBM System z
    # true if zKVM is running
    #
    # @return true if we are running on zKVM hypervisor
    def is_zkvm
      if @_is_zkvm.nil?
        # using different check than on x86 as recommended by IBM
        @_is_zkvm = s390 && Yast::WFM.Execute(path(".local.bash"), "/usr/bin/grep 'Control Program: KVM' /proc/sysinfo") == 0
      end

      @_is_zkvm
    end

    # ************************************************************
    # zVM stuff

    # zVM means VM on IBM System z
    # true if zVM is running
    #
    # @return true if we are running on zVM hypervisor
    def is_zvm
      if @_is_zvm.nil?
        # using different check than on x86 as recommended by IBM
        @_is_zvm = s390 && Yast::WFM.Execute(path(".local.bash"), "/usr/bin/grep 'Control Program: z\/VM' /proc/sysinfo") == 0
      end

      @_is_zvm
    end

    # ************************************************************
    # SMP stuff

    # Set "Arch::has_smp ()". Since Alpha doesn't reliably probe smp,
    # 'has_smp' must be set later with this function.
    # @param [Boolean] is_smp true if has_smp should be true
    # @example setSMP(true);
    def setSMP(is_smp)
      @_has_smp = is_smp

      nil
    end

    # true if running on multiprocessor board. This only reflects the
    # board, not the actual number of CPUs or the running kernel!
    #
    # @return true if running on multiprocessor board
    def has_smp
      @_has_smp = Convert.to_boolean(SCR.Read(path(".probe.has_smp"))) if @_has_smp.nil?
      if alpha
        # get smp for alpha from /etc/install.inf
        setSMP(SCR.Read(path(".etc.install_inf.SMP")) == "1")
      end
      @_has_smp
    end

    # run X11 configuration after inital boot
    # this is false in case of:
    # installation on iSeries,
    # installation on S390
    #
    # @return true when the X11 configuration is needed after inital boot
    # @see #Installation::x11_setup_needed
    def x11_setup_needed
      # disable X11 setup after initial boot
      return false if board_iseries || s390

      true
    end

    # Determines whether the system is running on WSL
    #
    # @return [Boolean] true if runs on WSL; false otherwise
    def is_wsl
      # As of 2020-07-24 /proc/sys/kernel/osrelease contains
      # "4.4.0-19041-Microsoft" on wsl1 and
      # "4.19.104-microsoft-standard" on wsl2.
      # Match on lowercase  "-microsoft"
      SCR.Read(path(".target.string"), "/proc/sys/kernel/osrelease").to_s.downcase.include?("-microsoft")
    end

    # map the Arch.architecture to the arch expected by SCC
    RPM_ARCH = {
      "s390_32" => "s390",
      "s390_64" => "s390x",
      # ppc64le is the only supported PPC arch, we do not have to distinguish the BE/LE variants
      "ppc64"   => "ppc64le"
    }.freeze
    private_constant :RPM_ARCH

    # Returns the architecture expected by SCC
    #
    # @return [String] Architecture
    def rpm_arch
      RPM_ARCH[architecture] || architecture
    end

    publish function: :architecture, type: "string ()"
    publish function: :i386, type: "boolean ()"
    publish function: :sparc32, type: "boolean ()"
    publish function: :sparc64, type: "boolean ()"
    publish function: :sparc, type: "boolean ()"
    publish function: :ppc32, type: "boolean ()"
    publish function: :ppc64, type: "boolean ()"
    publish function: :ppc, type: "boolean ()"
    publish function: :alpha, type: "boolean ()"
    publish function: :s390_64, type: "boolean ()"
    publish function: :s390, type: "boolean ()"
    publish function: :ia64, type: "boolean ()"
    publish function: :x86_64, type: "boolean ()"
    publish function: :arm, type: "boolean ()"
    publish function: :aarch64, type: "boolean ()"
    publish function: :riscv64, type: "boolean ()"
    publish function: :arch_short, type: "string ()"
    publish function: :board_mac, type: "boolean ()"
    publish function: :board_mac_new, type: "boolean ()"
    publish function: :board_mac_old, type: "boolean ()"
    publish function: :board_chrp, type: "boolean ()"
    publish function: :board_iseries, type: "boolean ()"
    publish function: :board_prep, type: "boolean ()"
    publish function: :board_pegasos, type: "boolean ()"
    publish function: :board_wintel, type: "boolean ()"
    publish function: :has_pcmcia, type: "boolean ()"
    publish function: :is_laptop, type: "boolean ()"
    publish function: :is_uml, type: "boolean ()"
    publish function: :is_xen, type: "boolean ()"
    publish function: :is_xen0, type: "boolean ()"
    publish function: :is_xenU, type: "boolean ()"
    publish function: :paravirtualized_xen_guest?, type: "boolean ()"
    publish function: :is_kvm, type: "boolean ()"
    publish function: :is_zkvm, type: "boolean ()"
    publish function: :has_smp, type: "boolean ()"
    publish function: :x11_setup_needed, type: "boolean ()"
    publish function: :is_wsl, type: "boolean ()"
  end
  # rubocop:enable Naming/VariableNumber

  Arch = ArchClass.new
  Arch.main
end
