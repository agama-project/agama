#! /usr/bin/env rspec

require_relative "test_helper"

Yast.import "Mode"

describe Yast::Mode do
  before do
    Yast::Mode.Initialize()
  end

  # restore the original modes to not accidentally influence the other tests
  around(:example) do |example|
    orig_mode = Yast::Mode.mode
    orig_ui = Yast::Mode.ui
    example.run
    Yast::Mode.SetMode(orig_mode)
    Yast::Mode.SetUI(orig_ui)
  end

  describe "#SetMode" do
    it "sets mode to given one" do
      Yast::Mode.SetMode("installation")
      expect(Yast::Mode.mode).to eq("installation")
    end

    context "when given mode does not exist" do
      it "changes the mode but logs an error" do
        expect(Yast::Builtins).to receive(:y2error).with("Unknown mode %1", "unknown")
        Yast::Mode.SetMode("unknown")
        expect(Yast::Mode.mode).to eq("unknown")
      end
    end
  end

  describe "#SetTest" do
    it "sets test mode to given one" do
      Yast::Mode.SetTest("test")
      expect(Yast::Mode.testMode).to eq("test")
    end

    context "when given test mode does not exist" do
      it "changes the test mode but logs an error" do
        expect(Yast::Builtins).to receive(:y2error).with("Unknown test mode %1", "unknown")
        Yast::Mode.SetTest("unknown")
        expect(Yast::Mode.testMode).to eq("unknown")
      end
    end
  end

  describe "#SetUI" do
    it "sets the UI mode" do
      Yast::Mode.SetUI("dialog")
      expect(Yast::Mode.ui).to eq("dialog")
    end

    context "when given UI mode is unknown" do
      it "changes the UI mode but logs an error" do
        expect(Yast::Builtins).to receive(:y2error).with("Unknown UI mode %1", "unknown")
        Yast::Mode.SetUI("unknown")
        expect(Yast::Mode.ui).to eq("unknown")
      end
    end
  end

  describe "#installation" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'installation'" do
      let(:mode) { "installation" }

      it "returns true" do
        expect(Yast::Mode.installation).to eq(true)
      end
    end

    context "when mode is 'autoinstallation'" do
      let(:mode) { "autoinstallation" }

      it "returns true" do
        expect(Yast::Mode.installation).to eq(true)
      end
    end

    context "when mode is 'live_installation'" do
      let(:mode) { "live_installation" }

      it "returns true" do
        expect(Yast::Mode.installation).to eq(true)
      end
    end

    context "when mode is not 'installation', 'autoinstallation' nor 'live_installation'" do
      let(:mode) { "update" }

      it "returns false" do
        expect(Yast::Mode.installation).to eq(false)
      end
    end
  end

  describe "#live_installation" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'live_installation'" do
      let(:mode) { "live_installation" }

      it "returns true" do
        expect(Yast::Mode.live_installation).to eq(true)
      end
    end

    context "when mode is not 'live_installation'" do
      let(:mode) { "installation" }

      it "returns false" do
        expect(Yast::Mode.live_installation).to eq(false)
      end
    end
  end

  describe "#update" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'update'" do
      let(:mode) { "update" }

      it "returns true" do
        expect(Yast::Mode.update).to eq(true)
      end
    end

    context "when mode is 'autoupgrade'" do
      let(:mode) { "autoupgrade" }

      it "returns true" do
        expect(Yast::Mode.update).to eq(true)
      end
    end

    context "when mode is not 'update' nor 'autoupgrade'" do
      let(:mode) { "installation" }

      it "returns false" do
        expect(Yast::Mode.update).to eq(false)
      end
    end
  end

  describe "#Depeche" do
    it "returns true :)" do
      expect(Yast::Mode.Depeche).to eq(true)
    end
  end

  describe "#normal" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'normal'" do
      let(:mode) { "normal" }

      it "returns true" do
        expect(Yast::Mode.normal).to eq(true)
      end
    end

    context "when mode is not 'normal'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.normal).to eq(false)
      end
    end
  end

  describe "#repair" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'repair'" do
      let(:mode) { "repair" }

      it "returns true" do
        expect(Yast::Mode.repair).to eq(true)
      end
    end

    context "when mode is not 'repair'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.repair).to eq(false)
      end
    end
  end

  describe "#autoinst" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'autoinst'" do
      let(:mode) { "autoinstallation" }

      it "returns true" do
        expect(Yast::Mode.autoinst).to eq(true)
      end
    end

    context "when mode is not 'autoinst'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.autoinst).to eq(false)
      end
    end
  end

  describe "#autoupgrade" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'autoupgrade'" do
      let(:mode) { "autoupgrade" }

      it "returns true" do
        expect(Yast::Mode.autoupgrade).to eq(true)
      end
    end

    context "when mode is not 'autoupgrade'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.autoupgrade).to eq(false)
      end
    end
  end

  describe "#auto" do
    context "when Mode.autoinst is true" do
      before do
        allow(Yast::Mode).to receive(:autoinst).and_return(true)
      end

      it "returns true" do
        expect(Yast::Mode.auto).to eq(true)
      end
    end

    context "when Mode.autoupgrade is true" do
      before do
        allow(Yast::Mode).to receive(:autoupgrade).and_return(true)
      end

      it "returns true" do
        expect(Yast::Mode.auto).to eq(true)
      end
    end

    context "when Mode.autoinst and Mode.autoupgrade are false" do
      before do
        allow(Yast::Mode).to receive(:autoinst).and_return(false)
        allow(Yast::Mode).to receive(:autoupgrade).and_return(false)
      end

      it "returns false" do
        expect(Yast::Mode.auto).to eq(false)
      end
    end
  end

  describe "#config" do
    before do
      Yast::Mode.SetMode(mode)
    end

    context "when mode is 'autoinst_config'" do
      let(:mode) { "autoinst_config" }

      it "returns true" do
        expect(Yast::Mode.config).to eq(true)
      end
    end

    context "when mode is not 'autoinst_config'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.config).to eq(false)
      end
    end
  end

  describe "#test" do
    before do
      Yast::Mode.SetTest(mode)
    end

    context "when test mode is 'test'" do
      let(:mode) { "test" }

      it "returns true" do
        expect(Yast::Mode.test).to eq(true)
      end
    end

    context "when test mode is 'screenshot'" do
      let(:mode) { "screenshot" }

      it "returns true" do
        expect(Yast::Mode.test).to eq(true)
      end
    end

    context "when test mode is 'testsuite'" do
      let(:mode) { "testsuite" }

      it "returns true" do
        expect(Yast::Mode.test).to eq(true)
      end
    end

    context "when test mode is not 'test', 'screenshot' or 'testsuite'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.test).to eq(false)
      end
    end
  end

  describe "#testsuite" do
    before do
      Yast::Mode.SetTest(mode)
    end

    context "when test mode is 'testsuite'" do
      let(:mode) { "testsuite" }

      it "returns true" do
        expect(Yast::Mode.testsuite).to eq(true)
      end
    end

    context "when test mode is not 'testsuite'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.testsuite).to eq(false)
      end
    end
  end

  describe "#commandline" do
    before do
      Yast::Mode.SetUI(mode)
    end

    context "when UI mode is 'commandline'" do
      let(:mode) { "commandline" }

      it "returns true" do
        expect(Yast::Mode.commandline).to eq(true)
      end
    end

    context "when UI mode is not 'commandline'" do
      let(:mode) { "other" }

      it "returns false" do
        expect(Yast::Mode.commandline).to eq(false)
      end
    end
  end
end
