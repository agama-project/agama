require "ostruct"
require "timeout"
require "shellwords"

require "yast"

Yast.import "Systemd"

module Yast2
  # Wrapper around `systemctl` command.
  # - uses non-interactive flags
  # - has a timeout
  #
  module Systemctl
    # Exception when systemctl command failed
    class Error < StandardError
      # @param details [#to_s]
      def initialize(details)
        super "Systemctl command failed: #{details}"
      end
    end

    include Yast::Logger

    CONTROL         = "/usr/bin/systemctl".freeze
    # The combination "--full --no-legend --no-pager --plain" is appropriate for
    # automated processing of systemctl output.
    # https://github.com/systemd/systemd/commit/1cabd2d0c56b7de73e4a4fb645f3bbed4a528d2c
    COMMAND_OPTIONS = " --plain --full --no-legend --no-pager --no-ask-password ".freeze
    ENV_VARS        = " LANG=C TERM=dumb COLUMNS=1024 ".freeze
    SYSTEMCTL       = ENV_VARS + CONTROL + COMMAND_OPTIONS
    TIMEOUT         = 40 # seconds

    class << self
      BASH_SCR_PATH = Yast::Path.new(".target.bash_output")

      # @param command [String]
      # @return [#command,#stdout,#stderr,#exit]
      # @raise [SystemctlError] if it times out
      def execute(command)
        log.info("systemctl #{command}")
        command = SYSTEMCTL + command
        log.debug "Executing `systemctl` command: #{command}"
        result = ::Timeout.timeout(TIMEOUT) { Yast::SCR.Execute(BASH_SCR_PATH, command) }
        OpenStruct.new(result.merge!(command: command))
      rescue ::Timeout::Error
        raise Yast2::Systemctl::Error, "Timeout #{TIMEOUT} seconds: #{command}"
      end

      # @return [Array<String>] like ["a.socket", "b.socket"]
      def socket_units
        sockets_from_files = list_unit_files(type: :socket).lines.map do |line|
          first_column(line)
        end

        sockets_from_units = list_units(type: :socket).lines.map do |line|
          first_column(line)
        end

        (sockets_from_files | sockets_from_units).compact
      end

      # @return [Array<String>] like ["a.service", "b.service"]
      def service_units
        services_from_files = list_unit_files(type: :service).lines.map do |line|
          first_column(line)
        end

        services_from_units = list_units(type: :service).lines.map do |line|
          first_column(line)
        end

        (services_from_files | services_from_units).compact
      end

      # @return [Array<String>] like ["a.target", "b.target"]
      def target_units
        targets_from_files = list_unit_files(type: :target).lines.map do |line|
          first_column(line)
        end

        targets_from_units = list_units(type: :target).lines.map do |line|
          first_column(line)
        end

        (targets_from_files | targets_from_units).compact
      end

    private

      def list_unit_files(type: nil)
        if !Yast::Systemd.Running
          log.info "systemd not running. Returning empty list"
          return ""
        end

        command = " list-unit-files "
        command << " --type=#{type.to_s.shellescape} " if type
        execute(command).stdout
      end

      def list_units(type: nil, all: true)
        if !Yast::Systemd.Running
          log.info "systemd not running. Returning empty list"
          return ""
        end

        command = " list-units "
        command << " --all " if all
        command << " --type=#{type.to_s.shellescape} " if type
        execute(command).stdout
      end

      def first_column(line)
        line[/\S+/]
      end
    end
  end
end
