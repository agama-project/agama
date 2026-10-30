require "yast"

module Yast2
  module Systemd
    # A replacement for {Yast2::Systemd::UnitProperties} during installation
    #
    # Systemd `show` command (systemctl show) is not available during
    # installation and will return error "Running in chroot, ignoring request."
    # Therefore, we must avoid calling it in the installation workflow, reason
    # why exist this class that helps to keep the API partially consistent.
    #
    # It has two goals:
    #
    #   1. Checks for existence of the unit based on the stderr from the
    #   command `systemctl is-enabled`
    #   2. Retrieves the status enabled|disabled which is needed in the
    #   installation system.
    #
    # There are currently only 3 commands available for systemd in
    # inst-sys/chroot: `systemctl enable|disable|is-enabled`. The rest will
    # return the error message mentioned above.
    #
    # @note Once the inst-sys has running dbus/systemd, this class definition
    # can be removed together with the condition for Stage.initial in the
    # {Yast2::Systemd::Unit#show}
    class UnitInstallationProperties < OpenStruct
      include Yast::Logger

      def initialize(systemd_unit)
        super()
        self[:systemd_unit] = systemd_unit
        self[:status]       = read_status
        self[:raw]          = status.stdout
        self[:error]        = status.stderr
        self[:exit]         = status.exit
        self[:enabled?]     = status.exit.zero?
        self[:not_found?]   = service_missing?
      end

    private

      def read_status
        systemd_unit.command("is-enabled")
      end

      # Analyze the exit code and stdout of the command `systemctl is-enabled
      # service_name`
      #
      # @see https://www.freedesktop.org/software/systemd/man/systemctl.html#is-enabled%20UNIT%E2%80%A6
      #
      # @return [Boolean] true if service does not exist; false otherwise
      def service_missing?
        # the service exists and it's enabled
        return false if status.exit.zero?
        # the service exists and it's disabled
        return false if status.exit.nonzero? && status.stdout.match(/disabled|masked|linked/)

        # for all other cases the service does not exist
        true
      end
    end
  end
end
