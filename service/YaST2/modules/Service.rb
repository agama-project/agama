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

    publish function: :Enabled, type: "boolean (string)"
    publish function: :Active, type: "boolean (string)"
    publish function: :Enable, type: "boolean (string)"
    publish function: :Disable, type: "boolean (string)"
    publish function: :Start, type: "boolean (string)"
    publish function: :Restart, type: "boolean (string)"
    publish function: :Reload, type: "boolean (string)"
    publish function: :Stop, type: "boolean (string)"
    publish function: :Error, type: "string ()"
  end
  Service = ServiceClass.new
end
