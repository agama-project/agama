#!/usr/bin/env rspec
# Copyright (c) 2018-2019 SUSE LLC
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

require "yast2/control_log_dir_rotator"

describe Yast2::ControlLogDirRotator do

  context "In the installed system" do

    before(:each) do
      allow(Yast::Mode).to receive(:installation).and_return(false)
      allow(Process).to receive(:euid).and_return(0)
    end

    describe "#log_dir" do
      it "uses 'control' as the log dir" do
        expect(subject.log_dir).to eq "/var/log/YaST2/control"
      end
    end

    describe "#prepare" do
      it "deletes, rotates and creates the directories" do
        expect(Dir).to receive(:entries).with("/var/log/YaST2").and_return(["control", "control-01", "control-02", "control-03"])

        expect(File).to receive(:exist?).with("/var/log/YaST2/control-03").and_return(true)
        expect(FileUtils).to receive(:remove_dir).with("/var/log/YaST2/control-03")

        expect(File).to receive(:exist?).with("/var/log/YaST2").and_return(true)
        expect(File).to receive(:rename).with("/var/log/YaST2/control-02", "/var/log/YaST2/control-03")
        expect(File).to receive(:rename).with("/var/log/YaST2/control-01", "/var/log/YaST2/control-02")
        expect(File).to receive(:rename).with("/var/log/YaST2/control", "/var/log/YaST2/control-01")

        expect(FileUtils).to receive(:mkdir_p).with("/var/log/YaST2/control")

        subject.prepare
      end
    end

  end

  context "During installation" do

    before(:each) do
      allow(Yast::Mode).to receive(:installation).and_return(true)
      allow(Process).to receive(:euid).and_return(0)
    end

    describe "#log_dir" do
      it "uses 'control-inst' as the log dir" do
        expect(subject.log_dir).to eq "/var/log/YaST2/control-inst"
      end
    end

  end

end
