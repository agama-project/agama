require "yast2/systemctl"
require "yast2/systemd/unit_prop_map"
require "yast2/systemd/unit_properties"
require "yast2/systemd/unit_installation_properties"

require "ostruct"

module Yast2
  module Systemd
    ###
    #  Use this class always as a parent class for implementing various systemd units.
    #  Do not use it directly for ad-hoc implementation of systemd units.
    #
    #  @example Create a systemd service unit
    #
    #     class Service < Yast2::Systemd::Unit
    #       SUFFIX = ".service"
    #       PROPMAP = {
    #         before: "Before"
    #       }
    #
    #       def initialize service_name, propmap={}
    #         service_name += SUFFIX unless service_name.end_with?(SUFFIX)
    #         super(service_name, PROPMAP.merge(propmap))
    #       end
    #
    #       def before
    #         properties.before.split
    #       end
    #     end
    #
    #     service = Service.new('sshd')
    #
    #     service.before # ['shutdown.target', 'multi-user.target']
    #
    class Unit
      Yast.import "Stage"
      Yast.import "Systemd"
      include Yast::Logger

      SUPPORTED_TYPES = %w[service socket target].freeze

      # with ruby 2.4 delegating ostruct with Forwardable start to write warning
      # so define it manually (bsc#1049433)
      FORWARDED_METHODS = [
        :id,
        :path,
        :description,
        :active?,
        :enabled?,
        :loaded?,
        :active_state,
        :sub_state,
        :can_reload?,
        :not_found?,
        :preset_enabled?
      ].freeze

      private_constant :FORWARDED_METHODS

      FORWARDED_METHODS.each { |m| define_method(m) { properties.public_send(m) } }

      # @return [String] eg. "apache2"
      #   (the canonical one, may be different from unit_name)
      attr_reader :name
      # @return [String] eg. "apache2"
      attr_reader :unit_name
      # @return [String] eg. "service"
      attr_reader :unit_type
      # @return [Yast2::Systemd::UnitPropMap]
      attr_reader :propmap
      # @return [String]
      #   eg "Failed to get properties: Unit name apache2@.service is not valid."
      attr_reader :error
      # @return [Yast2::Systemd::UnitProperties]
      attr_reader :properties

      # @param full_unit_name [String] eg "foo.service"
      # @param propmap [Yast2::Systemd::UnitPropMap]
      # @param property_text [String,nil]
      #   if provided, use it instead of calling `systemctl show`
      def initialize(full_unit_name, propmap = UnitPropMap.new, property_text = nil)
        @unit_name, dot, @unit_type = full_unit_name.rpartition(".")
        raise "Missing unit type suffix" if dot.empty?

        log.warn "Unsupported unit type '#{unit_type}'" unless SUPPORTED_TYPES.include?(unit_type)
        @propmap = propmap.merge!(UnitPropMap::DEFAULT)

        @properties = show(property_text)
        @error = properties.error
        # Id is not present when the unit name is not valid
        @name = id.to_s.split(".").first || unit_name
      end

      # @raise [Yast::SystemctlError] if 'systemctl show' cannot be executed
      def refresh!
        @properties = show
        @error = properties.error
        properties
      end

      # Run 'systemctl show' and parse the unit properties
      #
      # @raise [Yast::SystemctlError] if 'systemctl show' cannot be executed
      #
      # @param property_text [String,nil] if provided, use it instead of calling `systemctl show`
      # @return [Yast2::Systemd::UnitProperties]
      def show(property_text = nil)
        # Using different handler during first stage (installation, update, ...)
        # Avoid to call systemctl when running inside a chroot (bsc#1168849) as
        # it reports an error by default.
        if Yast::WFM.scr_chrooted? || (Yast::Stage.initial && !Yast::Systemd.Running)
          UnitInstallationProperties.new(self)
        else
          UnitProperties.new(self, property_text)
        end
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [String]
      def status
        command("status", options: "2>&1").stdout
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly started
      def start
        run_command! { command("start") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly stopped
      def stop
        run_command! { command("stop") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly enabled
      def enable
        run_command! { command("enable") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly disabled
      def disable
        run_command! { command("disable") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly restarted
      def restart
        run_command! { command("restart") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the service was correctly restarted
      def try_restart
        run_command! { command("try-restart") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly reloaded
      def reload
        run_command! { command("reload") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly reloaded or restarted
      def reload_or_restart
        run_command! { command("reload-or-restart") }
      end

      # @raise [Yast::SystemctlError] if the command cannot be executed
      # @return [Boolean] true if the unit was correctly reloaded or restarted
      def reload_or_try_restart
        run_command! { command("reload-or-try-restart") }
      end

      # Runs a command in the underlying system
      #
      # @raise [Yast::SystemctlError] if the command cannot be executed
      #
      # @param command_name [String]
      # @return [#command, #stdout, #stderr, #exit]
      def command(command_name, options = {})
        command = "#{command_name} #{unit_name}.#{unit_type} #{options[:options]}"
        Systemctl.execute(command)
      end

    private

      # Run a command, pass its stderr to {#error}, {#refresh!}.
      # @yieldreturn [#command,#stdout,#stderr,#exit]
      # @return [Boolean] success? (exit was zero)
      def run_command!
        error.clear
        command_result = yield
        error << command_result.stderr
        refresh!
        command_result.exit.zero?
      end
    end
  end
end
