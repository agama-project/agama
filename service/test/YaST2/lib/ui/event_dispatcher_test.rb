#! /usr/bin/env rspec

require_relative "../test_helper"

require "ui/event_dispatcher"

class DispatcherTestDialog
  include Yast::UIShortcuts
  include UI::EventDispatcher
  Yast.import "UI"

  def ok_handler
    finish_dialog(true)
  end

  def again_handler
    @again_handler_called = true
  end

  def again_handler_called?
    !!@again_handler_called
  end
end

class DispatcherUserInputTestDialog
  include Yast::UIShortcuts
  include UI::EventDispatcher
  Yast.import "UI"

  def user_input
    Yast::UI.TimeoutUserInput(1000)
  end
end

class DispatcherHandleEventTestDialog
  include UI::EventDispatcher

  def handle_event(input)
    finish_dialog(input)
  end
end

describe UI::EventDispatcher do
  subject { DispatcherTestDialog.new }

  def mock_ui_events(*events)
    allow(Yast::UI).to receive(:UserInput).and_return(*events)
  end

  describe "#event_loop" do
    it "dispatch call for widget with id 'i' to i_handler method" do
      mock_ui_events(:again, :cancel)

      subject.event_loop

      expect(subject.again_handler_called?).to eq(true)
    end

    it "returns value of first handler which call finish_dialog" do
      mock_ui_events(:ok, :again, :cancel)

      expect(subject.event_loop).to eq(true)
      expect(subject.again_handler_called?).to eq(false)
    end

    it "raise exception if handler is not defined" do
      mock_ui_events(:unknown)

      expect { subject.event_loop }.to raise_error(RuntimeError)
    end

    it "uses user_input to get input" do
      dialog = DispatcherUserInputTestDialog.new
      expect(Yast::UI).to receive(:TimeoutUserInput).with(1000).and_return(:cancel)
      expect(Yast::UI).to_not receive(:UserInput)

      dialog.event_loop
    end

    it "uses custom handle_event to manage other events" do
      mock_ui_events(:other)

      dialog = DispatcherHandleEventTestDialog.new
      expect(dialog.event_loop).to eq(:other)
    end
  end

  describe "#cancel_handler" do
    it "provides default action for cancel operation leading to exit of dialog with nil" do
      mock_ui_events(:cancel)

      expect(subject.event_loop).to eq(nil)
    end
  end
end
