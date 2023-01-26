# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require_relative "../../test_helper"
require "dinstaller/software/repository"

describe DInstaller::Software::Repository do
  subject do
    described_class.new(
      repo_id: 1, repo_alias: "tumbleweed", name: "openSUSE Tumbleweed",
      url: "https://example.net/oss", enabled: true, autorefresh: true
    )
  end

  describe "#refresh" do
    it "refreshes the corresponding source" do
      expect(Yast::Pkg).to receive(:SourceRefreshNow).with(1)
        .and_return(true)
      subject.refresh
    end
  end

  describe "#available?" do
    let(:refresh_result) { true }

    before do
      allow(Yast::Pkg).to receive(:SourceRefreshNow).with(1)
        .and_return(refresh_result)
    end

    context "when the metadata was not read" do
      it "returns false" do
        expect(subject.available?).to eq(false)
      end
    end

    context "when the metadata was successfully read" do
      before { subject.refresh }

      it "returns true" do
        expect(subject.available?).to eq(true)
      end
    end

    context "when it was not possible to read the metadata" do
      let(:refresh_result) { false }

      before { subject.refresh }

      it "returns false" do
        expect(subject.available?).to eq(false)
      end
    end
  end
end
