# Changelog

## 1.0.0 (2026-04-25)


### Features

* add MPP pay-per-call support + Solana x402 ([376d30b](https://github.com/LMTRADES/zerion-agent/commit/376d30b2cb9fff41b84d55a49e842229468b1f08))
* add MPP pay-per-call support via --mpp flag ([70ed3aa](https://github.com/LMTRADES/zerion-agent/commit/70ed3aa718b6bc9ab57ddca959b046c4cbbdfb59))
* add Solana support for x402 pay-per-call ([8afbecc](https://github.com/LMTRADES/zerion-agent/commit/8afbecc2c9f31ed2e6b49987a8548128e34936f1))
* add Solana support for x402 pay-per-call payments ([7d2a3b3](https://github.com/LMTRADES/zerion-agent/commit/7d2a3b3d9109a1f51ba898931e7ce0b352318306))
* add Solana x402 support via @x402/svm ([1741984](https://github.com/LMTRADES/zerion-agent/commit/17419846eb689d12304df32680febbff45af37e8))
* add x402 pay-per-call support ([3c8ab90](https://github.com/LMTRADES/zerion-agent/commit/3c8ab90a9979d81db517206c6e1d163e59d0c8ef))
* implement x402 payment protocol handshake ([20418db](https://github.com/LMTRADES/zerion-agent/commit/20418dbefdb99f62682b6cbc323dbf6ee354a7c5))
* merge wallet CLI into unified zerion-cli ([426ad00](https://github.com/LMTRADES/zerion-agent/commit/426ad000e505c3d905ca81230bb6f285f7351aef))
* support EVM_PRIVATE_KEY + SOLANA_PRIVATE_KEY for dual-chain x402 ([504454f](https://github.com/LMTRADES/zerion-agent/commit/504454fdc5b142c8802f01b95fff9b5e8e98a19e))


### Bug Fixes

* add npm install to release workflow ([040b734](https://github.com/LMTRADES/zerion-agent/commit/040b73457113d2c07e547eab818ffecc56cada4a))
* add npm install to release workflow before tests ([0abcc76](https://github.com/LMTRADES/zerion-agent/commit/0abcc767ed73293240021a3739baa81392a744c6))
* chains is not an integration test, and not pay-per-call ([b0c3e6a](https://github.com/LMTRADES/zerion-agent/commit/b0c3e6ac40132116cb5ad0b87ffef459adea8811))
* clean up three review issues in x402 key handling ([9b87977](https://github.com/LMTRADES/zerion-agent/commit/9b879773d6fa03191d6604c634eb52b7d67862b0))
* correct @x402/fetch and @x402/evm version ranges ([0f3ebd1](https://github.com/LMTRADES/zerion-agent/commit/0f3ebd193e8c135e83bafb5db9bd74fa86533c0d))
* keep trading commands on API key path ([3721ce0](https://github.com/LMTRADES/zerion-agent/commit/3721ce0d30195b2400162caab9a6c26b2797f5a3))
* move EVM key format guard before async imports; merge bash blocks in SKILL.md ([b79d7f7](https://github.com/LMTRADES/zerion-agent/commit/b79d7f79e4f896f522a41e81f742d476ffd5ddf8))
* rename npm package from zerion to zerion-cli ([#10](https://github.com/LMTRADES/zerion-agent/issues/10)) ([e76bfaa](https://github.com/LMTRADES/zerion-agent/commit/e76bfaa3471faf75c2243aa05a5c962a82424dc2))
* **test:** extract JSON from stderr to tolerate Node warnings ([a37463b](https://github.com/LMTRADES/zerion-agent/commit/a37463bb009e09846744e8847b9427b77bbe1b05))
* tighten x402 key validation and base58 decoding ([24018b1](https://github.com/LMTRADES/zerion-agent/commit/24018b118e3bcc4221591204a47e0e75b80b3610))
* validate EVM key format before MPP init ([2f2b397](https://github.com/LMTRADES/zerion-agent/commit/2f2b3976c804117bfc22e264a516266c4d06e158))

## [0.4.2](https://github.com/zeriontech/zerion-ai/compare/v0.4.1...v0.4.2) (2026-04-17)


### Bug Fixes

* add npm install to release workflow ([040b734](https://github.com/zeriontech/zerion-ai/commit/040b73457113d2c07e547eab818ffecc56cada4a))
* add npm install to release workflow before tests ([0abcc76](https://github.com/zeriontech/zerion-ai/commit/0abcc767ed73293240021a3739baa81392a744c6))

## [0.4.1](https://github.com/zeriontech/zerion-ai/compare/v0.4.0...v0.4.1) (2026-04-17)


### Bug Fixes

* rename npm package from zerion to zerion-cli ([#10](https://github.com/zeriontech/zerion-ai/issues/10)) ([e76bfaa](https://github.com/zeriontech/zerion-ai/commit/e76bfaa3471faf75c2243aa05a5c962a82424dc2))

## [0.4.0](https://github.com/zeriontech/zerion-ai/compare/v0.3.0...v0.4.0) (2026-04-16)


### Features

* merge wallet CLI into unified zerion-cli ([426ad00](https://github.com/zeriontech/zerion-ai/commit/426ad000e505c3d905ca81230bb6f285f7351aef))

## [0.3.0](https://github.com/zeriontech/zerion-ai/compare/v0.2.0...v0.3.0) (2026-04-03)


### Features

* add Solana support for x402 pay-per-call ([8afbecc](https://github.com/zeriontech/zerion-ai/commit/8afbecc2c9f31ed2e6b49987a8548128e34936f1))
* add Solana support for x402 pay-per-call payments ([7d2a3b3](https://github.com/zeriontech/zerion-ai/commit/7d2a3b3d9109a1f51ba898931e7ce0b352318306))
* support EVM_PRIVATE_KEY + SOLANA_PRIVATE_KEY for dual-chain x402 ([504454f](https://github.com/zeriontech/zerion-ai/commit/504454fdc5b142c8802f01b95fff9b5e8e98a19e))


### Bug Fixes

* clean up three review issues in x402 key handling ([9b87977](https://github.com/zeriontech/zerion-ai/commit/9b879773d6fa03191d6604c634eb52b7d67862b0))
* move EVM key format guard before async imports; merge bash blocks in SKILL.md ([b79d7f7](https://github.com/zeriontech/zerion-ai/commit/b79d7f79e4f896f522a41e81f742d476ffd5ddf8))
* tighten x402 key validation and base58 decoding ([24018b1](https://github.com/zeriontech/zerion-ai/commit/24018b118e3bcc4221591204a47e0e75b80b3610))
