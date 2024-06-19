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

require "yast"
require "agama/config"
require "agama/network"
require "agama/proxy_setup"
require "agama/with_progress"
require "agama/installation_phase"
require "agama/service_status_recorder"
require "agama/dbus/service_status"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/software"
require "agama/dbus/clients/storage"
require "agama/helpers"

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
      installation_phase.config

      start_progress(2)
      progress.step(_("Probing Storage")) { storage.probe }
      progress.step(_("Probing Software")) { software.probe }

      logger.info("Config phase done")
    rescue StandardError => e
      logger.error "Startup error: #{e.inspect}. Backtrace: #{e.backtrace}"
      # TODO: report errors
    ensure
      service_status.idle
      finish_progress
    end

    # Runs the install phase
    # rubocop:disable Metrics/AbcSize
    def install_phase
      service_status.busy
      installation_phase.install
      start_progress(7)

      Yast::Installation.destdir = "/mnt"

      progress.step(_("Partitioning")) do
        storage.install
        proxy.propose
        # propose software after /mnt is already separated, so it uses proper
        # target
        software.propose
      end

      progress.step(_("Installing Software")) { software.install }

      on_target do
        progress.step(_("Writing Users")) { users.write }
        progress.step(_("Writing Network Configuration")) { network.install }
        progress.step(_("Saving Language Settings")) { language.finish }
        progress.step(_("Writing repositories information")) { software.finish }
        progress.step(_("Finishing storage configuration")) { storage.finish }
      end

      logger.info("Install phase done")
    rescue StandardError => e
      logger.error "Installation error: #{e.inspect}. Backtrace: #{e.backtrace}"
    ensure
      service_status.idle
      finish_progress
    end
    # rubocop:enable Metrics/AbcSize

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
    # @return [DBus::Clients::Users]
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
      opt = "-d #{path}" unless path.nil? || path.empty?

      `agama logs store #{opt}`.strip
    end

    # Whatever has to be done at the end of installation
    def finish_installation
      logs = collect_logs(path: "/tmp/var/logs/")

      logger.info("Installation logs stored in #{logs}")

      cmd = if iguana?
        "/usr/bin/agamactl -k"
      else
        "/usr/sbin/shutdown -r now"
      end

      logger.info("Finishing installation with #{cmd}")

      system(cmd)
    end

    # Says whether running on iguana or not
    #
    # @return [Boolean] true when running on iguana
    def iguana?
      Dir.exist?("/iguana")
    end

  private

    attr_reader :config

    # @return [ServiceStatusRecorder]
    attr_reader :service_status_recorder
  end
end
