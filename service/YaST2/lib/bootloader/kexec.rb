# frozen_string_literal: true

require "yast"

module Bootloader
  # Task of class is to allow preparation for running kexec at the end of
  # installation. It also decide if environment is not suitable for kexec.
  class Kexec
    include Yast::Logger

    def initialize
      Yast.import "Arch"
      Yast.import "Directory"
      Yast.import "Installation"
      Yast.import "Mode"
      Yast.import "ProductFeatures"
    end

    # Prepares environment for kexec
    # @return false if environment is not suitable to be used for kexec
    def prepare_environment
      log.info "CopyKernelInird: start copy kernel and inird"
      return false unless proper_environment?

      copy_kernel
    end

  private

    # Get entry from DMI data returned by .probe.bios.
    #
    # @param section [String] section name
    # @param key [String] requested key
    # @return [String] entry for given key or nil
    def dmi_read(section, key)
      @smbios ||= bios_data.fetch(0, {}).fetch("smbios", [])

      result = @smbios.find { |x| x["type"] == section }
      result = result[key] if result

      log.info "Bootloader::DMIRead(#{section}, #{key}) = #{result}"

      result
    end

    # Check if we run in a vbox vm.
    #
    # @return [Boolean]: true if yast runs in a vbox vm
    def virtual_box?
      dmi_read("sysinfo", "product") == "VirtualBox"
    end

    # Check if we run in a hyperv vm.
    #
    # @return [Boolean]: true if yast runs in a hyperv vm
    def hyper_v?
      dmi_read("sysinfo", "manufacturer") == "Microsoft Corporation" &&
        dmi_read("sysinfo", "product") == "Virtual Machine"
    end

    def bios_data
      @bios_data ||= Yast::SCR.Read(Yast::Path.new(".probe.bios"))
    end

    def proper_environment?
      if Yast::Mode.live_installation
        log.info "Running live_installation without using kexec"
        return false
      end

      if !Yast::ProductFeatures.GetBooleanFeature("globals", "kexec_reboot")
        log.info "Option kexec_reboot is false. kexec will not be used."
        return false
      end

      # check architecture for using kexec instead of reboot
      if Yast::Arch.ppc || Yast::Arch.s390
        log.info "Skip using of kexec on this architecture"
        return false
      end

      log.info "bios_data = #{bios_data}"

      if virtual_box?
        log.info "Installation run on VirtualBox, skip kexec loading"
        return false
      end

      if hyper_v?
        log.info "Installation run on HyperV, skip kexec loading"
        return false
      end

      true
    end

    def copy_kernel
      # create directory /var/lib/YaST2
      Yast::WFM.Execute(Yast::Path.new(".local.mkdir"), "/var/lib/YaST2")

      cmd = Yast::Builtins.sformat(
        "/bin/cp -L %1/%2 %1/%3 %4",
        Yast::Installation.destdir,
        "boot/vmlinuz",
        "boot/initrd",
        Yast::Directory.vardir
      )

      out = Yast::WFM.Execute(Yast::Path.new(".local.bash_output"), cmd)
      log.info "Command for copy: #{cmd} and result #{out}"
      if out["exit"] != 0
        log.error "Copy kernel and initrd failed, output: #{out}"
        return false
      end

      true
    end
  end
end
