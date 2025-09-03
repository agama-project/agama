# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/autoyast/software_reader"

Yast.import "Profile"

describe Agama::AutoYaST::SoftwareReader do
  let(:profile) do
    {
      "software" => {
        "products" => ["SLE"],
        "patterns" => ["base", "gnome"],
        "packages" => ["vim"]
      },
      "add-on"   => {
        "add_on_others" => [
          {
            "media_url" => "https://test.com"
          },
          {
            "media_url"   => "https://test2.com",
            "product_dir" => "/prod",
            "alias"       => "prod2",
            "priority"    => 20,
            "name"        => "prod 2"
          }
        ]
      }
    }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'software' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when a list of patterns is included" do
      it "includes the list of patterns under 'software.patterns'" do
        patterns = subject.read.dig("software", "patterns")
        expect(patterns).to eq(["base", "gnome"])
      end
    end

    context "when a list of packages is included" do
      it "includes the list of patterns under 'software.packages'" do
        patterns = subject.read.dig("software", "packages")
        expect(patterns).to eq(["vim"])
      end
    end

    context "when a list of add-ons are provided" do
      it "includes the list of repositories under 'software.extraRepositories'" do
        repos = subject.read.dig("software", "extraRepositories")
        expect(repos).to_not be_empty
      end

      it "generates alias if it is not provided" do
        repos = subject.read.dig("software", "extraRepositories")
        repo = repos.find { |r| r["url"] == "https://test.com" }
        expect(repo["alias"]).to_not be_empty
      end
    end
  end
end
