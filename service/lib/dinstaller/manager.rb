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
require "y2storage/storage_manager"
require "y2network/proposal_settings"
require "dinstaller/status"
require "dinstaller/progress"
require "dinstaller/software"
require "dinstaller/users"
require "dinstaller/storage/proposal"
require "dinstaller/storage/actions"

Yast.import "Stage"

module DInstaller
  # This class represents the top level installer manager.
  #
  # It is responsible for orchestrating the installation process. For module
  # specific stuff it delegates it to the corresponding module class (e.g.,
  # {DInstaller::Software}, {DInstaller::Storage::Proposal}, etc.).
  class Manager
    # @return [Logger]
    attr_reader :logger

    # Installation status
    #
    # @return [Status]
    attr_reader :status

    # Progress for reporting long running tasks.
    #
    # Can be also used to get failure message if such task failed.
    #
    # @return [Progress]
    attr_reader :progress

    # Constructor
    #
    # @param logger [Logger]
    def initialize(logger)
      @logger = logger
      @status = Status.new(Status::ERROR) # temporary status until probing starts
      @progress = Progress.new

      initialize_yast
    end

    # Probes the system
    #
    # Status and progress are properly updated during the process.
    def probe
      Thread.new do
        sleep(1) # do sleep to ensure that dbus service is already attached
        status.change(Status::PROBING)

        progress.init_progress(4, "Probing Languages")
        language.probe(progress)

        progress.next_step("Probing Storage")
        probe_storage

        progress.next_step("Probing Software")
        software.probe(progress)

        progress.next_step("Probing Network")
        probe_network

        progress.next_step("Probing Finished")

        status.change(Status::PROBED)
      rescue StandardError => e
        status.change(Status::ERROR)
        progress.assign_error(e.message)
        logger.error "Probing error: #{e.inspect}"
      end
    end

    # rubocop:disable Metrics/AbcSize
    def install
      Thread.new do
        status.change(Status::INSTALLING)
        progress.init_progress(4, "Partitioning")
        Yast::Installation.destdir = "/mnt"
        # lets propose it here to be sure that software proposal reflects product selection
        # FIXME: maybe repropose after product selection change?
        # first make bootloader proposal to be sure that required packages are installed
        proposal = ::Bootloader::ProposalClient.new.make_proposal({})
        logger.info "Bootloader proposal #{proposal.inspect}"
        software.propose
        Yast::WFM.CallFunction("inst_prepdisk", [])
        progress.next_step("Installing Software")
        # call inst bootloader to get properly initialized bootloader
        # sysconfig before package installation
        Yast::WFM.CallFunction("inst_bootloader", [])
        software.install(progress)
        handle = Yast::WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr", false)
        Yast::WFM.SCRSetDefault(handle)
        progress.next_step("Writing Network Configuration")
        Yast::WFM.CallFunction("save_network", [])
        progress.next_step("Installing Bootloader")
        ::Bootloader::FinishClient.new.write
        progress.next_step("Installation Finished")
        status.change(Status::INSTALLED)
      end
    end
    # rubocop:enable Metrics/AbcSize

    # Software manager
    #
    # @return [Software]
    def software
      @software ||= Software.new(logger)
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
      @users ||= Users.new(logger)
    end

    # Storage proposal manager
    #
    # @return [Storage::Proposal]
    def storage_proposal
      @storage_proposal ||= Storage::Proposal.new(logger)
    end

    # Storage actions manager
    #
    # @return [Storage::Actions]
    def storage_actions
      @storage_actions ||= Storage::Actions.new(logger)
    end

  private

    # Initializes YaST
    def initialize_yast
      Yast::Mode.SetUI("commandline")
      Yast::Mode.SetMode("installation")
      # Set stage to initial, so it will act as installer for some cases like
      # proposing installer instead of reading current one
      Yast::Stage.Set("initial")
    end

    # Probes storage devices and performs an initial proposal
    #
    # TODO: move to Storage::Manager ?
    def probe_storage
      logger.info "Probing storage and performing proposal"
      progress.init_minor_steps(2, "Probing Storage Devices")
      Y2Storage::StorageManager.instance.probe
      progress.next_minor_step("Calculating Storage Proposal")
      storage_proposal.calculate
    end

    # Probes the network configuration
    #
    # TODO: move to Network ?
    def probe_network
      logger.info "Probing network"
      Yast.import "Lan"
      Yast::Lan.read_config
      settings = Y2Network::ProposalSettings.instance
      settings.refresh_packages
      settings.apply_defaults
    end
  end
end
