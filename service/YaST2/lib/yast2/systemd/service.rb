require "yast"
require "yast2/systemd/unit"
require "yast2/systemd/unit_prop_map"
require "yast2/systemd/socket"

require "shellwords"

module Yast2
  module Systemd
    # Represent a missing service
    class ServiceNotFound < StandardError
      def initialize(service_name)
        super "Service unit '#{service_name}' not found"
      end
    end

    # API to manage a systemd.service unit
    #
    # @example How to use it in other yast libraries
    #    require 'yast'
    #    require 'yast2/systemd/service'
    #
    #    ## Get a service unit by its name
    #    ## If the service unit can't be found, you'll get nil
    #
    #    service = Yast2::Systemd::Service.find('sshd') # service unit object
    #
    #    # or using the full unit id 'sshd.service'
    #
    #    service = Yast2::Systemd::Service.find('sshd.service')
    #
    #    ## If you can't handle any nil at the place of calling,
    #    ## use the finder with exclamation mark;
    #    ## Systemd::ServiceNotFound exception will be raised
    #
    #    service = Yast2::Systemd::Service.find!('IcanHasMoar') # Systemd::ServiceNotFound: Service unit 'IcanHasMoar' not found
    #
    #    ## Get basic unit properties
    #
    #    service.unit_name   # 'sshd'
    #    service.unit_type   # 'service'
    #    service.id          # 'sshd.service'
    #    service.description # 'OpenSSH Daemon'
    #    service.path        # '/usr/lib/systemd/system/sshd.service'
    #    service.loaded?     # true if it's loaded, false otherwise
    #    service.running?    # true if it's active and running
    #    service.enabled?    # true if enabled, false otherwise
    #    service.disabled?   # true if disabled, false otherwise
    #    service.status      # the same text output you get with `systemctl status sshd.service`
    #    service.show        # equivalent of calling `systemctl show sshd.service`
    #
    #    ## Service unit file commands
    #
    #    # Unit file commands do modifications on the service unit. Calling them triggers
    #    # service properties reloading. If a command fails, the error message is available
    #    # through the method #error as a string.
    #
    #    service.start       # true if unit has been activated successfully
    #    service.stop        # true if unit has been deactivated successfully
    #    service.enable      # true if unit has been enabled successfully
    #    service.disable     # true if unit has been disabled successfully
    #    service.error       # error string available if some of the actions above fails
    #
    #    ## Extended service properties
    #
    #    # In case you need more details about the service unit than the default ones,
    #    # you can extend the parameters for .find method. Those properties are
    #    # then available on the service unit object under the #properties instance method.
    #    # An extended property is always a string, you must convert it manually,
    #    # no automatical casting is done by yast.
    #    # To get an overview of available service properties, try e.g., `systemctl show sshd.service`
    #
    #    service = Yast2::Systemd::Service.find('sshd', :type=>'Type')
    #    service.properties.type  # 'simple'
    class Service < Unit
      Yast.import "Stage"
      include Yast::Logger

      UNIT_SUFFIX = ".service".freeze

      class << self
        # @param service_name [String] "foo" or "foo.service"
        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Service,nil] `nil` if not found
        def find(service_name, propmap = UnitPropMap.new)
          service = build(service_name, propmap)
          return nil if service.properties.not_found?

          service
        end

        # @param service_name [String] "foo" or "foo.service"
        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Service]
        # @raise [Systemd::ServiceNotFound]
        def find!(service_name, propmap = UnitPropMap.new)
          find(service_name, propmap) || raise(Systemd::ServiceNotFound, service_name)
        end

        # @param service_names [Array<String>] "foo" or "foo.service"
        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Array<Service,nil>] `nil` if a service is not found,
        #   [] if this helper cannot be used:
        #   either we're in the inst-sys without systemctl,
        #   or it has returned fewer services than requested
        #   (and we cannot match them up)
        def find_many_at_once(service_names, propmap = UnitPropMap.new)
          return [] if Yast::Stage.initial

          snames = service_names.map { |n| n + UNIT_SUFFIX unless n.end_with?(UNIT_SUFFIX) }
          snames_s = snames.join(" ")
          pnames_s = UnitPropMap::DEFAULT.merge(propmap).values.join(",")
          out = Systemctl.execute("show  --property=#{pnames_s} #{snames_s}")
          log.error "returned #{out.exit}, #{out.stderr}" unless out.exit.zero? && out.stderr.empty?
          property_texts = out.stdout.split("\n\n")
          return [] unless snames.size == property_texts.size

          snames.zip(property_texts).each_with_object([]) do |(name, property_text), memo|
            service = new(name, propmap, property_text)
            memo << service unless service.not_found?
          end
        end

        # @param service_names [Array<String>] "foo" or "foo.service"
        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Array<Service,nil>] `nil` if not found
        def find_many(service_names, propmap = UnitPropMap.new)
          services = find_many_at_once(service_names, propmap)
          return services unless services.empty?

          log.info "Retrying one by one"
          service_names.map { |n| find(n, propmap) }
        end

        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Array<Service>]
        def all(propmap = UnitPropMap.new)
          Systemctl.service_units.map { |s| new(s, propmap) }
        end

        # Instantiate a Systemd::Service object based on the given name
        #
        # Use with caution as the service might exist or not. If you need to
        # react when the service does not exist, use Systemd::Service.find.
        #
        # @param service_name [String] "foo" or "foo.service"
        # @param propmap [Yast2::Systemd::UnitPropMap]
        # @return [Service] System service with the given name
        def build(service_name, propmap = UnitPropMap.new)
          service_name += UNIT_SUFFIX unless service_name.end_with?(UNIT_SUFFIX)
          new(service_name, propmap)
        end
      end

      private_class_method :find_many_at_once

      # Available only on installation system
      START_SERVICE_INSTSYS_COMMAND = "/bin/service_start".freeze

      # @return [String]
      def pid
        properties.pid
      end

      def running?
        properties.running?
      end

      def static?
        properties.static?
      end

      def start
        command = "#{START_SERVICE_INSTSYS_COMMAND} #{unit_name.shellescape}"
        installation_system? ? run_instsys_command(command) : super
      end

      def stop
        command = "#{START_SERVICE_INSTSYS_COMMAND} --stop #{unit_name.shellescape}"
        installation_system? ? run_instsys_command(command) : super
      end

      def restart
        # Delegate to Systemd::Unit#restart if not within installation
        return super unless installation_system?

        stop
        sleep(1)
        start
      end

      # Returns socket associated with service or nil if there is no such socket
      #
      # @return [Yast2::Systemd::Socket,nil]
      # @see Yast2::Systemd::Socket.for_service
      def socket
        @socket ||= Socket.for_service(name)
      end

      # Determines whether the service has an associated socket
      #
      # @return [Boolean] true if an associated socket exists; false otherwise.
      def socket?
        !socket.nil?
      end

    private

      def installation_system?
        File.exist?(START_SERVICE_INSTSYS_COMMAND)
      end

      def run_instsys_command(command)
        log.info("Running command '#{command}'")
        error.clear
        result = OpenStruct.new(
          Yast::SCR.Execute(Yast::Path.new(".target.bash_output"), command)
        )
        error << result.stderr
        result.exit.zero?
      end
    end
  end
end
