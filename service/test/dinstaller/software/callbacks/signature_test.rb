# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "dinstaller/dbus/clients/questions"
require "dinstaller/question"

describe DInstaller::Software::Callbacks::Signature do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(DInstaller::DBus::Clients::Questions) }

  let(:logger) { Logger.new($stdout, level: :warn) }

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

    context "when the repo information is not available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1)
          .and_return(nil)
      end

      it "includes a generic message containing the filename" do
        expect(subject).to receive(:ask) do |question|
          expect(question.text).to include("repomd.xml")
        end
        expect(subject.accept_unsigned_file("repomd.xml", 1))
      end
    end
  end

  describe "import_gpg_key" do
    let(:asked_question) do
      instance_double(DInstaller::Question, text: "Better safe than sorry", answer: answer)
    end

    let(:answer) { :Trust }

    let(:key) do
      {
        "id"          => "0123456789ABCDEF",
        "fingerprint" => "2E2EA448C9DDD7A91BC28441AEE969E90F05DB9D",
        "name"        => "YaST:Head:D-Installer"
      }
    end

    before do
      allow(subject).to receive(:ask).and_yield(asked_question)
    end

    context "when the user answers :Trust" do
      let(:answer) { :Trust }

      it "returns true" do
        expect(subject.import_gpg_key(key, 1)).to eq(true)
      end
    end

    context "when the user answers :Skip" do
      let(:answer) { :Skip }

      it "returns false" do
        expect(subject.import_gpg_key(key, 1)).to eq(false)
      end
    end

    it "includes a message" do
      expect(subject).to receive(:ask) do |question|
        expect(question.text).to include(key["id"])
        expect(question.text).to include(key["name"])
        expect(question.text).to include("2E2E A448 C9DD")
      end
      subject.import_gpg_key(key, 1)
    end
  end
end
