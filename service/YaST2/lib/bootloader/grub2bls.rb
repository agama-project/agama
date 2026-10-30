# frozen_string_literal: true

require "yast"
require "bootloader/bootloader_base"
require "bootloader/bls"
require "bootloader/bls_sections"

Yast.import "Arch"
Yast.import "Report"
Yast.import "Stage"

module Bootloader
  # Represents grub2 bls bootloader with efi target
  class Grub2Bls < Grub2Base
    include Yast::Logger
    include Yast::I18n

    attr_reader :sections

    CMDLINE = "/etc/kernel/cmdline"

    def initialize
      super
      textdomain "bootloader"

      @sections = ::Bootloader::BlsSections.new
      @is_read = false
      @is_proposed = false
    end

    # Display bootloader summary
    # @return a list of summary lines
    def summary(*)
      result = [
        Yast::Builtins.sformat(
          _("Boot Loader Type: %1"),
          "GRUB2 BLS"
        )
      ]
      result << secure_boot_summary if Systeminfo.secure_boot_available?(name)
      result << update_nvram_summary if Systeminfo.nvram_available?(name)
      result
    end

    # @return bootloader name
    def name
      "grub2-bls"
    end

    # reads configuration from target disk
    # rubocop:disable Metrics/AbcSize
    def read
      @sections.read
      grub_default.timeout = Bls.menu_timeout
      log.info "Boot timeout: #{grub_default.timeout}"
      lines = ""
      filename = File.join(Yast::Installation.destdir, CMDLINE)
      if File.exist?(filename)
        File.open(filename).each do |line|
          lines = + line
        end
      end
      self.secure_boot = Systeminfo.secure_boot_active?
      self.update_nvram = Systeminfo.update_nvram_active?
      grub_default.kernel_params.replace(lines)
      log.info "kernel params: #{grub_default.kernel_params}"
      log.info "bls sections:  #{@sections.all}"
      log.info "bls default:   #{@sections.default}"
      log.info "secure boot:   #{secure_boot}"
      log.info "update nvram:   #{update_nvram}"
      @is_read = true # flag that settings has been read
    end
    # rubocop:enable Metrics/AbcSize

    # @return true if configuration is already read
    def read?
      @is_read
    end

    # Proposes new configuration
    def propose
      log.info("Propose settings...")
      if grub_default.kernel_params.empty?
        kernel_line = Yast::BootArch.DefaultKernelParams(Yast::BootStorage.propose_resume)
        grub_default.kernel_params.replace(kernel_line)
      end
      grub_default.timeout = Yast::ProductFeatures.GetIntegerFeature("globals", "boot_timeout").to_i
      self.secure_boot = Systeminfo.secure_boot_supported?
      @is_proposed = true
      # for UEFI always remove PMBR flag on disk (bnc#872054)
      self.pmbr_action = :remove
    end

    # @return true if configuration is already proposed
    def proposed?
      @is_proposed
    end

    # writes configuration to target disk
    def write(*)
      # writing kernel parameter to /etc/kernel/cmdline
      File.open(File.join(Yast::Installation.destdir, CMDLINE), "w+") do |fw|
        fw.puts(grub_default.kernel_params.serialize)
      end

      if Yast::Stage.initial # while new installation only
        Bls.install_bootloader
        Bls.create_menu_entries
        Bls.set_authentication
      else
        Bls.update_bootloader
      end
      @sections.write
      Bls.write_menu_timeout(grub_default.timeout)

      Pmbr.write_efi(pmbr_action)
    end

    # merges other bootloader configuration into this one.
    # It have to be same bootloader type.
    # rubocop:disable Metrics/AbcSize
    def merge(other)
      raise "Invalid merge argument #{other.name} for #{name}" if name != other.name

      log.info "merging: timeout: #{grub_default.timeout}=>#{other.grub_default.timeout}"
      log.info "         mitigations: #{cpu_mitigations.to_human_string}=>" \
               "#{other.cpu_mitigations.to_human_string}"
      log.info "         pmbr_action: #{pmbr_action}=>#{other.pmbr_action}"
      log.info "         secure boot: #{other.secure_boot}"
      log.info "         update_nvram: #{update_nvram}=>#{other.update_nvram}"
      log.info "         grub_default.kernel_params: #{grub_default.kernel_params.serialize}=>" \
               "#{other.grub_default.kernel_params.serialize}"
      log.info "         grub_default.kernel_params: #{grub_default.kernel_params.serialize}=>" \
               "#{other.grub_default.kernel_params.serialize}"

      merge_sections(other)
      merge_grub_default(other)
      merge_pmbr_action(other)
      self.secure_boot = other.secure_boot unless other.secure_boot.nil?
      self.update_nvram = other.update_nvram unless other.update_nvram.nil?

      log.info "merging result: timeout: #{grub_default.timeout}"
      log.info "                mitigations: #{cpu_mitigations.to_human_string}"
      log.info "                kernel_params: #{grub_default.kernel_params.serialize}"
      log.info "                pmbr_action: #{pmbr_action}"
      log.info "                secure boot: #{secure_boot}"
      log.info "                update_nvram: #{update_nvram}"
    end
    # rubocop:enable Metrics/AbcSize

    # @return [Array<String>] packages required to configure given bootloader
    def packages
      res = super
      res << ("grub2-" + grub2bls_architecture + "-efi-bls")
      res << "sdbootutil"
      res << "shim" if Systeminfo.secure_boot_supported?
      res
    end

    # overwrite BootloaderBase version to save secure boot
    def write_sysconfig(prewrite: false)
      sysconfig = Bootloader::Sysconfig.new(bootloader: name,
        secure_boot: secure_boot, update_nvram: update_nvram)
      prewrite ? sysconfig.pre_write : sysconfig.write
    end

  private

    def grub2bls_architecture
      arch = Yast::Arch.architecture
      table = { "x86_64"      => "x86_64",
                "amd64"       => "x86_64",
                "sparc"       => "sparc64",
                "mipsel"      => "mipsel",
                "mips64el"    => "mipsel",
                "mips"        => "mips",
                "mips64"      => "mips",
                "loongarch64" => "loongarch64" }
      ret = table[arch]
      ret ||= if arch.start_with?("arm")
        "arm"
      elsif arch.start_with?("aarch64")
        "arm64"
      elsif arch.start_with?("riscv32")
        "riscv32"
      elsif arch.start_with?("riscv64")
        "riscv64"
      else
        arch # fallback, but useful ?
      end
      ret
    end

    def merge_sections(other)
      return if !other.sections.default || other.sections.default.empty?

      @sections.default = other.sections.default
    end
  end
end
