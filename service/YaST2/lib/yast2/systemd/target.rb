require "yast"
require "yast2/systemd/unit"

module Yast2
  module Systemd
    # Represents that the given service does not exists
    class TargetNotFound < StandardError
      def initialize(target_name)
        super "Target unit '#{target_name}' not found"
      end
    end

    # Exception when systemctl command failed
    class SystemctlError < StandardError
      # @param details [#to_s]
      def initialize(details)
        super "Systemctl command failed: #{details}"
      end
    end

    # API to manage a systemd.target unit
    #
    # @example How to find a custom systemd target
    #
    #   require 'yast'
    #   require 'yast2/systemd/target'
    #
    #   # This will return either a target object or nil
    #   target = Yast2::Systemd::Target.find('graphical')
    #
    #   # This returns target object or raises exception Systemd::TargetNotFound
    #   target = Yast2::Systemd::Target.find!('whatever')
    #
    #   # This returns collection of all available targets
    #   Yast2::Systemd::Target.all
    #
    # @example How to find the current default target
    #
    #   target = Yast2::Systemd::Target.get_default
    #   target.unit_name      # name of the default target
    #   target.allow_isolate? # should return true
    #
    # @example Set the default target
    #
    #   Yast2::Systemd::Target.set_default('multi-user') # returns true if success
    #
    #   # Or if we have already an target object, use this for default target
    #   target = Yast2::Systemd::Target.find('graphical')
    #   target.allow_isolate? # must be true to set default target
    #   target.set_default # returns true if success
    class Target < Unit
      include Yast::Logger

      UNIT_SUFFIX    = ".target".freeze
      DEFAULT_TARGET = "default.target".freeze
      # @return [Yast2::Systemd::UnitPropMap]
      PROPMAP        = { allow_isolate: "AllowIsolate" }.freeze

      # Disable unsupported methods for target units
      undef_method :start, :stop, :enable, :disable, :restart

      class << self
        # @param propmap [Yast2::Systemd::UnitPropMap]
        def find(target_name, propmap = {})
          target_name += UNIT_SUFFIX unless target_name.end_with?(UNIT_SUFFIX)
          target = new(target_name, PROPMAP.merge(propmap))

          if target.properties.not_found?
            log.error "Target #{target_name} not found: #{target.properties.inspect}"
            return nil
          end

          target
        end

        # @param propmap [Yast2::Systemd::UnitPropMap]
        def find!(target_name, propmap = {})
          find(target_name, propmap) || raise(Systemd::TargetNotFound, target_name)
        end

        # @param propmap [Yast2::Systemd::UnitPropMap]
        def all(propmap = {})
          targets = Systemctl.target_units.map do |target_unit_name|
            find(target_unit_name, propmap)
          end
          targets.compact
        end

        def get_default # rubocop:disable Naming/AccessorMethodName
          result = Systemctl.execute("get-default")
          raise(SystemctlError, result) unless result.exit.zero?

          find(result.stdout.strip)
        end

        def set_default(target) # rubocop:disable Naming/AccessorMethodName
          target_unit = target.is_a?(Systemd::Target) ? target : find(target)

          unless target_unit
            log.error "Cannot find target #{target.inspect}"
            return false
          end

          target_unit.set_default
        end
      end

      def allow_isolate?
        # We cannot find out a target properties from /mnt in inst-sys
        # systemctl doesn't return any properties in chroot
        # See bnc#889323
        ["yes", nil].include?(properties.allow_isolate)
      end

      def set_default
        unless allow_isolate?
          log.error "Cannot set #{id.inspect} as default target: Cannot be isolated (#{properties.allow_isolate})"
          return false
        end

        # Constructing a fallback target ID if we can't get it from systemctl
        target_name = id || "#{name}.target"

        result = Systemctl.execute("set-default --force #{target_name}")
        result.exit.zero?
      end
    end
  end
end
