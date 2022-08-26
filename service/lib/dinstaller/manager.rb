# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "dinstaller/config"
require "dinstaller/network"
require "dinstaller/with_progress"
require "dinstaller/installation_phase"
require "dinstaller/service_status_recorder"
require "dinstaller/dbus/clients/language"
require "dinstaller/dbus/clients/software"
require "dinstaller/dbus/clients/storage"
require "dinstaller/dbus/clients/users"

Yast.import "Stage"

module DInstaller
  # This class represents the top level installer manager.
  #
  # It is responsible for orchestrating the installation process. For module
  # specific stuff it delegates it to the corresponding module class (e.g.,
  # {DInstaller::Network}, {DInstaller::Storage::Proposal}, etc.) or asks
  # other services via D-Bus (e.g., `org.opensuse.DInstaller.Software`).
  class Manager
    include WithProgress

    # @return [Logger]
    attr_reader :logger

    # @return [InstallationPhase]
    attr_reader :installation_phase

    # Constructor
    #
    # @param logger [Logger]
    def initialize(config, logger)
      @config = config
      @logger = logger
      @installation_phase = InstallationPhase.new
      @service_status_recorder = ServiceStatusRecorder.new
    end

    # Runs the startup phase
    def startup_phase
      installation_phase.startup

      probe_single_product unless config.multi_product?

      logger.info("Startup phase done")
    end

    # Runs the config phase
    def config_phase
      installation_phase.config

      storage.probe
      network.probe

      logger.info("Config phase done")
    rescue StandardError => e
      logger.error "Startup error: #{e.inspect}. Backtrace: #{e.backtrace}"
      # TODO: report errors
    end

    # Runs the install phase
    # rubocop:disable Metrics/AbcSize
    def install_phase
      installation_phase.install

      start_progress(9)

      progress.step("Reading software repositories") do
        software.probe
        Yast::Installation.destdir = "/mnt"
      end

      progress.step("Partitioning") do
        storage.install
        # propose software after /mnt is already separated, so it uses proper
        # target
        software.propose
      end

      progress.step("Installing Software") { software.install }

      on_target do
        progress.step("Writing Users") { users.write }
        progress.step("Writing Network Configuration") { network.install }
        progress.step("Saving Language Settings") { language.finish }
        progress.step("Writing repositories information") { software.finish }
        progress.step("Copying logs") { copy_logs }
        progress.step("Finishing storage configuration") { storage.finish }
      end

      logger.info("Install phase done")
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

    # Language manager
    #
    # @return [DBus::Clients::Language]
    def language
      @language ||= DBus::Clients::Language.new
    end

    # Users client
    #
    # @return [DBus::Clients::Users]
    def users
      @users ||= DBus::Clients::Users.new.tap do |client|
        client.on_service_status_change do |status|
          service_status_recorder.save(client.service.name, status)
        end
      end
    end

    # Network manager
    #
    # @return [Network]
    def network
      @network ||= Network.new(logger)
    end

    # Storage manager
    #
    # @return [Storage::Manager]
    def storage
      @storage ||= DBus::Clients::Storage.new.tap do |client|
        client.on_service_status_change do |status|
          service_status_recorder.save(client.service.name, status)
        end
      end
    end

    # Actions to perform when a product is selected
    #
    # @note The config phase is executed.
    def select_product(product)
      config.pick_product(product)
      config_phase
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

  private

    attr_reader :config

    # @return [ServiceStatusRecorder]
    attr_reader :service_status_recorder

    # Copy the logs to the target system
    def copy_logs
      Yast::WFM.CallFunction("copy_logs_finish", ["Write"])
    end

    # Runs a block in the target system
    def on_target(&block)
      old_handle = Yast::WFM.SCRGetDefault
      handle = Yast::WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr", false)
      Yast::WFM.SCRSetDefault(handle)

      begin
        block.call
      rescue StandardError => e
        logger.error "Error while running on target tasks: #{e.inspect}"
      ensure
        Yast::WFM.SCRSetDefault(old_handle)
        Yast::WFM.SCRClose(handle)
      end
    end

    # Runs the config phase for the first product found
    #
    # Adjust the configuration and run the config phase.
    #
    # This method is expected to be used on single-product scenarios.
    def probe_single_product
      selected = config.data["products"].keys.first
      config.pick_product(selected)
      config_phase
    end
  end
end
