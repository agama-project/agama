# Copyright (c) [2018] SUSE LLC
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

require "yast"
require "yast2/execute"
require "yast2/systemctl"

Yast.import "Stage"

module Yast2
  module Systemd
    # This class is responsible for finding out which sockets trigger a given service.
    #
    # When systemd is working properly, the relationship between services and sockets is cached in
    # order to reduce the amount of calls to `systemctl show`. However, during the installation, where
    # systemd is not fully operational, this class just tries to find a socket named after the
    # service.
    #
    # @example Finding a socket
    #   finder = Yast2::SystemdSocketFinder.new
    #   finder.for_service("cups").class # => Yast2::Systemd::Socket
    class SocketFinder
      # Returns the socket for a given service
      #
      # @param service_name [String] Service name (without the `.service` extension)
      # @return [Yast2::SystemdSocket, nil]
      def for_service(service_name)
        socket_name = socket_name_for(service_name)
        return nil unless socket_name

        Yast2::Systemd::Socket.find(socket_name)
      end

    private

      # Return the socket's name for a given service
      #
      # @note On 1st stage it returns just the same name.
      #
      # @return [String,nil]
      def socket_name_for(service_name)
        return service_name if Yast::Stage.initial

        sockets_map[service_name]
      end

      # Builds a map between services and sockets
      #
      # @note When more than one socket triggers the service, the last one will be used.
      #
      # @return [Hash<String,String>] Sockets indexed by the name of the service they trigger
      def sockets_map
        return @sockets_map if @sockets_map

        result = Yast2::Systemctl.execute(show_triggers_cmd)
        return {} unless result.exit.zero?

        lines = result.stdout.lines.map(&:chomp)
        @sockets_map = lines.each_slice(3).each_with_object({}) do |(id_str, triggers_str, _), memo|
          id = id_str[/Id=(\w+).socket/, 1]
          triggers = triggers_str[/Triggers=(\w+).service/, 1]
          memo[triggers] = id if triggers && id
        end
      end

      # @return [String] systemctl command to get services and their triggers
      SHOW_TRIGGERS_CMD = "show --property Id,Triggers %<unit_names>s".freeze

      # Returns the systemctl show command to get sockets details
      #
      # @note The list is alphabetically ordered.
      #
      # @return [String] systemctl show command
      def show_triggers_cmd
        format(SHOW_TRIGGERS_CMD, unit_names: unit_names.sort.join(" "))
      end

      # Returns the names of the socket units
      #
      # @return [Array<String>] Socket unit names
      def unit_names
        output = Yast::Execute.on_target(
          "/usr/bin/systemctl", "list-unit-files", "--type", "socket",
          stdout: :capture
        )
        output.lines.each_with_object([]) do |name, memo|
          socket_name = name[/\A(\w+.socket)/, 1]
          memo << socket_name if socket_name
        end
      end
    end
  end
end
