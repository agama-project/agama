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

require_relative "../../storage_helpers"
require_relative "./examples"
require "agama/storage/config_conversions/from_json_conversions/md_raid"
require "agama/storage/config_conversions/to_model_conversions/md_raid"
require "agama/storage/volume_templates_builder"

describe Agama::Storage::ConfigConversions::ToModelConversions::MdRaid do
  subject { described_class.new(config, volumes) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::MdRaid
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      search:     search,
      filesystem: filesystem,
      ptableType: ptable_type,
      partitions: partitions
    }
  end

  let(:volumes) { Agama::Storage::VolumeTemplatesBuilder.new([]) }

  let(:search) { nil }
  let(:filesystem) { nil }
  let(:ptable_type) { nil }
  let(:partitions) { nil }

  describe "#convert" do
    include_examples "without filesystem"
    include_examples "without ptable_type"
    include_examples "without partitions"

    include_examples "with filesystem"
    include_examples "with ptable_type"
    include_examples "with partitions"

    include_examples "device name"
    include_examples "space policy"
  end
end
