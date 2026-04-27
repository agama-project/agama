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

require_relative "./context"
require_relative "./examples"
require "agama/storage/config_conversions/from_model_conversions/drive"
require "agama/storage/configs/drive"
require "agama/storage/configs/search"
require "agama/storage/bootloader_config"

describe Agama::Storage::ConfigConversions::FromModelConversions::Drive do
  include_context "from model conversions"

  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }

  subject do
    described_class.new(model_json, product_config, bootloader_config)
  end

  describe "#convert" do
    let(:model_json) { {} }

    it "returns a drive config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::Drive)
    end

    context "if 'name' is not specified" do
      let(:model_json) { {} }

      it "sets #search to the expected value" do
        config = subject.convert
        expect(config.search).to be_a(Agama::Storage::Configs::Search)
        expect(config.search.name).to be_nil
        expect(config.search.if_not_found).to eq(:error)
      end
    end

    context "if neither 'mountPath' nor 'filesystem' are specified" do
      let(:model_json) { {} }
      include_examples "without filesystem"
    end

    context "if 'ptableType' is not specified" do
      let(:model_json) { {} }
      include_examples "without ptableType"
    end

    context "if 'spacePolicy' is not specified" do
      let(:model_json) { {} }
      include_examples "without spacePolicy", :partitions
    end

    context "if 'name' is specified" do
      let(:model_json) { { name: name } }
      include_examples "with name"
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

    context "if 'ptableType' is specified" do
      let(:model_json) { { ptableType: ptableType } }
      include_examples "with ptableType"
    end

    context "if 'partitions' is specified" do
      let(:model_json) { { partitions: partitions } }
      include_examples "with partitions"
    end

    context "if 'spacePolicy' is specified" do
      let(:model_json) { { spacePolicy: spacePolicy } }
      include_examples "with spacePolicy"
    end

    context "if 'spacePolicy' and 'partitions' are specified" do
      let(:model_json) { { spacePolicy: spacePolicy, partitions: partitions } }
      include_examples "with spacePolicy and volumes"
    end
  end
end
