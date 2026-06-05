# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "agama/storage/bootloader_config"
require "agama/storage/bootloader_config_solver"
require "agama/storage/bootloader_prober"
require "bootloader/bootloader_factory"
require "bootloader/os_prober"
require "yast"

Yast.import "BootStorage"

module Agama
  module Storage
    # Represents bootloader specific functionality
    class BootloaderManager
      # @return [BootloaderConfig]
      attr_reader :config

      # @param logger [Logger]
      def initialize(logger)
        @config = BootloaderConfig.new
        @logger = logger
      end

      def probed?
        !!@probed
      end

      def probe
        @probed = true
        @available_bootloaders = BootloaderProber.new.probe
      end

      # Available bootloaders in the system.
      #
      # @return [Array<Bootloader>]
      def available_bootloaders
        @available_bootloaders || []
      end

      # Calculates proposal.
      #
      # It proposes the bootloader configuration based on the current system and storage
      # configuration. It also applies the user configuration and installs the needed packages.
      #
      # @param product_config [Agama::Config]
      def configure(product_config)
        # TODO: get value from product ( probably for TW and maybe Leap?)
        ::Bootloader::OsProber.package_available = false
        # reset disk to always read the recent storage configuration
        ::Yast::BootStorage.reset_disks
        # reset bootloader factory cache as we want here to reapply config from scratch
        ::Bootloader::BootloaderFactory.clear_cache
        bootloader = bootloader_object(product_config)
        ::Bootloader::BootloaderFactory.current = bootloader
        bootloader.propose
        # then also apply changes to that proposal
        write_config
        # TODO: error handling (including catching exceptions and filling issues)
        @logger.info "Bootloader config #{bootloader.inspect}"
      rescue ::Bootloader::NoRoot
        @logger.info "Bootloader configure aborted - there is no storage proposal"
      end

      # Installs bootloader.
      #
      # It writes the bootloader configuration to the system.
      def install
        Yast::WFM.CallFunction("inst_bootloader", [])
      end

      # Required packages.
      #
      # @return [Array<String>]
      def packages
        ::Bootloader::BootloaderFactory.current.packages
      end

    private

      def write_config
        bootloader = ::Bootloader::BootloaderFactory.current
        write_stop_on_boot(bootloader) if @config.keys_to_export.include?(:stop_on_boot_menu)
        write_timeout(bootloader) if @config.keys_to_export.include?(:timeout)
        write_nvram(bootloader) if @config.keys_to_export.include?(:update_nvram)
        kernel_params = @config.scoped_kernel_params.values.join(" ")
        @logger.info "scoped kernel params: #{kernel_params}"

        if @config.keys_to_export.include?(:extra_kernel_params)
          kernel_params += " " + @config.extra_kernel_params
        end
        @logger.info "full kernel params: #{kernel_params}"
        write_extra_kernel_params(bootloader, kernel_params)

        bootloader
      end

      def write_nvram(bootloader)
        return if @config.update_nvram.nil?

        if bootloader.respond_to?(:update_nvram=)
          bootloader.update_nvram = @config.update_nvram
        else
          @logger.info "bootloader #{bootloader.name} does not support NVRAM update"
        end
      end

      def write_extra_kernel_params(bootloader, kernel_params)
        if bootloader.respond_to?(:grub_default)
          new_bl = bootloader.class.new
          new_bl.grub_default.kernel_params.replace(kernel_params)
          # and now just merge extra kernel params with all merge logic
          bootloader.merge(new_bl)
        elsif bootloader.respond_to?(:kernel_params)
          # I know it can be done more DRY, but explicit behavior is preferred
          new_bl = bootloader.class.new
          new_bl.kernel_params.replace(kernel_params)
          bootloader.merge(new_bl)
        else
          @logger.info "bootloader #{bootloader.name} does not support extra kernel params"
        end
      end

      def write_timeout(bootloader)
        # grub2 based bootloaders
        if bootloader.respond_to?(:grub_default)
          # it is really string as timeout as we write directly to CFA,
          # so it is string values from parser
          bootloader.grub_default.timeout = @config.timeout.to_s
        # systemd bootloader
        elsif bootloader.respond_to?(:menu_timeout)
          # here it is correct to have integer
          bootloader.menu_timeout = @config.timeout.to_i
        else
          @logger.info "bootloader #{bootloader.name} does not support timeout"
        end
      end

      def write_stop_on_boot(bootloader)
        case @config.stop_on_boot_menu
        when true
          # grub2 based bootloaders
          if bootloader.respond_to?(:grub_default)
            # it is really string as timeout as we write directly to CFA,
            # so it is string values from parser
            bootloader.grub_default.timeout = "-1"
          # systemd bootloader
          elsif bootloader.respond_to?(:menu_timeout)
            # here it is correct to have integer as yast2-bootloader translate it to
            # "force-menu" string
            bootloader.menu_timeout = -1
          else
            @logger.info "bootloader #{bootloader.name} does not support forcing user input"
          end
        when false
          # TODO: basically as we have single argument we repropose here. If more attributes comes
          # we will need to do always propose first and then modify what is in config set
          bootloader.propose
        when nil
          # not set, so do nothing and keep it as it is
        else
          @logger.error "unexpected value for stop_on_boot_menu #{@config.stop_on_boot_menu}"
        end
      end

      # Bootloader object from yast2-bootloader to use during configuration
      #
      # @param product_config [Agama::Config]
      def bootloader_object(product_config)
        ::Bootloader::BootloaderFactory.bootloader_by_name(bootloader_name(product_config))
      end

      # Name of the bootloader at ::Bootloader::BootloaderFactory
      #
      # @param product_config [Agama::Config]
      # @return [String]
      def bootloader_name(product_config)
        solved = @config.copy
        BootloaderConfigSolver.new(product_config).solve(solved)
        return "grub2-efi" if solved.type.is?(:grub2) && ::Bootloader::Systeminfo.efi?

        solved.type.to_s
      end
    end
  end
end
