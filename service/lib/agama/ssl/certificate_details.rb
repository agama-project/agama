require "agama/ssl/fingerprint"

module Agama
  # class handling SSL certificate
  module SSL
    class CertificateDetails
      include Yast::I18n

      # indent size used in summary text
      INDENT = " " * 3

      def initialize(certificate)
        textdomain "registration"
        @certificate = certificate
      end

      def subject
        identity_details(certificate.subject_name, certificate.subject_organization,
          certificate.subject_organization_unit)
      end

      def issuer
        identity_details(certificate.issuer_name, certificate.issuer_organization,
          certificate.issuer_organization_unit)
      end

      def summary(small_space: false)
        summary = _("Certificate:") + "\n" + _("Issued To") + "\n" + subject +
          "\n" + _("Issued By") + "\n" + issuer + "\n" + _("SHA1 Fingerprint: ") +
          "\n" + INDENT + certificate.fingerprint(Fingerprint::SHA1).value + "\n" +
          _("SHA256 Fingerprint: ") + "\n"

        sha256 = certificate.fingerprint(Fingerprint::SHA256).value
        summary += if small_space
          # split the long SHA256 digest to two lines in small text mode UI
          INDENT + sha256[0..59] + "\n" + INDENT + sha256[60..-1]
        else
          INDENT + sha256
        end

        summary
      end

    private

      attr_reader :certificate

      def identity_details(cn, o, ou)
        # label followed by the SSL certificate identification
        _("Common Name (CN): ") + (cn || "") + "\n" +
          # label followed by the SSL certificate identification
          _("Organization (O): ") + (o || "") + "\n" +
          # label followed by the SSL certificate identification
          _("Organization Unit (OU): ") + (ou || "") + "\n"
      end
    end
  end
end

