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

require_relative "../../../../test_helper"
require "agama/storage/config_conversions/from_json_conversions/boot"
require "agama/storage/config_conversions/to_json_conversions/boot"

describe Agama::Storage::ConfigConversions::ToJSONConversions::Boot do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Boot
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      configure: configure,
      device:    device
    }
  end

  let(:configure) { nil }
  let(:device) { nil }

  describe "#convert" do
    context "if nothing is configured" do
      let(:configure) { nil }
      let(:devices) { nil }

      it "generates the expected JSON" do
        expect(subject.convert).to eq({ configure: true })
      end
    end

    context "if #configure is false" do
      let(:configure) { false }

      it "generates the expected JSON" do
        expect(subject.convert).to eq({ configure: false })
      end
    end

    context "if #configure is true" do
      let(:configure) { true }

      it "generates the expected JSON" do
        expect(subject.convert).to eq({ configure: true })
      end

      context "and #device is configured" do
        let(:device) { "vda" }

        it "generates the expected JSON" do
          expect(subject.convert).to eq(
            {
              configure: true,
              device:    "vda"
            }
          )
        end
      end
    end
  end
end
