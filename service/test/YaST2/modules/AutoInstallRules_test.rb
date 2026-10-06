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

require_relative "../../test_helper"
require "fileutils"
require "pathname"
require "tmpdir"

Yast.import "AutoInstallRules"

describe Yast::AutoInstallRules do
  subject { Yast::AutoInstallRules }
  let(:profile_checker) { Y2Autoinstallation::XmlChecks.instance }

  let(:rules_fixtures) { File.join(FIXTURES_PATH, "yast2", "rules") }

  before do
    Y2Storage::StorageManager.create_test_instance
    allow(profile_checker).to receive(:valid_profile?).and_return(true)
    # do not crash on reporting errors
    allow(Yast::Report).to receive(:Error)
  end

  describe "#ProbeRules" do
    before { subject.main }

    let(:devicegraph) { instance_double(Y2Storage::Devicegraph, disk_devices: disk_devices) }
    let(:disk_devices) { [disk] }
    let(:disk) do
      instance_double(Y2Storage::Disk, name: "/dev/sda", size: Y2Storage::DiskSize.MiB(1))
    end

    it "detects system properties" do
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(true)
      allow(Y2Storage::StorageManager.instance).to receive(:probed)
        .and_return(devicegraph)
      allow(Y2Storage::StorageManager.instance.probed).to receive(:disks)
        .and_return([disk])
      allow_any_instance_of(Y2Storage::DiskAnalyzer).to receive(:linux_partitions)
        .and_return([])
      expect_any_instance_of(Y2Storage::DiskAnalyzer).to receive(:windows_partitions)
        .and_return([])
      expect(Yast::SCR).to receive(:Read).with(Yast::Path.new(".probe.bios")).and_return([])
      expect(Yast::SCR).to receive(:Read).with(Yast::Path.new(".probe.memory")).and_return([])
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      expect(Yast::Kernel).to receive(:GetPackages).and_return([])
      expect(subject).to receive(:getNetwork).and_return("192.168.1.0")
      expect(subject).to receive(:getHostname).and_return("myhost")
      expect(Yast::SCR).to receive(:Read).with(Yast::Path.new(".etc.install_inf.XServer"))
      expect(Yast::Hostname).to receive(:CurrentDomain).and_return("mydomain.lan")

      expect(Yast::OSRelease).to receive(:ReleaseInformation)
        .and_return("SUSE Linux Enterprise Server 12")
      expect(Yast::OSRelease).to receive(:ReleaseVersion)
        .and_return("12")

      subject.ProbeRules

      expect(Yast::AutoInstallRules.installed_product).to eq("SUSE Linux Enterprise Server 12")
      expect(Yast::AutoInstallRules.installed_product_version).to eq("12")
      expect(Yast::AutoInstallRules.efi).to eq("yes")
    end
  end

  describe "#getHostid" do
    let(:ip_route_output_path) { File.join(rules_fixtures, "output", "ip_route.out") }

    it "returns the host IP in hex format" do
      expect(Yast::SCR).to receive(:Execute)
        .with(Yast::Path.new(".target.bash_output"), /ip route/)
        .and_return("stdout" => File.read(ip_route_output_path), "exit" => 0)

      expect(subject.getHostid).to eq(Yast::IP.ToHex("10.13.32.195"))
    end

    it "returns nil if an error occurs finding the IP address" do
      expect(Yast::SCR).to receive(:Execute)
        .with(Yast::Path.new(".target.bash_output"), /ip route/)
        .and_return("stdout" => "", "stderr" => "error from iputils", "exit" => 1)

      expect(subject.getHostid).to be_nil
    end
  end

  describe "#getHostname" do
    before do
      allow(Yast::SCR).to receive(:Execute)
        .with(Yast::Path.new(".target.bash_output"), "/bin/hostname")
        .and_return(hostname_output)
    end

    context "when '/bin/hostname' returns the hostname properly" do
      let(:hostname_output) { { "stdout" => "myhost", "exit" => 0 } }

      it "returns that hostname" do
        expect(subject.getHostname).to eq("myhost")
      end
    end

    context "when '/bin/hostname' fails" do
      let(:hostname_output) { { "stderr" => "error from hostname", "stdout" => "", "exit" => 1 } }

      before do
        allow(Yast::SCR).to receive(:Read).with(Yast::Path.new(".etc.install_inf.Hostname"))
          .and_return(inf_hostname)
      end

      context "and install.inf contains a Hostname" do
        let(:inf_hostname) { "myhost" }

        it "returns the name stored in install.inf" do
          expect(subject.getHostname).to eq("myhost")
        end
      end

      context "and install.inf does not contain a Hostname" do
        let(:inf_hostname) { nil }

        it "returns nil" do
          expect(subject.getHostname).to be_nil
        end
      end
    end
  end

  describe "#Read" do
    let(:env) { { "hostaddress" => subject.hostaddress, "mac" => subject.mac } }

    it "reads rules with the 'or' operator" do
      expect(Yast::XML).to receive(:XMLToYCPFile).and_return(
        "rules" => [{
          "hostaddress" => { "match"      => "10.69.57.43",
                             "match_type" => "exact" },
          "mac"         => { "match"      => "000c2903d288",
                             "match_type" => "exact" },
          "operator"    => "or",
          "result"      => { "profile" => "machine12.xml" }
        }]
      )
      expect(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.bash_output"),
        "if  ( [ \"$hostaddress\" = \"10.69.57.43\" ] )   ||   " \
        "( [ \"$mac\" = \"000c2903d288\" ] ); then exit 0; else exit 1; fi",
        env)
        .and_return("stdout" => "", "exit" => 0, "stderr" => "")

      subject.Read
    end

    it "reads rules with the 'and' operator" do
      expect(Yast::XML).to receive(:XMLToYCPFile).and_return(
        "rules" => [{
          "hostaddress" => { "match"      => "10.69.57.43",
                             "match_type" => "exact" },
          "mac"         => { "match"      => "000c2903d288",
                             "match_type" => "exact" },
          "operator"    => "and",
          "result"      => { "profile" => "machine12.xml" }
        }]
      )
      expect(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.bash_output"),
        "if  ( [ \"$hostaddress\" = \"10.69.57.43\" ] )   &&   " \
        "( [ \"$mac\" = \"000c2903d288\" ] ); then exit 0; else exit 1; fi",
        env)
        .and_return("stdout" => "", "exit" => 0, "stderr" => "")

      subject.Read
    end

    it "reads rules with the default operator" do
      expect(Yast::XML).to receive(:XMLToYCPFile).and_return(
        "rules" => [{
          "hostaddress" => { "match"      => "10.69.57.43",
                             "match_type" => "exact" },
          "mac"         => { "match"      => "000c2903d288",
                             "match_type" => "exact" },
          "result"      => { "profile" => "machine12.xml" }
        }]
      )
      expect(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.bash_output"),
        "if  ( [ \"$hostaddress\" = \"10.69.57.43\" ] )   &&   " \
        "( [ \"$mac\" = \"000c2903d288\" ] ); then exit 0; else exit 1; fi",
        env)
        .and_return("stdout" => "", "exit" => 0, "stderr" => "")

      subject.Read
    end

    it "shows an error popup when the XML is not valid" do
      allow(Yast::XML).to receive(:XMLToYCPFile).and_raise(Yast::XMLDeserializationError)
      expect(Yast::Popup).to receive(:Error)

      subject.Read
    end
  end

  describe "#getNetwork" do
    let(:hostaddress) { "10.13.32.195" }
    let(:ip_route_output) { { "stdout" => ip_route_content, "exit" => 0 } }
    let(:ip_route_content) do
      File.read(File.join(rules_fixtures, "output", "ip_route.out"))
    end

    before do
      allow(subject).to receive(:hostaddress).and_return(hostaddress)
      allow(Yast::SCR).to receive(:Execute)
        .with(Yast::Path.new(".target.bash_output"), /ip route/)
        .and_return(ip_route_output)
    end

    context "when the host address is known" do
      it "returns the network for the system's hostaddress" do
        expect(subject.getNetwork).to eq("10.13.32.0")
      end
    end

    context "when the host address is unknown" do
      let(:hostaddress) { "10.163.2.9" }

      it "returns nil" do
        expect(subject.getNetwork).to be_nil
      end
    end

    context "when an error occurs finding the IP" do
      let(:ip_route_output) { { "stderr" => "some error", "stdout" => "", "exit" => 1 } }

      it "returns nil" do
        expect(subject.getNetwork).to be_nil
      end
    end
  end

  describe "#merge_profiles" do
    let(:base_profile_path) { File.join(rules_fixtures, "partitions.xml") }
    let(:tmp_dir) { Dir.mktmpdir("AutoInstallRules_test-") }
    let(:expected_xml) { File.read(expected_xml_path) }
    let(:output_path) { File.join(tmp_dir, "output.xml") }
    let(:to_merge_path) { File.join(rules_fixtures, "classes", "swap", "largeswap.xml") }
    let(:output_xml) { File.read(output_path) }
    let(:dontmerge) { [] }
    let(:merge_xslt_path) { Yast::AutoInstallRulesClass::MERGE_XSLT_PATH }
    let(:xsltproc_command) do
      "/usr/bin/xsltproc --novalid --maxdepth 10000 --maxvars 30000 " \
        "--param replace \"'false'\" " \
        "--param with \"'#{to_merge_path}'\" " \
        "--output \"#{output_path}\" " \
        "#{merge_xslt_path} #{base_profile_path}"
    end

    around do |example|
      example.run
      FileUtils.rm_rf(tmp_dir)
    end

    before do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return(tmp_dir)
      allow(Yast::AutoinstConfig).to receive(:dontmerge).and_return(dontmerge)
      subject.Files
    end

    it "executes xsltproc and returns a hash with info about the result" do
      expect(Yast::SCR).to receive(:Execute)
        .with(Yast::Path.new(".target.bash_output"), xsltproc_command, {}).and_call_original
      out = subject.merge_profiles(base_profile_path, to_merge_path, output_path)
      expect(out).to eq("exit" => 0, "stderr" => "", "stdout" => "")
    end

    context "when all elements must be merged" do
      let(:expected_xml_path) { File.join(rules_fixtures, "output", "partitions-merged.xml") }

      it "merges elements from the base profile and the rule profile" do
        expect(Yast::SCR).to receive(:Execute)
          .with(Yast::Path.new(".target.bash_output"), xsltproc_command, {}).and_call_original
        subject.merge_profiles(base_profile_path, to_merge_path, output_path)
        expect(output_xml).to eq(expected_xml)
      end
    end

    context "when some elements are not intended to be merged" do
      let(:expected_xml_path) { File.join(rules_fixtures, "output", "partitions-dontmerge.xml") }
      let(:dontmerge) { ["partition"] }
      let(:xsltproc_command) do
        "/usr/bin/xsltproc --novalid --maxdepth 10000 --maxvars 30000 " \
          "--param replace \"'false'\" " \
          "--param dontmerge1 \"'partition'\" " \
          "--param with \"'#{to_merge_path}'\" " \
          "--output \"#{output_path}\" " \
          "#{merge_xslt_path} #{base_profile_path}"
      end

      it "does not merge those elements" do
        expect(Yast::SCR).to receive(:Execute)
          .with(Yast::Path.new(".target.bash_output"), xsltproc_command, {}).and_call_original
        subject.merge_profiles(base_profile_path, to_merge_path, output_path)
        expect(output_xml).to eq(expected_xml)
      end
    end
  end

  describe "#Merge" do
    let(:tmp_dir) { Dir.mktmpdir("AutoInstallRules_test-") }
    let(:result_path) { File.join(tmp_dir, "result.xml") }
    let(:first_path) { File.join(tmp_dir, "first.xml") }
    let(:second_path) { File.join(tmp_dir, "second.xml") }
    let(:base_profile_path) { File.join(tmp_dir, "base_profile.xml") }
    let(:cleaned_profile_path) { File.join(tmp_dir, "current.xml") }

    around do |example|
      example.run
      FileUtils.rm_rf(tmp_dir)
    end

    before do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return(tmp_dir)
      allow(Yast::AutoinstConfig).to receive(:local_rules_location).and_return(tmp_dir)
      subject.reset
    end

    context "when no XML profile has been given to merge" do
      it "does not read and merge any XML profile" do
        expect(subject).to_not receive(:merge_profiles)
        expect(subject).to_not receive(:XML_cleanup)
        expect(subject.Merge(result_path)).to eq(true)
      end
    end

    context "when a profile is not valid" do
      it "returns false" do
        subject.CreateFile("first.xml")
        expect(profile_checker).to receive(:valid_profile?)
          .and_return(false)
        expect(subject.Merge(result_path)).to eq(false)
      end
    end

    context "when only one XML profile is given" do
      it "reads but does not merge this XML profile" do
        subject.CreateFile("first.xml")
        expect(subject).to_not receive(:merge_profiles)
        expect(subject).to receive(:XML_cleanup).at_least(:once).and_return(true)
        expect(subject.Merge(result_path)).to eq(true)
      end
    end

    context "when two XML profiles are given" do
      before do
        subject.CreateFile("first.xml")
        subject.CreateFile("second.xml")
        allow(subject).to receive(:XML_cleanup).and_return(true)
      end

      it "cleans up each profile before merging them" do
        expect(subject).to receive(:XML_cleanup).with(first_path, base_profile_path)
          .and_return(true)
        expect(subject).to receive(:XML_cleanup).with(second_path, cleaned_profile_path)
          .and_return(true)

        subject.Merge(result_path)
      end

      it "merges the two XML profiles" do
        expect(subject).to receive(:merge_profiles)
          .with(base_profile_path, cleaned_profile_path, result_path)
          .and_return("exit" => 0, "stderr" => "", "stdout" => "")
        expect(subject.Merge(result_path)).to eq(true)
      end
    end
  end

  describe "#GetRules" do
    let(:tmp_dir) { Dir.mktmpdir("AutoInstallRules_test-") }
    let(:config) do
      double(
        "AutoinstConfig",
        scheme: "https", host: "example.net", directory: "",
        local_rules_location: local_rules_location
      )
    end
    let(:local_rules_location) { File.join(tmp_dir, "rules") }
    let(:tomerge) { ["profiles/base.xml", "profiles/disks.xml"] }

    before do
      stub_const("Yast::AutoinstConfig", config)
      allow(subject).to receive(:Get).and_return(true)
      subject.tomerge = tomerge
    end

    after do
      FileUtils.rm_rf(tmp_dir)
    end

    it "retrieves the files to merge" do
      expect(subject).to receive(:Get).with(
        "https", "example.net", "/profiles/base.xml", "#{local_rules_location}/profiles/base.xml"
      ).and_return(true)
      expect(subject).to receive(:Get).with(
        "https", "example.net", "/profiles/disks.xml",
        "#{local_rules_location}/profiles/disks.xml"
      ).and_return(true)
      expect(subject.GetRules).to eq(true)
    end

    context "when the local rules location does not exist" do
      let(:local_rules_location) { File.join(tmp_dir, "missing", "rules") }

      it "creates the directory" do
        subject.GetRules
        expect(Pathname.new(File.join(local_rules_location, "profiles"))).to exist
      end
    end

    context "when the files could be retrieved" do
      before do
        allow(subject).to receive(:Get).and_return(true)
      end

      it "returns true" do
        expect(subject.GetRules).to eq(true)
      end
    end

    context "when the files cannot be retrieved" do
      before do
        allow(subject).to receive(:Get).and_return(false)
      end

      it "returns false" do
        expect(subject.GetRules).to eq(false)
      end
    end
  end

  describe "#XML_cleanup" do
    let(:profile) { File.join(rules_fixtures, "leap.xml") }
    let(:tmp_dir) { Dir.mktmpdir("AutoInstallRules_test-") }
    let(:output) { File.join(tmp_dir, "output.xml") }

    around do |example|
      example.run
      FileUtils.rm_rf(tmp_dir)
    end

    it "cleans up the XML namespaces added by xsltproc" do
      subject.XML_cleanup(profile, output)
      content = File.read(output)
      expect(content).to include('t="list"')
    end
  end

  describe "#shellseg" do
    let(:ismatch) { false }

    context "when matchtype is 'exact'" do
      it "sets the shell command to do the comparison using '='" do
        subject.shellseg(ismatch, "memsize", "16384", "and", "exact")
        expect(subject.instance_variable_get(:@shell))
          .to eq(' ( [ "$memsize" = "16384" ] ) ')
      end
    end

    context "when matchtype is 'greater'" do
      it "sets the shell command to do the comparison using '-gt'" do
        subject.shellseg(ismatch, "memsize", "16384", "and", "greater")
        expect(subject.instance_variable_get(:@shell))
          .to eq(' ( [ "$memsize" -gt "16384" ] ) ')
      end
    end

    context "when matchtype is 'lower'" do
      it "sets the shell command to do the comparison using '-lt'" do
        subject.shellseg(ismatch, "memsize", "16384", "and", "lower")
        expect(subject.instance_variable_get(:@shell))
          .to eq(' ( [ "$memsize" -lt "16384" ] ) ')
      end
    end

    context "when matchtype is 'range'" do
      it "sets the shell command to do the range comparison" do
        subject.shellseg(ismatch, "memsize", "16384-32768", "and", "range")
        expect(subject.instance_variable_get(:@shell))
          .to eq(' ( [ "$memsize" -ge "16384" -a "$memsize" -le "32768" ] ) ')
      end
    end

    context "when matchtype is 'regex'" do
      it "sets the shell command to do a regex-based comparison" do
        subject.shellseg(ismatch, "installed_product", "openSUSE", "and", "regex")
        expect(subject.instance_variable_get(:@shell))
          .to eq(' ( [[ "$installed_product" =~ openSUSE ]] ) ')
      end
    end

    context "when the 'match' argument is set to true" do
      before do
        subject.shellseg(false, "memsize", "16384", "or", "exact")
      end

      it "adds the condition to the existing one" do
        subject.shellseg(true, "installed_product_version", "15.2", "or", "exact")
        expect(subject.instance_variable_get(:@shell)).to eq(
          ' ( [ "$memsize" = "16384" ] )   ||   ( [ "$installed_product_version" = "15.2" ] )'
        )
      end
    end
  end

  describe "#Process" do
    let(:tmp_dir) { Dir.mktmpdir("AutoInstallRules_test-") }
    let(:config) do
      double(
        "AutoinstConfig",
        scheme: "https", host: "example.net", directory: "",
        local_rules_location: local_rules_location, tmpDir: tmp_dir
      )
    end

    let(:output) { File.join(tmp_dir, "output.xml") }
    let(:local_rules_location) { File.join(tmp_dir, "rules") }
    let(:prefinal_profile_path) { File.join(local_rules_location, "prefinal_autoinst.xml") }
    let(:tomerge) { ["profiles/base.xml", "profiles/disks.xml"] }
    let(:classes) { false }

    before do
      stub_const("Yast::AutoinstConfig", config)
      allow(subject).to receive(:Merge).and_return(true)
      allow(subject).to receive(:read_xml).and_return(true)
      allow(subject).to receive(:classes_to_merge).and_return(:classes)
      allow(Yast::SCR).to receive(:Execute)
    end

    after do
      FileUtils.rm_rf(tmp_dir)
    end

    it "merges the rules already read into a prefinal profile" do
      expect(subject).to receive(:Merge).with(prefinal_profile_path)

      subject.Process(output)
    end

    it "reads the classes defined in the prefinal profile" do
      expect(subject).to receive(:classes_to_merge).and_return(classes)

      subject.Process(output)
    end

    context "when there are no classes to be merged" do
      it "copies the prefinal profile to the given path" do
        expect(Yast::SCR).to receive(:Execute)
          .with(Yast::Path.new(".target.bash"), "cp #{prefinal_profile_path} #{output}")

        subject.Process(output)
      end
    end

    context "when there are classes to be merged" do
      let(:get_rules) { true }
      let(:classes) { true }

      before do
        allow(subject).to receive(:GetRules).and_return(get_rules)
      end

      context "and the classes files are obtained correctly" do
        it "merges the prefinal profile with the classes ones into the given path" do
          expect(subject).to receive(:Merge).with(prefinal_profile_path).and_return(true)
          expect(subject).to receive(:Merge).with(output)

          subject.Process(output)
        end

        it "returns true" do
          expect(subject.Process(output)).to eq(true)
        end
      end

      context "and the files cannot be obtained correctly" do
        let(:get_rules) { false }

        it "reports an error" do
          expect(Yast::Report).to receive(:Error)

          subject.Process(output)
        end

        it "copies the prefinal profile to the given path" do
          expect(Yast::SCR).to receive(:Execute)
            .with(Yast::Path.new(".target.bash"), "cp #{prefinal_profile_path} #{output}")

          subject.Process(output)
        end

        it "returns false" do
          expect(subject.Process(output)).to eq(false)
        end
      end
    end
  end

  describe "#classes_to_merge" do
    let(:profile_def) do
      { "classes" => [
        {
          "class_name"    => "TrainingRoom",
          "configuration" => "Software.xml",
          "dont_merge"    => dont_merge
        }
      ] }
    end

    let(:profile) { double("Profile", current: profile_def) }
    let(:dont_merge) { [] }

    before do
      stub_const("Yast::Profile", profile)
      subject.tomerge = []
      Yast::AutoinstConfig.dontmerge = []
    end

    context "when there are no classes defined in the profile" do
      let(:profile_def) { {} }

      it "returns false" do
        expect(subject.classes_to_merge).to eq(false)
      end
    end

    context "when there are classes defined in the profile" do
      let(:tomerge) { ["classes/TrainingRoom/Software.xml"] }

      it "adds the configuration file to the list of files to be merged" do
        expect { subject.classes_to_merge }.to change { subject.tomerge }.from([]).to(tomerge)
      end

      context "and the classes define sections not to be merged" do
        let(:dont_merge) { ["partition", "software"] }

        it "adds the sections to the list of not mergeable ones" do
          expect { subject.classes_to_merge }
            .to change { Yast::AutoinstConfig.dontmerge }.from([]).to(dont_merge)
        end
      end
    end
  end
end
