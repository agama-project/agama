require "yast2/systemd/unit"
require "yast2/systemd/socket_finder"

module Yast2
  module Systemd
    # Respresent missed socket
    class SocketNotFound < StandardError
      def initialize(socket_name)
        super "Socket unit '#{socket_name}' not found"
      end
    end

    #  API to manage a systemd.socket unit
    #
    #  @example How to use it in other yast libraries
    #
    #    require 'yast'
    #    require 'yast2/systemd/socket'
    #
    #    ## Get a socket unit by its name
    #    ## If the socket unit can't be found, you'll get a nil object
    #
    #    socket = Yast2::Systemd::Socket.find('iscsid') # socket unit object
    #
    #    ## If you can't handle any nil at the place of calling,
    #    ## use the finder with exclamation mark;
    #    ## Systemd::SocketNotFound exception will be raised
    #
    #    socket = Yast2::Systemd::Socket.find!('IcanHasCheez') # Systemd::SocketNotFound: Socket unit 'IcanHasCheez' not found
    #
    #    ## Get basic unit properties
    #
    #    socket.unit_name   # 'iscsid'
    #    socket.unit_type   # 'socket'
    #    socket.id          # 'iscsid.socket'
    #    socket.path        # '/usr/lib/systemd/system/iscsid.socket' => unit file path
    #    socket.loaded?     # true if it's loaded, false otherwise
    #    socket.listening?  # true if it's listening, false otherwise
    #    socket.enabled?    # true if enabled, false otherwise
    #    socket.disabled?   # true if disabled, false otherwise
    #    socket.status      # the same string output you get with `systemctl status iscsid.socket`
    #    socket.show        # equivalent of calling `systemctl show iscsid.socket`
    #
    #    ## Socket unit file commands
    #
    #    # Unit file commands do modifications on the socket unit. Calling them triggers
    #    # socket properties reloading. In case a command fails, the error messages are available
    #    # through the method #errors as a string.
    #
    #    socket.start       # true if unit has been activated successfully
    #    socket.stop        # true if unit has been deactivated successfully
    #    socket.enable      # true if unit has been enabled successfully
    #    socket.disable     # true if unit has been disabled successfully
    #    socket.errors      # error string available if some of the actions above fails
    #
    #    ## Extended socket properties
    #
    #    # In case you need more details about the socket unit than the default ones,
    #    # you can extend the paramters when getting the socket. Those properties are
    #    # then available under the #properties instance method. To get an overview of
    #    # available socket properties, try e.g., `systemctl show iscsid.socket`
    #
    #    socket = Yast2::Systemd::Socket.find('iscsid', :can_start=>'CanStart', :triggers=>'Triggers')
    #    socket.properties.can_start  # 'yes'
    #    socket.properties.triggers   # 'iscsid.service'
    class Socket < Unit
      UNIT_SUFFIX = ".socket".freeze

      class << self
        # @param propmap [Yast2::Systemd::UnitPropMap]
        def find(socket_name, propmap = {})
          socket_name += UNIT_SUFFIX unless socket_name.end_with?(UNIT_SUFFIX)
          socket = new(socket_name, propmap)
          return nil if socket.properties.not_found?

          socket
        end

        # @param propmap [Yast2::Systemd::UnitPropMap]
        def find!(socket_name, propmap = {})
          find(socket_name, propmap) || raise(Systemd::SocketNotFound, socket_name)
        end

        # @param propmap [Yast2::Systemd::UnitPropMap]
        def all(propmap = {})
          sockets = Systemctl.socket_units.map { |s| new(s, propmap) }
          sockets.select { |s| s.properties.supported? }
        end

        # Returns the socket for a given service
        #
        # @param service_name [String] Service name (without the `.service` extension)
        # @return [Yast2::Systemd::Socket, nil]
        def for_service(service_name)
          @socket_finder ||= Yast2::Systemd::SocketFinder.new
          @socket_finder.for_service(service_name)
        end

        # Resets the cache for socket finder
        def reset
          @socket_finder = nil
        end
      end

      def listening?
        properties.sub_state == "listening"
      end
    end
  end
end
