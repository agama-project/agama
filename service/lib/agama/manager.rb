# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require "shellwords"

require "yast"
require "agama/config"
require "agama/network"
require "agama/proxy_setup"
require "agama/with_locale"
require "agama/with_progress"
require "agama/installation_phase"
require "agama/service_status_recorder"
require "agama/dbus/service_status"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/software"
require "agama/dbus/clients/storage"
require "agama/helpers"
require "agama/http"

Yast.import "Stage"

module Agama
  # This class represents the top level installer manager.
  #
  # It is responsible for orchestrating the installation process. For module
  # specific stuff it delegates it to the corresponding module class (e.g.,
  # {Agama::Network}, {Agama::Storage::Proposal}, etc.) or asks
  # other services via D-Bus (e.g., `org.opensuse.Agama.Software1`).
  class Manager
    include WithProgress
    include WithLocale
    include Helpers
    include Yast::I18n

    # @return [Logger]
    attr_reader :logger

    # @return [InstallationPhase]
    attr_reader :installation_phase

    # @return [DBus::ServiceStatus]
    attr_reader :service_status

    # Constructor
    #
    # @param logger [Logger]
    def initialize(config, logger)
      textdomain "agama"

      @config = config
      @logger = logger
      @installation_phase = InstallationPhase.new
      @service_status_recorder = ServiceStatusRecorder.new
      @service_status = DBus::ServiceStatus.new.busy
      on_progress_change { logger.info progress.to_s }
    end

    # Runs the startup phase
    def startup_phase
      service_status.busy
      installation_phase.startup
      config_phase if software.selected_product

      logger.info("Startup phase done")
      service_status.idle
    end

    # Runs the config phase
    def config_phase
      service_status.busy
      first_time = installation_phase.startup?
      installation_phase.config

      start_progress_with_descriptions(
        _("Analyze disks"), _("Configure software")
      )
      # FIXME: hot-fix for bsc#1234711, see {#probe_and_recover_storage}. In autoinstallation, the
      #   storage config could be applied before probing. In that case, the config has to be
      #   recovered.
      progress.step { first_time ? probe_and_recover_storage : storage.probe }
      progress.step { software.probe }

      logger.info("Config phase done")
    rescue StandardError => e
      logger.error "Startup error: #{e.inspect}. Backtrace: #{e.backtrace}"
      # TODO: report errors
    ensure
      service_status.idle
      finish_progress
    end

    # Runs the install phase
    # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
    def install_phase
      service_status.busy
      installation_phase.install
      start_progress_with_descriptions(
        _("Prepare disks"),
        _("Install software"),
        _("Configure the system")
      )

      Yast::Installation.destdir = "/mnt"

      progress.step do
        storage.install
        run_post_partitioning_scripts
        proxy.propose
        # propose software after /mnt is already separated, so it uses proper
        # target
        software.propose
      end

      progress.step { software.install }
      progress.step do
        on_target do
          users.write
          network.install
          language.finish
          software.finish
          storage.finish
        end
      end

      logger.info("Install phase done")
    rescue StandardError => e
      logger.error "Installation error: #{e.inspect}. Backtrace: #{e.backtrace}"
    ensure
      service_status.idle
      installation_phase.finish
      finish_progress
    end
    # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

    def locale=(locale)
      service_status.busy
      change_process_locale(locale)
      users.update_issues
      start_progress_with_descriptions(
        _("Load software translations"),
        _("Load storage translations")
      )
      progress.step { software.locale = locale }
      progress.step { storage.locale = locale }
    ensure
      service_status.idle
      finish_progress
    end

    # Software client
    #
    # @return [DBus::Clients::Software]
    def software
      @software ||= DBus::Clients::Software.new.tap do |client|
        client.on_service_status_change do |status|
          service_status_recorder.save(client.service.name, status)
        end
      end
    end

    # ProxySetup instance
    #
    # @return [ProxySetup]
    def proxy
      ProxySetup.instance
    end

    # Language manager
    #
    # @return [DBus::Clients::Locale]
    def language
      DBus::Clients::Locale.instance
    end

    # Users client
    #
    # @return [Agama::Users]
    def users
      @users ||= Users.new(logger)
    end

    # Network manager
    #
    # @return [Network]
    def network
      @network ||= Network.new(logger)
    end

    # Storage manager
    #
    # @return [DBus::Clients::Storage]
    def storage
      @storage ||= DBus::Clients::Storage.new.tap do |client|
        client.on_service_status_change do |status|
          service_status_recorder.save(client.service.name, status)
        end
      end
    end

    # Name of busy services
    #
    # @see ServiceStatusRecorder
    #
    # @return [Array<String>]
    def busy_services
      service_status_recorder.busy_services
    end

    # Registers a callback to be called when the status of a service changes
    #
    # @see ServiceStatusRecorder
    def on_services_status_change(&block)
      service_status_recorder.on_service_status_change(&block)
    end

    # Determines whether the configuration is valid and the system is ready for installation
    #
    # @return [Boolean]
    def valid?
      users.issues.empty? && !software.errors? && !storage.errors?
    end

    # Collects the logs and stores them into an archive
    #
    # @param path [String] directory where to store logs
    #
    # @return [String] path to created archive
    def collect_logs(path: nil)
      opt = "-d #{path.shellescape}" unless path.nil? || path.empty?

      `agama logs store #{opt}`.strip
    end

    # Whatever has to be done at the end of installation
    #
    # If a finish method is given it will call the related shutdown
    # command.
    #
    # @param method [HALT, POWEROFF, STOP, REBOOT]
    # @return [Boolean]
    def finish_installation(method)
      logs = collect_logs(path: "/tmp/var/logs/")

      logger.info("Installation logs stored in #{logs}")

      unless installation_phase.finish?
        logger.error "The installer has not finished correctly. Please check logs"
        return false
      end

      if method == STOP
        logger.info("Finished the installation (stop).")
        return true
      end

      cmd = finish_cmd(method)
      logger.info("Finishing installation with '#{cmd}' (#{method})")

      !!system(cmd)
    end

    # Says whether running on iguana or not
    #
    # @return [Boolean] true when running on iguana
    def iguana?
      Dir.exist?("/iguana")
    end

  private

    # Possible finish methods
    STOP = "stop"
    REBOOT = "reboot"
    HALT = "halt"
    POWEROFF = "poweroff"

    # Default finish method to be called if not given or not find
    DEFAULT_METHOD = "reboot"
    # Finish shutdown option for each finish method
    SHUTDOWN_OPT = { REBOOT => "-r", HALT => "-H", POWEROFF => "-P" }.freeze

    # @param method [String, nil]
    # @return [String] the cmd to be run for finishing the installation
    def finish_cmd(method)
      return "/usr/bin/agamactl -k" if iguana?

      opt = SHUTDOWN_OPT[method]
      unless opt
        log.info "Not recognized method, using the default one (reboot)."
        opt = SHUTDOWN_OPT[DEFAULT_METHOD]
      end
      "/usr/sbin/shutdown #{opt} now"
    end

    attr_reader :config

    # @return [ServiceStatusRecorder]
    attr_reader :service_status_recorder

    # Probes storage and recover the current config, if any.
    def probe_and_recover_storage
      storage_config = storage.config
      storage.probe
      storage.config = storage_config if storage_config
    end

    # Runs post partitioning scripts
    def run_post_partitioning_scripts
      client = Agama::HTTP::Clients::Scripts.new(logger)
      client.run("post_partitioning")
    end
  end
end
