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
require "bootloader/proposal_client"

require "agama/http/clients"

Yast.import "BootStorage"

module Agama
  module Storage
    # Represents bootloader specific functionality
    class Bootloader
      # Represents bootloader settings
      class Config
        # If bootloader should stop on boot menu
        attr_accessor :stop_on_boot_menu
        # bootloader timeout. Only positive numbers are supported and stop_on_boot_menu has
        # precedence
        attr_accessor :timeout
        # bootloader extra kernel parameters beside ones that is proposed.
        attr_accessor :extra_kernel_params
        # as both previous keys are conflicting, remember which one to set or none. It can be empty
        # and it means export nothing
        attr_accessor :keys_to_export

        def initialize
          @keys_to_export = []
          @stop_on_boot_menu = false # false means use proposal, which has timeout
          @timeout = 10 # just some reasonable timeout, we do not send it anywhere
          @extra_kernel_params = ""
        end

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

          self
        end
      end

      attr_reader :config

      def initialize(logger)
        @config = Config.new
        @logger = logger
      end

      # Calculates proposal.
      def configure
        # reset disk to always read the recent storage configuration
        ::Yast::BootStorage.reset_disks
        # propose values first
        bootloader = ::Bootloader::BootloaderFactory.current
        bootloader.propose
        # then also apply changes to that proposal
        write_config
        # and set packages needed for given config
        install_packages
        # TODO: error handling (including catching exceptions like Bootloader::NoRoot) and filling issues
        @logger.debug "Bootloader config #{bootloader.inspect}"
      end

      # Installs bootloader.
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
        if @config.keys_to_export.include?(:extra_kernel_params)
          write_extra_kernel_params(bootloader)
        end

        bootloader
      end

      def write_extra_kernel_params(bootloader)
        # no systemd boot support for now
        return unless bootloader.respond_to?(:grub_default)

        new_bl = bootloader.class.new
        new_bl.grub_default.kernel_params.replace(@config.extra_kernel_params)
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
