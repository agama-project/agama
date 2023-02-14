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
  let(:repo) do
    instance_double(
      DInstaller::Software::Repository, enable!: nil, probe: true, enabled?: true
    )
  end

  let(:disabled_repo) do
    instance_double(DInstaller::Software::Repository, enable!: nil, enabled?: false)
  end

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

  describe "#load" do
    let(:repo1) do
      instance_double(
        DInstaller::Software::Repository, disable!: nil, probe: false
      )
    end

    before do
      subject.repositories << repo
      subject.repositories << repo1
      allow(Yast::Pkg).to receive(:SourceLoad)
    end

    it "enables the repositories that can be read" do
      expect(repo).to receive(:enable!)
      subject.load
    end

    it "disables the repositories that cannot be read" do
      expect(repo1).to receive(:disable!)
      subject.load
    end

    it "loads the repositories" do
      expect(Yast::Pkg).to receive(:SourceLoad)
      subject.load
    end
  end

  describe "#delete_all" do
    before do
      subject.repositories << repo
      subject.repositories << disabled_repo
    end

    it "deletes all the repositories" do
      expect(repo).to receive(:delete!)
      expect(disabled_repo).to receive(:delete!)
      subject.delete_all
    end
  end

  describe "#enabled" do
    before do
      subject.repositories << repo
      subject.repositories << disabled_repo
    end

    it "returns the enabled repositories" do
      expect(subject.enabled).to eq([repo])
    end
  end

  describe "#disabled" do
    before do
      subject.repositories << repo
      subject.repositories << disabled_repo
    end

    it "returns the enabled repositories" do
      expect(subject.disabled).to eq([disabled_repo])
    end
  end
end
