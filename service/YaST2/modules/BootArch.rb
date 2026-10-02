# frozen_string_literal: true

# File:
#      modules/BootArch.ycp
#
# Module:
#      Bootloader installation and configuration
#
# Summary:
#      Module containing specific data for differnt architecturese
#      (as some architectures support multiple bootloaders, some bootloaders
#      support multiple architectures)
#
# Authors:
#      Jiri Srain <jsrain@suse.cz>
#      Olaf Dabrunz <od@suse.de>
#
# $Id$
#
# Vendored from yast2-bootloader's src/modules/BootArch.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require "yast"

require "bootloader/cpu_mitigations"

module Yast
  class BootArchClass < Module
    include Yast::Logger

    def main
      textdomain "bootloader"

      Yast.import "Arch"
      Yast.import "Kernel"
      Yast.import "Linuxrc"
      Yast.import "ProductFeatures"
      Yast.import "Stage"
    end

    # list of regexp to match kernel params that should be added
    # from installation to running kernel on s390 (bsc#1086665)
    S390_WHITELIST = [
      /net\.ifnames=\S*/,
      /fips=\S*/,
      /mitigations=\S*/,
      /rd\.zdev=\S*/,
      /zfcp\.allow_lun_scan=\S*/,
      # Keep cio_ignore parameter always (bsc#1210525)
      /cio_ignore=\S*/
    ].freeze

    # Get parameters for the default kernel
    # @note for possible arguments for kernel see `man kernel-command-line`
    # @param [String] resume string device to resume from (or empty not to set it)
    # @return [String] parameters for default kernel
    def DefaultKernelParams(resume)
      features = ProductFeatures.GetStringFeature(
        "globals",
        "additional_kernel_parameters"
      )
      kernel_cmdline = Kernel.GetCmdLine.dup
      # filter out root= parameter as installation special root cannot work on target system
      kernel_cmdline.gsub!(/root=\S+/, "")

      if Arch.i386 || Arch.x86_64 || Arch.aarch64 || Arch.arm || Arch.ppc || Arch.riscv64
        ret = kernel_cmdline
        ret << " resume=#{resume}" unless resume.empty?
        ret << " #{features}" unless features.empty?
        ret << propose_cpu_mitigations
        ret << " quiet"
        ret
      elsif Arch.s390
        termparm = if ENV.fetch("TERM", nil) == "linux"
          "TERM=linux console=ttyS0 console=ttyS1"
        else
          "hvc_iucv=8 TERM=dumb"
        end
        parameters = +"#{features} #{termparm}"
        # pick selected params from installation command line
        S390_WHITELIST.each do |pattern|
          parameters << " #{Regexp.last_match(0)}" if kernel_cmdline =~ pattern
        end

        parameters << propose_cpu_mitigations
        parameters << " resume=#{resume}" unless resume.empty?
        parameters
      else
        log.warn "Default kernel parameters not defined"
        kernel_cmdline + propose_cpu_mitigations
      end
    end

    def propose_cpu_mitigations
      linuxrc_value = Yast::Linuxrc.value_for("mitigations")
      log.info "linuxrc mitigations #{linuxrc_value.inspect}"
      return "" unless linuxrc_value.nil? # linuxrc already has mitigations

      product_value = ProductFeatures.GetStringFeature("globals", "cpu_mitigations")
      log.info "cpu mitigations in product: #{product_value.inspect}"

      mitigations = if product_value.empty?
        ::Bootloader::CpuMitigations::DEFAULT
      else
        ::Bootloader::CpuMitigations.from_string(product_value)
      end
      # no value for manual mitigations
      mitigations.kernel_value ? " mitigations=#{mitigations.kernel_value}" : ""
    end

    publish :function => :DefaultKernelParams, :type => "string (string)"
    publish :function => :ResumeAvailable, :type => "boolean ()"
  end

  BootArch = BootArchClass.new
  BootArch.main
end
