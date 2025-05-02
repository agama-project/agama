# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "autoinstall/script_runner"
require "autoinstall/script"
require "agama/autoyast/localization_reader"
require "agama/autoyast/product_reader"
require "agama/autoyast/root_reader"
require "agama/autoyast/scripts_reader"
require "agama/autoyast/security_reader"
require "agama/autoyast/services-manager_reader"
require "agama/autoyast/software_reader"
require "agama/autoyast/storage_reader"
require "agama/autoyast/user_reader"
require "json"
require "fileutils"
require "pathname"

require "agama/autoyast/report_patching"

# :nodoc:
module Agama
  module AutoYaST
    # Converts an AutoYaST profile into an Agama one.
    #
    # It is expected that many of the AutoYaST options are ignored because Agama does not have the
    # same features.
    #
    # The output might include, apart from the JSON Agama profile, a set of scripts (not implemented
    # yet).
    #
    # TODO: handle invalid profiles (YAST_SKIP_XML_VALIDATION).
    # TODO: capture reported errors (e.g., via the Report.Error function).
    class Converter
      # Sections which have a corresponding reader. The reader is expected to be
      # named in Pascal case and adding "Reader" as suffix (e.g., "L10nReader").
      SECTIONS = [
        "files",
        "localization",
        "product",
        "root",
        "scripts",
        "security",
        "services-manager",
        "software",
        "storage",
        "user"
      ].freeze

      # Builds the Agama profile
      #
      # It goes through the list of READERS and merges the results of all of them.
      #
      # @return [Hash] Agama profile
      def to_agama(profile)
        SECTIONS.reduce({}) do |result, section|
          require "agama/autoyast/#{section}_reader"
          klass = "#{section}_reader".sub("-", "_").split("_").map(&:capitalize).join
          reader = Agama::AutoYaST.const_get(klass).new(profile)
          result.merge(reader.read)
        end
      end
    end
  end
end
