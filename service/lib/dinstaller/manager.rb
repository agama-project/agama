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
require "dinstaller/network"
require "dinstaller/status_manager"
require "dinstaller/progress"
require "dinstaller/software"
require "dinstaller/users"
require "dinstaller/storage"

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

    # @return [StatusManager]
    attr_reader :status_manager

    # @return [Progress]
    attr_reader :progress

    # Constructor
    #
    # @param logger [Logger]
    def initialize(logger)
      @logger = logger
      @status_manager = StatusManager.new(Status::Error.new) # temporary status until probing starts
      @progress = Progress.new

      initialize_yast
    end

    # Probes the system
    def probe
      Thread.new do
        sleep(1) # do sleep to ensure that dbus service is already attached
        probe_steps
      rescue StandardError => e
        status = Status::Error.new.tap { |s| s.messages << e.message }
        status_manager.change(status)
        logger.error "Probing error: #{e.inspect}"
      end
    end

    # rubocop:disable Metrics/AbcSize
    def install
      Thread.new do
        status_manager.change(Status::Installing.new)
        progress.init_progress(5, "Partitioning")
        Yast::Installation.destdir = "/mnt"
        # lets propose it here to be sure that software proposal reflects product selection
        # FIXME: maybe repropose after product selection change?
        # first make bootloader proposal to be sure that required packages are installed
        proposal = ::Bootloader::ProposalClient.new.make_proposal({})
        logger.info "Bootloader proposal #{proposal.inspect}"
        software.propose
        storage.install(progress)
        progress.next_step("Installing Software")
        # call inst bootloader to get properly initialized bootloader
        # sysconfig before package installation
        Yast::WFM.CallFunction("inst_bootloader", [])
        software.install(progress)
        handle = Yast::WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr", false)
        Yast::WFM.SCRSetDefault(handle)
        progress.next_step("Writting Users")
        users.write(progress)
        progress.next_step("Writing Network Configuration")
        network.install(progress)
        progress.next_step("Installing Bootloader")
        ::Bootloader::FinishClient.new.write
        progress.next_step("Installation Finished")
        status_manager.change(Status::Installed.new)
      rescue StandardError => e
        status = Status::Error.new.tap { |s| s.messages << e.message }
        status_manager.change(status)
        logger.error "Installation error: #{e.inspect}"
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
      @storage ||= Storage::Manager.new(logger)
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

    # Performs probe steps
    #
    # Status and progress are properly updated during the process.
    def probe_steps
      status_manager.change(Status::Probing.new)

      progress.init_progress(4, "Probing Languages")
      language.probe(progress)

      progress.next_step("Probing Storage")
      storage.probe(progress)

      progress.next_step("Probing Software")
      software.probe(progress)

      progress.next_step("Probing Network")
      network.probe(progress)

      progress.next_step("Probing Finished")

      status_manager.change(Status::Probed.new)
    end
  end
end
