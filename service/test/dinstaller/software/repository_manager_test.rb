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
require "dinstaller/software/repositories_manager"

describe DInstaller::Software::RepositoriesManager do
  let(:repo) { instance_double(DInstaller::Software::Repository) }

  describe "#add" do
    it "registers the repository in the packaging system" do
      url = "https://example.net"
      expect(DInstaller::Software::Repository).to receive(:create)
        .with(name: url, url: url)
        .and_return(repo)
      subject.add(url)
      expect(subject.repositories).to include(repo)
    end
  end

  describe "#refresh_all" do
    before do
      subject.repositories << repo
    end

    it "refreshes all the repositories" do
      expect(repo).to receive(:refresh)
      subject.refresh_all
    end
  end

  describe "#available?" do
    let(:repo1) do
      instance_double(DInstaller::Software::Repository, available?: false)
    end
    let(:repo2) do
      instance_double(DInstaller::Software::Repository, available?: false)
    end

    before do
      subject.repositories << repo1
      subject.repositories << repo2
    end

    context "when there no repositories available" do
      it "returns false" do
        expect(subject.available?).to eq(false)
      end
    end

    context "when at least one repository is available" do
      let(:repo1) do
        instance_double(DInstaller::Software::Repository, available?: true)
      end

      it "returns true" do
        expect(subject.available?).to eq(true)
      end
    end
  end
end
