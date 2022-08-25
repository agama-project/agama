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
require "y2storage/storage_manager"
require "dinstaller/storage/proposal"
require "dinstaller/storage/callbacks"
require "dinstaller/with_progress"
require "dinstaller/can_ask_question"
require "dinstaller/dbus/clients/questions_manager"

Yast.import "PackagesProposal"

module DInstaller
  module Storage
    # Manager to handle storage configuration
    class Manager
      include WithProgress
      include CanAskQuestion

      def initialize(config, logger)
        @config = config
        @logger = logger
      end

      # Probes storage devices and performs an initial proposal
      def probe
        start_progress(3)
        progress.step("Activating storage devices") { activate_devices }
        progress.step("Probing storage devices") { probe_devices }
        progress.step("Calculating the storage proposal") { proposal.calculate }
      end

      # Prepares the partitioning to install the system
      def install
        start_progress(2)
        progress.step("Adding storage-related packages") { add_packages }
        progress.step("Preparing the storage devices") do
          Yast::WFM.CallFunction("inst_prepdisk", [])
        end
      end

      # Umounts the target file system
      def finish
        start_progress(1)
        progress.step("Umounting storage devices") do
          Yast::WFM.CallFunction("umount_finish", ["Write"]) 
        end
      end

      # Storage proposal manager
      #
      # @return [Storage::Proposal]
      def proposal
        @proposal ||= Proposal.new(logger, config)
      end

    private

      PROPOSAL_ID = "storage_proposal"
      private_constant :PROPOSAL_ID

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # Activates the devices, calling activation callbacks if needed
      def activate_devices
        callbacks = Callbacks::Activate.new(questions_manager, logger)

        Y2Storage::StorageManager.instance.activate(callbacks)
      end

      # Probes the devices
      def probe_devices
        # TODO: probe callbacks
        Y2Storage::StorageManager.instance.probe
      end

      # Adds the required packages to the list of resolvables to install
      def add_packages
        devicegraph = Y2Storage::StorageManager.instance.staging
        packages = devicegraph.used_features.pkg_list
        return if packages.empty?

        logger.info "Selecting these packages for installation: #{packages}"
        Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :package, packages)
      end

      # Returns the client to ask questions
      #
      # @return [DInstaller::DBus::Clients::QuestionsManager]
      def questions_manager
        @questions_manager ||= DInstaller::DBus::Clients::QuestionsManager.new
      end
    end
  end
end
