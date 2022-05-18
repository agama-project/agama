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
require "dinstaller/cockpit_manager"
require "dinstaller/language"
require "dinstaller/network"
require "dinstaller/progress"
require "dinstaller/software"
require "dinstaller/status_manager"
require "dinstaller/storage"
require "dinstaller/dbus/clients/users"
require "dinstaller/questions_manager"

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

    # @return [QuestionsManager]
    attr_reader :questions_manager

    # @return [Progress]
    attr_reader :progress

    # Constructor
    #
    # @param logger [Logger]
    def initialize(logger)
      @logger = logger
      @status_manager = StatusManager.new(Status::Error.new) # temporary status until probing starts
      @questions_manager = QuestionsManager.new(logger)
      @progress = Progress.new

      initialize_yast
    end

    # Sets up the installation process
    def setup
      setup_cockpit
    end

    # Probes the system
    def probe
      probe_steps
    rescue StandardError => e
      status = Status::Error.new.tap { |s| s.messages << e.message }
      status_manager.change(status)
      logger.error "Probing error: #{e.inspect}"
    end

    # rubocop:disable Metrics/AbcSize
    def install
      status_manager.change(Status::Installing.new)
      progress.init_progress(8, "Partitioning")
      Yast::Installation.destdir = "/mnt"
      # lets propose it here to be sure that software proposal reflects product selection
      # FIXME: maybe repropose after product selection change?
      # first make bootloader proposal to be sure that required packages are installed
      proposal = ::Bootloader::ProposalClient.new.make_proposal({})
      logger.info "Bootloader proposal #{proposal.inspect}"
      software.propose
      storage.install(progress)

      # call inst bootloader to get properly initialized bootloader
      # sysconfig before package installation
      Yast::WFM.CallFunction("inst_bootloader", [])

      progress.next_step("Installing Software")
      software.install(progress)

      on_target do
        progress.next_step("Writting Users")
        users.write(progress)

        progress.next_step("Writing Network Configuration")
        network.install(progress)

        progress.next_step("Installing Bootloader")
        ::Bootloader::FinishClient.new.write

        progress.next_step("Saving Language Settings")
        language.install(progress)
      end

      progress.next_step("Writing repositories information")
      software.finish(progress)

      progress.next_step("Finishing installation")
      finish_installation

      progress.next_step("Installation Finished")
      status_manager.change(Status::Installed.new)
    end
    # rubocop:enable Metrics/AbcSize

    # Configuration
    def config
      Config.load unless Config.current

      Config.current
    end

    # Software manager
    #
    # @return [Software]
    def software
      @software ||= Software.new(logger, config)
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
      @users ||= DBus::Clients::Users
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

    def setup_cockpit
      cockpit = CockpitManager.new(logger)
      cockpit.setup(config.data["web"])
    end

    # Performs probe steps
    #
    # Status and progress are properly updated during the process.
    def probe_steps
      status_manager.change(Status::Probing.new)

      progress.init_progress(4, "Probing Languages")
      language.probe(progress)

      progress.next_step("Probing Storage")
      storage.probe(progress, questions_manager)

      progress.next_step("Probing Software")
      software.probe(progress)

      progress.next_step("Probing Network")
      network.probe(progress)

      progress.next_step("Probing Finished")

      status_manager.change(Status::Probed.new)
    end

    # Performs required steps after installing the system
    #
    # For now, this only unmounts the installed system and copies installation logs. Note that YaST
    # performs many more steps like copying configuration files, creating snapshots, etc. Adding
    # more features to D-Installer could require to recover some of that YaST logic.
    def finish_installation
      progress.init_minor_steps(2, "Copying logs")
      Yast::WFM.CallFunction("copy_logs_finish", ["Write"])

      progress.next_minor_step("Unmounting target system")
      Yast::WFM.CallFunction("pre_umount_finish", ["Write"])
      Yast::WFM.CallFunction("umount_finish", ["Write"])
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
  end
end
