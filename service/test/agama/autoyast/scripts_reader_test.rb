# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
require "agama/autoyast/scripts_reader"

Yast.import "Profile"

RSpec.shared_examples "a script reader" do |ay_section, section|
  let(:profile) do
    { "scripts" => { ay_section => [script] } }
  end

  context "when the script definition includes the sources" do
    let(:script) do
      { "filename" => "script.sh",
        "location" => "https://example.com/script.sh" }
    end

    it "sets the \"url\" to the \"location\"" do
      scripts = subject.read["scripts"][section]
      expect(scripts.first).to include("url" => "https://example.com/script.sh")
    end

    context "and the script filename is not specified" do
      let(:script) do
        { "location" => "https://example.com/script.sh" }
      end

      it "uses the path as the filename" do
        scripts = subject.read["scripts"][section]
        expect(scripts.first).to include("name" => "script.sh")
      end

      context "but there is no path in the URL" do
        let(:script) do
          { "location" => "https://example.com/" }
        end

        it "uses the script type as the filename" do
          scripts = subject.read["scripts"][section]
          expect(scripts.first).to include("name" => "script-1")
        end
      end
    end
  end

  context "when the script definition specifies a location" do
    let(:script) do
      {
        "filename" => "script.sh",
        "source"   => "#!/bin/bash\necho 'Hello World!'"
      }
    end

    it "sets the \"body\" to the \"sources\"" do
      scripts = subject.read["scripts"][section]
      expect(scripts.first).to include("body" => "#!/bin/bash\necho 'Hello World!'")
    end

    context "and the script filename is not specified" do
      let(:script) do
        { "source" => "#!/bin/bash\necho 'Hello World!'" }
      end

      it "uses the script type as the filename" do
        scripts = subject.read["scripts"][section]
        expect(scripts.first).to include("name" => "script-1")
      end
    end
  end
end

describe Agama::AutoYaST::ScriptsReader do
  let(:profile) { {} }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no scripts sections" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when a chroot script is defined" do
      it_behaves_like "a script reader", "chroot-scripts", "post"

      let(:chroot_script) do
        { "filename" => "test.sh",
          "chrooted" => true,
          "source"   => "#!/bin/bash\necho 'Hello World!'" }
      end

      let(:profile) do
        {
          "scripts" => {
            "chroot-scripts" => [chroot_script]
          }
        }
      end

      context "when the \"chrooted\" option is not set" do
        let(:chroot_script) do
          { "filename" => "test.sh",
            "source"   => "#!/bin/bash\necho 'Hello World!'" }
        end

        it "sets the \"chroot\" option to false" do
          expect(subject.read["scripts"]).to include(
            "post" => [
              {
                "name" => "test.sh", "chroot" => false, "body" => "#!/bin/bash\necho 'Hello World!'"
              }
            ]
          )
        end
      end
    end

    context "when an init script is defined" do
      it_behaves_like "a script reader", "init-scripts", "init"
    end

    context "when an post script is defined" do
      it_behaves_like "a script reader", "post-scripts", "init"
    end
  end
end
