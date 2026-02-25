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
require "agama/commands/agama_autoyast"
require "yast"
Yast.import "Profile"

describe Agama::Commands::AgamaAutoYaST do
  subject { described_class.new(url, tmpdir) }

  let(:fetcher) { instance_double(Agama::AutoYaST::ProfileFetcher) }
  let(:checker) { Agama::AutoYaST::ProfileChecker.new }
  let(:reporter) { instance_double(Agama::AutoYaST::ProfileReporter, report: true) }
  let(:questions) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:profile) do
    Yast::ProfileHash.new({ "software" => { "products" => ["openSUSE"] } })
  end
  let(:url) { "http://example.net/autoyast.xml" }
  let(:tmpdir) { Dir.mktmpdir }
  let(:cmdline_args) { Agama::CmdlineArgs.new({}) }

  before do
    allow(Agama::AutoYaST::ProfileFetcher).to receive(:new).with(url).and_return(fetcher)
    allow(Agama::AutoYaST::ProfileChecker).to receive(:new).and_return(checker)
    allow(Agama::AutoYaST::ProfileReporter).to receive(:new).and_return(reporter)
    allow(Agama::HTTP::Clients::Questions).to receive(:new).and_return(questions)
    allow(Agama::CmdlineArgs).to receive(:read_from).and_return(cmdline_args)
    allow(fetcher).to receive(:fetch).and_return(profile)
  end

  after do
    FileUtils.remove_entry(tmpdir)
  end

  describe "#run" do
    it "checks for unsupported elements" do
      expect(checker).to receive(:find_unsupported).with(profile)
        .and_call_original
      subject.run
    end

    it "writes the Agama equivalent to the given directory" do
      subject.run
      autoinst = File.read(File.join(tmpdir, "autoinst.json"))
      expect(autoinst).to include("openSUSE")
    end

    context "when the profile includes unsupported elements" do
      let(:profile) do
        Yast::ProfileHash.new({ "networking" => { "backend" => "wicked" } })
      end

      it "reports them to the user" do
        expect(reporter).to receive(:report).and_return(true)
        subject.run
      end

      context "but the error reporting is disabled" do
        let(:cmdline_args) { Agama::CmdlineArgs.new({ "ay_check" => "0" }) }

        it "does not report the errors" do
          expect(reporter).to_not receive(:report)
          subject.run
        end
      end
    end

    context "when the profile could not be fetched" do
      before do
        allow(fetcher).to receive(:fetch).and_raise("Could not fetch the profile")
      end

      it "raises a CouldNotFetchProfile exception" do
        expect { subject.run }.to raise_exception(Agama::Commands::CouldNotFetchProfile)
      end
    end
  end
end
