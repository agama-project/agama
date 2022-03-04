# frozen_string_literal: true

#
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
require "y2storage"
require "dinstaller/installer_status"
require "dinstaller/progress"
require "dinstaller/software"
require "bootloader/proposal_client"
require "bootloader/finish_client"
require "forwardable"
require "singleton"

Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  # This class represents top level installer manager.
  #
  # It is responsible for orchestrating the installation process. For module specific
  # stuff it delegates it to module itself.
  class Manager
    class InvalidValue < StandardError; end

    include Singleton

    extend Forwardable

    # TODO: move to own module classes
    attr_reader :disks, :languages
    # TODO: move to own module classes
    attr_reader :disk
    attr_reader :logger

    # Global status of installation
    # @return [InstallationStatus]
    attr_reader :status
    # Progress for reporting long running tasks.
    # Can be also used to get failure message if such task failed.
    # @return [Progress]
    attr_reader :progress

    def options
      { "disk" => disk }
    end

    # Starts the probing process
    #
    # At this point, it just initializes some YaST modules/subsystems:
    #
    # * Software management
    # * Simplified storage probing
    #
    # The initialization of these subsystems should probably live in a different place.
    def probe
      Thread.new do
        sleep(1) # do sleep to ensure that dbus service is already attached
        change_status(InstallerStatus::PROBING)
        progress.init_progress(3, "Probing Languages")
        progress.next_step("Probing Storage")
        probe_storage
        progress.next_step("Probing Software")
        software.probe(progress)
        progress.next_step("Probing Finished")
        change_status(InstallerStatus::PROBED)
      rescue StandardError => e
        change_status(InstallerStatus::ERROR)
        progress.assign_error(e.message)
        logger.error "Probing error: #{e.inspect}"
      end
    end

    def add_status_callback(&block)
      @status_callbacks << block
    end

    def disk=(name)
      raise InvalidValue unless propose_storage(name)

      @disk = name
    end

    end

    def storage_proposal
      storage_manager.proposal&.devices
    end

    def install
      Thread.new do
        change_status(InstallerStatus::INSTALLING)
        progress.init_progress(3, "Partitioning")
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
        progress.next_step("Installing Bootloader")
        handle = Yast::WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr", false)
        Yast::WFM.SCRSetDefault(handle)
        ::Bootloader::FinishClient.new.write
        progress.next_step("Installation Finished")
        change_status(InstallerStatus::INSTALLED)
      end
    end

  private

    def change_status(new_status)
      @status = new_status
      @status_callbacks.each(&:call)
    end

    def probe_storage
      logger.info "Probing storage"
      storage_manager.probe
      @disks = storage_manager.probed.disks
      self.disk = @disks.first&.name
    end

    # @return [Boolean] true if success; false if failed
    def propose_storage(disk_name)
      settings = Y2Storage::ProposalSettings.new_for_current_product
      settings.candidate_devices = [disk_name]

      # FIXME: clean up the disks
      clean_probed = storage_probed.clone
      clean_probed.disks.each(&:remove_descendants)

      proposal = Y2Storage::GuidedProposal.initial(
        devicegraph: clean_probed,
        settings:    settings
      )
      return false if proposal.failed?

      storage_manager.proposal = proposal
      true
    end

    def storage_probed
      storage_manager.probed
    end

    def storage_manager
      @storage_manager ||= Y2Storage::StorageManager.instance
    end

    def software
      @software ||= Software.instance.tap { |s| s.logger = @logger }
    end

    def initialize
      Yast::Mode.SetUI("commandline")
      Yast::Mode.SetMode("installation")
      @disks = []
      @languages = []
      @status_callbacks = []
      @status = InstallerStatus::ERROR # it should start with probing, so just temporary status
      @logger = logger || Logger.new($stdout)
      @progress = Progress.new
      # Set stage to initial, so it will act as installer for some cases like
      # proposing installer instead of reading current one
      Yast::Stage.Set("initial")
    end
  end
end
