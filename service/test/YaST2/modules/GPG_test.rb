#!/usr/bin/env rspec
# Copyright (c) [2020] SUSE LLC
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
require "tempfile"
require "tmpdir"
require "fileutils"

Yast.import "GPG"

describe Yast::GPG do
  let(:file_content) do
    File.read(File.join(__dir__, "data", "test.asc"))
  end

  let(:label) { "test" }

  around do |t|
    file = Tempfile.open
    file.write file_content
    file.close

    @path = file.path

    t.call

    file.unlink
  end

  describe "#decrypt_symmetric" do
    context "file contain gpg encrypted file" do
      it "returns content if password was correct" do
        expect(described_class.decrypt_symmetric(@path, "test")).to match(/<zeroOrMore>/)
      end

      it "raises Yast::GPGFailed expcetion if password is not correct" do
        expect { described_class.decrypt_symmetric(@path, "wrong") }.to raise_error(Yast::GPGFailed)
      end
    end

    context "file is not encrypted" do
      let(:file_content) { "test\n" }

      it "raises Yast::GPGFailed exception" do
        expect { described_class.decrypt_symmetric(@path, "test") }.to raise_error(Yast::GPGFailed)
      end
    end
  end

  describe "#encrypted_symmetric?" do
    context "file contain gpg encrypted file" do
      it "returns true" do
        expect(described_class.encrypted_symmetric?(@path)).to eq true
      end
    end

    context "file is not encrypted" do
      let(:file_content) { "test\n" }

      it "returns false" do
        expect(described_class.encrypted_symmetric?(@path)).to eq false
      end
    end
  end

  describe "#encrypted_symmetric" do
    let(:file_content) { "test\n" }

    it "will create output file that is encrypted" do
      Dir.mktmpdir do |dir|
        path = File.join(dir, "encrypted")
        described_class.encrypt_symmetric(@path, path, "test")
        expect(described_class.encrypted_symmetric?(path)).to eq true
      end
    end
  end
end
