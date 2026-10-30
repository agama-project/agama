#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

require "y2storage/actions_presenter"

describe Y2Storage::ActionsPresenter do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(actiongraph) }

  let(:actiongraph) { double(Y2Storage::Actiongraph, compound_actions: compound_actions) }
  let(:compound_actions) { [] }
  let(:ca_delete_device) { instance_double(Y2Storage::CompoundAction) }
  let(:ca_create_device) { instance_double(Y2Storage::CompoundAction) }
  let(:ca_delete_subvol) { instance_double(Y2Storage::CompoundAction) }
  let(:ca_create_subvol) { instance_double(Y2Storage::CompoundAction) }
  let(:ca_multi_line)    { instance_double(Y2Storage::CompoundAction) }

  before do
    allow(ca_delete_device).to receive(:delete?).and_return(true)
    allow(ca_delete_device).to receive(:device_is?).with(:btrfs_subvolume).and_return(false)
    allow(ca_delete_device).to receive(:sentence).and_return("delete device action")

    allow(ca_create_device).to receive(:delete?).and_return(false)
    allow(ca_create_device).to receive(:device_is?).with(:btrfs_subvolume).and_return(false)
    allow(ca_create_device).to receive(:sentence).and_return("create device action")

    allow(ca_delete_subvol).to receive(:delete?).and_return(true)
    allow(ca_delete_subvol).to receive(:device_is?).with(:btrfs_subvolume).and_return(true)
    allow(ca_delete_subvol).to receive(:sentence).and_return("delete subvolume action")

    allow(ca_create_subvol).to receive(:delete?).and_return(false)
    allow(ca_create_subvol).to receive(:device_is?).with(:btrfs_subvolume).and_return(true)
    allow(ca_create_subvol).to receive(:sentence).and_return("create subvolume action")

    allow(ca_multi_line).to receive(:delete?).and_return(false)
    allow(ca_multi_line).to receive(:device_is?).with(:btrfs_subvolume).and_return(false)
    allow(ca_multi_line).to receive(:sentence).and_return("multi\nline\naction")
  end

  describe "#update_status" do
    before do
      allow(subject).to receive(:toggle_subvolumes_event).and_return("subvolumes")
    end

    context "when it receives a toggle subvolumes event" do
      it "toggles subvolumes" do
        expect(subject).to receive(:toggle_subvolumes)
        subject.update_status("subvolumes")
      end
    end

    context "when it receives other event" do
      it "does not toggle subvolumes" do
        expect(subject).not_to receive(:toggle_subvolumes)
        subject.update_status("other_event")
      end
    end
  end

  describe "#to_html" do
    let(:compound_actions) { [ca_create_device, ca_delete_device, ca_multi_line] }

    context "when there is no actiongraph" do
      let(:actiongraph) { nil }

      it "returns an empty html list" do
        expect(subject.to_html).to include "<ul></ul>"
      end
    end

    context "when there is an actiongraph" do

      it "presents delete actions in bold" do
        expect(subject.to_html).to include "<b>delete device action</b>"
      end

      it "presents delete actions first" do
        expect(subject.to_html)
          .to include "<ul><li><b>delete device action</b></li><li>create device action</li>"
      end

      it "formats newlines in actions correctly" do
        expect(subject.to_html)
          .to include "<li>multi<br>line<br>action</li>"
      end

      context "when there are no subvolume actions" do
        let(:compound_actions) { [ca_create_device, ca_delete_device] }

        it "does not include subvolumes line" do
          expect(subject.to_html).not_to include "see details"
        end
      end

      context "when there are subvolume actions" do
        let(:compound_actions) do
          [ca_create_device, ca_create_subvol, ca_delete_device, ca_delete_subvol]
        end

        it "presents collapsed subvolumes by default" do
          expect(subject.to_html).to include "see details"
          expect(subject.to_html).not_to include "delete subvolume"
          expect(subject.to_html).not_to include "create subvolume"
        end

        context "when subvolume actions are expanded" do
          before do
            allow(subject).to receive(:collapsed_subvolumes?).and_return(false)
          end

          it "presents delete subvolume actions first" do
            expect(subject.to_html)
              .to include "<li><b>delete subvolume action</b></li><li>create subvolume action</li>"
          end
        end
      end
    end
  end

  describe "#to_s" do
    context "with nothing to do" do
      it "Shows a reasonable text" do
        expect(subject.to_s).to eq "Nothing to do"
      end
    end

    context "with a create and a delete action" do
      let(:compound_actions) { [ca_create_device, ca_delete_device] }

      it "Shows the right messages in the right order" do
        lines = subject.to_s.split("\n")
        expect(lines).to eq ["delete device action", "create device action"]
      end
    end

    context "with subvolume actions" do
      let(:compound_actions) do
        [ca_create_device, ca_create_subvol, ca_delete_device, ca_delete_subvol]
      end

      it "Shows the right messages in the right order" do
        lines = subject.to_s.split("\n")
        expect(lines[0]).to eq "delete device action"
        expect(lines[1]).to eq "create device action"
        expect(lines[2]).to eq ""
        expect(lines[3]).to eq "delete subvolume action"
        expect(lines[4]).to eq "create subvolume action"
      end
    end
  end

  describe "#save" do
    let(:compound_actions) { [ca_create_device, ca_delete_device] }
    let(:filename) { "/tmp/saved_actions.txt" }

    before { FileUtils.remove(filename) if File.exist?(filename) }
    after { FileUtils.remove(filename) }

    it "Saves the actions in a plain text file" do
      subject.save(filename)
      lines = File.read(filename).split("\n")
      expect(lines[0]).to start_with(Time.now.year.to_s)
      expect(lines[1]).to eq ""
      expect(lines[2]).to eq "delete device action"
      expect(lines[3]).to eq "create device action"
    end
  end

  describe "#can_handle?" do
    before do
      allow(subject).to receive(:events).and_return(["event1", "event2"])
    end

    it "returns true if the event is included in its list of events" do
      expect(subject.can_handle?("event1")).to be_truthy
    end

    it "returns false if the event is not included in its list of events" do
      expect(subject.can_handle?("event3")).to be_falsey
    end
  end

  describe "#events" do
    before do
      allow(subject).to receive(:toggle_subvolumes_event).and_return("subvolumes")
    end

    it "returns a list of strings" do
      expect(subject.events).to all(be_a(String))
    end

    it "includes toggle subvolumes event" do
      expect(subject.events).to include("subvolumes")
    end
  end
end
