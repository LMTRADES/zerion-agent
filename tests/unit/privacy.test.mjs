// Privacy Layer Tests
// Tests: stealth addresses, ZK proofs, private routing, privacy audit

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PrivacyLayer, PrivacyPolicyPresets, PrivacyAgent } from "../../agent/privacy.js";

describe("PrivacyLayer", () => {
  let privacy;

  beforeEach(() => { privacy = new PrivacyLayer(); });

  describe("constructor", () => {
    it("should initialize empty maps", () => {
      assert.equal(privacy.stealthAddresses.size, 0);
      assert.equal(privacy.transactionHistory.size, 0);
      assert.equal(privacy.zkProofs.size, 0);
    });
  });

  // ─── Stealth Addresses ────────────────────────────────────────────────

  describe("generateStealthAddress()", () => {
    it("should generate unique stealth address", () => {
      const { stealthAddress } = privacy.generateStealthAddress("0xPUBKEY");
      assert.ok(stealthAddress.startsWith("0x"));
      assert.equal(stealthAddress.length, 42);
    });

    it("should generate different addresses for same key", () => {
      const a1 = privacy.generateStealthAddress("0xPUBKEY");
      const a2 = privacy.generateStealthAddress("0xPUBKEY");
      assert.notEqual(a1.stealthAddress, a2.stealthAddress);
    });

    it("should include ephemeral key", () => {
      const result = privacy.generateStealthAddress("0xPUBKEY");
      assert.ok(result.ephemeralKey);
      assert.equal(result.ephemeralKey.length, 64);
    });

    it("should store in stealthAddresses map", () => {
      const { stealthAddress } = privacy.generateStealthAddress("0xPUBKEY");
      assert.ok(privacy.stealthAddresses.has(stealthAddress));
    });
  });

  describe("verifyStealthAddress()", () => {
    it("should verify correct stealth address", () => {
      const pubkey = "0xPUBKEY";
      const { stealthAddress, ephemeralKey } = privacy.generateStealthAddress(pubkey);
      assert.equal(privacy.verifyStealthAddress(stealthAddress, pubkey, ephemeralKey), true);
    });

    it("should reject wrong recipient", () => {
      const { stealthAddress, ephemeralKey } = privacy.generateStealthAddress("0xPUBKEY");
      assert.equal(privacy.verifyStealthAddress(stealthAddress, "0xWRONG", ephemeralKey), false);
    });

    it("should reject wrong ephemeral key", () => {
      const pubkey = "0xPUBKEY";
      const { stealthAddress } = privacy.generateStealthAddress(pubkey);
      assert.equal(privacy.verifyStealthAddress(stealthAddress, pubkey, "wrong_key"), false);
    });

    it("should reject tampered stealth address", () => {
      const pubkey = "0xPUBKEY";
      const { ephemeralKey } = privacy.generateStealthAddress(pubkey);
      assert.equal(privacy.verifyStealthAddress("0xTAMPERED", pubkey, ephemeralKey), false);
    });
  });

  // ─── ZK Proofs ────────────────────────────────────────────────────────

  describe("createZKProof()", () => {
    it("should create proof for transaction", () => {
      const tx = { sender: "0xSENDER", recipient: "0xRECIPIENT", amount: 100, token: "ETH" };
      const result = privacy.createZKProof(tx);
      assert.ok(result.proofId);
      assert.ok(result.proof);
      assert.ok(result.publicSignals);
      assert.equal(result.publicSignals.length, 2);
    });

    it("should generate unique proofs for same tx", () => {
      const tx = { sender: "0xA", recipient: "0xB", amount: 50, token: "USDC" };
      const p1 = privacy.createZKProof(tx);
      const p2 = privacy.createZKProof(tx);
      assert.notEqual(p1.proof, p2.proof);
    });

    it("should store proof in zkProofs map", () => {
      const tx = { sender: "0xSENDER", recipient: "0xRECIPIENT", amount: 100, token: "ETH" };
      const { proofId } = privacy.createZKProof(tx);
      assert.ok(privacy.zkProofs.has(proofId));
    });

    it("should handle minimal transaction data", () => {
      const result = privacy.createZKProof({ sender: "", recipient: "", amount: 0, token: "" });
      assert.ok(result.proofId);
    });

    it("should handle missing fields", () => {
      const result = privacy.createZKProof({});
      assert.ok(result.proofId);
    });
  });

  describe("verifyZKProof()", () => {
    it("should verify valid proof", () => {
      const tx = { sender: "0xSENDER", recipient: "0xRECIPIENT", amount: 100, token: "ETH" };
      const { proofId, proof, publicSignals } = privacy.createZKProof(tx);
      assert.equal(privacy.verifyZKProof(proofId, proof, publicSignals), true);
    });

    it("should reject tampered proof", () => {
      const tx = { sender: "0xSENDER", recipient: "0xRECIPIENT", amount: 100, token: "ETH" };
      const { proofId, publicSignals } = privacy.createZKProof(tx);
      assert.equal(privacy.verifyZKProof(proofId, "tampered_proof", publicSignals), false);
    });

    it("should reject unknown proofId", () => {
      assert.equal(privacy.verifyZKProof("unknown", "proof", []), false);
    });
  });

  // ─── Private Transaction Routing ──────────────────────────────────────

  describe("routePrivateTransaction()", () => {
    it("should route with stealth address", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, { useStealthAddress: true });
      assert.ok(result.routedTo);
      assert.notEqual(result.routedTo, tx.to);
    });

    it("should route with ZK proof", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, { useZKProof: true });
      assert.ok(result.privacy.zkProof);
    });

    it("should route with full privacy", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, {
        useStealthAddress: true,
        useZKProof: true,
      });
      assert.equal(result.privacyLevel, "full");
    });

    it("should route with no privacy (passthrough)", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, {});
      assert.equal(result.privacyLevel, "none");
    });

    it("should generate transaction hash", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, { useStealthAddress: true });
      assert.ok(result.txHash);
      assert.equal(result.txHash.length, 64);
    });

    it("should store in transaction history", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, { useZKProof: true });
      assert.ok(privacy.transactionHistory.has(result.txHash));
    });
  });

  describe("_assessPrivacyLevel()", () => {
    it("should return none for empty options", () => {
      assert.equal(privacy._assessPrivacyLevel({}), "none");
    });

    it("should return partial for stealth only", () => {
      assert.equal(privacy._assessPrivacyLevel({ useStealthAddress: true }), "partial");
    });

    it("should return partial for ZK only", () => {
      assert.equal(privacy._assessPrivacyLevel({ useZKProof: true }), "partial");
    });

    it("should return full for both", () => {
      assert.equal(privacy._assessPrivacyLevel({ useStealthAddress: true, useZKProof: true }), "full");
    });
  });

  // ─── Privacy Audit ────────────────────────────────────────────────────

  describe("auditPrivacy()", () => {
    it("should audit exposed transactions", () => {
      const txs = [{ hash: "0x1" }, { hash: "0x2" }];
      const report = privacy.auditPrivacy(txs);
      assert.equal(report.exposed, 2);
      assert.equal(report.private, 0);
      assert.equal(report.privacyScore, "0.0%");
    });

    it("should detect private transactions", async () => {
      const tx = { from: "0xFROM", to: "0xTO", value: 100 };
      const result = await privacy.routePrivateTransaction(tx, {
        useStealthAddress: true,
        useZKProof: true,
      });
      const report = privacy.auditPrivacy([{ hash: result.txHash }]);
      assert.equal(report.private, 1);
      assert.equal(report.privacyScore, "100.0%");
    });

    it("should handle empty transaction list", () => {
      const report = privacy.auditPrivacy([]);
      assert.equal(report.totalAnalyzed, 0);
      assert.equal(report.privacyScore, "N/A");
    });

    it("should include recommendations", () => {
      const report = privacy.auditPrivacy([{ hash: "0x1" }]);
      assert.ok(report.recommendation);
    });
  });
});

