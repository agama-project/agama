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

require_relative "./storage_helpers"
require "agama/config"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_solver"
require "y2storage"
require "y2storage/encryption_method/tpm_fde"

shared_context "config solver" do
  # Solves the config.
  def solve_config
    devicegraph = Y2Storage::StorageManager.instance.probed

    Agama::Storage::ConfigSolver
      .new(product_config, devicegraph)
      .solve(config)
  end

  include Agama::RSpec::StorageHelpers

  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "volumes"          => volumes,
        "volume_templates" => volume_templates
      }
    }
  end

  let(:volumes) { ["/"] }

  let(:volume_templates) do
    [
      {
        "mount_path" => "/",
        "filesystem" => "btrfs",
        "outline"    => { "filesystems" => ["btrfs", "xfs"] }
      }
    ]
  end

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:config_json) { nil }

  before do
    mock_storage(devicegraph: scenario)

    # To speed-up the tests. Use #allow_any_instance because #allow introduces marshaling problems
    allow_any_instance_of(Y2Storage::EncryptionMethod::TpmFde)
      .to(receive(:possible?))
      .and_return(true)

    allow(Y2Storage::BlkDevice).to receive(:find_by_any_name)
  end

  let(:scenario) { "disks.yaml" }
end
