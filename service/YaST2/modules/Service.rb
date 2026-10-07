# ***************************************************************************
#
# Copyright (c) 2002 - 2014 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/Service.ycp
# Package:  yast2
# Summary:  Service manipulation
# Authors:  Martin Vidner <mvidner@suse.cz>
#    Petr Blahos <pblahos@suse.cz>
#    Michal Svec <msvec@suse.cz>
#    Lukas Ocilka <locilka@suse.cz>
###

# Functions for systemd service handling used by other modules.

require "yast"
require "yast2/systemd/service"

module Yast
  class ServiceClass < Module
    include Yast::Logger

  private

    attr_writer :error

  public

    attr_reader :error

    def initialize
      super

      textdomain "base"
      @error = ""
    end

    # Send whatever systemd command you need to call for a specific service
    # If the command fails, log entry with output from systemctl is created in y2log
    # @param [String,String] Command name and service name
    # @return [Boolean] Result of the action, true means success
    def call(command_name, service_name)
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service

      systemd_command = case command_name
      when "show"    then :show
      when "status"  then :status
      when "start"   then :start
      when "stop"    then :stop
      when "enable"  then :enable
      when "disable" then :disable
      when "restart" then :restart
      when "reload"  then :reload
      when "try-restart" then :try_restart
      when "reload-or-restart" then :reload_or_restart
      when "reload-or-try-restart" then :reload_or_try_restart
      else
        raise "Command '#{command_name}' not supported"
      end

      result = service.send(systemd_command)
      failure(command_name, service_name, service.error) unless result
      result
    end

    # Check if service is active/running
    #
    # @param [String] name service name
    # @return true if service is active
    def Active(service_name)
      service = Yast2::Systemd::Service.find(service_name)
      !!(service && service.active?)
    end

    alias_method :active?, :Active

    # Check if service is enabled (in any runlevel)
    #
    # Forwards to chkconfig -l which decides between init and systemd
    #
    # @param [String] name service name
    # @return true if service is set to run in any runlevel
    def Enabled(name)
      service = Yast2::Systemd::Service.find(name)
      !!(service && service.enabled?)
    end

    alias_method :enabled?, :Enabled

    # Enable service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be enabled
    # @return true if operation is successful
    def Enable(service_name)
      log.info "Enabling service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:enable, service_name, service.error) unless service.enable

      true
    end

    alias_method :enable, :Enable

    # Disable service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be disabled
    # @return true if operation is  successful
    def Disable(service_name)
      log.info "Disabling service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:disable, service_name, service.error) unless service.disable

      true
    end

    alias_method :disable, :Disable

    # Start service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be started
    # @return true if operation is  successful
    def Start(service_name)
      log.info "Starting service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:start, service_name, service.error) unless service.start

      true
    end

    alias_method :start, :Start

    # Restart service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be restarted
    # @return true if operation is  successful
    def Restart(service_name)
      log.info "Restarting service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:restart, service_name, service.error) unless service.restart

      true
    end

    alias_method :restart, :Restart

    # Reload service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be reloaded
    # @return true if operation is  successful
    def Reload(service_name)
      log.info "Reloading service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:reload, service_name, service.error) unless service.reload

      true
    end

    alias_method :reload, :Reload

    # Stop service
    # Logs error with output from systemctl if the command fails
    # @param [String] service service to be stopped
    # @return true if operation is  successful
    def Stop(service_name)
      log.info "Stopping service '#{service_name}'"
      service = Yast2::Systemd::Service.find(service_name)
      return failure(:not_found, service_name) unless service
      return failure(:stop, service_name, service.error) unless service.stop

      true
    end

    alias_method :stop, :Stop

    # Error Message
    #
    # If a Service function returns an error, this function would return
    # an error message, possibly containing newlines.
    #
    # @return error message from the last operation
    def Error
      error
    end

    # @deprecated Use Yast2::Systemd::Service.find
    # Check that a service exists.
    # If not, set error_msg.
    # @param [String] name service name without a path, eg. nfsserver
    # @return Return true if the service exists.
    def checkExists(name)
      deprecate("use `Yast2::Systemd::Service.find` instead")

      return failure(:not_found, name) unless Yast2::Systemd::Service.find(name)

      true
    end

    # @deprecated Not supported by systemd
    # Get service info without peeking if service runs.
    # @param [String] name name of the service
    # @return Service information or empty map ($[])
    def Info(name)
      deprecate("not supported by systemd")

      unit = Yast2::Systemd::Service.find(name)
      return {} unless unit

      read = Convert.to_map(SCR.Read(path(".init.scripts.runlevel"), name))
      detail = Ops.get_map(read, name, {})
      read = Convert.to_map(SCR.Read(path(".init.scripts.comment"), name))
      service = Ops.get_map(read, name, {})
      Builtins.add(
        Builtins.add(service, "start", Ops.get_list(detail, "start", [])),
        "stop",
        Ops.get_list(detail, "stop", [])
      )
    end

    # @deprecated Use Yast2::Systemd::Service.find('service_name').id
    # Get complete systemd unit id
    # @param name name or alias of the unit
    # @return (resolved) unit Id
    def GetUnitId(unit)
      deprecate("use Yast2::Systemd::Service.find('service_name').id")

      unit = Yast2::Systemd::Service.find(unit)
      return nil unless unit

      unit.id
    end

    # @deprecated Use Yast2::Systemd::Service.find('service_name').name
    # Get the name from a systemd service unit id without the .service suffix
    # @param [String] name name or alias of the service
    # @return (resolved) service name without the .service suffix
    def GetServiceId(name)
      deprecate("use Yast2::Systemd::Service.find('service_name').name")

      unit = Yast2::Systemd::Service.find(name)
      return nil unless unit

      unit.name
    end

    # @deprecated Use `Active` instead
    # Get service status.
    # The status is the output from "service status".
    # It should conform to LSB. 0 means the service is running.
    # @param [String] name name of the service
    # @return init script exit status or -1 if it does not exist
    def Status(name)
      deprecate("use `active?` instead")

      unit = Yast2::Systemd::Service.find(name)
      failure(:not_found, name) unless unit

      unit&.active? ? 0 : -1
    end

    # @deprecated Not supported by systemd
    # Get service info and find out whether service is running.
    # @param [String] name name of the service
    # @return service map or empty map ($[])
    def FullInfo(name)
      deprecate("not supported by systemd")

      return {} if !checkExists(name)

      Builtins.add(Info(name), "started", Status(name))
    end

    # @deprecated Use `Disable` instead
    # Disables a given service and records errors.
    # Does not check if it exists.
    #
    # @param [String] name service name
    # @param [Boolean] force pass "--force" (workaround for #17608, #27370)
    # @return success state
    def serviceDisable(name, _force)
      deprecate("use `disable` instead")

      unit = Yast2::Systemd::Service.find(name)
      !!(unit && unit.disable)
    end

    # @deprecated Use the specific methods: `Enable` or `Disable`
    # Adjusts runlevels in which the service runs.
    #
    # @param string service name
    # @param [String] action "disable" -- remove links, "enable" -- if there are
    #    no links, set default, otherwise do nothing, "default" -- set
    #    defaults.
    # @return [Boolean] success state
    def Adjust(name, action)
      deprecate("use `enable` or `disable` instead")

      service = Yast2::Systemd::Service.find(name)
      return failure(:not_found, name) unless service

      case action
      when "disable"
        service.disable
      when "enable", "default"
        service.enable
      else
        log.error "Unknown action '#{action}' for service '#{name}'"
        false
      end
    end

    # @deprecated Use `Enable` or `Disable` instead
    # Set service to run in selected runlevels.
    # Obsoleted - enables or disables the given service depending on the
    # list of runlevels to start. If any runlevel is present, service is
    # enabled, otherwise disabled.
    #
    # @param [String] name name of service to adjust
    # @param [Array] list list of runlevels in which service should start
    # @return success state
    def Finetune(name, list)
      deprecate("use `enable` or `disable` instead")

      service = Yast2::Systemd::Service.find(name)
      return failure(:not_found, name) unless service

      if list.empty?
        service.disable
      else
        log.warn "Cannot enable service '#{name}' in selected runlevels, enabling for all"
        service.enable
      end
    end

    # @deprecated Use specific method for service configuration
    # Run init script.
    # @param [String] name init service name
    # @param [String] param init script argument
    # @return [Fixnum] exit value
    def RunInitScript(name, param)
      deprecate("use the specific unit command instead")

      service = Yast2::Systemd::Service.find(name)
      if !service
        failure(:not_found, name)
        return -1
      end

      result = case param
      when "start", "stop", "status", "reload", "restart", "enable", "disable"
        service.send(param)
      when "try-restart"
        service.try_restart
      when "reload-or-restart"
        service.reload_or_restart
      when "reload-or-try-restart"
        service.reload_or_try_restart
      else
        log.error "Unknown action '#{param}' for service '#{name}'"
        false
      end

      result ? 0 : -1
    end

    # @deprecated Use specific unit methods for service configuration
    # Run init script with a time-out.
    # @param [String] name init service name
    # @param [String] param init script argument
    # @return [Fixnum] exit value
    def RunInitScriptWithTimeOut(name, param)
      deprecate("use `start` or `stop` instead")

      service = Yast2::Systemd::Service.find(name)
      if !service
        failure(:not_found, name)
        return 1
      end
      service.send(param) ? 0 : 1
    end

    # @deprecated Use a specific method instread
    # Run init script and also return its output (stdout and stderr merged).
    # @param [String] name init service name
    # @param [String] param init script argument
    # @return A map of $[ "stdout" : "...", "stderr" : "...", "exit" : int]
    def RunInitScriptOutput(name, param)
      deprecate("use `start` or `stop` instead")

      service = Yast2::Systemd::Service.find(name)
      if service
        success = service.send(param)
        self.error = service.error
      else
        failure(:not_found, name)
        success = false
      end
      { "stdout" => "", "stderr" => error, "exit" => success ? 0 : 1 }
    end

    # @deprecated Runlevel features are not supported by systemd
    # Get list of enabled services in a runlevel
    # @param [Fixnum] runlevel requested runlevel number (0-6, -1 = Single)
    # @return [Array<String>] enabled services
    def EnabledServices(_runlevel)
      deprecate("use `Yast2::Systemd::Service.all.select(&:enabled?)`")

      Yast2::Systemd::Service.all.select(&:enabled?).map(&:name)
    end

    # @deprecated Use Yast2::Systemd::Service.find instead
    # Return the first of the list of services which is available
    # (has init script) or "" if none is.
    # @param list<string> list of service names
    # @return [String] the first found service
    def Find(services)
      deprecate("use `Yast2::Systemd::Service.find` instead")

      services.find { |service_name| Yast2::Systemd::Service.find(service_name) }
    end

  private

    def failure(event, service_name, error = "")
      case event
      when :not_found
        error << "Service '#{service_name}' not found"
      else
        error.prepend("Attempt to `#{event}` service '#{service_name}' failed.\nERROR: ")
      end
      self.error = error
      log.error(error)
      false
    end

    def deprecate(message)
      log.warn "[DEPRECATION] #{caller[0].split.last} in \"#{caller[1]}\" is deprecated; #{message}"
    end

    publish function: :GetUnitId, type: "string (string)"
    publish function: :GetServiceId, type: "string (string)"
    publish function: :Enabled, type: "boolean (string)"
    publish function: :Info, type: "map (string)"
    publish function: :Status, type: "integer (string)"
    publish function: :Active, type: "boolean (string)"
    publish function: :FullInfo, type: "map (string)"
    publish function: :Adjust, type: "boolean (string, string)"
    publish function: :Finetune, type: "boolean (string, list)"
    publish function: :RunInitScript, type: "integer (string, string)"
    publish function: :RunInitScriptWithTimeOut, type: "integer (string, string)"
    publish function: :RunInitScriptOutput, type: "map (string, string)"
    publish function: :Enable, type: "boolean (string)"
    publish function: :Disable, type: "boolean (string)"
    publish function: :Start, type: "boolean (string)"
    publish function: :Restart, type: "boolean (string)"
    publish function: :Reload, type: "boolean (string)"
    publish function: :Stop, type: "boolean (string)"
    publish function: :Error, type: "string ()"
    publish function: :EnabledServices, type: "list <string> (integer)"
    publish function: :Find, type: "string (list <string>)"
  end
  Service = ServiceClass.new
end
