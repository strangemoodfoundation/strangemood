import * as anchor from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { PublicKey } from "@solana/web3.js";
const { web3 } = anchor;
const { SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

export const pda = {
  mint_authority: async (strangemoodProgramId: PublicKey, mint: PublicKey) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("mint_authority"), mint.toBuffer()],
      strangemoodProgramId
    );
  },

  token_authority: async (
    strangemoodProgramId: PublicKey,
    account: PublicKey
  ) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("token_authority"), account.toBuffer()],
      strangemoodProgramId
    );
  },

  listing: async (strangemoodProgramId: PublicKey, mint: PublicKey) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), mint.toBuffer()],
      strangemoodProgramId
    );
  },

  charter: async (strangemoodProgramId: PublicKey, mint: PublicKey) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("charter"), mint.toBuffer()],
      strangemoodProgramId
    );
  },

  treasury: async (
    strangemoodProgramId: PublicKey,
    cashierOrCharter: PublicKey,
    mint: PublicKey
  ) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury"), cashierOrCharter.toBuffer(), mint.toBuffer()],
      strangemoodProgramId
    );
  },
};
