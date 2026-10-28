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

require_relative "../../../test_helper"
require "y2network/startmode"
require "y2network/startmodes"

describe Y2Network::Startmode do
  describe ".create" do
    context "when given a known startmode name" do
      it "returns an instance of the matching Startmodes subclass" do
        startmode = described_class.create("auto")

        expect(startmode).to be_a(Y2Network::Startmodes::Auto)
        expect(startmode.name).to eq("auto")
        expect(startmode.alias_name).to be_nil
      end
    end

    context "when given a legacy alias ('boot', 'onboot' or 'on')" do
      it "returns an 'auto' startmode remembering the original alias name" do
        startmode = described_class.create("boot")

        expect(startmode).to be_a(Y2Network::Startmodes::Auto)
        expect(startmode.name).to eq("auto")
        expect(startmode.alias_name).to eq("boot")
      end

      it "works the same for 'onboot'" do
        startmode = described_class.create("onboot")

        expect(startmode.name).to eq("auto")
        expect(startmode.alias_name).to eq("onboot")
      end

      it "works the same for 'on'" do
        startmode = described_class.create("on")

        expect(startmode.name).to eq("auto")
        expect(startmode.alias_name).to eq("on")
      end
    end

    context "when given an unknown startmode name" do
      it "logs an error and returns nil" do
        expect(Y2Network::Startmode).to receive(:log).and_call_original.at_least(:once)
        expect(described_class.create("not-a-real-mode")).to be_nil
      end
    end
  end

  describe ".all" do
    it "returns one instance for every registered Startmodes subclass" do
      all = described_class.all

      expect(all.map(&:class)).to contain_exactly(
        Y2Network::Startmodes::Auto,
        Y2Network::Startmodes::Hotplug,
        Y2Network::Startmodes::Ifplugd,
        Y2Network::Startmodes::Manual,
        Y2Network::Startmodes::Nfsroot,
        Y2Network::Startmodes::Off
      )
    end
  end

  describe "#to_s" do
    it "returns the startmode name" do
      expect(described_class.create("manual").to_s).to eq("manual")
    end
  end

  describe "#==" do
    it "returns true when both the class and the name are equal" do
      expect(described_class.create("auto")).to eq(described_class.create("auto"))
    end

    it "returns false when the classes differ even with the same name" do
      manual = Y2Network::Startmodes::Manual.new
      off = Y2Network::Startmodes::Off.new

      expect(manual).to_not eq(off)
    end

    it "returns false when the alias_name differs" do
      expect(described_class.create("auto")).to_not eq(described_class.create("boot"))
    end
  end
end

describe Y2Network::Startmodes do
  describe "its constants" do
    it "are named after the Startmode subclasses they hold" do
      expect(described_class.constants).to contain_exactly(
        :Auto, :Hotplug, :Ifplugd, :Manual, :Nfsroot, :Off
      )
    end

    it "all inherit from Y2Network::Startmode" do
      classes = described_class.constants.map { |c| described_class.const_get(c) }

      expect(classes).to all(be < Y2Network::Startmode)
    end
  end
end

describe Y2Network::Startmodes::Auto do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'auto'" do
      expect(startmode.name).to eq("auto")
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("At Boot Time")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Started automatically at boot")
    end
  end

  context "when created with an alias_name" do
    subject(:startmode) { described_class.new(alias_name: "boot") }

    it "remembers the alias_name" do
      expect(startmode.alias_name).to eq("boot")
    end
  end
end

describe Y2Network::Startmodes::Hotplug do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'hotplug'" do
      expect(startmode.name).to eq("hotplug")
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("On Hotplug")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Started automatically when attached")
    end
  end
end

describe Y2Network::Startmodes::Ifplugd do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'ifplugd'" do
      expect(startmode.name).to eq("ifplugd")
    end
  end

  describe "#priority" do
    it "defaults to 0" do
      expect(startmode.priority).to eq(0)
    end

    it "can be changed" do
      startmode.priority = 5

      expect(startmode.priority).to eq(5)
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("On Cable Connection")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Started automatically on cable connection")
    end
  end

  describe "#==" do
    it "returns true when both the name and the priority are equal" do
      other = described_class.new

      expect(startmode).to eq(other)
    end

    it "returns false when the priority differs" do
      other = described_class.new
      other.priority = 1

      expect(startmode).to_not eq(other)
    end

    it "returns false when the name differs" do
      other = Y2Network::Startmodes::Manual.new

      expect(startmode).to_not eq(other)
    end
  end
end

describe Y2Network::Startmodes::Manual do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'manual'" do
      expect(startmode.name).to eq("manual")
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("Manually")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Started manually")
    end
  end
end

describe Y2Network::Startmodes::Nfsroot do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'nfsroot'" do
      expect(startmode.name).to eq("nfsroot")
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("On NFSroot")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Started automatically at boot (mandatory)")
    end
  end
end

describe Y2Network::Startmodes::Off do
  subject(:startmode) { described_class.new }

  describe "#name" do
    it "returns 'off'" do
      expect(startmode.name).to eq("off")
    end
  end

  describe "#to_human_string" do
    it "returns a human readable description" do
      expect(startmode.to_human_string).to eq("Never")
    end
  end

  describe "#long_description" do
    it "returns a longer description" do
      expect(startmode.long_description).to eq("Will not be started at all")
    end
  end
end
