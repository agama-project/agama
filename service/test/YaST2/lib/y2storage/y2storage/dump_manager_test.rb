#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) 2018 SUSE LLC
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
require_relative "../support/shared_setup"
require "y2storage/dump_manager"

describe Y2Storage::DumpManager do
  include_context "yast2-storage-ng test setup"

  before(:all) do
    fake_scenario("mixed_disks")
    # DumpManager is a singleton which might be used by previous unit tests,
    # so let's reset it to a well-defined state to make sure the dump dir
    # numbers start with -01 again.
    described_class.instance.reset
  end

  after(:all) do
    # Comment this out for debugging to keep the dump files after running the tests
    kill_dump_dirs
  end

  before do
    allow(Y2Storage::DumpManager.instance).to receive(:dump).and_call_original
  end

  subject { described_class.instance }
  let(:probed) { Y2Storage::StorageManager.instance.probed }
  let(:staging) { Y2Storage::StorageManager.instance.staging }

  def populate_dump_dir(dir, marker = nil)
    FileUtils.mkdir_p(base_dir + "/" + dir)
    FileUtils.touch(base_dir + "/" + dir + "/" + marker) if marker
  end

  def populate_full
    kill_dump_dirs
    populate_dump_dir("storage-inst", "marker-inst")
    populate_dump_dir("storage", "marker-00")
    populate_dump_dir("storage-01", "marker-01")
    populate_dump_dir("storage-02", "marker-02")
    populate_dump_dir("storage-03", "marker-03")
  end

  def dir?(dir)
    File.exist?(base_dir + "/" + dir)
  end

  def marker?(dir, marker)
    File.exist?(base_dir + "/" + dir + "/" + marker)
  end

  def dump?(name)
    base_name = dump_dir + "/" + name
    File.exist?(base_name + ".xml") && File.exist?(base_name + ".yml")
  end

  def kill_dump_dirs
    Dir.glob(base_dir + "/storage*").each { |dir| FileUtils.remove_dir(dir) }
  end

  def base_dir
    (Process.euid == 0) ? "/var/log/YaST2" : Dir.home + "/.y2storage"
  end

  def dump_dir_list
    return [] unless File.exist?(base_dir)

    Dir.glob(base_dir + "/storage*").sort
  end

  describe "#instance" do
    it "does not crash and burn" do
      expect(subject).not_to be_nil
    end
  end

  context "In the installed system" do
    before(:all) do
      fake_scenario("mixed_disks")
    end

    let(:dump_dir) { base_dir + "/storage" }

    describe "#installation?" do
      it "returns false" do
        expect(subject.installation?).to be false
      end
    end

    describe "#base_dir" do
      it "returns the correct base directory" do
        expect(subject.base_dir).to eq base_dir
      end
    end

    describe "#dump_dir" do
      it "uses 'storage' as the dump dir" do
        expect(subject.dump_dir).to eq dump_dir
      end
    end

    describe "#kill_all_dump_dirs" do
      it "leaves only the base dir" do
        populate_full
        # Check preconditions
        expect(dump_dir_list.size).to be == 5
        expect(dir?("storage")).to be true
        expect(dir?("storage-01")).to be true

        subject.kill_all_dump_dirs
        expect(dump_dir_list.empty?).to be true
        expect(File.exist?(base_dir)).to be true
      end
    end

    describe "#rotate_dump_dirs" do
      it "Rotates the most recent 3 directories" do
        populate_full
        subject.rotate_dump_dirs
        expect(marker?("storage-03", "marker-02")).to be true
        expect(marker?("storage-02", "marker-01")).to be true
        expect(marker?("storage-01", "marker-00")).to be true
        expect(marker?("storage-inst", "marker-inst")).to be true
        expect(dir?("storage")).to be false
      end

      it "Rotates one more" do
        subject.rotate_dump_dirs
        # storage-04 might sound surprising, but rotating the directories once
        # more without creating the one that just rotated out (storage-01) should
        # still leave us with 3 old dump directories, so it's now storage-04..02.
        expect(marker?("storage-04", "marker-02")).to be true
        expect(marker?("storage-03", "marker-01")).to be true
        expect(marker?("storage-02", "marker-00")).to be true
        expect(dir?("storage-01")).to be false
        expect(marker?("storage-inst", "marker-inst")).to be true
        expect(dir?("storage")).to be false
      end
    end

    describe "#devicegraph_dump_name" do
      it "Can handle a nil devicegraph" do
        expect(subject.devicegraph_dump_name(nil)).to be_nil
      end

      it "Returns 'probed' for the probed devicegraph" do
        expect(subject.devicegraph_dump_name(probed)).to eq "probed"
      end

      it "Returns 'staging' for the staging devicegraph" do
        expect(subject.devicegraph_dump_name(probed)).to eq "probed"
      end

      it "Returns 'devicegraph' for anything else" do
        expect(subject.devicegraph_dump_name(Object.new)).to eq "devicegraph"
      end
    end

    describe "#dump" do
      it "Can handle a nil object" do
        expect(subject.dump(nil)).to be_nil
      end

      it "Correctly dumps the probed devicegraph" do
        expect(dir?("storage")).to be false
        expect(subject.dump(probed)).to eq "01-probed"
        expect(dump?("01-probed")).to be true
      end

      it "Correctly dumps the staging devicegraph" do
        expect(subject.dump(staging)).to eq "02-staging"
        expect(dump?("02-staging")).to be true
        expect(dump?("01-probed")).to be true
      end

      it "Correctly dumps the staging devicegraph again" do
        expect(subject.dump(staging)).to eq "03-staging"
        expect(dump?("03-staging")).to be true
        expect(dump?("02-staging")).to be true
        expect(dump?("01-probed")).to be true
      end

      it "Correctly dumps the staging devicegraph again to a specified name" do
        expect(subject.dump(staging, "committed")).to eq "04-committed"
        expect(dump?("04-committed")).to be true
        expect(dump?("03-staging")).to be true
        expect(dump?("02-staging")).to be true
        expect(dump?("01-probed")).to be true
      end

      it "Correctly dumps an ActionsPresenter" do
        expect(subject.dump(Y2Storage::ActionsPresenter.new(nil))).to eq "05-actions"
        expect(File.exist?(base_dir + "/storage/05-actions.txt")).to be true
      end

      it "Rejects unknown types" do
        expect { subject.dump(Object.new) }.to raise_error(ArgumentError)
      end
    end
  end

  context "During installation" do
    let(:dump_dir) { base_dir + "/storage-inst" }

    before(:each) do
      allow(Yast::Mode).to receive(:installation).and_return(true)
    end

    describe "#reset" do
      # It's a singleton - we need to reset it now for Mode.installation to
      # take effect
      it "clears storage-inst/" do
        subject.reset
        expect(dir?("storage-inst")).to be true
        expect(marker?("storage-inst", "marker-inst")).to be false
      end

      it "leaves storage/, storage-03/, ... alone" do
        expect(marker?("storage", "01-probed.yml")).to be true
        expect(marker?("storage", "03-staging.yml")).to be true
        expect(marker?("storage", "04-committed.yml")).to be true
        expect(marker?("storage-03", "marker-01")).to be true
      end
    end

    describe "#dump_dir" do
      it "uses 'storage-inst' as the dump dir" do
        expect(subject.dump_dir).to eq dump_dir
      end
    end

    describe "#installation?" do
      it "returns true" do
        expect(subject.installation?).to be true
      end
    end
  end
end
