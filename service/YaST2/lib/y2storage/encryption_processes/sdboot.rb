# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "y2storage/encryption_processes/base"
require "y2storage/encryption_type"
require "yast"
require "yast2/execute"

module Y2Storage
  module EncryptionProcesses
    # Encryption process that allows to setup device unlocking based on the sdbootutil provided by
    # SUSE.
    #
    # Check the documentation of sdbootutil for further information:
    # https://github.com/openSUSE/sdbootutil
    class Sdboot < Base
      include Yast::Logger

      # Creates an encryption layer over the given block device.
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param pbkdf [PbkdFunction, nil] PBKDF of the LUKS2 device.
      # @param label [String, nil] label of the LUKS device.
      #
      # @return [Encryption]
      def create_device(blk_device, dm_name, pbkdf: nil, label: nil)
        enc = super(blk_device, dm_name)
        enc.label = label if label
        enc.pbkdf = pbkdf if pbkdf
        enc
      end

      # @see EncryptionProcesses::Base#encryption_type
      def encryption_type
        EncryptionType::LUKS2
      end

      # @see Base#finish_installation
      # @param device [Encryption]
      def finish_installation(device)
        # Password used by systemd-cryptenroll to unlock the device (LUKS2)
        export_password(device.password, "cryptenroll")

        # Password used by sdbootutil as a recovery PIN
        export_password(device.password, "sdbootutil")

        enroll_tpm_authentication(device)
      end

      private

      SDBOOTUTIL = "/usr/bin/sdbootutil"
      private_constant :SDBOOTUTIL

      # "keyctl padd" command adds a key to the Linux kernel keyring.
      #
      # The kernel keyring is used to securely pass passwords between processes without exposing
      # them:
      #   - Not visible in process listings (ps, top)
      #   - Not visible in command history
      #   - Not visible in environment variables
      #   - Only accessible by processes with proper permissions
      #
      # In this case:
      #   - The password is stored with description "cryptenroll" for systemd-cryptenroll to
      #     retrieve
      #   - The password is stored with description "sdbootutil" for sdbootutil to retrieve
      #
      # Both tools know to look for their respective keys in the user keyring to unlock/enroll the
      # LUKS2 device without the password being passed as a command-line argument.
      #
      # A new key is always added (padd) because systemd is supposed to drop the key once it is
      # used.
      #
      # @param password [String]
      # @param kind [String]
      def export_password(password, kind)
        if password.empty?
          log.error("Cannot pass empty password via the keyring.")
          return
        end

        Yast::Execute.on_target!("keyctl", "padd", "user", kind, "@s",
          recorder: Yast::ReducedRecorder.new(skip: :stdin),
          stdin:    password)
      rescue Cheetah::ExecutionFailed => e
        log.error(
          format(
            "Cannot pass the password via the keyring:\n" \
            "Command `%{command}`.\n" \
            "Error output: %{stderr}",
            command: e.commands.inspect,
            stderr:  e.stderr
          )
        )
      end

      # @param device [Encryption]
      def enroll_tpm_authentication(device)
        Yast::Execute.on_target!(
          SDBOOTUTIL,
          "enroll",
          "--method=tpm2",
          "--devices=#{device.blk_device.name}"
        )
      rescue Cheetah::ExecutionFailed => e
        log.error(
          format(
            "Cannot enroll authentication:\n" \
            "Command `%{command}`.\n" \
            "Error output: %{stderr}",
            command: e.commands.inspect,
            stderr:  e.stderr
          )
        )
      end
    end
  end
end
