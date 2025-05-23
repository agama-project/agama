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
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_conversions/to_model_conversions/boot"

describe Agama::Storage::ConfigConversions::ToModelConversions::Boot do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  # let(:config_json) do
  #   {
  #     boot: {
  #       configure: configure,
  #       device: device
  #     },
  #     drives: drives
  #   }
  # end

  # let(:drives) { nil }
  # let(:configure) { nil }
  # let(:device) { nil }

  describe "#convert" do
    context "with the default config" do
      let(:config_json) { {} }

      it "generates the expected JSON" do
        expect(subject.convert).to eq(
          {
            configure: true,
            device:    { default: true }
          }
        )
      end
    end

    context "if #boot is set to be configured" do
      let(:config_json) do
        {
          boot:   {
            configure: true,
            device:    device_alias
          },
          drives: [
            {
              search: "/dev/vda",
              alias:  "vda"
            },
            {
              search: "/dev/vdb",
              alias:  "vdb"
            }
          ]
        }
      end

      context "and uses the default boot device" do
        let(:device_alias) { nil }

        before do
          config.boot.device.default = true
          config.boot.device.device_alias = "vda"
        end

        it "generates the expected JSON for 'boot'" do
          expect(subject.convert).to eq(
            {
              configure: true,
              device:    {
                default: true,
                name:    "/dev/vda"
              }
            }
          )
        end
      end

      context "and uses a specific boot device" do
        let(:device_alias) { "vdb" }

        it "generates the expected JSON for 'boot'" do
          expect(subject.convert).to eq(
            {
              configure: true,
              device:    {
                default: false,
                name:    "/dev/vdb"
              }
            }
          )
        end
      end
    end

    context "if #boot is set to not be configured" do
      let(:config_json) do
        {
          boot:   {
            configure: false,
            device:    "vda"
          },
          drives: [
            {
              search: "/dev/vda",
              alias:  "vda"
            }
          ]
        }
      end

      it "generates the expected JSON for 'boot'" do
        expect(subject.convert).to eq(
          {
            configure: false
          }
        )
      end
    end
  end
end
