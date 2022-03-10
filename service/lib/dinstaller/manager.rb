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
require "dinstaller/errors"
require "dinstaller/installer_status"
require "dinstaller/progress"
require "dinstaller/software"
require "bootloader/proposal_client"
require "bootloader/finish_client"
require "dinstaller/storage/proposal"
require "y2storage/storage_manager"
require "y2network/proposal_settings"

Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  # This class represents top level installer manager.
  #
  # It is responsible for orchestrating the installation process. For module
  # specific stuff it delegates it to the corresponding module class (e.g.,
  # {DInstaller::Software}, {DInstaller::Storage}, etc.).
  class Manager
    attr_reader :logger

    # Global status of installation
    # @return [InstallationStatus]
    attr_reader :status
    # Progress for reporting long running tasks.
    # Can be also used to get failure message if such task failed.
    # @return [Progress]
    attr_reader :progress

    def initialize(logger)
      Yast::Mode.SetUI("commandline")
      Yast::Mode.SetMode("installation")
      @status_callbacks = []
      @status = InstallerStatus::ERROR # it should start with probing, so just temporary status
      @logger = logger || Logger.new($stdout)
      @progress = Progress.new
      # Set stage to initial, so it will act as installer for some cases like
      # proposing installer instead of reading current one
      Yast::Stage.Set("initial")
    end

    # Starts the probing process
    #
    # At this point, it just initializes some YaST modules/subsystems:
    #
    # * Software management
    # * Simplified storage probing
    # * Network configuration
    #
    # The initialization of these subsystems should probably live in a different place.
    def probe
      Thread.new do
        sleep(1) # do sleep to ensure that dbus service is already attached
        change_status(InstallerStatus::PROBING)
        progress.init_progress(4, "Probing Languages")
        language.probe(progress)
        progress.next_step("Probing Storage")
        probe_storage
        progress.next_step("Probing Software")
        software.probe(progress)
        progress.next_step("Probing Network")
        probe_network
        progress.next_step("Probing Finished")
        change_status(InstallerStatus::PROBED)
      rescue StandardError => e
        change_status(InstallerStatus::ERROR)
        progress.assign_error(e.message)
        logger.error "Probing error: #{e.inspect}"
      end
    end

    # rubocop:disable Metrics/AbcSize
    def install
      Thread.new do
        change_status(InstallerStatus::INSTALLING)
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
        change_status(InstallerStatus::INSTALLED)
      end
    end
    # rubocop:enable Metrics/AbcSize

    def add_status_callback(&block)
      @status_callbacks << block
    end

    # Returns the instance of the software manager module
    #
    # @return [Software] Software manager module
    def software
      @software ||= Software.new(logger)
    end

    # Returns the instance of the language manager module
    #
    # @return [Language] Language manager module
    def language
      @language ||= Language.new(logger)
    end

  private

    def change_status(new_status)
      @status = new_status
      @status_callbacks.each(&:call)
    end

    # Probes storage devices and performs an initial proposal
    def probe_storage
      logger.info "Probing storage and performing proposal"
      progress.init_minor_steps(2, "Probing Storage Devices")
      Y2Storage::StorageManager.instance.probe
      progress.next_minor_step("Calculating Storage Proposal")
      Storage::Proposal.instance.calculate
    end

    # Probes the network configuration
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
