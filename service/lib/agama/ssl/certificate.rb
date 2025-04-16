require "openssl"
require "suse/connect"
require "yast2/execute"
require "agama/ssl/fingerprint"
require "agama/ssl/certificate_details"

module Agama
  module SSL
    # class handling SSL certificate
    class Certificate
      include Yast::Logger

      Yast.import "Stage"
      Yast.import "Installation"

      # Path to the registration certificate in the instsys
      INSTSYS_CERT_DIR = "/etc/pki/trust/anchors".freeze
      INSTSYS_SERVER_CERT_FILE = File.join(INSTSYS_CERT_DIR, "registration_server.pem").freeze
      # Path to system CA certificates
      CA_CERTS_DIR = "/var/lib/ca-certificates".freeze

      # all used certificate paths, this is used during upgrade to import
      # the old certificate into the inst-sys, put the older paths at the end
      # so the newer paths are checked first
      PATHS = [
        # the YaST (SUSEConnect) current default path
        # /etc/pki/trust/anchors/registration_server.pem
        SUSE::Connect::YaST::SERVER_CERT_FILE,
        # old location of the certificate (before moved to /etc)
        # https://bugzilla.suse.com/show_bug.cgi?id=1130864
        "/usr/share/pki/trust/anchors/registration_server.pem",
        # RMT certificate
        # https://github.com/SUSE/rmt/blob/b240ce577bd1637cfb57548f2741a1925cf3e4ee/public/tools/rmt-client-setup#L214
        "/etc/pki/trust/anchors/rmt-server.pem",
        # SMT certificate
        # https://github.com/SUSE/smt/blob/SMT12/script/clientSetup4SMT.sh#L245
        "/etc/pki/trust/anchors/registration-server.pem",
        # the SLE11 path (for both YaST and the clientSetup4SMT.sh script)
        # https://github.com/yast/yast-registration/blob/Code-11-SP3/src/modules/Register.ycp#L296-L297
        "/etc/ssl/certs/registration-server.pem"
      ].freeze

      attr_reader :x509_cert

      # Path to store the certificate of the registration server
      #
      # @return [String] Path to store the certificate
      def self.default_certificate_path
        INSTSYS_SERVER_CERT_FILE
      end

      def initialize(x509_cert)
        @x509_cert = x509_cert
      end

      def self.load_file(file)
        load(File.read(file))
      end

      def self.load(data)
        cert = OpenSSL::X509::Certificate.new(data)
        Certificate.new(cert)
      end

      def self.download(url, insecure: false)
        # TODO
        #result = Downloader.download(url, insecure: insecure)
        #load(result)
      end

      # Path to temporal CA certificates (to be used only in instsys)
      TMP_CA_CERTS_DIR = "/var/lib/YaST2/ca-certificates".freeze

      # Update instys CA certificates
      #
      # update-ca-certificates script cannot be used in inst-sys.
      # See bsc#981428 and bsc#989787.
      #
      # @return [Boolean] true if update was successful; false otherwise.
      #
      # @see CA_CERTS_DIR
      # @see TMP_CA_CERTS_DIR
      def self.update_instsys_ca
        FileUtils.mkdir_p(TMP_CA_CERTS_DIR)
        # Extract system certs in openssl and pem formats
        Yast::Execute.locally("trust", "extract", "--format=openssl-directory",
          "--filter=ca-anchors", "--overwrite", File.join(TMP_CA_CERTS_DIR, "openssl"))
        Yast::Execute.locally("trust", "extract", "--format=pem-directory-hash",
          "--filter=ca-anchors", "--overwrite", File.join(TMP_CA_CERTS_DIR, "pem"))

        # Copy certificates/links
        new_files = []
        ["pem", "openssl"].each do |subdir|
          files = Dir[File.join(TMP_CA_CERTS_DIR, subdir, "*")]
          next if files.empty?

          subdir = File.join(CA_CERTS_DIR, subdir)
          FileUtils.mkdir_p(subdir) unless Dir.exist?(subdir)
          files.each do |file|
            # FileUtils.cp does not seem to allow copying the links without dereferencing them.
            Yast::Execute.locally("cp", "--no-dereference", "--preserve=links", file, subdir)
            new_files << File.join(subdir, File.basename(file))
          end
        end

        # Cleanup
        FileUtils.rm_rf(TMP_CA_CERTS_DIR)

        return false if new_files.empty?

        # Reload SUSEConnect internal cert pool (suseconnect-ng only)
        SUSE::Connect::SSLCertificate.reload if SUSE::Connect::SSLCertificate.respond_to?(:reload)

        # Check that last file was copied to return true or false
        File.exist?(new_files.last)
      end

      # certificate serial number (in HEX format, e.g. AB:CD:42:FF...)
      def serial
        x509_cert.serial.to_s(16).scan(/../).join(":")
      end

      def issued_on
        x509_cert.not_before.localtime.strftime("%F")
      end

      def valid_yet?
        Time.now > x509_cert.not_before
      end

      def expires_on
        x509_cert.not_after.localtime.strftime("%F")
      end

      def expired?
        Time.now > x509_cert.not_after
      end

      def subject_name
        find_subject_attribute("CN")
      end

      def subject_organization
        find_subject_attribute("O")
      end

      def subject_organization_unit
        find_subject_attribute("OU")
      end

      def issuer_name
        find_issuer_attribute("CN")
      end

      def issuer_organization
        find_issuer_attribute("O")
      end

      def issuer_organization_unit
        find_issuer_attribute("OU")
      end

      def match_fingerprint?(fp)
        fp == fingerprint(fp.sum)
      end

      def fingerprint(sum)
        case sum.upcase
        when Fingerprint::SHA1
          sha1_fingerprint
        when Fingerprint::SHA256
          sha256_fingerprint
        else
          raise "Unsupported checksum type '#{sum}'"
        end
      end

      # Import the certificate
      #
      # Depending if running in installation or in a installed system,
      # it will rely on #import_to_instsys or #import_to_system methods.
      #
      # @return [true] true if import was successful
      #
      # @raise Connect::SystemCallError
      # @raise Cheetah::ExecutionFailed

      # @see #import_to_instsys
      def import
        import_to_instsys
      end

      # Import the certificate to the installation system
      #
      # This method exists because the procedure to import certificates
      # to installation system is slightly different to the one followed
      # to import certificates to a installed system.
      #
      # @param target_path [String] where the imported certificate will be saved,
      #   the path should contain the INSTSYS_CERT_DIR prefix otherwise it might
      #   not work correctly.
      # @return [Boolean] true if import was successful; false otherwise.
      #
      # @see update_instsys_ca
      def import_to_instsys(target_path = self.class.default_certificate_path)
        # Copy certificate
        File.write(target_path, x509_cert.to_pem)

        # Update database
        self.class.update_instsys_ca
      end

      # Log the certificate details
      def log_details
        require "registration/ssl_certificate_details"
        # log also the dates
        log.info("#{CertificateDetails.new(self).summary}\n" \
          "Issued on: #{issued_on}\nExpires on: #{expires_on}")

        # log a warning for expired certificate
        expires = x509_cert.not_after.localtime
        log.warn("The certificate has EXPIRED! (#{expires})") if expires < Time.now
      end

    private

      # @param x509_name [OpenSSL::X509::Name] name object
      # @param attribute [String] requested attribute name. e.g. "CN"
      # @return attribut value or nil if not defined
      def find_name_attribute(x509_name, attribute)
        # to_a returns an attribute list, e.g.:
        # [["CN", "linux", 19], ["emailAddress", "root@...", 22], ["O", "YaST", 19], ...]
        _attr, value, _code = x509_name.to_a.find { |a| a.first == attribute }
        value
      end

      def find_issuer_attribute(attribute)
        find_name_attribute(x509_cert.issuer, attribute)
      end

      def find_subject_attribute(attribute)
        find_name_attribute(x509_cert.subject, attribute)
      end

      def sha1_fingerprint
        Fingerprint.new(
          Fingerprint::SHA1,
          ::SUSE::Connect::YaST.cert_sha1_fingerprint(x509_cert)
        )
      end

      def sha256_fingerprint
        Fingerprint.new(
          Fingerprint::SHA256,
          ::SUSE::Connect::YaST.cert_sha256_fingerprint(x509_cert)
        )
      end
    end
  end
end
