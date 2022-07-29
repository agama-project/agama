# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require_relative "../test_helper"
require "dinstaller/questions_manager"
require "dinstaller/question"

describe DInstaller::QuestionsManager do
  subject { described_class.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:callback) { proc {} }

  let(:question1) { DInstaller::Question.new("test1", options: [:yes, :no]) }
  let(:question2) { DInstaller::Question.new("test2", options: [:yes, :no]) }

  describe "#add" do
    before do
      subject.on_add(&callback)
    end

    context "if it does not contain the given question yet" do
      it "adds the question" do
        subject.add(question1)

        expect(subject.questions).to include(question1)
      end

      it "calls the #on_add callbacks" do
        expect(callback).to receive(:call)

        subject.add(question1)
      end

      it "returns trthy value" do
        expect(subject.add(question1)).to be_truthy
      end
    end

    context "if it already contains the given question" do
      before do
        subject.add(question1)
      end

      it "does not add the question" do
        subject.add(question1)

        expect(subject.questions.size).to eq(1)
      end

      it "does not call the #on_add callbacks" do
        expect(callback).to_not receive(:call)

        subject.add(question1)
      end

      it "returns falsy value" do
        expect(subject.add(question1)).to be_falsy
      end
    end
  end

  describe "#delete" do
    before do
      subject.on_delete(&callback)
    end

    context "if it contains the given question" do
      before do
        subject.add(question1)
      end

      it "deletes the question" do
        subject.delete(question1)

        expect(subject.questions).to_not include(question1)
      end

      it "calls the #on_delete callbacks" do
        expect(callback).to receive(:call)

        subject.delete(question1)
      end

      it "returns truthy value" do
        expect(subject.delete(question1)).to be_truthy
      end
    end

    context "if it does not contain the given question" do
      before do
        subject.add(question2)
      end

      it "does not delete any question" do
        subject.delete(question1)

        expect(subject.questions).to contain_exactly(question2)
      end

      it "does not call the #on_delete callbacks" do
        expect(callback).to_not receive(:call)

        subject.delete(question1)
      end

      it "returns falsy value" do
        expect(subject.delete(question1)).to be_falsy
      end
    end
  end

  describe "#wait" do
    # This callback ensures that both questions are answered after calling it for third time
    let(:callback) do
      times = 0

      proc do
        times += 1
        question1.answer = :yes if times == 2
        question2.answer = :no if times == 3
      end
    end

    before do
      subject.on_wait(&callback)

      subject.add(question1)
      subject.add(question2)

      allow(subject).to receive(:sleep)
    end

    it "waits until all questions are answered" do
      expect(subject).to receive(:sleep).exactly(3).times

      subject.wait
    end

    it "calls the #on_wait callbacks while waiting" do
      expect(callback).to receive(:call).and_call_original.exactly(3).times

      subject.wait
    end
  end
end
