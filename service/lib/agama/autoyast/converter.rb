# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/autoyast/bootloader_reader"
require "agama/autoyast/dasd_reader"
require "agama/autoyast/files_reader"
require "agama/autoyast/hostname_reader"
require "agama/autoyast/iscsi_reader"
require "agama/autoyast/localization_reader"
require "agama/autoyast/network_reader"
require "agama/autoyast/product_reader"
require "agama/autoyast/root_reader"
require "agama/autoyast/scripts_reader"
require "agama/autoyast/security_reader"
require "agama/autoyast/software_reader"
require "agama/autoyast/storage_reader"
require "agama/autoyast/user_reader"
require "agama/autoyast/zfcp_reader"

module Agama
  module AutoYaST
    # Converts an AutoYaST profile into an Agama one.
    #
    # It is expected that many of the AutoYaST options are ignored because Agama does not have the
    # same features.
    #
    # TODO: handle invalid profiles (YAST_SKIP_XML_VALIDATION).
    # TODO: capture reported errors (e.g., via the Report.Error function).
    class Converter
      # Converts the given AutoYaST profile to an Agama profile.
      #
      # @return [Hash]
      def to_agama(profile)
        [
          BootloaderReader.new(profile).read,
          DASDReader.new(profile).read,
          FilesReader.new(profile).read,
          HostnameReader.new(profile).read,
          IscsiReader.new(profile).read,
          LocalizationReader.new(profile).read,
          NetworkReader.new(profile).read,
          ProductReader.new(profile).read,
          RootReader.new(profile).read,
          ScriptsReader.new(profile).read,
          SecurityReader.new(profile).read,
          SoftwareReader.new(profile).read,
          StorageReader.new(profile).read,
          UserReader.new(profile).read,
          ZFCPReader.new(profile).read
        ].inject(:merge)
      end
    end
  end
end
