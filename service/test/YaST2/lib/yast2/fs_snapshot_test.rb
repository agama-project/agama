#!/usr/bin/env rspec

# Copyright (c) [2015-2019] SUSE LLC
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

require_relative "test_helper"
require "yast2/fs_snapshot"

describe Yast2::FsSnapshot do
  def logger
    described_class.log
  end

  let(:dummy_snapshot) { double("snapshot", number: 2) }

  before do
    # reset configured cache
    described_class.instance_variable_set("@configured", nil)
  end

  describe ".configured?" do
    let(:command) { format(Yast2::FsSnapshot::FIND_CONFIG_CMD, root: "/") }
    let(:chrooted) { true }

    before do
      allow(Yast::SCR).to receive(:Execute)
        .with(path(".target.bash_output"), command)
        .and_return("stdout" => "", "exit" => find_code)
      allow(Yast::WFM).to receive(:scr_chrooted?).and_return chrooted
    end

    context "when snapper's configuration does not exist" do
      let(:find_code) { 1 }

      it "returns false" do
        expect(logger).to receive(:info).with(/Checking if Snapper is configured/)
        expect(described_class.configured?).to eq(false)
      end
    end

    context "when snapper's configuration exists" do
      let(:find_code) { 0 }

      it "returns false" do
        expect(described_class.configured?).to eq(true)
      end
    end

    context "in initial stage before scr switched" do
      let(:command) { format(Yast2::FsSnapshot::FIND_CONFIG_CMD, root: "/mnt") }
      let(:chrooted) { false }

      let(:find_code) { 0 }

      before do
        Yast.import "Installation"
        Yast::Installation.destdir = "/mnt"

        Yast.import "Stage"
        allow(Yast::Stage).to receive(:initial).and_return true

        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), command)
          .and_return("stdout" => "", "exit" => 0)
      end

      it "detects snapper configuration in installation target dir" do
        expect(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), command)
          .and_return("stdout" => "", "exit" => 0)

        expect(described_class.configured?).to eq(true)
      end
    end
  end

  describe ".configure_on_install?" do
    # This test assumes #configure_on_install= has not been called in the
    # testsuite
    it "returns false unless explicitly set to true" do
      expect(described_class.configure_on_install?).to eq false
    end
  end

  describe ".configure_snapper" do
    before do
      Yast.import "Mode"
      Yast.import "Stage"

      allow(Yast::Stage).to receive(:initial).and_return true
      allow(Yast::Mode).to receive(:installation).and_return(mode == :installation)
      allow(Yast::WFM).to receive(:scr_chrooted?).and_return chrooted
    end

    context "in normal mode (no installation)" do
      let(:mode) { :normal }
      let(:chrooted) { false }

      it "raises a SnapperNotConfigurable error" do
        expect { described_class.configure_snapper }.to raise_error(Yast2::SnapperNotConfigurable)
      end
    end

    context "during installation" do
      let(:mode) { :installation }

      context "before the chroot switch to the target system" do
        let(:chrooted) { false }

        it "raises a SnapperNotConfigurable error" do
          expect { described_class.configure_snapper }.to raise_error(Yast2::SnapperNotConfigurable)
        end
      end

      context "after chrooting to the target system" do
        let(:chrooted) { true }

        before do
          described_class.instance_variable_set("@configured", false)
          allow(Yast::Execute).to receive(:on_target)
          allow(Yast::SCR).to receive(:Write)
        end

        # Not the most elegant test ever, but...
        it "resets the .configured? cache" do
          expect(described_class.instance_variable_get("@configured")).to_not be_nil
          described_class.configure_snapper
          expect(described_class.instance_variable_get("@configured")).to be_nil
        end

        it "executes the fourth step of Snapper's installation helper" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper\/installation-helper/, "--step", "4")
          described_class.configure_snapper
        end

        it "sets Snapper config" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper$/, "--no-dbus", "set-config", any_args)
          described_class.configure_snapper
        end

        it "configures YaST to use snapper" do
          expect(Yast::SCR).to receive(:Write).with(path(".sysconfig.yast2.USE_SNAPPER"), "yes")
          described_class.configure_snapper
        end

        it "sets Snapper quota" do
          expect(Yast::Execute).to receive(:on_target).with(/snapper$/, "--no-dbus", "setup-quota")
          described_class.configure_snapper
        end
      end
    end
  end

  describe ".create_single" do
    CREATE_SINGLE_SNAPSHOT = "/usr/bin/snapper --no-dbus "\
                             "--root=/ create --type single --description some-description".freeze
    OPTION_CLEANUP_NUMBER = " --cleanup number".freeze
    OPTION_IMPORTANT = " --userdata \"important=yes\"".freeze

    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(configured)
      allow(Yast2::FsSnapshot).to receive(:create_snapshot?).with(:single).and_return(create_snapshot)
      allow(Yast2::FsSnapshot).to receive(:all).and_return([dummy_snapshot])
    end

    context "when snapper is configured" do
      let(:configured) { true }
      let(:create_snapshot) { true }
      let(:snapshot_command) { CREATE_SINGLE_SNAPSHOT }

      before do
        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), snapshot_command)
          .and_return(output)
      end

      context "when snapshot creation fails" do
        let(:output) { { "exit" => 1 } }

        it "logs the error and returns nil" do
          expect(logger).to receive(:error).with(/Snapshot could not be created/)
          expect { described_class.create_single("some-description") }
            .to raise_error(Yast2::SnapshotCreationFailed)
        end
      end

      context "when snapshot creation is successful" do
        let(:output) { { "exit" => 0 } }

        it "returns the created snapshot" do
          snapshot = described_class.create_single("some-description")
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when a cleanup strategy is set" do
        let(:output) { { "exit" => 0 } }
        let(:snapshot_command) { CREATE_SINGLE_SNAPSHOT + OPTION_CLEANUP_NUMBER }

        it "creates a snapshot with that strategy" do
          snapshot = described_class.create_single("some-description", cleanup: :number)
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when a snapshot is important" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }
        let(:snapshot_command) { CREATE_SINGLE_SNAPSHOT + OPTION_IMPORTANT }

        it "creates a snapshot marked as important" do
          snapshot = described_class.create_single("some-description", important: true)
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when it's both important and a cleanup strategy is set" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }
        let(:snapshot_command) { CREATE_SINGLE_SNAPSHOT + OPTION_IMPORTANT + OPTION_CLEANUP_NUMBER }

        it "creates a snapshot with that strategy that is marked as important" do
          snapshot = described_class.create_single("some-description", cleanup: :number, important: true)
          expect(snapshot).to be(dummy_snapshot)
        end
      end
    end

    context "when snapper is not configured" do
      let(:configured) { false }
      let(:create_snapshot) { true }

      it "raises an exception" do
        expect { described_class.create_single("some-description") }
          .to raise_error(Yast2::SnapperNotConfigured)
      end
    end

    context "when creating snapshots is disabled" do
      let(:configured) { false }
      let(:create_snapshot) { false }

      it "returns nil" do
        expect(described_class.create_single("some-description")).to eq(nil)
      end
    end
  end

  describe ".create_pre" do
    CREATE_PRE_SNAPSHOT = "/usr/bin/snapper --no-dbus "\
                          "--root=/ create --type pre --description some-description".freeze

    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(configured)
      allow(Yast2::FsSnapshot).to receive(:create_snapshot?).with(:around).and_return(create_snapshot)
      allow(Yast2::FsSnapshot).to receive(:all).and_return([dummy_snapshot])
    end

    context "when snapper is configured" do
      let(:configured) { true }
      let(:create_snapshot) { true }
      let(:snapshot_command) { CREATE_PRE_SNAPSHOT }

      before do
        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), snapshot_command)
          .and_return(output)
      end

      context "when snapshot creation fails" do
        let(:output) { { "exit" => 1 } }

        it "logs the error and returns nil" do
          expect(logger).to receive(:error).with(/Snapshot could not be created/)
          expect { described_class.create_pre("some-description") }
            .to raise_error(Yast2::SnapshotCreationFailed)
        end
      end

      context "when snapshot creation is successful" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }

        it "returns the created snapshot" do
          snapshot = described_class.create_pre("some-description")
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when a cleanup strategy is set" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }
        let(:snapshot_command) { CREATE_PRE_SNAPSHOT + OPTION_CLEANUP_NUMBER }

        it "creates a pre snapshot with that strategy" do
          snapshot = described_class.create_pre("some-description", cleanup: :number)
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when a snapshot is important" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }
        let(:snapshot_command) { CREATE_PRE_SNAPSHOT + OPTION_IMPORTANT }

        it "creates a pre snapshot marked as important" do
          snapshot = described_class.create_pre("some-description", important: true)
          expect(snapshot).to be(dummy_snapshot)
        end
      end

      context "when it's both important and a cleanup strategy is set" do
        let(:output) { { "stdout" => "2", "exit" => 0 } }
        let(:snapshot_command) { CREATE_PRE_SNAPSHOT + OPTION_IMPORTANT + OPTION_CLEANUP_NUMBER }

        it "creates a pre snapshot with that strategy that is marked as important" do
          snapshot = described_class.create_pre("some-description", important: true, cleanup: :number)
          expect(snapshot).to be(dummy_snapshot)
        end
      end
    end

    context "when snapper is not configured" do
      let(:configured) { false }
      let(:create_snapshot) { true }

      it "raises an exception" do
        expect { described_class.create_pre("some-description") }
          .to raise_error(Yast2::SnapperNotConfigured)
      end
    end

    context "when creating snapshots is disabled" do
      let(:configured) { false }
      let(:create_snapshot) { false }

      it "returns nil" do
        expect(described_class.create_pre("some-description")).to eq(nil)
      end
    end
  end

  describe ".create_post" do
    CREATE_POST_SNAPSHOT = "/usr/bin/snapper --no-dbus "\
                           "--root=/ create --type post --description some-description "\
                           "--pre-num 1".freeze

    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(configured)
      allow(Yast2::FsSnapshot).to receive(:create_snapshot?).with(:around).and_return(create_snapshot)
    end

    context "when snapper is configured" do
      let(:configured) { true }
      let(:create_snapshot) { true }

      let(:pre_snapshot) { double("snapshot", snapshot_type: :pre, number: 1) }
      let(:snapshots) { [pre_snapshot] }
      let(:output) { { "exit" => 0 } }

      before do
        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), CREATE_POST_SNAPSHOT)
          .and_return(output)
        allow(Yast2::FsSnapshot).to receive(:all)
          .and_return([pre_snapshot])
        allow(Yast2::FsSnapshot).to receive(:all)
          .and_return([pre_snapshot, dummy_snapshot])
      end

      context "when previous snapshot exists" do
        let(:snapshots) { [pre_snapshot] }

        context "when snapshot creation is successful" do
          it "returns the created snapshot" do
            expect(described_class.create_post("some-description", pre_snapshot.number))
              .to eq(dummy_snapshot)
          end
        end

        context "when snapshot creation fails" do
          let(:output) { { "stdout" => "", "exit" => 1 } }

          it "logs the error and raises an exception" do
            expect(logger).to receive(:error).with(/Snapshot could not be created/)
            expect { described_class.create_post("some-description", pre_snapshot.number) }
              .to raise_error(Yast2::SnapshotCreationFailed)
          end
        end
      end

      context "when previous snapshot does not exist" do
        it "logs the error and raises an exception" do
          expect(logger).to receive(:error).with(/Previous filesystem snapshot was not found/)
          expect { described_class.create_post("some-description", 100) }
            .to raise_error(Yast2::PreviousSnapshotNotFound)
        end
      end
    end

    context "when snapper is not configured" do
      let(:configured) { false }
      let(:create_snapshot) { true }

      it "raises an exception" do
        expect { described_class.create_post("some-description", 1) }
          .to raise_error(Yast2::SnapperNotConfigured)
      end
    end

    context "when creating snapshots is disabled" do
      let(:configured) { false }
      let(:create_snapshot) { false }

      it "returns nil" do
        expect(described_class.create_post("some-description", 999)).to eq(nil)
      end
    end
  end

  describe ".all" do
    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(configured)
    end

    context "when snapper is configured" do
      let(:configured) { true }

      let(:command) { format(Yast2::FsSnapshot::LIST_SNAPSHOTS_CMD, root: "/") }

      before do
        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), command)
          .and_return("stdout" => output, "exit" => 0)
      end

      context "given some snapshots exist" do
        let(:output) { File.read(output_path) }
        let(:output_path) { File.expand_path("fixtures/snapper-list.txt", __dir__) }

        it "should return the snapshots and log about how many were found" do
          expect(logger).to receive(:info).with(/Retrieving snapshots list/)
          snapshots = described_class.all
          expect(snapshots).to be_kind_of(Array)
          expect(snapshots.size).to eq(4)
        end
      end

      context "given no snapshots exist" do
        let(:output) { File.read(output_path) }
        let(:output_path) { File.expand_path("fixtures/empty-snapper-list.txt", __dir__) }

        it "should return an empty array" do
          expect(described_class.all).to eq([])
        end
      end

      context "when an snapshot contains a wrong date" do
        let(:output) do
          "number,type,pre-number,date,user,cleanup,description\n" \
            "1,single,,bad-date,root,,\n"
        end

        it "sets timestamp to nil" do
          snapshot = described_class.all.first

          expect(snapshot.timestamp).to be_nil
        end
      end
    end

    context "when snapper is not configured" do
      let(:configured) { false }

      it "raises an exception" do
        expect { described_class.all }
          .to raise_error(Yast2::SnapperNotConfigured)
      end
    end
  end

  describe ".find" do
    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(configured)
    end

    context "when snapper is configured" do
      let(:configured) { true }
      let(:output) { File.read(output_path) }
      let(:output_path) { File.expand_path("fixtures/snapper-list.txt", __dir__) }

      let(:command) { format(Yast2::FsSnapshot::LIST_SNAPSHOTS_CMD, root: "/") }

      before do
        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash_output"), command)
          .and_return("stdout" => output, "exit" => 0)
      end

      context "when a snapshot with that number exists" do
        it "should return the snapshot" do
          snapshot = described_class.find(4)
          expect(snapshot.number).to eq(4)
          expect(snapshot.snapshot_type).to eq(:post)
          expect(snapshot.previous_number).to eq(3)
          expect(snapshot.timestamp).to eq(DateTime.parse("2015-05-13 05:03:13"))
          expect(snapshot.user).to eq("root")
          expect(snapshot.cleanup_algo).to eq(:number)
          expect(snapshot.description).to eq("zypp(zypper)")
        end
      end

      context "when a snapshot with that number does not exists" do
        it "should return nil" do
          expect(described_class.find(100)).to be_nil
        end
      end
    end

    context "when snapper is not configured" do
      let(:configured) { false }

      it "raises an exception" do
        expect { described_class.find(1) }
          .to raise_error(Yast2::SnapperNotConfigured)
      end
    end
  end

  describe "#previous" do
    let(:output) { File.read(output_path) }
    let(:output_path) { File.expand_path("fixtures/snapper-list.txt", __dir__) }

    let(:command) { format(Yast2::FsSnapshot::LIST_SNAPSHOTS_CMD, root: "/") }

    before do
      allow(Yast2::FsSnapshot).to receive(:configured?).and_return(true)
      allow(Yast::SCR).to receive(:Execute)
        .with(path(".target.bash_output"), command)
        .and_return("stdout" => output, "exit" => 0)
    end

    context "given a previous snapshot" do
      subject(:fs_snapshot) { Yast2::FsSnapshot.find(4) }

      it "returns the previous snapshot" do
        expect(fs_snapshot.previous.number).to eq(3)
      end
    end

    context "given no previous snapshot" do
      subject(:fs_snapshot) { Yast2::FsSnapshot.find(3) }

      it "returns nil" do
        expect(fs_snapshot.previous).to be_nil
      end
    end
  end

  describe ".create_snapshot?" do
    before do
      Yast.import "Linuxrc"
    end

    context "when single value is defined on Linuxrc commandline" do
      it "returns whether given snapshot type is allowed" do
        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("around")
        expect(described_class.create_snapshot?(:around)).to eq(false)
        expect(described_class.create_snapshot?(:single)).to eq(true)

        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("single")
        expect(described_class.create_snapshot?(:around)).to eq(true)
        expect(described_class.create_snapshot?(:single)).to eq(false)

        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("all")
        expect(described_class.create_snapshot?(:around)).to eq(false)
        expect(described_class.create_snapshot?(:single)).to eq(false)
      end
    end

    context "when more values are defined on Linuxrc commandline" do
      it "returns whether given snapshot type is not within disabled snapshots types" do
        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("single,around")
        expect(described_class.create_snapshot?(:around)).to eq(false)
        expect(described_class.create_snapshot?(:single)).to eq(false)

        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("all,around")
        expect(described_class.create_snapshot?(:around)).to eq(false)
        expect(described_class.create_snapshot?(:single)).to eq(false)
      end
    end

    context "when no value is defined on Linuxrc commandline" do
      it "returns that any snapshots are allowed" do
        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return(nil)
        expect(described_class.create_snapshot?(:around)).to eq(true)
        expect(described_class.create_snapshot?(:single)).to eq(true)

        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("")
        expect(described_class.create_snapshot?(:around)).to eq(true)
        expect(described_class.create_snapshot?(:single)).to eq(true)
      end
    end

    context "when called with unsupported parameter value" do
      it "throws an ArgumentError exception" do
        allow(Yast::Linuxrc).to receive(:value_for).with(/snapshot/).and_return("all")
        expect { described_class.create_snapshot?(:some) }.to raise_error(ArgumentError, /:some/)
      end
    end
  end
end
