# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/storage/bootloader_config"
require "agama/storage/config_conversions/from_json_conversions/partition"
require "agama/storage/config_conversions/to_model_conversions/partition"
require "agama/storage/volume_templates_builder"

describe Agama::Storage::ConfigConversions::ToModelConversions::Partition do
  subject { described_class.new(config, volumes) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Partition
      .new(config_json, bootloader_config)
      .convert
  end

  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }

  let(:config_json) do
    {
      search:         search,
      filesystem:     filesystem,
      size:           size,
      id:             id,
      delete:         delete,
      deleteIfNeeded: delete_if_needed
    }
  end

  let(:volumes) { Agama::Storage::VolumeTemplatesBuilder.new([]) }

  let(:search) { nil }
  let(:filesystem) { nil }
  let(:size) { nil }
  let(:id) { nil }
  let(:delete) { nil }
  let(:delete_if_needed) { nil }

  describe "#convert" do
    context "if #id is not configured" do
      let(:id) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:id)
      end
    end

    include_examples "without delete"
    include_examples "without delete_if_needed"
    include_examples "without filesystem"
    include_examples "without size"

    context "if #id is configured" do
      let(:id) { "esp" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:id]).to eq("esp")
      end
    end

    include_examples "with delete"
    include_examples "with delete_if_needed"
    include_examples "with filesystem"
    include_examples "with size"
    include_examples "device name"
    include_examples "resize"
  end
end