describe("PrivacyPolicyPresets", () => {
  it("fullPrivacy should have 5 policies", () => {
    assert.equal(PrivacyPolicyPresets.fullPrivacy.length, 5);
  });

  it("compliancePrivacy should have 5 policies", () => {
    assert.equal(PrivacyPolicyPresets.compliancePrivacy.length, 5);
  });

  it("fullPrivacy should include portfolio guard", () => {
    const pg = PrivacyPolicyPresets.fullPrivacy.find(p => p.type === "portfolio_guard");
    assert.ok(pg);
  });

  it("compliancePrivacy should allow larger limits", () => {
    const fsl = PrivacyPolicyPresets.fullPrivacy.find(p => p.type === "spend_limit");
    const csl = PrivacyPolicyPresets.compliancePrivacy.find(p => p.type === "spend_limit");
    assert.ok(csl.maxPerTx > fsl.maxPerTx);
  });
});

describe("PrivacyAgent", () => {
  let agent;

  beforeEach(() => { agent = new PrivacyAgent({ walletAddress: "0xPrivacyTest" }); });

  it("should initialize with fullPrivacy default", () => {
    assert.equal(agent.policies.length, 5);
  });

  it("should have PrivacyLayer instance", () => {
    assert.ok(agent.privacy instanceof PrivacyLayer);
  });

  it("should have initial stats at zero", () => {
    assert.equal(agent.stats.transactionsRouted, 0);
    assert.equal(agent.stats.stealthAddressesGenerated, 0);
    assert.equal(agent.stats.zkProofsGenerated, 0);
  });

  describe("sendPrivate()", () => {
    it("should send private transaction with full privacy", async () => {
      const result = await agent.sendPrivate({ from: "0xA", to: "0xB", value: 100 });
      assert.equal(result.privacyLevel, "full");
      assert.equal(agent.stats.transactionsRouted, 1);
      assert.equal(agent.stats.stealthAddressesGenerated, 1);
      assert.equal(agent.stats.zkProofsGenerated, 1);
    });
  });

  describe("audit()", () => {
    it("should audit transactions", async () => {
      const result = await agent.sendPrivate({ from: "0xA", to: "0xB", value: 100 });
      const report = await agent.audit([{ hash: result.txHash }]);
      assert.equal(agent.stats.privacyAuditsRun, 1);
      assert.ok(report.privacyScore);
    });
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🚀 Privacy Layer Tests Complete");
}
