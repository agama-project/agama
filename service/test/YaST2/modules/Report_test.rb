#! /usr/bin/env rspec

require_relative "test_helper"
require "yaml"

Yast.import "Report"
Yast.import "Mode"

describe Yast::Report do
  before { subject.ClearAll }

  #
  # Shared examples
  #
  shared_examples "logging" do |meth, level|
    before do
      allow(Yast2::Popup).to receive(:show)
    end

    context "when logging is enabled" do
      it "logs the message" do
        expect(Yast::Builtins).to receive("y2#{level}")
          .with(1, "%1", "Message")
        subject.send(meth, "Message")
      end
    end

    context "when logging is disabled" do
      let(:log) { false }

      it "does not log the message" do
        expect(Yast::Builtins).to_not receive("y2#{level}")
        subject.send(meth, "Message")
      end
    end
  end

  shared_examples "display" do |meth|
    context "when display of messages is disabled" do
      let(:show) { false }

      it "does not show a popup" do
        expect(Yast2::Popup).to_not receive(:show)
        subject.send(meth, "Message")
      end
    end

    context "when display of messages is enabled" do
      it "shows a popup" do
        expect(Yast2::Popup).to receive(:show) do |msg, args|
          expect(msg).to eq "Message"
          expect(args[:richtext]).to eq true
        end
        subject.send(meth, "Message")
      end
    end

    shared_examples "timeouts" do
      context "when timeouts are enabled" do
        let(:timeout) { 1 }

        it "shows a timed popup" do
          expect(Yast2::Popup).to receive(:show) do |msg, args|
            expect(msg).to eq "Message"
            expect(args[:richtext]).to eq true
            expect(args[:timeout]).to eq 1
          end
          subject.send(meth, "Message")
        end
      end
    end
  end

  describe ".LongMessage" do
    let(:show) { true }
    let(:timeout) { 0 }
    let(:log) { true }

    before do
      subject.DisplayMessages(show, timeout)
      subject.LogMessages(log)
    end

    include_examples "logging", :LongMessage, "milestone"
    include_examples "display", :LongMessage
    include_examples "timeouts", :LongMessage

    it "stores the message" do
      subject.LongMessage("Message")
      expect(subject.GetMessages(0, 1, 0, 0)).to match(/Message/)
    end
  end

  describe ".LongWarning" do
    let(:show) { true }
    let(:timeout) { 0 }
    let(:log) { true }

    before do
      subject.DisplayWarnings(show, timeout)
      subject.LogWarnings(log)
    end

    include_examples "logging", :LongWarning, "warning"
    include_examples "display", :LongWarning
    include_examples "timeouts", :LongWarning

    it "stores the message" do
      subject.LongWarning("Message")
      expect(subject.GetMessages(0, 1, 0, 0)).to match(/Message/)
    end

    context "when running on command line mode" do
      before do
        allow(Yast::Mode).to receive(:commandline).and_return(true)
      end

      it "prints the message" do
        expect(Yast::CommandLine).to receive(:Print).with("Warning: message")
        subject.LongWarning("message")
      end
    end
  end

  describe ".LongError" do
    let(:show) { true }
    let(:timeout) { 0 }
    let(:log) { true }

    before do
      subject.DisplayErrors(show, timeout)
      subject.LogErrors(log)
    end

    include_examples "logging", :LongError, "error"
    include_examples "display", :LongError
    include_examples "timeouts", :LongError

    it "stores the message" do
      subject.LongError("Message")
      expect(subject.GetMessages(0, 1, 0, 0)).to match(/Message/)
    end

    context "when running on command line mode" do
      before do
        allow(Yast::Mode).to receive(:commandline).and_return(true)
      end

      it "prints the message" do
        expect(Yast::CommandLine).to receive(:Print).with("Error: message")
        subject.LongError("message")
      end
    end
  end

  describe ".Settings" do
    DATA_DIR = File.join(__dir__, "data")
    let(:ay_profile) { YAML.load_file(File.join(DATA_DIR, "ay_profile.yml")) }
    let(:default_normal) { YAML.load_file(File.join(DATA_DIR, "default_normal_installation.yml")) }
    let(:default_ay) { YAML.load_file(File.join(DATA_DIR, "default_ay_installation.yml")) }
    let(:result_ay) { YAML.load_file(File.join(DATA_DIR, "ay_installation.yml")) }

    context "while normal installation" do
      it "check default entries" do
        allow(Yast::Mode).to receive(:mode).and_return("installation")
        subject.main
        expect(subject.Export()).to match(default_normal)
      end
    end

    context "while AutoYaST installation" do
      before(:each) do
        allow(Yast::Mode).to receive(:mode).and_return("autoinstallation")
        subject.main
      end

      it "sets default entries" do
        expect(subject.Export()).to match(default_ay)
      end
      it "check if default entries are not overwritten by empty import" do
        subject.Import({})
        expect(subject.Export()).to match(default_ay)
      end
      it "set flags via AutoYaST profile" do
        subject.Import(ay_profile)
        expect(subject.Export()).to match(result_ay)
      end
    end

    context "while AutoYaST cloning system" do
      before(:each) do
        allow(Yast::Mode).to receive(:mode).and_return("autoinst_config")
        subject.main
      end

      it "AutoYaST default entries will be cloned" do
        # Set timeout for autoyast to 10 seconds (bnc#887397)
        expect(subject.Export()).to match(default_ay)
      end
    end
  end

  describe ".Warning" do
    let(:show) { true }
    let(:message) { "Message" }

    before do
      allow(Yast::Mode).to receive(:commandline).and_return(commandline?)
    end

    context "while in command-line mode" do
      let(:commandline?) { true }

      it "prints the message only on console" do
        expect(Yast::CommandLine).to receive(:Print)
          .with(/#{message}/)
        expect(Yast2::Popup).to_not receive(:show)
        subject.Warning(message)
      end
    end

    context "while in UI mode and timeout is disabled" do
      let(:timeout) { 0 }
      let(:commandline?) { false }

      before(:each) do
        subject.DisplayWarnings(show, timeout)
      end

      it "shows a popup" do
        expect(Yast2::Popup).to receive(:show).with(message, headline: :warning, timeout: 0)
        subject.Warning(message)
      end
    end

    context "while in UI mode and timeout is enabled" do
      let(:timeout) { 1 }
      let(:commandline?) { false }

      before(:each) do
        subject.DisplayWarnings(show, timeout)
      end

      it "shows timed popup" do
        expect(Yast2::Popup).to receive(:show).with(message, headline: :warning, timeout: timeout)
        subject.Warning(message)
      end
    end
  end

  describe ".Error" do
    let(:show) { true }
    let(:message) { "Message" }

    before do
      allow(Yast::Mode).to receive(:commandline).and_return(commandline?)
    end

    context "while in command-line mode" do
      let(:commandline?) { true }

      it "prints the message only on console" do
        expect(Yast::CommandLine).to receive(:Print)
          .with(/#{message}/)
        expect(Yast2::Popup).to_not receive(:show)
        subject.Error(message)
      end
    end

    context "while in UI mode and timeout is disabled" do
      let(:timeout) { 0 }
      let(:commandline?) { false }

      before(:each) do
        subject.DisplayErrors(show, timeout)
      end

      it "shows a popup" do
        expect(Yast2::Popup).to receive(:show).with(message, headline: :error, timeout: 0)
        subject.Error(message)
      end
    end

    context "while in UI mode and timeout is enabled" do
      let(:timeout) { 1 }
      let(:commandline?) { false }

      before(:each) do
        subject.DisplayErrors(show, timeout)
      end

      it "shows a timed popup" do
        expect(Yast2::Popup).to receive(:show).with(message, headline: :error, timeout: timeout)
        subject.Error(message)
      end
    end
  end

  describe ".yesno_popup" do
    let(:show) { true }
    let(:timeout) { 0 }
    let(:log) { true }

    before do
      subject.DisplayYesNoMessages(show, timeout)
      subject.LogYesNoMessages(log)
    end

    include_examples "logging", :yesno_popup, "milestone"

    it "stores the message" do
      allow(Yast2::Popup).to receive(:show)
      subject.yesno_popup("Message")
      expect(subject.GetMessages(0, 1, 0, 0)).to match(/Message/)
    end

    context "when display of messages is disabled" do
      let(:show) { false }

      it "does not show a popup" do
        expect(Yast2::Popup).to_not receive(:show)
        subject.yesno_popup("Message")
      end

      it "returns false" do
        expect(subject.yesno_popup("Message")).to eq false
      end
    end

    context "when display of messages is enabled" do
      it "shows a popup ignoring any :timeout argument" do
        expect(Yast2::Popup).to receive(:show).with("Message", hash_including(timeout: 0))
        subject.yesno_popup("Message")

        expect(Yast2::Popup).to receive(:show).with("Message", hash_including(timeout: 0))
        subject.yesno_popup("Message", timeout: 22)
      end

      it "uses :yes_no buttons for the popup by default" do
        expect(Yast2::Popup).to receive(:show).with("Message", hash_including(buttons: :yes_no))
        subject.yesno_popup("Message")

        expect(Yast2::Popup).to receive(:show)
          .with("Message", hash_including(buttons: { yes: "Sir" }))
        subject.yesno_popup("Message", buttons: { yes: "Sir" })
      end

      it "forwards any extra argument to Popup.show" do
        # Use block syntax in the expectaton instead of ".with" to unveil the problem with Ruby3
        # and named params
        expect(Yast2::Popup).to receive(:show) do |msg, **args|
          expect(msg).to eq "Message"
          expect(args).to include(headline: "Breaking News")
        end
        subject.yesno_popup("Message", headline: "Breaking News", focus: :yes)
      end

      it "returns true if :yes is pressed" do
        allow(Yast2::Popup).to receive(:show).and_return :yes
        expect(subject.yesno_popup("Message")).to eq true
      end

      it "returns false if another button is pressed" do
        allow(Yast2::Popup).to receive(:show).and_return :no
        expect(subject.yesno_popup("Message")).to eq false
      end

      context "when timeouts are enabled" do
        let(:timeout) { 12 }

        it "shows a timed popup based on the Report timeout" do
          expect(Yast2::Popup).to receive(:show).with("Message", hash_including(timeout: 12))
          subject.yesno_popup("Message")

          expect(Yast2::Popup).to receive(:show).with("Message", hash_including(timeout: 12))
          subject.yesno_popup("Message", timeout: 22)
        end
      end
    end

    describe ".AnyQuestion" do
      it "accepts also :focus_yes/:focus_no as focus parameter" do
        subject.DisplayYesNoMessages(true, 0)
        expect(Yast2::Popup).to receive(:show)
          .with("Message", headline: "test", buttons: { yes: "yes", no: "no" }, focus: :no, timeout: 0)

        subject.AnyQuestion("test", "Message", "yes", "no", :focus_no)
      end
    end
  end
end
