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
require "dinstaller/config"
require "dinstaller/language"
require "dinstaller/network"
require "dinstaller/progress"
require "dinstaller/questions_manager"
require "dinstaller/security"
require "dinstaller/status_manager"
require "dinstaller/storage"
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
    # @return [Logger]
    attr_reader :logger

    # @return [StatusManager]
    attr_reader :status_manager

    # @return [QuestionsManager]
    attr_reader :questions_manager

    # @return [Progress]
    attr_reader :progress

    # Constructor
    #
    # @param logger [Logger]
    def initialize(config, logger)
      @config = config
      @logger = logger
      @status_manager = StatusManager.new(Status::Error.new) # temporary status until probing starts
      @questions_manager = QuestionsManager.new(logger)
      @progress = Progress.new
    end

    # Sets up the installation process
    def setup
      progress.init_progress(1, "Probing Languages")
      language.probe(progress)
      software.on_product_selected do |selected|
        config.pick_product(selected)
        probe
      end
      probe_single_product unless config.multi_product?
    end

    # Probes the system
    def probe
      probe_steps
    rescue StandardError => e
      status = Status::Error.new.tap { |s| s.messages << e.message }
      status_manager.change(status)
      logger.error "Probing error: #{e.inspect}. Backtrace: #{e.backtrace}"
    end

    # rubocop:disable Metrics/AbcSize
    def install
      status_manager.change(Status::Installing.new)
      progress.init_progress(9, "Reading software repositories")
      software.probe

      Yast::Installation.destdir = "/mnt"

      # lets propose it here to be sure that software proposal reflects product selection
      # FIXME: maybe repropose after product selection change?
      # first make bootloader proposal to be sure that required packages are installed
      progress.next_step("Partitioning")
      proposal = ::Bootloader::ProposalClient.new.make_proposal({})
      logger.info "Bootloader proposal #{proposal.inspect}"
      storage.install(progress)
      # propose software after /mnt is already separated, so it uses proper
      # target
      software.propose

      # call inst bootloader to get properly initialized bootloader
      # sysconfig before package installation
      Yast::WFM.CallFunction("inst_bootloader", [])

      progress.next_step("Installing Software")
      software.install

      on_target do
        progress.next_step("Writing Users")
        users.write(progress)

        progress.next_step("Writing Network Configuration")
        network.install(progress)

        progress.next_step("Installing Bootloader")
        security.write(progress)
        ::Bootloader::FinishClient.new.write

        progress.next_step("Saving Language Settings")
        language.install(progress)

        progress.next_step("Writing repositories information")
        software.finish

        progress.next_step("Finishing installation")
        finish_installation
      end

      progress.next_step("Installation Finished")
      status_manager.change(Status::Installed.new)
    end
    # rubocop:enable Metrics/AbcSize

    # Software manager
    #
    # @return [Software]
    def software
      @software ||= DBus::Clients::Software.new
    end

    # Language manager
    #
    # @return [Language]
    def language
      @language ||= Language.new(logger)
    end

    # Users manager
    #
    # @return [Users]
    def users
      @users ||= DBus::Clients::Users.new
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

  private

    attr_reader :config

    # Performs probe steps
    #
    # Status and progress are properly updated during the process.
    #
    # FIXME: progress has no much sense now because probing steps are performed in parallel.
    def probe_steps
      status_manager.change(Status::Probing.new)

      # FIXME: manager_probing_status is needed until moving all probing steps to separate services.
      #   Note that the status of the manager represents the global status, so we still need a
      #   status for the sequential probing steps that are still done by the manager.
      manager_probing_status = status_manager.status

      progress.next_step("Probing Storage")
      storage.probe(progress, questions_manager)

      progress.next_step("Probing Software")
      security.probe(progress)

      progress.next_step("Probing Network")
      network.probe(progress)

      progress.next_step("Probing Finished")

      # Sequential steps are finished, so they are now in probed status.
      manager_probing_status = Status::Probed.new
      update_status(manager_probing_status)
    end
    # rubocop:enable Metrics/AbcSize

    # Performs required steps after installing the system
    #
    # For now, this only unmounts the installed system and copies installation logs. Note that YaST
    # performs many more steps like copying configuration files, creating snapshots, etc. Adding
    # more features to D-Installer could require to recover some of that YaST logic.
    def finish_installation
      progress.init_minor_steps(2, "Copying logs")
      Yast::WFM.CallFunction("copy_logs_finish", ["Write"])
      progress.next_minor_step("Unmounting target system")
      storage.finish
      progress.next_minor_step("Target system correctly unmounted")
    end

    # Run a block in the target system
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

    # Updates the manager status according to the status of the rest of services
    #
    # @param manager_probing_status [Status::Base] Status of the sequential probing tasks that are
    #   still performed by the manager. Those probing tasks will be moved to separated services and
    #   this param could be removed.
    def update_status(manager_probing_status)
      new_status = calculate_status(manager_probing_status)

      status_manager.change(new_status) unless status_manager.status == new_status
    end

    # Calculate the status according to the status of the services
    #
    # @param manager_probing_status [Status::Base] see {#update_status}
    # @return [Status::Base]
    def calculate_status(manager_probing_status)
      statuses = clients_statuses.append(manager_probing_status)

      if probing?(statuses)
        Status::Probing.new
      elsif probed?(statuses)
        Status::Probed.new
      elsif installing?(statuses)
        Status::Installating.new
      elsif installed?(statuses)
        Status::Installed.new
      else
        Status::Error.new.tap { |s| s.messages << "Unknown status" }
      end
    end

    # Whether the manager status should be probing according to the given statuses
    #
    # @param statuses [Array<Status::Base>]
    # @return [Boolean]
    def probing?(statuses)
      statuses.any? { |s| s.is_a?(Status::Probing) }
    end

    # Whether the manager status should be probed according to the given statuses
    #
    # @param statuses [Array<Status::Base>]
    # @return [Boolean]
    def probed?(statuses)
      statuses.all? { |s| s.is_a?(Status::Probed) }
    end

    # Whether the manager status should be installing according to the given statuses
    #
    # @param statuses [Array<Status::Base>]
    # @return [Boolean]
    def installing?(statuses)
      statuses.any? { |s| s.is_a?(Status::Installing) }
    end

    # Whether the manager status should be installed according to the given statuses
    #
    # @param statuses [Array<Status::Base>]
    # @return [Boolean]
    def installed?(statuses)
      statuses.all? { |s| s.is_a?(Status::Installed) }
    end

    # Current status of the clients
    #
    # @return [Array<Status::Base>]
    def clients_statuses
      [software, users].map(&:status)
    end

    # Runs the probing phase for the first product found
    #
    # Adjust the configuration and run the probing phase.
    #
    # This method is expected to be used on single-product scenarios.
    def probe_single_product
      selected = config.data["products"].keys.first
      config.pick_product(selected)
      probe
    end
  end
end
