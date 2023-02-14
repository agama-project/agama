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
      url: "https://example.net/oss", enabled: true, autorefresh: true,
      product_dir: "/"
    )
  end

  describe "#probe" do
    before do
      allow(Yast::Pkg).to receive(:RepositoryProbe).with(/example.net/, "/")
        .and_return(repo_type)
    end

    context "if the repository can be read" do
      let(:repo_type) { "YUM" }

      it "returns true" do
        expect(subject.probe).to eq(true)
      end
    end

    context "if the repository type cannot be inferred" do
      let(:repo_type) { "NONE" }

      it "returns false" do
        expect(subject.probe).to eq(false)
      end
    end

    context "if the repository cannot be red" do
      let(:repo_type) { nil }

      it "returns false" do
        expect(subject.probe).to eq(false)
      end
    end
  end
end
