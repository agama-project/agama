# frozen_string_literal: true

require "fileutils"
require "yast"
require "y2storage"
require "bootloader/sysconfig"
require "bootloader/cpu_mitigations"
require "cfa/grub2/default"

Yast.import "Report"

module Bootloader
  # Represents bls compatile system calls which can be used
  # e.g. by grub2-bls and systemd-boot
  class Bls
    include Yast::Logger
    extend Yast::I18n

    SDBOOTUTIL = "/usr/bin/sdbootutil"

    def initialize
      textdomain "bootloader"
    end

    def self.create_menu_entries
      Yast::Execute.on_target!(SDBOOTUTIL, "add-all-kernels")
    rescue Cheetah::ExecutionFailed => e
      Yast::Report.Error(
        format(_(
                 "Cannot create boot menu entry:\n" \
                 "Command `%{command}`.\n" \
                 "Error output: %{stderr}"
               ), command: e.commands.inspect, stderr: e.stderr)
      )
    end

    def self.install_bootloader
      Yast::Execute.on_target!(SDBOOTUTIL, "install")
    rescue Cheetah::ExecutionFailed => e
      Yast::Report.Error(
      format(_(
               "Cannot install bootloader:\n" \
               "Command `%{command}`.\n" \
               "Error output: %{stderr}"
             ), command: e.commands.inspect, stderr: e.stderr)
    )
    end

    def self.update_bootloader
      Yast::Execute.on_target!(SDBOOTUTIL, "update-all-entries")
    rescue Cheetah::ExecutionFailed => e
      Yast::Report.Error(
      format(_(
               "Cannot update bootloader:\n" \
               "Command `%{command}`.\n" \
               "Error output: %{stderr}"
             ), command: e.commands.inspect, stderr: e.stderr)
    )
    end

    def self.write_menu_timeout(timeout)
      Yast::Execute.on_target!(SDBOOTUTIL, "set-timeout", "--", timeout)
    rescue Cheetah::ExecutionFailed => e
      Yast::Report.Error(
      format(_(
               "Cannot write boot menu timeout:\n" \
               "Command `%{command}`.\n" \
               "Error output: %{stderr}"
             ), command: e.commands.inspect, stderr: e.stderr)
    )
    end

    def self.menu_timeout
      begin
        output = Yast::Execute.on_target!(SDBOOTUTIL, "get-timeout", stdout: :capture).to_i
      rescue Cheetah::ExecutionFailed => e
        error_message = format(_(
                                 "Cannot read boot menu timeout:\n" \
                                 "Command `%{command}`.\n" \
                                 "Error output: %{stderr}"
                               ), command: e.commands.inspect, stderr: e.stderr)
        if Yast::Stage.initial && Yast::Mode.update
          Yast::Report.Warning(error_message)
        else
          Yast::Report.Error(error_message)
        end
        output = -2 # -1 will be returned from sdbootutil for menu-force
      end
      output
    end

    def self.write_default_menu(default)
      return if default.empty?

      begin
        Yast::Execute.on_target!(SDBOOTUTIL, "set-default", default)
      rescue Cheetah::ExecutionFailed => e
        Yast::Report.Error(
          format(_(
                   "Cannot write default boot menu entry:\n" \
                   "Command `%{command}`.\n" \
                   "Error output: %{stderr}"
                 ), command: e.commands.inspect, stderr: e.stderr)
        )
      end
    end

    def self.default_menu
      begin
        output = Yast::Execute.on_target!(SDBOOTUTIL, "get-default", stdout: :capture)
      rescue Cheetah::ExecutionFailed => e
        error_message = format(_(
                                 "Cannot read default menu:\n" \
                                 "Command `%{command}`.\n" \
                                 "Error output: %{stderr}"
                               ), command: e.commands.inspect, stderr: e.stderr)
        if Yast::Stage.initial && Yast::Mode.update
          Yast::Report.Warning(error_message)
        else
          Yast::Report.Error(error_message)
        end
        output = ""
      end
      output.strip
    end

    # Enable TPM2/FIDO2 if it is required
    # rubocop:disable Metrics/AbcSize
    def self.set_authentication
      generate_machine_id
      devicegraph = Y2Storage::StorageManager.instance.staging

      devicegraph.encryptions&.each do |d|
        next unless d.method.id == :systemd_fde

        # No enrollment is needed. Setting password while
        # encryption is enough.
        next if d.authentication.value == "password"

        # Password used by systemd-cryptenroll to unlock the device (LUKS2)
        export_password(d.password, "cryptenroll")
        # Password used by sdbootutil as a recovery PIN
        if d.authentication.value == "tpm2" || d.authentication.value == "tpm2+pin"
          export_password(d.password, "sdbootutil")
        end
        # Password used by sdbootutil as a TPM2 PIN
        export_password(d.password, "sdbootutil-pin") if d.authentication.value == "tpm2+pin"

        ask_for_fido2_key(d.blk_device.name) if d.authentication.value == "fido2"
        begin
          Yast::Execute.on_target!(SDBOOTUTIL,
            "enroll", "--method=#{d.authentication.value}",
            "--devices=#{d.blk_device.name}")
        rescue Cheetah::ExecutionFailed => e
          Yast::Report.Error(
            format(_(
                     "Cannot enroll authentication:\n" \
                     "Command `%{command}`.\n" \
                     "Error output: %{stderr}"
                   ), command: e.commands.inspect, stderr: e.stderr)
          )
        end
      end
    end
    # rubocop:enable Metrics/AbcSize

    def self.generate_machine_id
      Yast::SCR.Execute(Yast::Path.new(".target.remove"), "/etc/machine-id")
      begin
        Yast::Execute.on_target!("/bin/systemd-machine-id-setup")
      rescue Cheetah::ExecutionFailed => e
        Yast::Report.Error(
          format(_(
                   "Cannot create machine-id:\n" \
                   "Command `%{command}`.\n" \
                   "Error output: %{stderr}"
                 ), command: e.commands.inspect, stderr: e.stderr)
        )
      end
    end

    def self.export_password(pwd, kind)
      if pwd.empty?
        Yast::Report.Error(_("Cannot pass empty password via the keyring."))
        return
      end

      begin
        Yast::Execute.on_target!("keyctl", "padd", "user", kind, "@u",
          recorder: Yast::ReducedRecorder.new(skip: :stdin),
          stdin:    pwd)
      rescue Cheetah::ExecutionFailed => e
        Yast::Report.Error(
          format(_(
                   "Cannot pass the password via the keyring:\n" \
                   "Command `%{command}`.\n" \
                   "Error output: %{stderr}"
                 ), command: e.commands.inspect, stderr: e.stderr)
        )
      end
    end

    def self.ask_for_fido2_key(device_name)
      Yast::Popup.Message(
        format(_(
          "Please ensure that a FIDO2 Key is connected to your system in order to " \
          "enroll the authentication for device %{device}.\n" \
          "You will be asked to push the FIDO2 key button twice for " \
          "transfering the information."
        ), device: device_name)
      )
    end
  end
end
