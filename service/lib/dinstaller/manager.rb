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
require "bootloader/proposal_client"
require "bootloader/finish_client"
require "dinstaller/can_ask_question"
require "dinstaller/config"
require "dinstaller/network"
require "dinstaller/security"
require "dinstaller/storage"
require "dinstaller/question"
require "dinstaller/questions_manager"
require "dinstaller/with_progress"
require "dinstaller/installation_phase"
require "dinstaller/service_status_recorder"
require "dinstaller/dbus/clients/language"
require "dinstaller/dbus/clients/software"
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
    include CanAskQuestion

    # @return [Logger]
    attr_reader :logger

    # @return [QuestionsManager]
    attr_reader :questions_manager

    # @return [InstallationPhase]
    attr_reader :installation_phase

    # Constructor
    #
    # @param logger [Logger]
    def initialize(config, logger)
      @config = config
      @logger = logger
      @questions_manager = QuestionsManager.new(logger)
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

      storage.probe(questions_manager)
      security.probe
      network.probe

      if ENV["DINSTALLER_TEST_QUESTIONS"] == "1"
        testing_question
        software.testing_question
      end

      logger.info("Config phase done")
    rescue StandardError => e
      logger.error "Startup error: #{e.inspect}. Backtrace: #{e.backtrace}"
      # TODO: report errors
    end

    def testing_question
      question = Question.new("What is your favourite colour?", options: [:blue, :yellow])
      correct = ask(question) do |q|
        q.answer == :blue
      end
      logger.info(correct ? "Off you go" : "Aaaaaugh!")
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
        # lets propose it here to be sure that software proposal reflects product selection
        # FIXME: maybe repropose after product selection change?
        # first make bootloader proposal to be sure that required packages are installed
        proposal = ::Bootloader::ProposalClient.new.make_proposal({})
        logger.info "Bootloader proposal #{proposal.inspect}"
        storage.install
        # propose software after /mnt is already separated, so it uses proper
        # target
        software.propose

        # call inst bootloader to get properly initialized bootloader
        # sysconfig before package installation
        Yast::WFM.CallFunction("inst_bootloader", [])
      end

      progress.step("Installing Software") { software.install }

      on_target do
        progress.step("Writing Users") { users.write }

        progress.step("Writing Network Configuration") { network.install }

        progress.step("Installing Bootloader") do
          security.write
          ::Bootloader::FinishClient.new.write
        end

        progress.step("Saving Language Settings") { language.finish }

        progress.step("Writing repositories information") { software.finish }

        progress.step("Finishing installation") { finish_installation }
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
      @storage ||= Storage::Manager.new(logger, config)
    end

    # Security manager
    #
    # @return [Security]
    def security
      @security ||= Security.new(logger, config)
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

    # Performs required steps after installing the system
    #
    # For now, this only unmounts the installed system and copies installation logs. Note that YaST
    # performs many more steps like copying configuration files, creating snapshots, etc. Adding
    # more features to D-Installer could require to recover some of that YaST logic.
    def finish_installation
      Yast::WFM.CallFunction("copy_logs_finish", ["Write"])
      storage.finish
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
