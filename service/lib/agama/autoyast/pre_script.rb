# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "autoinstall/script"
require "fileutils"

module Agama
  module AutoYaST
    # Wrapper around an AutoYaST pre-script
    #
    # This class wraps around an AutoYaST pre-script and redefines
    # some of its methods to adapt it to Agama.
    class PreScript < Y2Autoinstallation::PreScript
      SCRIPTS_DIR = "/run/agama/scripts/autoyast"

      class << self
        # Clean the existing pre-scripts.
        def clean_all
          Dir[File.join(SCRIPTS_DIR, "*")]
        end
      end

      # Overrides the logs directory.
      def logs_dir
        SCRIPTS_DIR
      end

      # Overrides the path of the file to write th logs.
      def log_path
        File.join(SCRIPTS_DIR, "#{script_name}.log")
      end

      # Overrides the path to save the script to.
      def script_path
        File.join(SCRIPTS_DIR, script_name)
      end
    end
  end
end
