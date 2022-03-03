import * as anchor from "@project-serum/anchor";

export type NET = typeof MAINNET;

export type Environment = {
  strangemood_program_id: anchor.web3.PublicKey;
  strangemood_foundation_charter: anchor.web3.PublicKey;
};

export const MAINNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
  strangemood_foundation_charter: new anchor.web3.PublicKey(
    "D8hxZ192cEtaWBYTQfpLKDtHPUMjd8AVkAAVTdLyLujx"
  ),
};

export const TESTNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
  strangemood_foundation_charter: new anchor.web3.PublicKey(
    "D8hxZ192cEtaWBYTQfpLKDtHPUMjd8AVkAAVTdLyLujx"
  ),
};

export const DEVNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
  strangemood_foundation_charter: new anchor.web3.PublicKey(
    "D8hxZ192cEtaWBYTQfpLKDtHPUMjd8AVkAAVTdLyLujx"
  ),
};
