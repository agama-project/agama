require "yast"

module Yast2
  module Systemd
    # Structure holding  properties of systemd unit
    class UnitProperties < OpenStruct
      include Yast::Logger

      SUPPORTED_STATES = %w[enabled disabled].freeze

      # Values of `#active_state` fow which we consider a unit "active".
      #
      # systemctl.c:check_unit_active uses (active, reloading)
      # For bsc#884756 we also consider "activating" to be active.
      #
      # "maintenance" means that the unit will automatically return
      # to be "active" after a while. (`systemctl clean` was invoked)
      #
      # (The remaining states are "deactivating", "inactive", "failed".)
      #
      # Yes, depending on systemd states that are NOT covered by their
      # interface stability promise is fragile.
      # But: 10 to 50ms per call of systemctl is-active, times 100 to 300 services
      # (depending on hardware and software installed, VM or not)
      # is a 1 to 15 second delay (bsc#1045658).
      # That is why we try hard to avoid many systemctl calls.
      ACTIVE_STATES = ["active", "activating", "maintenance", "reloading"].freeze

      # @param systemd_unit [Yast2::Systemd::Unit]
      # @param property_text [String,nil] if provided, use it instead of calling `systemctl show`
      def initialize(systemd_unit, property_text)
        super()
        self[:systemd_unit] = systemd_unit
        if property_text.nil?
          raw_output   = load_systemd_properties
          self[:raw]   = raw_output.stdout
          self[:error] = raw_output.stderr
          self[:exit]  = raw_output.exit
        else
          self[:raw]   = property_text
          self[:error] = ""
          self[:exit]  = 0
        end

        if !exit.zero? || !error.empty?
          message = "Failed to get properties for unit '#{systemd_unit.unit_name}' ; "
          message << "Command `#{raw_output.command}` returned error: #{error}"
          log.error(message)
          self[:not_found?] = true
          return
        end

        extract_properties
        self[:active?]         = ACTIVE_STATES.include?(active_state)
        self[:running?]        = sub_state  == "running"
        self[:loaded?]         = load_state == "loaded"
        self[:not_found?]      = load_state == "not-found"
        self[:static?]         = unit_file_state == "static"
        self[:preset_enabled?] = read_preset_enabled_state
        self[:enabled?]        = read_enabled_state
        self[:supported?]      = SUPPORTED_STATES.include?(unit_file_state)
        self[:can_reload?]     = can_reload == "yes"
      end

    private

      # Check the value of #unit_file_state; its value mirrors UnitFileState dbus property
      # @return [Boolean] True if enabled, False if not
      def read_enabled_state
        # If UnitFileState property is missing (due to e.g. legacy sysvinit service) or
        # has an unknown entry (e.g. "bad") we must use a different way how to get the
        # real status of the service.
        if SUPPORTED_STATES.include?(unit_file_state)
          state_name_enabled?(unit_file_state)
        else
          # Check for exit code of `systemctl is-enabled systemd_unit.name` ; additionally
          # test the stdout of the command for valid values when the service is enabled
          # https://www.freedesktop.org/software/systemd/man/systemctl.html#is-enabled%20UNIT%E2%80%A6
          status = systemd_unit.command("is-enabled")
          status.exit.zero? && state_name_enabled?(status.stdout)
        end
      end

      # Determines whether the unit should be enabled by default (preset)
      # @return [Boolean] True if enabled by default, false otherwise.
      def read_preset_enabled_state
        return false unless unit_file_preset

        state_name_enabled?(unit_file_preset.strip)
      end

      # Systemd service unit can have various states like enabled, enabled-runtime,
      # linked, linked-runtime, masked, masked-runtime, static, disabled, invalid.
      # We test for the return value 'enabled' and 'enabled-runtime' to consider
      # a service as enabled.
      # @return [Boolean] True if enabled, False if not
      def state_name_enabled?(state)
        ["enabled", "enabled-runtime"].include?(state.strip)
      end

      def extract_properties
        systemd_unit.propmap.each do |name, property|
          self[name] = raw[/#{property}=(.+)/, 1]
        end
      end

      def load_systemd_properties
        names = systemd_unit.propmap.values
        opts = names.map { |property_name| " --property=#{property_name} " }
        systemd_unit.command("show", options: opts.join)
      end
    end
  end
end
