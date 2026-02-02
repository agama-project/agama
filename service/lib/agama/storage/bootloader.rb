# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "yast"
require "json"
require "bootloader/bootloader_factory"
require "bootloader/os_prober"

require "agama/http/clients"

Yast.import "BootStorage"

module Agama
  module Storage
    # Represents bootloader specific functionality
    class Bootloader
      # Represents bootloader settings
      class Config
        # Whether bootloader should stop on boot menu.
        #
        # @return [Boolean]
        attr_accessor :stop_on_boot_menu

        # Bootloader timeout.
        #
        # Only positive numbers are supported and stop_on_boot_menu has precedence.
        #
        # @return [Integer]
        attr_accessor :timeout

        # Bootloader extra kernel parameters beside ones that is proposed.
        #
        # @return [String]
        attr_accessor :extra_kernel_params

        # Bootloader extra kernel parameters needed for other parts of agama
        #
        # @return [Hash<String, String>]
        attr_accessor :scoped_kernel_params

        # Keys to export to JSON.
        #
        # As both previous keys are conflicting, remember which one to set or none. It can be empty
        # and it means export nothing.
        #
        # @return [Array<Symbol>]
        attr_accessor :keys_to_export

        def initialize
          @keys_to_export = []
          @stop_on_boot_menu = false # false means use proposal, which has timeout
          @timeout = 10 # just some reasonable timeout, we do not send it anywhere
          @extra_kernel_params = ""
        end

        # Serializes the config to JSON.
        #
        # @return [String]
        def to_json(*_args)
          result = {}

          # our json use camel case
          result[:stopOnBootMenu] = stop_on_boot_menu if keys_to_export.include?(:stop_on_boot_menu)
          result[:timeout] = timeout if keys_to_export.include?(:timeout)
          if keys_to_export.include?(:extra_kernel_params)
            result[:extraKernelParams] =
              @extra_kernel_params
          end

          result.to_json
        end

        # Loads the config from a JSON string.
        #
        # @param serialized_config [String]
        # @return [Config] self
        def load_json(serialized_config)
          hsh = JSON.parse(serialized_config, symbolize_names: true)
          if hsh.include?(:timeout)
            self.timeout = hsh[:timeout]
            keys_to_export.delete(:stop_on_boot_menu)
            keys_to_export.push(:timeout) unless keys_to_export.include?(:timeout)

          end
          if hsh.include?(:stopOnBootMenu)
            self.stop_on_boot_menu = hsh[:stopOnBootMenu]
            keys_to_export.delete(:timeout)
            unless keys_to_export.include?(:stop_on_boot_menu)
              keys_to_export.push(:stop_on_boot_menu)
            end
          end
          if hsh.include?(:extraKernelParams)
            self.extra_kernel_params = hsh[:extraKernelParams]
            unless keys_to_export.include?(:extra_kernel_params)
              keys_to_export.push(:extra_kernel_params)
            end
          end

          self.scoped_kernel_params = hsh[:kernelArgs]

          self
        end
      end

      # @return [Config]
      attr_reader :config

      # @param logger [Logger]
      def initialize(logger)
        @config = Config.new
        @logger = logger
      end

      # Calculates proposal.
      #
      # It proposes the bootloader configuration based on the current system and storage
      # configuration. It also applies the user configuration and installs the needed packages.
      def configure
        # TODO: get value from product ( probably for TW and maybe Leap?)
        ::Bootloader::OsProber.package_available = false
        # reset disk to always read the recent storage configuration
        ::Yast::BootStorage.reset_disks
        # propose values first. Propose bootloader from factory and do not use
        # current as agama has /etc/sysconfig/bootloader with efi, so it
        # will lead to wrong one.
        bootloader = ::Bootloader::BootloaderFactory.proposed
        ::Bootloader::BootloaderFactory.current = bootloader
        bootloader.propose
        # then also apply changes to that proposal
        write_config
        # and set packages needed for given config
        install_packages
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

    private

      def install_packages
        bootloader = ::Bootloader::BootloaderFactory.current
        http_client = Agama::HTTP::Clients::Main.new(::Logger.new($stdout))
        packages = bootloader.packages
        @logger.info "Installing bootloader packages: #{packages}"

        http_client.set_resolvables("agama-bootloader", :package, packages)
      end

      def write_config
        bootloader = ::Bootloader::BootloaderFactory.current
        write_stop_on_boot(bootloader) if @config.keys_to_export.include?(:stop_on_boot_menu)
        write_timeout(bootloader) if @config.keys_to_export.include?(:timeout)
        kernel_params = @config.scoped_kernel_params.values.join(" ")
        @logger.info "scoped kernel params: #{kernel_params}"

        if @config.keys_to_export.include?(:extra_kernel_params)
          kernel_params += " " + @config.extra_kernel_params
        end
        @logger.info "full kernel params: #{kernel_params}"
        write_extra_kernel_params(bootloader, kernel_params)

        bootloader
      end

      def write_extra_kernel_params(bootloader, kernel_params)
        # no systemd boot support for now
        return unless bootloader.respond_to?(:grub_default)

        new_bl = bootloader.class.new
        new_bl.grub_default.kernel_params.replace(kernel_params)
        # and now just merge extra kernel params with all merge logic
        bootloader.merge(new_bl)
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
    end
  end
end
