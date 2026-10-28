# Copyright (c) [2023] SUSE LLC
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
require "singleton"
require "y2storage/pbkd_function"

module Y2Storage
  module EncryptionProcesses
    # Class to read and write /etc/sysconfig/fde-tools
    #
    # The class is basically a simple wrapper for the SCR. The class does not
    # remember any values.
    class FdeToolsConfig
      include Singleton
      include Yast
      include Yast::Logger

      # Reads value for FDE_LUKS_PBKDF key and converts it to a proper PbkdFunction object
      #
      # @note In case the value cannot be converted, a fallback value is used,
      #   see {LUKS_PBKDF_FALLBACK}.
      #
      # @return [Y2Storage::PbkdFunction]
      def pbkd_function
        found = Y2Storage::PbkdFunction.find(fde_luks_pbkdf&.downcase)
        return found if found

        log.warn("sysconfig.fde-tools contains an invalid value '#{fde_luks_pbkdf}' for " \
                 "FDE_LUKS_PBKDF. Using fallback value #{LUKS_PBKDF_FALLBACK}.")
        Y2Storage::PbkdFunction.find(LUKS_PBKDF_FALLBACK)
      end

      # Writes the proper FDE_LUKS_PBKDF value into the sysconfig file
      #
      # @note The PbkdFunction object is converted to a plain string.
      #
      # @param pbkdf [Y2Storage::PbkdFunction]
      def pbkd_function=(pbkdf)
        self.fde_luks_pbkdf = pbkdf.to_s
      end

      def devices
        (fde_devices || "").split
      end

      def devices=(devices)
        self.fde_devices = devices.compact.join(" ")
      end

      private

      SYSCONFIG_PATH = ".sysconfig.fde-tools".freeze

      FDE_DEVICES = "FDE_DEVS".freeze
      FDE_LUKS_PBKDF = "FDE_LUKS_PBKDF".freeze

      LUKS_PBKDF_FALLBACK = :pbkdf2

      # Reads a key from the sysconfig file
      #
      # @param key [String]
      # @return [String, nil]
      def read(key)
        Yast::SCR.Read(path("#{SYSCONFIG_PATH}.#{key}"))
      end

      # Writes a value into the sysconfig file
      #
      # @param key [String]
      # @param value [String]
      def write(key, value)
        Yast::SCR.Write(path("#{SYSCONFIG_PATH}.#{key}"), value)
        Yast::SCR.Write(path(SYSCONFIG_PATH), nil)
      end

      # Reads the raw value for the FDE_DEVICES key
      #
      # @return [String, nil] nil if there is no value for FDE_EXTRA_DEVS
      def fde_devices
        read(FDE_DEVICES)
      end

      # Writes the value for the FDE_DEVICES key
      #
      # @param value [String]
      def fde_devices=(value)
        write(FDE_DEVICES, value)
      end

      # Reads the raw value for the FDE_LUKS_PBKDF key
      #
      # @return [String, nil] nil if there is no value for FDE_LUKS_PBKDF
      def fde_luks_pbkdf
        read(FDE_LUKS_PBKDF)
      end

      # Writes the value for the FDE_LUKS_PBKDF key
      #
      # @param value [String]
      def fde_luks_pbkdf=(value)
        write(FDE_LUKS_PBKDF, value)
      end
    end
  end
end
