# frozen_string_literal: true

require "yast"
require "bootloader/systeminfo"

Yast.import "Arch"

module Bootloader
  # Represents sysconfig file for bootloader usually located in /etc/sysconfig/bootloader
  class Sysconfig
    include Yast::Logger
    AGENT_PATH = Yast::Path.new(".sysconfig.bootloader")
    ATTR_VALUE_MAPPING = {
      bootloader:   "LOADER_TYPE",
      secure_boot:  "SECURE_BOOT",
      update_nvram: "UPDATE_NVRAM"
    }.freeze

    # specifies bootloader in sysconfig
    attr_accessor :bootloader
    # @return [Boolean] if secure boot should be used
    attr_accessor :secure_boot
    # @return [Boolean] if nvram should be updated
    attr_accessor :update_nvram

    def initialize(bootloader: nil, secure_boot: false, update_nvram: true)
      @sys_agent = AGENT_PATH
      @bootloader = bootloader
      @secure_boot = secure_boot
      @update_nvram = update_nvram
    end

    def self.from_system
      bootloader = Yast::SCR.Read(AGENT_PATH + "LOADER_TYPE")
      # propose secure boot always to true (bnc#872054), otherwise respect user choice
      # but only on architectures that support it
      secure_boot = Yast::SCR.Read(AGENT_PATH + "SECURE_BOOT") != "no"

      update_nvram = Yast::SCR.Read(AGENT_PATH + "UPDATE_NVRAM") != "no"

      new(bootloader: bootloader, secure_boot: secure_boot, update_nvram: update_nvram)
    end

    # Specialized write before rpm install, that do not have switched SCR
    # and work on blank system
    def pre_write
      ensure_file_exists_in_target
      temporary_target_agent do
        write
      end
    end

    PROPOSED_COMMENTS = {
      bootloader:   "\n" \
                    "## Path:\tSystem/Bootloader\n" \
                    "## Description:\tBootloader configuration\n" \
                    "## Type:\tlist(grub,grub2,grub2-efi,grub2-bls,systemd-boot,none)\n" \
                    "## Default:\tgrub2\n" \
                    "#\n" \
                    "# Type of bootloader in use.\n" \
                    "# For making the change effect run bootloader configuration tool\n" \
                    "# and configure newly selected bootloader\n" \
                    "#\n" \
                    "#\n",

      secure_boot:  "\n" \
                    "## Path:\tSystem/Bootloader\n" \
                    "## Description:\tBootloader configuration\n" \
                    "## Type:\tyesno\n" \
                    "## Default:\t\"no\"\n" \
                    "#\n" \
                    "# Enable Secure Boot support\n" \
                    "# Only available on UEFI systems and IBM z15+.\n" \
                    "#\n" \
                    "#\n",

      update_nvram: "\n" \
                    "## Path:\tSystem/Bootloader\n" \
                    "## Description:\tBootloader configuration\n" \
                    "## Type:\tyesno\n" \
                    "## Default:\t\"yes\"\n" \
                    "#\n" \
                    "# Update nvram boot settings (UEFI, OF)\n" \
                    "# Unset to preserve specific settings or workaround firmware issues.\n" \
                    "#\n"
    }.freeze

    def write
      log.info "Saving /etc/sysconfig/bootloader for #{bootloader}"

      write_option(:bootloader, bootloader)

      sb = secure_boot ? "yes" : "no"
      write_option(:secure_boot, sb)

      un = update_nvram ? "yes" : "no"
      write_option(:update_nvram, un)

      # flush write
      Yast::SCR.Write(sys_agent, nil)

      nil
    end

  private

    attr_accessor :sys_agent

    def destdir
      return @destdir if @destdir

      Yast.import "Installation"

      @destdir = Yast::Installation.destdir
    end

    def ensure_file_exists_in_target
      return if File.exist?(File.join(destdir, "/etc/sysconfig"))

      Yast::WFM.Execute(Yast::Path.new(".local.mkdir"),
        File.join(destdir, "/etc/sysconfig"))
      Yast::WFM.Execute(Yast::Path.new(".local.bash"),
        "touch #{destdir}/etc/sysconfig/bootloader")
    end

    def temporary_target_agent(&block)
      old_agent = sys_agent
      @sys_agent = Yast::Path.new(".target.sysconfig.bootloader")

      target_sysconfig_path = "#{destdir}/etc/sysconfig/bootloader"
      # Register new agent to temporary path. It register same agent as in
      # scrconf but to different path and it also touch different file
      # For more info see documentation of {SCR}
      Yast::SCR.RegisterAgent(
        @sys_agent,
        Yast::Term.new(:ag_ini,
          Yast::Term.new(:SysConfigFile, target_sysconfig_path))
      )

      block.call
    ensure
      Yast::SCR.UnregisterAgent(@sys_agent)
      @sys_agent = old_agent
    end

    def write_option(option, value)
      file_path_option = sys_agent + ATTR_VALUE_MAPPING[option]
      comment_path = file_path_option + "comment"
      comment_exist = Yast::SCR.Read(comment_path)

      # write value of option
      Yast::SCR.Write(file_path_option, value)

      # write comment of option only if it doesn't exist
      return if comment_exist

      Yast::SCR.Write(comment_path, PROPOSED_COMMENTS[option])
    end
  end
end
