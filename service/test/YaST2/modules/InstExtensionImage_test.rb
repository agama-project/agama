#! /usr/bin/env rspec

require_relative "test_helper"

Yast.import "InstExtensionImage"

describe Yast::InstExtensionImage do
  subject { Yast::InstExtensionImage }

  describe ".LoadExtension" do
    before do
      # clean internal cache of already loaded extension
      subject.instance_variable_set("@integrated_extensions", [])
    end
    it "returns false if package is nil" do
      expect(subject.LoadExtension(nil, "msg")).to eq false
    end

    it "returns false if package is \"\"" do
      expect(subject.LoadExtension("", "msg")).to eq false
    end

    it "returns true immediately if package is already loaded" do
      subject.instance_variable_set("@integrated_extensions", ["snapper"])
      expect(subject.LoadExtension("snapper", "msg")).to eq true
    end

    it "shows message as feedback when loading package" do
      expect(Yast::Popup).to receive(:ShowFeedback).with("", "msg")

      subject.LoadExtension("snapper", "msg")
    end

    it "calls extend CLI with given package" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend 'snapper'")
        .and_return("exit" => 0)

      subject.LoadExtension("snapper", "msg")
    end

    it "returns false if extend CLI failed" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend 'snapper'")
        .and_return("exit" => 1)

      expect(subject.LoadExtension("snapper", "msg")).to eq false
    end
  end

  describe ".UnLoadExtension" do
    before do
      # set in internal cache that snapper is already loaded
      subject.instance_variable_set("@integrated_extensions", ["snapper"])
    end
    it "returns false if package is nil" do
      expect(subject.UnLoadExtension(nil, "msg")).to eq false
    end

    it "returns false if package is \"\"" do
      expect(subject.UnLoadExtension("", "msg")).to eq false
    end

    it "returns true immediately if package is already unloaded" do
      subject.instance_variable_set("@integrated_extensions", [])
      expect(subject.UnLoadExtension("snapper", "msg")).to eq true
    end

    it "shows message as feedback when unloading package" do
      expect(Yast::Popup).to receive(:ShowFeedback).with("", "msg")

      subject.UnLoadExtension("snapper", "msg")
    end

    it "calls extend CLI with given package" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend -r 'snapper'")
        .and_return("exit" => 0)

      subject.UnLoadExtension("snapper", "msg")
    end

    it "returns false if extend CLI failed" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend -r 'snapper'")
        .and_return("exit" => 1)

      expect(subject.UnLoadExtension("snapper", "msg")).to eq false
    end
  end

  describe ".with_extension" do
    before do
      # clean internal cache of already loaded extension
      subject.instance_variable_set("@integrated_extensions", [])
    end

    it "loads package, executes block and unload package" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend 'snapper'")
        .and_return("exit" => 0)
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend -r 'snapper'")
        .and_return("exit" => 0)

      res = nil
      subject.with_extension("snapper") do
        res = true
      end

      expect(res).to eq true
    end

    it "raises exception if package loading fails" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend 'snapper'")
        .and_return("exit" => 1)

      expect { subject.with_extension("snapper") {} }.to raise_error # empty block is enough
    end

    it "unloads extension even if block raises exception" do
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend 'snapper'")
        .and_return("exit" => 0)
      expect(Yast::WFM).to receive(:Execute)
        .with(path(".local.bash_output"), "/bin/extend -r 'snapper'")
        .and_return("exit" => 0)

      expect { subject.with_extension("snapper") { raise "expected" } }.to raise_error
    end
  end
end
