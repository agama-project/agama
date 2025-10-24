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
require "agama/software/repositories_manager"

describe Agama::Software::RepositoriesManager do
  subject do
    res = described_class.instance
    res.reset
    res
  end

  # probe and refresh succeed
  let(:repo) do
    instance_double(
      Agama::Software::Repository, enable!: nil, probe: true, enabled?: true, refresh: true
    )
  end

  let(:disabled_repo) do
    instance_double(Agama::Software::Repository, enable!: nil, enabled?: false)
  end

  let(:user_repositories) do
    [{
      "url"              => "http://testing.com",
      "alias"            => "test",
      "enabled"          => true,
      "priority"         => 50,
      "allow_unsigned"   => true,
      "gpg_fingerprints" => ["0123"]
    }]
  end

  describe "#add" do
    it "registers the repository in the packaging system" do
      url = "https://example.net"
      expect(Agama::Software::Repository).to receive(:create)
        .with(autorefresh: true, name: url, repo_alias: "", url: url, priority: 99)
        .and_return(repo)
      subject.add(url)
      expect(subject.repositories).to include(repo)
    end
  end

  describe "#load" do
    # probe and refresh fail
    let(:repo1) do
      instance_double(
        Agama::Software::Repository, enable!: nil, disable!: nil, probe: false, refresh: false
      )
    end

    # corner case, probe succeeds but refresh fails
    let(:repo2) do
      instance_double(
        Agama::Software::Repository, enable!: nil, disable!: nil, probe: true, refresh: false
      )
    end

    before do
      subject.repositories << repo
      subject.repositories << repo1
      subject.repositories << repo2
      allow(Yast::Pkg).to receive(:SourceLoad)
    end

    it "enables the repositories that can be read" do
      expect(repo).to receive(:enable!)
      expect(repo).to_not receive(:disable!)
      subject.load
    end

    it "disables the repositories that cannot be probed" do
      expect(repo1).to receive(:disable!)
      subject.load
    end

    it "disables the repositories that cannot be refreshed" do
      expect(repo2).to receive(:disable!)
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

  describe "unsigned_allowed?" do
    it "returns true if user repo can be unsigned" do
      allow(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      allow(Agama::Software::Repository).to receive(:find).and_return(double)
      allow(subject).to receive(:load)
      subject.user_repositories = user_repositories

      expect(subject.unsigned_allowed?("test")).to eq true
    end
  end

  describe "trust_gpg?" do
    it "returns true if gpg key fingerprint matches user defined one" do
      allow(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      allow(Agama::Software::Repository).to receive(:find).and_return(double)
      allow(subject).to receive(:load)
      subject.user_repositories = user_repositories

      expect(subject.trust_gpg?("test", "0123")).to eq true
    end

    it "ignores any whitespaces in fingerprint" do
      allow(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      allow(Agama::Software::Repository).to receive(:find).and_return(double)
      allow(subject).to receive(:load)
      subject.user_repositories = user_repositories

      expect(subject.trust_gpg?("test", "01 23")).to eq true
    end
  end

  describe "#user_repositories" do
    before do
      allow(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      allow(Agama::Software::Repository).to receive(:find).and_return(double)
      allow(subject).to receive(:load)
    end

    it "returns list of repositories as defined by user" do
      subject.user_repositories = user_repositories
      expect(subject.user_repositories).to eq user_repositories
    end
  end

  describe "#user_repositories=" do
    before do
      allow(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      allow(Agama::Software::Repository).to receive(:find).and_return(double)
      allow(subject).to receive(:load)
    end

    it "sets list of user repositories" do
      subject.user_repositories = user_repositories
      expect(subject.user_repositories).to eq user_repositories
    end

    it "add repositories to repository pool" do
      expect(Yast::Pkg).to receive(:RepositoryAdd).and_return(1)
      repo = double
      allow(Agama::Software::Repository).to receive(:find).with(1).and_return(repo)

      subject.user_repositories = user_repositories
      expect(subject.repositories).to include repo
    end

    it "loads repositories" do
      expect(subject).to receive(:load)

      subject.user_repositories = user_repositories
    end

    it "removes previous user repositories" do
      old_repo = double
      allow(Agama::Software::Repository).to receive(:find).and_return(old_repo)
      subject.user_repositories = user_repositories

      expect(old_repo).to receive(:delete!)
      new_repo = double
      allow(Agama::Software::Repository).to receive(:find).and_return(new_repo)

      subject.user_repositories = user_repositories
      expect(subject.repositories).to_not include old_repo
      expect(subject.repositories).to include new_repo
    end
  end
end
