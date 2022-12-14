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

require_relative "../../../test_helper"
require "dinstaller/software/callbacks/signature"
require "dinstaller/dbus/clients/questions_manager"
require "dinstaller/question"

describe DInstaller::Software::Callbacks::Signature do
  subject { described_class.new(questions_manager, logger) }

  let(:questions_manager) { DInstaller::DBus::Clients::QuestionsManager.new }
  let(:logger) { Logger.new($stdout) }

  describe "#accept_unsigned_file" do
    let(:asked_question) do
      instance_double(DInstaller::Question, text: "Better safe than sorry", answer: answer)
    end
    let(:answer) { :Yes }

    before do
      allow(subject).to receive(:ask).and_yield(asked_question)
    end

    context "when the user answers :Yes" do
      it "returns true" do
        expect(subject.accept_unsigned_file("repomd.xml", -1)).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { :No }

      it "returns false" do
        expect(subject.accept_unsigned_file("repomd.xml", -1)).to eq(false)
      end
    end

    context "when the repo information is available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1)
          .and_return("name" => "OSS", "url" => "http://localhost/repo")
      end

      it "includes the name and the URL in the question" do
        expect(subject).to receive(:ask) do |question|
          expect(question.text).to include("OSS (http://localhost/repo)")
        end
        expect(subject.accept_unsigned_file("repomd.xml", 1))
      end
    end

    context "when the repo information is not available"
    it "includes a generic message containing " do
      expect(subject).to receive(:ask) do |question|
        expect(question.text).to include("repomd.xml")
      end
      expect(subject.accept_unsigned_file("repomd.xml", 1))
    end
  end
end
