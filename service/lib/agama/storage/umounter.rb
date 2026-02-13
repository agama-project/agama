# frozen_string_literal: true

# Copyright (c) [2023-2026] SUSE LLC
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
require "yast/i18n"
require "yast2/execute"
require "yast2/systemd/service"
require "yast2/fs_snapshot"
require "bootloader/finish_client"
require "y2storage/storage_manager"
require "agama/helpers"
require "abstract_method"
require "fileutils"

Yast.import "Installation"

module Agama
  module Storage
    # Auxiliary class to handle the end of the installation including final
    # copy of logs and umount of devices
    class Umounter
      include Helpers

      # Constructor
      # @param logger [Logger]
      def initialize(logger)
        @logger = logger
      end

      # Execute the final storage actions.
      def run
        steps = possible_steps.select(&:run?)

        on_target do
          steps.each(&:run)
        end
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # All possible steps, that may or not need to be executed
      def possible_steps
        [
          CopyLogsStep.new(logger),
          UnmountStep.new(logger)
        ]
      end

      # Base class for the Finisher steps containing some shared logic
      class Step
        include Yast::I18n

        # Base constructor
        def initialize(logger)
          textdomain "agama"
          @logger = logger
        end

        # Whether this step must be executed
        def run?
          true
        end

        # @!method run
        #   Executes the step
        abstract_method :run

        # @!method label
        #   Sentence to describe the step in the progress report
        #   @return [String]
        abstract_method :label

      private

        # @return [Logger]
        attr_reader :logger

        def wfm_write(function)
          Yast::WFM.CallFunction(function, ["Write"])
        end
      end

      # Step to copy the installation logs
      class CopyLogsStep < Step
        SCRIPTS_DIR = "/run/agama/scripts"

        def label
          _("Copying logs")
        end

        def run
          FileUtils.mkdir_p(logs_dir, mode: 0o700)
          collect_logs
          copy_scripts
        end

      private

        def copy_scripts
          return unless Dir.exist?(SCRIPTS_DIR)

          FileUtils.cp_r(SCRIPTS_DIR, logs_dir)
        end

        def collect_logs
          path = File.join(logs_dir, "logs")
          Yast::Execute.locally(
            "agama", "logs", "store", "--destination", path
          )
        end

        def logs_dir
          @logs_dir ||= File.join(
            Yast::Installation.destdir, "var", "log", "agama-installation"
          )
        end
      end

      # Step to unmount the target file-systems
      class UnmountStep < Step
        def label
          _("Unmounting storage devices")
        end

        def run
          wfm_write("umount_finish")
        end
      end
    end
  end
end
