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
require "agama/storage/config_conversions/from_model_conversions/logical_volume"
require "agama/storage/configs/logical_volume"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromModelConversions::LogicalVolume do
  subject do
    described_class.new(model_json)
  end

  describe "#convert" do
    let(:model_json) { {} }

    it "returns a logical volume config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::LogicalVolume)
    end

    context "if 'lvName' is not specified" do
      let(:model_json) { {} }

      it "does not set #name" do
        config = subject.convert
        expect(config.name).to be_nil
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

    context "if 'stripes' is not specified" do
      let(:model_json) { {} }

      it "does not set #stripes" do
        config = subject.convert
        expect(config.stripes).to be_nil
      end
    end

    context "if 'stripeSize' is not specified" do
      let(:model_json) { {} }

      it "does not set #stripe_size" do
        config = subject.convert
        expect(config.stripe_size).to be_nil
      end
    end

    context "if 'lvName' is specified" do
      let(:model_json) { { lvName: "lv1" } }

      it "sets #name to the expected value" do
        config = subject.convert
        expect(config.name).to eq("lv1")
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

    context "if 'stripes' is specified" do
      let(:model_json) { { stripes: 4 } }

      it "sets #stripes to the expected value" do
        config = subject.convert
        expect(config.stripes).to eq(4)
      end
    end

    context "if 'stripeSize' is specified" do
      let(:model_json) { { stripeSize: 2.KiB.to_i } }

      it "sets #stripeSize to the expected value" do
        config = subject.convert
        expect(config.stripe_size).to eq(2.KiB)
      end
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
