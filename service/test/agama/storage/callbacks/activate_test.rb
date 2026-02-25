# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require_relative "../../../test_helper"
require "agama/storage/callbacks/activate"
require "agama/http/clients"

describe Agama::Storage::Callbacks::Activate do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#multipath" do
    before do
      allow(Agama::Storage::Callbacks::ActivateMultipath)
        .to receive(:new).and_return(activate_callbacks)
    end

    let(:activate_callbacks) { instance_double(Agama::Storage::Callbacks::ActivateMultipath) }

    it "calls callbacks for multipath activation" do
      expect(activate_callbacks).to receive(:call)

      subject.multipath(true)
    end

    context "when the callbacks returns true" do
      before do
        allow(activate_callbacks).to receive(:call).and_return(true)
      end

      it "returns true" do
        expect(subject.multipath(true)).to eq(true)
      end
    end

    context "when the callbacks returns false" do
      before do
        allow(activate_callbacks).to receive(:call).and_return(false)
      end

      it "returns false" do
        expect(subject.multipath(true)).to eq(false)
      end
    end
  end

  describe "#luks" do
    before do
      allow(Agama::Storage::Callbacks::ActivateLuks)
        .to receive(:new).and_return(activate_callbacks)
      allow(activate_callbacks).to receive(:call).and_return([true, "notsecret"])
    end

    let(:activate_callbacks) { instance_double(Agama::Storage::Callbacks::ActivateLuks) }

    let(:info) { instance_double(Storage::LuksInfo) }

    let(:attempt) { 1 }

    it "calls callbacks for LUKS activation" do
      expect(activate_callbacks).to receive(:call)

      subject.luks(info, attempt)
    end

    it "returns a storage pair with the information for activation" do
      result = subject.luks(info, attempt)

      expect(result).to be_a(Storage::PairBoolString)
      expect(result.first).to eq(true)
      expect(result.second).to eq("notsecret")
    end
  end
end
