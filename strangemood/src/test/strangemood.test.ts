import assert from "assert";
import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program, splitArgsAndCtx } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { TestClient } from "./testClient";
import { fetchStrangemoodProgram, makeReceiptNonce } from "..";
import { createMint, createTokenAccount } from "./utils";
import { pda } from "../pda";
import { MAINNET } from "../constants";
const { SystemProgram, Keypair } = anchor.web3;

describe("no nonce buffer bug", () => {
  const nonce = makeReceiptNonce();
  nonce.toBuffer();
});

async function createCharter(
  program: Program<Strangemood>,
  expansionRate: number,
  paymentContribution: number,
  voteContribution: number,
  withdrawPeriod: anchor.BN,
  stakeWithdrawAmount: anchor.BN,
  uri: string
) {
  const mint = await createMint(program);
  const reserve = await createTokenAccount(program, mint.publicKey);

  const [charter_pda, _] = await pda.charter(program.programId, mint.publicKey);

  await program.methods
    .initCharter(
      expansionRate,
      paymentContribution,
      voteContribution,
      withdrawPeriod,
      stakeWithdrawAmount,
      uri
    )
    .accounts({
      charter: charter_pda,
      mint: mint.publicKey,
      authority: program.provider.wallet.publicKey,
      reserve: reserve.publicKey,
      user: program.provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const charter = await program.account.charter.fetch(charter_pda);

  return {
    account: charter,
    pubkey: charter_pda,
  };
}

describe("Strangemood", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const program = anchor.workspace.Strangemood as Program<Strangemood>;

  it("init_charter", async () => {
    const mint = await createMint(program);
    const reserve = await createTokenAccount(program, mint.publicKey);

    const [charter_pda, _] = await pda.charter(
      program.programId,
      mint.publicKey
    );

    await program.methods
      .initCharter(
        10,
        0.01,
        0.2,
        new anchor.BN(1),
        new anchor.BN(1),
        "https://strangemood.org"
      )
      .accounts({
        charter: charter_pda,
        mint: mint.publicKey,
        authority: program.provider.wallet.publicKey,
        reserve: reserve.publicKey,
        user: program.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const charter = await program.account.charter.fetch(charter_pda);

    assert.equal(
      charter.authority.toString(),
      program.provider.wallet.publicKey.toString()
    );
    assert.equal(charter.mint.toString(), mint.publicKey.toString());
    assert.equal(charter.reserve.toString(), reserve.publicKey.toString());
    assert.equal(charter.expansionRate, 10);
    assert.equal(charter.paymentContribution, 0.01);
    assert.equal(charter.voteContribution, 0.2);
    assert.equal(charter.uri, "https://strangemood.org");
  });

  // it("init_charter_treasury", async () => {
  //   const charter = await createCharter(
  //     program,
  //     10,
  //     0.01,
  //     0.2,
  //     new anchor.BN(1),
  //     new anchor.BN(1),
  //     "https://strangemood.org"
  //   );

  // });
});
