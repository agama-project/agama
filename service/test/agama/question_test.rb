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
require "agama/question"

describe Agama::Question do
  describe ".new" do
    it "creates a question with unique id" do
      question1 = described_class.new("test1")
      question2 = described_class.new("test2")
      question3 = described_class.new("test3")

      ids = [question1, question2, question3].map(&:id).uniq

      expect(ids.size).to eq(3)
    end
  end

  subject { described_class.new("test", options: options, default_option: default_option) }

  let(:options) { [:yes, :no] }

  let(:default_option) { :yes }

  describe "#answer=" do
    context "when the given value is a valid option" do
      let(:value) { :no }

      it "sets the given option as answer" do
        subject.answer = value

        expect(subject.answer).to eq(value)
      end
    end

    context "when the given value is not a valid option" do
      let(:value) { :other }

      it "raises an error" do
        expect { subject.answer = value }.to raise_error(ArgumentError, /Invalid answer/)
      end
    end
  end

  describe "#answered?" do
    context "if the question has no answer yet" do
      it "returns false" do
        expect(subject.answered?).to eq(false)
      end
    end

    context "if the question has an answer" do
      before do
        subject.answer = :yes
      end

      it "returns true" do
        expect(subject.answered?).to eq(true)
      end
    end
  end
end
