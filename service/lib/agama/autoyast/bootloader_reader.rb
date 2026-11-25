# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

module Agama
  module AutoYaST
    # Builds the Agama "bootloader" section from an AutoYaST profile.
    class BootloaderReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "bootloader" section.
      #
      # @return [Hash] Agama "bootloader" section
      def read
        bootloader_hash = profile.fetch_as_hash("bootloader")
        global = bootloader_hash.fetch_as_hash("global")
        loader_type = bootloader_hash["loader_type"]
        return {} if global.empty? && loader_type.to_s.empty?

        bootloader = {}
        add_type(bootloader, loader_type)
        add_timeout(bootloader, global)
        add_kernel_params(bootloader, global)
        add_update_nvram(bootloader, global)

        { "bootloader" => bootloader }
      end

    private

      attr_reader :profile

      def add_type(bootloader, loader_type)
        type = convert_loader_type(loader_type)
        bootloader["type"] = type if type
      end

      def add_timeout(bootloader, global)
        return unless global["timeout"].is_a?(Integer)

        if global["timeout"] >= 0
          bootloader["timeout"] = global["timeout"]
        else
          bootloader["stopOnBootMenu"] = true
        end
      end

      def add_kernel_params(bootloader, global)
        bootloader["extraKernelParams"] = global["append"] unless global["append"].to_s.empty?
      end

      # In the AutoYaST schema, update_nvram is defined as STRING_BOOL ("true" | "false"):
      # https://github.com/yast/yast-bootloader/blob/master/src/autoyast-rnc/bootloader.rnc
      # Without config:type="boolean" in XML, YaST parses it as a String ("true" / "false"),
      # while typed profiles or in-memory hashes provide a Boolean. We accept both and normalize
      # to boolean true/false as required by Agama's schema.
      def add_update_nvram(bootloader, global)
        return if global["update_nvram"].to_s.empty?

        bootloader["updateNvram"] = [true, "true"].include?(global["update_nvram"])
      end

      def convert_loader_type(loader_type)
        case loader_type
        when "grub2", "grub2-efi"
          "grub2"
        when "systemd-boot"
          "systemd-boot"
        when "none"
          "none"
        end
      end
    end
  end
end
