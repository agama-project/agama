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

shared_examples "search issues" do
  context "if the search is not valid" do
    let(:search) do
      {
        condition:  { name: "/test" },
        ifNotFound: "error"
      }
    end

    it "includes the search issues" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        Agama::Storage::IssueClasses::Config::SEARCH,
        description: "Mandatory device /test not found"
      )
    end
  end
end

shared_examples "filesystem issues" do
  context "if the filesystem is not valid" do
    let(:filesystem) do
      { path: "/" }
    end

    it "includes the filesystem issues" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        Agama::Storage::IssueClasses::Config::FILESYSTEM,
        description: "Missing file system type for '/'"
      )
    end
  end
end

shared_examples "encryption issues" do
  context "if the encryption is not valid" do
    let(:encryption) do
      { luks1: {} }
    end

    it "includes the encryption issues" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
        description: /No passphrase .*/
      )
    end
  end
end

shared_examples "partitions issues" do
  context "if any partition is not valid" do
    let(:partitions) do
      [
        {
          search: {
            ifNotFound: "error"
          }
        }
      ]
    end

    it "includes the partition issues" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        Agama::Storage::IssueClasses::Config::SEARCH,
        description: "Mandatory partition not found"
      )
    end
  end
end

shared_examples "alias issues" do
  context "if the alias has issues" do
    let(:device_alias) { "device1" }

    let(:volume_groups) do
      [
        { physicalVolumes: [device_alias] },
        { physicalVolumes: [device_alias] }
      ]
    end

    it "includes the alias issues" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        Agama::Storage::IssueClasses::Config::ALIAS,
        description: /alias '#{device_alias}' is used by more than one/
      )
    end
  end
end
