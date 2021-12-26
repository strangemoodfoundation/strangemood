import * as anchor from "@project-serum/anchor";
import fs from "fs/promises";

// Test utility for deploying external programs (like the governance program)
// onto the local test validator for tests.
export async function deployProgram(
  conn: anchor.web3.Connection,
  path: string
) {
  // Create a signer with a bunch of lamports
  const signer = anchor.web3.Keypair.generate();
  console.log(signer);
  let signature = await conn.requestAirdrop(
    signer.publicKey,
    anchor.web3.LAMPORTS_PER_SOL * 10
  );
  await conn.confirmTransaction(signature);

  if (
    (await conn.getBalance(signer.publicKey)) !=
    anchor.web3.LAMPORTS_PER_SOL * 10
  ) {
    throw new Error("Failed to airdrop enough for the program");
  }

  const program = anchor.web3.Keypair.generate();
  const data = await fs.readFile(path);
  await anchor.web3.BpfLoader.load(
    conn,
    signer,
    program,
    data,
    anchor.web3.BPF_LOADER_PROGRAM_ID
  );

  return program.publicKey;
}
