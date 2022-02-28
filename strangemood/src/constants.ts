import * as anchor from "@project-serum/anchor";

export type NET = typeof MAINNET;

export type Environment = {
  strangemood_program_id: anchor.web3.PublicKey;
};

export const MAINNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
};

export const TESTNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
};

export const DEVNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx"
  ),
};
