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
require "agama/storage/config_conversions/from_json_conversions/partition"
require "agama/storage/config_conversions/to_model_conversions/partition"
require "agama/storage/volume_templates_builder"

describe Agama::Storage::ConfigConversions::ToModelConversions::Partition do
  subject { described_class.new(config, volumes) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Partition
      .new(config_json)
      .convert
  end

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

    context "if #delete is not configured" do
      let(:delete) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:delete]).to eq(false)
      end
    end

    context "if #delete_if_needed is not configured" do
      let(:delete_if_needed) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:deleteIfNeeded]).to eq(false)
      end
    end

    include_examples "without filesystem"
    include_examples "without size"

    context "if #id is configured" do
      let(:id) { "esp" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:id]).to eq("esp")
      end
    end

    context "if #delete is configured" do
      let(:delete) { true }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:delete]).to eq(true)
      end
    end

    context "if #delete_if_needed is not configured" do
      let(:delete_if_needed) { true }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:deleteIfNeeded]).to eq(true)
      end
    end

    include_examples "with filesystem"
    include_examples "with size"

    include_examples "device name"

    context "for the 'resize' property" do
      let(:search) { {} }

      context "if there is not assigned device" do
        before { config.search.solve }

        it "generates the expected JSON" do
          model_json = subject.convert
          expect(model_json[:resize]).to eq(false)
        end
      end

      context "if there is an assigned device" do
        before { config.search.solve(device) }

        let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/vda1") }

        context "and the #size is not configured" do
          let(:size) { nil }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resize]).to eq(false)
          end
        end

        context "and the min size is equal to the max size" do
          let(:size) { "1 GiB" }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resize]).to eq(true)
          end
        end

        context "and the min size is not equal to the max size" do
          let(:size) { { min: "1 GiB", max: "2 GiB" } }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resize]).to eq(false)
          end
        end
      end
    end

    context "for the 'resizeIfNeeded' property" do
      let(:search) { {} }

      context "if there is not assigned device" do
        before { config.search.solve }

        it "generates the expected JSON" do
          model_json = subject.convert
          expect(model_json[:resizeIfNeeded]).to eq(false)
        end
      end

      context "if there is an assigned device" do
        before { config.search.solve(device) }

        let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/vda1") }

        context "and the #size is not configured" do
          let(:size) { nil }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resizeIfNeeded]).to eq(false)
          end
        end

        context "and the min size is equal to the max size" do
          let(:size) { "1 GiB" }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resizeIfNeeded]).to eq(false)
          end
        end

        context "and the min size is not equal to the max size" do
          let(:size) { { min: "1 GiB", max: "2 GiB" } }

          it "generates the expected JSON" do
            model_json = subject.convert
            expect(model_json[:resizeIfNeeded]).to eq(true)
          end
        end
      end
    end
  end
end
