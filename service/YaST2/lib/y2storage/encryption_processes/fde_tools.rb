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

require "yast2/execute"
require "yast2/systemd/service"
require "y2storage/secret_attributes"

module Y2Storage
  module EncryptionProcesses
    # Auxiliary class to interact with the utilities provided by the fde-tools package
    class FdeTools
      include SecretAttributes
      include Yast::Logger

      # Location of the fdectl command
      FDECTL = "/usr/sbin/fdectl".freeze
      private_constant :FDECTL

      # Passphrase that was used to encrypt the device and that is needed to
      # perform several of the steps
      #
      # @return [String]
      secret_attr :recovery_password

      # Constructor
      def initialize(recovery_password = nil)
        self.recovery_password = recovery_password
      end

      # Whether fde-tools detect a working TPM2 chip in the system
      #
      # @return [Boolean]
      def tpm_present
        Yast::Execute.on_target!(FDECTL, "tpm-present")
        log.info "FDE: TPMv2 detected"
        true
      rescue Cheetah::ExecutionFailed
        log.info "FDE: TPMv2 not detected"
        false
      end

      alias_method :tpm_present?, :tpm_present

      # Adds an additional passphrase to the encrypted device and configures Grub2
      # to use that passphrase during the next boot
      def add_secondary_password
        command_with_password("add-secondary-password")
      end

      # Adds to the encrypted device the new key that will be used as a base to complete
      # the sealing process on the next boot
      def add_secondary_key
        command_with_password("add-secondary-key")
      end

      # @see #enroll_service
      ENROLL_SERVICE = "fde-tpm-enroll.service".freeze
      private_constant :ENROLL_SERVICE

      # Systemd service that takes care of finishing the configuration of the encrypted
      # devices, sealing the new key and dropping the temporary one used by Grub2 for
      # the first boot.
      #
      # @return [Yast2::Systemd::Service]
      def enroll_service
        service = Yast2::Systemd::Service.find(ENROLL_SERVICE)
        log.info "FDE: TPM enroll service: #{service}"
        service
      end

      private

      # Executes an fdectl command that requires the recovery password to complete
      #
      # @return [Boolean] true if the command was successfully executed
      def command_with_password(command)
        Yast::Execute.on_target!(
          FDECTL, command,
          stdin:    "#{recovery_password}\n",
          recorder: Yast::ReducedRecorder.new(skip: :stdin)
        )
        true
      rescue Cheetah::ExecutionFailed
        false
      end
    end
  end
end
