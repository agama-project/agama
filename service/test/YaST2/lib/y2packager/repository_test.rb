#!/usr/bin/env rspec
# frozen_string_literal: true

# Vendored from yast2's library/packages/test/repository_test.rb.
# This is a permanent fork (see service/YaST2/README.md): Y2Packager::Repository is vendored
# directly instead of depending on yast2-packager (which has a circular RPM Requires: on
# yast2-storage-ng).
#
# The "#products" describe block was removed along with it (see repository.rb's own
# "DEVIATION FROM UPSTREAM" comment); require_relative "product_factory" (its only user) was
# dropped too.

require_relative "../../../test_helper"
require "y2packager/repository"
require "uri"

describe Y2Packager::Repository do
  Yast.import "Pkg"

  let(:repo_id) { 1 }
  let(:enabled) { true }
  let(:autorefresh) { true }
  let(:repo_url) { URI("http://download.opensuse.org/update/leap/42.1/oss") }
  let(:repo_raw_url) { repo_url }

  subject(:repo) do
    Y2Packager::Repository.new(repo_id: repo_id, name: "repo-oss", enabled: enabled,
      autorefresh: autorefresh, url: repo_url, raw_url: repo_url, repo_alias: "repo#{repo_id}")
  end

  let(:disabled) do
    Y2Packager::Repository.new(repo_id: repo_id + 1, name: "disabled-repo", enabled: false,
      autorefresh: false, url: repo_url, raw_url: repo_url, repo_alias: "repo#{repo_id}")
  end

  describe ".all" do
    before do
      allow(Yast::Pkg).to receive(:SourceGetCurrent).with(false).and_return(repo_ids)
    end

    context "when no repository exist" do
      let(:repo_ids) { [] }

      it "returns a empty array" do
        expect(described_class.all).to eq([])
      end
    end

    context "when a repository exist" do
      let(:repo_ids) { [repo_id] }
      let(:repo) { double("repo") }

      it "returns an array containing existing repositories" do
        expect(described_class).to receive(:find).with(repo_id).and_return(repo)
        expect(described_class.all).to eq([repo])
      end
    end

    context "when asked only for enabled repositories" do
      let(:repo_ids) { [repo_id] }
      let(:repo) { double("repo") }

      before do
        allow(described_class).to receive(:find).with(repo_id).and_return(repo)
      end

      it "returns only enabled repositories" do
        expect(Yast::Pkg).to receive(:SourceGetCurrent).with(true).and_return(repo_ids)
        described_class.all(enabled_only: true)
      end
    end
  end

  describe ".enabled" do
    before do
      allow(Y2Packager::Repository).to receive(:all).and_return([repo, disabled])
    end

    it "returns enabled repositories" do
      expect(Y2Packager::Repository.enabled).to eq([repo])
    end
  end

  describe ".disabled" do
    before do
      allow(Y2Packager::Repository).to receive(:all).and_return([repo, disabled])
    end

    it "returns disabled repositories" do
      expect(Y2Packager::Repository.disabled).to eq([disabled])
    end
  end

  describe ".find" do
    before do
      allow(Yast::Pkg).to receive(:SourceGeneralData).with(repo_id).and_return(repo_data)
    end

    context "when a valid repo_id is given" do
      let(:repo_data) do
        { "enabled" => true, "autorefresh" => true, "url" => repo_url, "raw_url" => repo_raw_url,
          "name" => "Repo #1", "product_dir" => "/product", "repo_alias" => "alias" }
      end

      it "returns the repository with the given repo_id" do
        repo = described_class.find(repo_id)
        expect(repo.repo_id).to eq(repo_id)
        expect(repo.enabled?).to eq(repo_data["enabled"])
        expect(repo.url).to eq(URI(repo_data["url"]))
        expect(repo.product_dir).to eq("/product")
      end

      context "if the raw url contains a repo var like $releasever" do
        let(:repo_raw_url) { "http://download.opensuse.org/update/leap/$releasever/oss" }

        it "returns the repository with the given repo_id" do
          repo = described_class.find(repo_id)
          expect(repo.repo_id).to eq(repo_id)
          expect(repo.enabled?).to eq(repo_data["enabled"])
          expect(repo.raw_url.to_s).to eq(repo_data["raw_url"].to_s)
          expect(repo.product_dir).to eq("/product")
        end
      end

      # Regression test for bug#1172867, using ${var_name} used to cause an exception
      context "if the raw url contains a repo var like ${releasever}" do
        let(:repo_raw_url) { "http://download.opensuse.org/update/leap/${releasever}/oss" }

        it "returns the repository with the given repo_id" do
          repo = described_class.find(repo_id)
          expect(repo.repo_id).to eq(repo_id)
          expect(repo.enabled?).to eq(repo_data["enabled"])
          expect(repo.raw_url.to_s).to eq(repo_data["raw_url"].to_s)
          expect(repo.product_dir).to eq("/product")
        end
      end

      # Regression test for bug#1172867, part 2
      context "if the raw url contains a repo var like ${var-word}" do
        let(:repo_raw_url) { "http://download.opensuse.org/update/leap/${var-word}/oss" }

        it "returns the repository with the given repo_id" do
          repo = described_class.find(repo_id)
          expect(repo.repo_id).to eq(repo_id)
          expect(repo.enabled?).to eq(repo_data["enabled"])
          expect(repo.raw_url.to_s).to eq(repo_data["raw_url"].to_s)
          expect(repo.product_dir).to eq("/product")
        end
      end

      # Regression test for bug#1172867, part 3
      context "if the raw url contains a repo var like ${var+word}" do
        let(:repo_raw_url) { "http://download.opensuse.org/update/leap/${var+word}/oss" }

        it "returns the repository with the given repo_id" do
          repo = described_class.find(repo_id)
          expect(repo.repo_id).to eq(repo_id)
          expect(repo.enabled?).to eq(repo_data["enabled"])
          expect(repo.raw_url.to_s).to eq(repo_data["raw_url"].to_s)
          expect(repo.product_dir).to eq("/product")
        end
      end

      context "if the raw url cannot be parsed" do
        let(:repo_raw_url) { "http://download.opensuse.org:80$releasever/update/leap/15.2/oss" }

        it "returns a repository with an empty url" do
          repo = described_class.find(repo_id)
          expect(repo.repo_id).to eq(repo_id)
          expect(repo.raw_url.to_s).to eq ""
          expect(repo.url.to_s).to eq ""
        end
      end
    end

    context "when an invalid repo_id is given" do
      let(:repo_data) { nil }

      it "raises a RepositoryNotFound error" do
        expect { described_class.find(repo_id) }.to raise_error(Y2Packager::Repository::NotFound)
      end
    end
  end

  describe "#scheme" do
    context "when URL contains a scheme" do
      let(:repo_url) { URI("cd://dev/sr1") }

      it "returns the repository scheme" do
        expect(repo.scheme).to eq(:cd)
      end
    end

    context "when URL does not contain a scheme" do
      let(:repo_url) { URI("/home/user/myrepo") }

      it "returns nil" do
        expect(repo.scheme).to be_nil
      end
    end
  end

  describe "#local" do
    before do
      allow(repo.raw_url).to receive(:scheme).and_return(scheme)
    end

    context "when scheme is :cd" do
      let(:scheme) { :cd }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is :dvd" do
      let(:scheme) { :dvd }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is :dir" do
      let(:scheme) { :dir }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is :hd" do
      let(:scheme) { :hd }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is :iso" do
      let(:scheme) { :iso }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is :file" do
      let(:scheme) { :file }

      it "returns true" do
        expect(repo).to be_local
      end
    end

    context "when scheme is other than local ones" do
      let(:scheme) { :http }

      it "returns false" do
        expect(repo).to_not be_local
      end
    end
  end

  describe "#enabled?" do
    context "when the repo is enabled" do
      let(:enabled) { true }

      it "returns true" do
        expect(repo).to be_enabled
      end
    end

    context "when the repo is not enabled" do
      let(:enabled) { false }

      it "returns false" do
        expect(repo).to_not be_enabled
      end
    end
  end

  describe "#autorefresh?" do
    context "when the repo is autorefresh" do
      let(:autorefresh) { true }

      it "returns true" do
        expect(repo).to be_autorefresh
      end
    end

    context "when the repo is not autorefresh" do
      let(:autorefresh) { false }

      it "returns false" do
        expect(repo).to_not be_autorefresh
      end
    end
  end

  describe "#refresh" do
    it "runs the refresh only when needed if called without parameters" do
      expect(Yast::Pkg).to receive(:SourceRefreshNow).with(repo.repo_id)
      repo.refresh
    end

    it "runs the refresh only when needed if the force parameter is false" do
      expect(Yast::Pkg).to receive(:SourceRefreshNow).with(repo.repo_id)
      repo.refresh(force: false)
    end

    it "always runs the refresh if the force parameter is true" do
      expect(Yast::Pkg).to receive(:SourceForceRefreshNow).with(repo.repo_id)
      repo.refresh(force: true)
    end
  end

  describe "#enable!" do
    it "enables the repository" do
      expect(Yast::Pkg).to receive(:SourceSetEnabled).with(disabled.repo_id, true)
        .and_return(true)
      expect { disabled.enable! }.to change { disabled.enabled? }.from(false).to(true)
    end
  end

  describe "#disable!" do
    it "disables the repository" do
      expect(Yast::Pkg).to receive(:SourceSetEnabled).with(repo.repo_id, false)
        .and_return(true)
      expect { repo.disable! }.to change { repo.enabled? }.from(true).to(false)
    end
  end

  describe "#delete!" do
    it "deletes the repository" do
      expect(Yast::Pkg).to receive(:SourceDelete).with(repo.repo_id).and_return(true)
      repo.delete!
    end

    it "changes the repo_id to nil" do
      allow(Yast::Pkg).to receive(:SourceDelete).with(repo.repo_id).and_return(true)
      expect { repo.delete! }.to change { repo.repo_id }.from(repo.repo_id).to(nil)
    end
  end

  describe "#url=!" do
    it "changes the repository URL" do
      new_url = "https://example.com/new_repo"
      expect(Yast::Pkg).to receive(:SourceChangeUrl).with(repo.repo_id, new_url).and_return(true)
      expect { repo.url = new_url }.to change { repo.url.to_s }.from(repo.url.to_s).to(new_url)
    end

    it "allows using an URI class parameter" do
      new_url = URI("https://example.com/new_repo")
      expect(Yast::Pkg).to receive(:SourceChangeUrl).with(repo.repo_id,
        new_url.to_s).and_return(true)
      expect { repo.url = new_url }.to change { repo.url.to_s }.from(repo.url.to_s).to(new_url.to_s)
    end

    it "allows using an ZyppUrl class parameter" do
      new_url = Y2Packager::ZyppUrl.new("https://example.com/new_repo")
      expect(Yast::Pkg).to receive(:SourceChangeUrl).with(repo.repo_id,
        new_url.to_s).and_return(true)
      expect { repo.url = new_url }.to change { repo.url }.from(repo.url).to(new_url)
    end
  end
end
