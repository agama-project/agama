#! /usr/bin/env rspec

require_relative "../../test_helper"

require "agama/ssl/certificate"

require "pathname"
require "tmpdir"

describe Agama::SSL::Certificate do
  subject { Agama::SSL::Certificate.load_file(File.join(FIXTURES_PATH, "test.pem")) }
  # use "openssl x509 -in test.pem -noout -serial -fingerprint" to get serial and SHA1
  # use "openssl x509 -outform der -in test.pem -out test.der" and then
  #   "sha224sum test.der" and "sha256sum test.der" to get SHA224 and SHA256
  let(:serial) { "B8:AB:F1:73:E4:1F:10:4D" }
  let(:sha1)   { "A8:DE:08:B1:57:52:FE:70:DF:D5:31:EA:E3:53:BB:39:EE:01:FF:B9" }
  let(:sha256) do
    "2A:02:DA:EC:A9:FF:4C:B4:A6:C0:57:08:F6:1C:8B:B0:94:FA:F4:60:96:5E:" \
      "18:48:CA:84:81:48:60:F3:CB:BF"
  end
  let(:initial) { false }

  before do
    allow(Yast::Stage).to receive(:initial).and_return(initial)
  end

  describe ".load_file" do
    it "loads SSL certificate from a file" do
      expect(subject).to be_a(Agama::SSL::Certificate)
    end
  end

  describe ".load" do
    it "loads SSL certificate from data" do
      expect(Agama::SSL::Certificate.load(File.read(File.join(FIXTURES_PATH, "test.pem")))).to \
        be_a(Agama::SSL::Certificate)
    end
  end

  xdescribe ".download" do
    it "downloads a SSL certificate from server" do
      expect(Agama::SSL::Downloader).to receive(:download)\
        .and_return(File.read(File.join(FIXTURES_PATH, "test.pem")))

      expect(Agama::SSL::Certificate.download("http://example.com/smt.crt")).to \
        be_a(Agama::SSL::Certificate)
    end
  end

  describe ".update_instsys_ca" do
    CERT_NAME = "YaST_Team.pem".freeze
    # Names are asigned by "trust" and related to certificate content
    CERT_LINKS = ["8820a2e8.0", "8f13f82e.0"].freeze

    let(:ca_dir) { Pathname.new(Dir.mktmpdir) }
    let(:tmp_ca_dir) { File.join(FIXTURES_PATH, "anchors") }

    before do
      stub_const("Agama::SSL::Certificate::TMP_CA_CERTS_DIR", tmp_ca_dir.to_s)
      stub_const("Agama::SSL::Certificate::CA_CERTS_DIR", ca_dir.to_s)
      allow(Yast::Execute).to receive(:locally).and_call_original
      allow(FileUtils).to receive(:rm_rf).and_call_original
      ["openssl", "pem"].each do |d|
        FileUtils.mkdir_p(File.join(tmp_ca_dir, d))
        CERT_LINKS.each do |l|
          FileUtils.ln_sf(File.join(tmp_ca_dir, d, CERT_NAME), File.join(tmp_ca_dir, d, l))
        end
      end
    end

    after do
      FileUtils.rm_rf(ca_dir.to_s)
      cert_links = Dir[File.join(tmp_ca_dir, "*")].select { |f| File.symlink?(f)}
      FileUtils.rm(cert_links) unless cert_links.empty?
    end

    it "adds new certs under anchors to system CA certificates" do
      expect(Yast::Execute).to receive(:locally).with("trust", "extract",
        "--format=openssl-directory", "--filter=ca-anchors", "--overwrite",
        File.join(tmp_ca_dir, "openssl"))
        .and_return(true)
      expect(Yast::Execute).to receive(:locally).with("trust", "extract",
        "--format=pem-directory-hash", "--filter=ca-anchors", "--overwrite",
        File.join(tmp_ca_dir, "pem"))
        .and_return(true)
      expect(FileUtils).to receive(:rm_rf).with(tmp_ca_dir)
        .and_return(Dir[File.join(tmp_ca_dir, "*")])

      expect(described_class.update_instsys_ca).to eq(true)

      # Check that certificates and symlink exists
      targets = ["pem", "openssl"].map { |d| File.join(ca_dir, d) }
      targets.each do |subdir|
        expect(File.file?(File.join(subdir, CERT_NAME))).to eq true
        CERT_LINKS.each { |l| expect(File.symlink?(File.join(subdir, l))).to eq true }
      end
    end

    context "when updating the system CA certificate fails" do
      before do
        allow(Cheetah).to receive(:run)
        allow(FileUtils).to receive(:rm_rf)
      end

      it "returns false" do
        expect(described_class.update_instsys_ca).to eq(false)
      end
    end
  end

  describe ".default_certificate_path" do
    it "returns the path defined by INSTSYS_SERVER_CERT_FILE" do
      expect(described_class.default_certificate_path)
        .to eq(Agama::SSL::Certificate::INSTSYS_SERVER_CERT_FILE)
    end
  end

  describe "#fingerprint" do
    it "returns SHA1 fingerprint in HEX format" do
      expect(subject.fingerprint(Agama::SSL::Fingerprint::SHA1).value).to eq(sha1)
    end

    it "returns SHA256 fingerprint in HEX format" do
      expect(subject.fingerprint(Agama::SSL::Fingerprint::SHA256).value).to eq(sha256)
    end

    it "raises an exception when unsupported sum is requested" do
      expect { subject.fingerprint("SHA224") }.to raise_error(/Unsupported checksum type/)
    end
  end

  describe "#serial" do
    it "returns serial number in HEX format" do
      expect(subject.serial).to eq(serial)
    end
  end

  describe "#issued_on" do
    it "returns date of issue in human readable form" do
      expect(subject.issued_on).to eq("2014-04-24")
    end
  end

  describe "#expires_on" do
    it "returns date of issue in human readable form" do
      expect(subject.expires_on).to eq("2017-04-23")
    end
  end

  context "current date in the past" do
    before do
      expect(Time).to receive(:now).and_return(Time.new(2010, 1, 1))
    end

    describe "#expired?" do
      it "returns false" do
        expect(subject.expired?).to eq(false)
      end
    end

    describe "#valid_yet?" do
      it "returns false" do
        expect(subject.valid_yet?).to eq(false)
      end
    end
  end

  context "current date in the future" do
    before do
      expect(Time).to receive(:now).and_return(Time.new(2020, 1, 1))
    end

    describe "#expired?" do
      it "returns true" do
        expect(subject.expired?).to eq(true)
      end
    end

    describe "#valid_yet?" do
      it "returns true" do
        expect(subject.valid_yet?).to eq(true)
      end
    end
  end

  context "current date in valid range" do
    before do
      expect(Time).to receive(:now).and_return(Time.new(2015, 1, 1))
    end

    describe "#expired?" do
      it "returns false" do
        expect(subject.expired?).to eq(false)
      end
    end

    describe "#valid_yet?" do
      it "returns true" do
        expect(subject.valid_yet?).to eq(true)
      end
    end
  end

  describe "#subject_name" do
    it "returns subject name" do
      expect(subject.subject_name).to eq("linux-1hyn")
    end
  end

  describe "#subject_organization" do
    it "returns subject organization name" do
      expect(subject.subject_organization).to eq("WebYaST")
    end
  end

  describe "#subject_organization_unit" do
    it "returns subject organization unit name" do
      expect(subject.subject_organization_unit).to eq("WebYaST")
    end
  end

  describe "#issuer_name" do
    it "returns issuer name" do
      expect(subject.issuer_name).to eq("linux-1hyn")
    end
  end

  describe "#issuer_organization" do
    it "returns issuer organization name" do
      expect(subject.issuer_organization).to eq("WebYaST")
    end
  end

  describe "#issuer_organization_unit" do
    it "returns issuer organization unit name" do
      expect(subject.issuer_organization_unit).to eq("WebYaST")
    end
  end

  describe "#import_to_instsys" do
    before do
      allow(subject.x509_cert).to receive(:to_pem).and_return("CERTIFICATE")
    end

    it "copies the certificate to the default instsys path" do
      allow(described_class).to receive(:update_instsys_ca)
      expect(File).to receive(:write)
        .with(described_class.default_certificate_path, "CERTIFICATE")

      subject.import_to_instsys
    end

    context "when successfully updates system CA certificates" do
      before do
        allow(File).to receive(:write)
        expect(described_class).to receive(:update_instsys_ca).and_return(true)
      end

      it "returns true" do
        expect(subject.import_to_instsys).to eq(true)
      end
    end

    context "when fails to update system CA certificates" do
      before do
        allow(File).to receive(:write)
        expect(described_class).to receive(:update_instsys_ca).and_return(false)
      end

      it "returns false" do
        expect(subject.import_to_instsys).to eq(false)
      end
    end
  end

  describe "#import" do
    it "installs the certificate in the instsys" do
      expect(subject).to receive(:import_to_instsys)
      subject.import
    end
  end
end
