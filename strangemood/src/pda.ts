import * as anchor from "@project-serum/anchor";
export { Strangemood } from "../target/types/strangemood";
import { PublicKey } from "@solana/web3.js";
const { web3 } = anchor;
const { SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

export const pda = {
  mint: async (strangemoodProgramId: PublicKey, mint: PublicKey) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), mint.toBuffer()],
      strangemoodProgramId
    );
  },

  listing: async (strangemoodProgramId: PublicKey, mint: PublicKey) => {
    return web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), mint.toBuffer()],
      strangemoodProgramId
    );
  },

  charter: async (
    strangemoodProgramId: PublicKey,
    governanceProgramId: PublicKey,
    realmId: PublicKey
  ) => {
    return web3.PublicKey.findProgramAddress(
      [
        Buffer.from("charter"),
        governanceProgramId.toBuffer(),
        realmId.toBuffer(),
      ],
      strangemoodProgramId
    );
  },
};
