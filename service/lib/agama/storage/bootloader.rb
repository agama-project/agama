# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module Storage
    # Represents bootloader specific functionality
    class Bootloader
      # Represents bootloader settings
      class Config
        # If bootloader should stop on boot menu
        attr_accessor :stop_on_boot_menu

        def initialize
          @stop_on_boot_menu = false # false means use proposal, which has timeout
        end

        def to_json(*_args)
          result = {}

          # our json use camel case
          result[:stopOnBootMenu] = stop_on_boot_menu
          result.to_json
        end

        def load_json(serialized_config)
          hsh = JSON.parse(serialized_config, symbolize_names: true)
          self.stop_on_boot_menu = hsh[:stopOnBootMenu] if hsh.include?(:stopOnBootMenu)
        end
      end

      attr_reader :config

      def initialize(logger)
        @config = Config.new
        @logger = logger
      end

      def write_config
        bootloader = ::Bootloader::BootloaderFactory.current
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
