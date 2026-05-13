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

require "agama/copyable"

module Agama
  module Storage
    # Representation of the bootloader settings, also affecting the storage proposal
    class BootloaderConfig
      include Copyable

      # Type of bootloader to install
      #
      # @return [Y2Storage::BootloaderType, nil] if nil, the type is decided by Agama
      attr_accessor :type

      # Whether bootloader should update persistent RAM.
      # If kept as nil then default will be used.
      #
      # @return [Boolean]
      attr_accessor :update_nvram

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
        @update_nvram = nil
        @extra_kernel_params = ""
        @scoped_kernel_params = {}
      end

      # Converts the config to a JSON hash.
      #
      # @return [Hash]
      def to_json(*_args)
        result = {}

        # our json use camel case
        result[:stopOnBootMenu] = stop_on_boot_menu if keys_to_export.include?(:stop_on_boot_menu)
        result[:timeout] = timeout if keys_to_export.include?(:timeout)
        result[:updateNvram] = update_nvram if keys_to_export.include?(:update_nvram)
        if keys_to_export.include?(:extra_kernel_params)
          result[:extraKernelParams] = @extra_kernel_params
        end

        result
      end

      # Loads the configuration from a hash according to the JSON schema.
      #
      # @param hsh [Hash]
      # @return [Config] self
      def load_json(hsh)
        update_attribute(hsh, :timeout, :timeout, conflicts: :stop_on_boot_menu)
        update_attribute(hsh, :stopOnBootMenu, :stop_on_boot_menu, conflicts: :timeout)
        update_attribute(hsh, :extraKernelParams, :extra_kernel_params)
        update_attribute(hsh, :updateNvram, :update_nvram)

        self.scoped_kernel_params = hsh[:kernelArgs]

        self
      end

    private

      def update_attribute(hsh, json_key, attr_key, conflicts: nil)
        return unless hsh.key?(json_key)

        public_send("#{attr_key}=", hsh[json_key])
        keys_to_export.delete(conflicts) if conflicts
        keys_to_export.push(attr_key) unless keys_to_export.include?(attr_key)
      end
    end
  end
end
