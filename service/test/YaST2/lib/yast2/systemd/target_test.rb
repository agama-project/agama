# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require_relative "support/stubs"

module Yast2 # rubocop:disable Metrics/ModuleLength
  describe Systemd::Target do
    include SystemdTargetStubs

    before do
      stub_targets
    end

    describe ".find" do
      it "returns the target unit object specified in parameter" do
        target = Systemd::Target.find("graphical")
        expect(target).not_to be_nil
        expect(target).to be_a(Systemd::Target)
        expect(target.unit_type).to eq("target")
      end

      it "returns nil if the target unit does not exist" do
        stub_targets(target: "unknown")
        target = Systemd::Target.find("unknown")
        expect(target).to be_nil
      end
    end

    describe ".find!" do
      it "returns the target unit object specified in parameter" do
        target = Systemd::Target.find("graphical")
        expect(target).not_to be_nil
        expect(target.unit_type).to eq("target")
      end

      it "raises Systemd::TargetNotFound error if the target unit does not exist" do
        stub_targets(target: "unknown")
        expect { Systemd::Target.find!("unknown") }.to raise_error(Systemd::TargetNotFound)
      end
    end

    describe ".all" do
      it "returns all targets found" do
        targets = Systemd::Target.all
        expect(targets).to be_a(Array)
        expect(targets).not_to be_empty
        expect(targets).not_to include(nil)
        targets.each { |s| expect(s.unit_type).to eq("target") }
      end
    end

    describe "methods not supported for target units" do
      it "raises NoMethodError for unsupported unit methods" do
        target = Systemd::Target.find("graphical")
        expect(target).not_to be_nil
        expect { target.enable  }.to raise_error(NoMethodError)
        expect { target.disable }.to raise_error(NoMethodError)
        expect { target.start   }.to raise_error(NoMethodError)
        expect { target.stop    }.to raise_error(NoMethodError)
      end
    end

    describe ".get_default" do
      it "returns the unit object of the currently set default target" do
        allow(Systemctl).to receive(:execute).with("get-default").and_return(
          OpenStruct.new("exit" => 0, "stdout" => "graphical.target", "stderr" => "")
        )
        target = Systemd::Target.get_default
        expect(target).not_to be_nil
        expect(target).to be_a(Systemd::Target)
        expect(target.unit_name).to eq("graphical")
      end
    end

    describe ".set_default" do
      it "returns true if the default target has been has for the parameter successfully" do
        expect(Systemctl).to receive(:execute).with("set-default --force graphical.target")
          .and_return(OpenStruct.new("exit" => 0, "stdout" => "", "stderr" => ""))
        expect(Systemd::Target.set_default("graphical")).to eq(true)
      end

      it "returns false if the default target has not been set" do
        stub_targets(target: "unknown")
        expect(Systemd::Target.set_default("unknown")).to eq(false)
      end
    end

    describe "#set_default" do
      it "it returns true if the target unit object has been set as default target" do
        expect(Systemctl).to receive(:execute).with("set-default --force graphical.target")
          .and_return(OpenStruct.new("exit" => 0, "stdout" => "", "stderr" => ""))
        target = Systemd::Target.find("graphical")
        expect(target.set_default).to eq(true)
      end

      it "returns false if the target unit has not been set as default target" do
        stub_targets(target: "network")
        target = Systemd::Target.find("network")
        expect(target.set_default).to eq(false)
      end

      context "when target properties cannot be found out (e.g. in chroot)" do
        it "it returns true if the target unit object has been set as default target" do
          expect(Systemctl).to receive(:execute)
            .with("set-default --force multi-user-in-installation.target")
            .and_return(OpenStruct.new("exit" => 0, "stdout" => "", "stderr" => ""))
          stub_targets(target: "multi-user-in-installation")
          target = Systemd::Target.find("multi-user-in-installation")
          expect(target.set_default).to eq(true)
        end
      end
    end

    describe "#allow_isolate?" do
      it "returns true if the unit is allowed to be isolated" do
        target = Systemd::Target.find("graphical")
        expect(target.allow_isolate?).to eq(true)
      end

      it "returns false if the unit is not allowed to be isolated" do
        stub_targets(target: "network")
        target = Systemd::Target.find("network")
        expect(target.allow_isolate?).to eq(false)
      end

      context "when target properties cannot be found out (e.g. in chroot)" do
        it "returns true" do
          stub_targets(target: "multi-user-in-installation")
          target = Systemd::Target.find("multi-user-in-installation")
          expect(target.allow_isolate?).to eq(true)
        end
      end
    end
  end
end
