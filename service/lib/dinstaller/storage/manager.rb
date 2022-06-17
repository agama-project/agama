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
require "dinstaller/storage/actions"
require "dinstaller/storage/callbacks"

module DInstaller
  module Storage
    # Manager to handle storage configuration
    class Manager
      def initialize(logger, config)
        @logger = logger
        @config = config
      end

      # Probes storage devices and performs an initial proposal
      #
      # @param progress [Progress] Progress reporting object
      # @param questions_manager [QuestionsManager]
      def probe(progress, questions_manager)
        logger.info "Probing storage and performing proposal"
        progress.init_minor_steps(2, "Probing Storage Devices")
        activate_devices(questions_manager)
        probe_devices
        progress.next_minor_step("Calculating Storage Proposal")
        proposal.calculate
      end

      # Prepares the partitioning to install the system
      #
      # @param _progress [Progress] Progress reporting object
      def install(_progress)
        Yast::WFM.CallFunction("inst_prepdisk", [])
      end

      # Umounts the target file system
      def finish
        Yast::WFM.CallFunction("umount_finish", ["Write"])
      end

      # Storage proposal manager
      #
      # @return [Storage::Proposal]
      def proposal
        @proposal ||= Proposal.new(logger, config)
      end

      # Storage actions manager
      #
      # @return [Storage::Actions]
      def actions
        @actions ||= Actions.new(logger)
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # Activates the devices, calling activation callbacks if needed
      #
      # @param questions_manager [QuestionsManager]
      def activate_devices(questions_manager)
        callbacks = Callbacks::Activate.new(questions_manager, logger)

        Y2Storage::StorageManager.instance.activate(callbacks)
      end

      # Probes the devices
      def probe_devices
        # TODO: probe callbacks
        Y2Storage::StorageManager.instance.probe
      end
    end
  end
end
