const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
  let registry;
  let owner;
  let issuer;
  let unauthorizedUser;

  const certificateId = "CERT-2024-001";
  const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("salted private credential proof"));

  beforeEach(async function () {
    [owner, issuer, unauthorizedUser] = await ethers.getSigners();
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();
  });

  const issue = (id = certificateId, hash = credentialHash) =>
    registry.connect(issuer).issueCertificate(id, hash);

  describe("Deployment", function () {
    it("Should deploy correctly and set the owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  describe("Issuer Management", function () {
    it("Should authorize an issuer", async function () {
      await expect(registry.authorizeIssuer(issuer.address))
        .to.emit(registry, "IssuerAuthorized")
        .withArgs(issuer.address, (timestamp) => timestamp > 0);
      expect(await registry.isAuthorizedIssuer(issuer.address)).to.be.true;
    });

    it("Should revoke an issuer", async function () {
      await registry.authorizeIssuer(issuer.address);
      await expect(registry.revokeIssuer(issuer.address))
        .to.emit(registry, "IssuerRevoked")
        .withArgs(issuer.address, (timestamp) => timestamp > 0);
      expect(await registry.isAuthorizedIssuer(issuer.address)).to.be.false;
    });

    it("Should prevent non-owner from authorizing issuers", async function () {
      await expect(registry.connect(issuer).authorizeIssuer(unauthorizedUser.address))
        .to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Certificate Issuance", function () {
    beforeEach(async function () {
      await registry.authorizeIssuer(issuer.address);
    });

    it("Should issue a salted credential proof", async function () {
      await expect(issue())
        .to.emit(registry, "CertificateIssued")
        .withArgs(certificateId, issuer.address, credentialHash, (timestamp) => timestamp > 0);
    });

    it("Should prevent unauthorized issuance", async function () {
      await expect(registry.connect(unauthorizedUser).issueCertificate(certificateId, credentialHash))
        .to.be.revertedWith("Only authorized issuers can call this function");
    });

    it("Should prevent double issuance", async function () {
      await issue();
      await expect(issue()).to.be.revertedWith("Certificate already exists");
    });
  });

  describe("Certificate Verification", function () {
    beforeEach(async function () {
      await registry.authorizeIssuer(issuer.address);
      await issue();
    });

    it("Should return only the credential proof and chain status", async function () {
      const cert = await registry.verifyCertificate(certificateId);
      expect(cert.credentialHash).to.equal(credentialHash);
      expect(cert.issuer).to.equal(issuer.address);
      expect(cert.issuedAt).to.be.greaterThan(0);
      expect(cert.isRevoked).to.be.false;
      expect(cert.revokedAt).to.equal(0);
    });

    it("Should fail for a non-existent certificate", async function () {
      await expect(registry.verifyCertificate("NON-EXISTENT"))
        .to.be.revertedWith("Certificate does not exist");
    });
  });

  describe("Certificate Revocation", function () {
    beforeEach(async function () {
      await registry.authorizeIssuer(issuer.address);
      await issue();
    });

    it("Should revoke a certificate without putting a reason on-chain", async function () {
      await expect(registry.connect(issuer).revokeCertificate(certificateId))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(certificateId, issuer.address, (timestamp) => timestamp > 0);
      const cert = await registry.verifyCertificate(certificateId);
      expect(cert.isRevoked).to.be.true;
      expect(cert.revokedAt).to.be.greaterThan(0);
    });

    it("Should prevent non-issuer from revoking", async function () {
      await expect(registry.connect(unauthorizedUser).revokeCertificate(certificateId))
        .to.be.revertedWith("Only the original issuer can revoke");
    });

    it("Should prevent double revocation", async function () {
      await registry.connect(issuer).revokeCertificate(certificateId);
      await expect(registry.connect(issuer).revokeCertificate(certificateId))
        .to.be.revertedWith("Certificate already revoked");
    });
  });

  describe("Audit Trail", function () {
    beforeEach(async function () {
      await registry.authorizeIssuer(issuer.address);
    });

    it("Should track issuance and revocation without personal details", async function () {
      await issue();
      let audit = await registry.getAuditTrail(certificateId);
      expect(audit.length).to.equal(1);
      expect(audit[0].action).to.equal("ISSUED");
      expect(audit[0].performedBy).to.equal(issuer.address);

      await registry.connect(issuer).revokeCertificate(certificateId);
      audit = await registry.getAuditTrail(certificateId);
      expect(audit.length).to.equal(2);
      expect(audit[1].action).to.equal("REVOKED");
      expect(audit[1].performedBy).to.equal(issuer.address);
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await registry.authorizeIssuer(issuer.address);
    });

    it("Should list certificates by issuer", async function () {
      await issue("CERT-001", ethers.keccak256(ethers.toUtf8Bytes("proof-1")));
      await issue("CERT-002", ethers.keccak256(ethers.toUtf8Bytes("proof-2")));
      const certs = await registry.getCertificatesByIssuer(issuer.address);
      expect(certs).to.deep.equal(["CERT-001", "CERT-002"]);
    });
  });
});
