# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "./examples"
require "agama/storage/config_conversions/from_model_conversions/partition"
require "agama/storage/configs/partition"
require "agama/storage/bootloader_config"
require "y2storage/partition_id"

describe Agama::Storage::ConfigConversions::FromModelConversions::Partition do
  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }

  subject do
    described_class.new(model_json, bootloader_config)
  end

  describe "#convert" do
    let(:model_json) { {} }

    it "returns a partition config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::Partition)
    end

    context "if 'name' is not specified" do
      let(:model_json) { {} }

      it "does not set #search" do
        config = subject.convert
        expect(config.search).to be_nil
      end
    end

    context "if a partition does not spicify 'id'" do
      let(:model_json) { {} }

      it "does not set #id" do
        config = subject.convert
        expect(config.id).to be_nil
      end
    end

    context "if 'size' is not specified" do
      let(:model_json) { {} }
      include_examples "without size"
    end

    context "if neither 'mountPath' nor 'filesystem' are specified" do
      let(:model_json) { {} }
      include_examples "without filesystem"
    end

    context "if 'delete' is not specified" do
      let(:model_json) { {} }
      include_examples "without delete"
    end

    context "if 'deleteIfNeeded' is not specified" do
      let(:model_json) { {} }
      include_examples "without deleteIfNeeded"
    end

    context "if 'name' is not specified" do
      # Add mount path in order to use the partition. Otherwise the partition is omitted because it
      # is considered a keep action.
      let(:model_json) { { name: name, mountPath: "/test2" } }
      include_examples "with name"
    end

    context "if 'id' is specified" do
      let(:model_json) { { id: "esp" } }

      it "sets #id to the expected value" do
        config = subject.convert
        expect(config.id).to eq(Y2Storage::PartitionId::ESP)
      end
    end

    context "if 'size' is specified" do
      let(:model_json) { { size: size } }
      include_examples "with size"
    end

    context "if 'mountPath' is specified" do
      let(:model_json) { { mountPath: mountPath } }
      include_examples "with mountPath"
    end

    context "if 'filesystem' is specified" do
      let(:model_json) { { filesystem: filesystem } }
      include_examples "with filesystem"
    end

    context "if 'mountPath' and 'filesystem' are specified" do
      let(:model_json) { { mountPath: mountPath, filesystem: filesystem } }
      include_examples "with mountPath and filesystem"
    end

    context "if 'resizeIfNeeded' is specified" do
      let(:model_json) { { resizeIfNeeded: resize_if_needed } }
      include_examples "with resizeIfNeeded"
    end

    context "if 'size' and 'resizeIfNeeded' are specified" do
      let(:model_json) { { size: size, resizeIfNeeded: resize_if_needed } }
      include_examples "with size and resizeIfNeeded"
    end

    context "if 'size' and 'resize' are specified" do
      let(:model_json) { { size: size, resize: resize } }
      include_examples "with size and resize"
    end

    context "if 'delete' is specified" do
      let(:model_json) { { delete: true, mountPath: mount_path } }
      include_examples "with delete"
    end

    context "if 'deleteIfNeeded' is specified" do
      let(:model_json) { { deleteIfNeeded: true, mountPath: mount_path } }
      include_examples "with deleteIfNeeded"
    end
  end
end
