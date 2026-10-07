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
require "tempfile"
require "yaml"
require "installation/installation_info"

describe Installation::InstallationInfo do
  # create a new anonymous subclass inheriting from the singleton class,
  # this ensures we use a fresh instance for each test and we do not modify
  # the global singleton instance
  subject { Class.new(Installation::InstallationInfo).instance }

  describe "#add_callback" do
    it "remembers the callback block" do
      expect { subject.add_callback("test") { puts "foo" } }.to change { subject.callback?("test") }
        .from(false).to(true)
    end

    it "does not save missing block" do
      subject.add_callback("test")

      expect(subject.callback?("test")).to eq(false)
    end
  end

  describe "#callback?" do
    it "returns true for a defined callback name" do
      subject.add_callback("test") { puts "foo" }

      expect(subject.callback?("test")).to eq(true)
    end

    it "returns false for an undefined callback name" do
      expect(subject.callback?("foo")).to eq(false)
    end
  end

  describe "#write" do
    before do
      allow(File).to receive(:write)
      allow(FileUtils).to receive(:mkdir_p)
    end

    it "evaluates all callbacks" do
      foo = false
      bar = false
      subject.add_callback("foo") { foo = true }
      subject.add_callback("bar") { bar = true }

      subject.write("test")

      expect(foo).to eq(true)
      expect(bar).to eq(true)
    end

    it "saves the data to an YAML file" do
      # unmock the File.write call
      allow(File).to receive(:write).and_call_original

      # write to a tempfile
      tmpfile = Tempfile.new
      begin
        subject.write("test", path: tmpfile)

        # check the file is not empty
        expect(File.stat(tmpfile).size).to be > 0

        # it can be parsed without errors
        data = nil
        expect { data = YAML.load_file(tmpfile) }.to_not raise_error

        # expected data structure
        expect(data).to be_a Hash
      ensure
        tmpfile.unlink
      end
    end
  end
end
