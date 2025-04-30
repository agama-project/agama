# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require_relative "../../test_helper"
require "yast"
require "agama/autoyast/files_reader"

Yast.import "Profile"

describe Agama::AutoYaST::FilesReader do
  let(:profile) do
    {
      "files" => [file]
    }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  let(:file) do
    {
      "file_path"        => "/etc/issue.d/motd",
      "file_contents"    => "Hello!",
      "file_owner"       => owner,
      "file_permissions" => "0400"
    }
  end

  let(:owner) { "root:wheel" }

  describe "#read" do
    context "when there is no \"files\" section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    it "returns an array with a hash per file" do
      files = subject.read["files"]
      expect(files.size).to eq(1)
      expect(files[0]).to be_a(Hash)
    end

    it "includes the path as \"destination\"" do
      files = subject.read["files"]
      expect(files[0]).to include("destination" => "/etc/issue.d/motd")
    end

    it "includes the permissions" do
      files = subject.read["files"]
      expect(files[0]).to include("permissions" => "0400")
    end

    it "includes the user and the group" do
      files = subject.read["files"]
      expect(files[0]).to include("user" => "root")
      expect(files[0]).to include("group" => "wheel")
    end

    context "when only the user is given" do
      let(:owner) { "root" }

      it "includes the user but not the group" do
        files = subject.read["files"]
        expect(files[0]).to include("user" => "root")
        expect(files[0]["group"]).to be_nil
      end
    end

    context "when only the group is given" do
      let(:owner) { ":wheel" }

      it "includes the group but not the user" do
        files = subject.read["files"]
        expect(files[0]).to include("group" => "wheel")
        expect(files[0]["user"]).to be_nil
      end
    end

    context "when user and group are separted by a dot" do
      let(:owner) { "root.wheel" }

      it "includes the user and the group" do
        files = subject.read["files"]
        expect(files[0]).to include("user" => "root")
        expect(files[0]).to include("group" => "wheel")
      end
    end

    context "when the content is given" do
      it "includes the content" do
        files = subject.read["files"]
        expect(files[0]).to include("content" => "Hello!")
      end
    end

    context "when a location is given" do
      let(:file) do
        {
          "file_location" => "https://example.com/file.txt"
        }
      end

      it "includes the location as \"url\"" do
        files = subject.read["files"]
        expect(files[0]).to include("url" => file["file_location"])
      end
    end
  end
end
