import assert from "assert";
import { PublicKey } from "@solana/web3.js";
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
    publicKey: charter_pda,
  };
}

async function createCharterTreasury(
  program: Program<Strangemood>,
  charter: PublicKey,
  mint: PublicKey
) {
  const [treasury_pda, _] = await pda.treasury(
    program.programId,
    charter,
    mint
  );
  const deposit = await createTokenAccount(program, mint);

  await program.methods
    .initCharterTreasury(1.0)
    .accounts({
      treasury: treasury_pda,
      mint: mint,
      deposit: deposit.publicKey,
      charter: charter,
    })
    .rpc();
  const treasury = await program.account.charterTreasury.fetch(treasury_pda);

  return {
    account: treasury,
    publicKey: treasury_pda,
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
    assert.equal(charter.withdrawPeriod.toNumber(), 1);
    assert.equal(charter.stakeWithdrawAmount.toNumber(), 1);
  });

  it("init_charter_treasury", async () => {
    const charter = await createCharter(
      program,
      10,
      0.01,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );

    const mint = await createMint(program);
    const deposit = await createTokenAccount(program, mint.publicKey);

    const [treasury_pda, _] = await pda.treasury(
      program.programId,
      charter.publicKey,
      mint.publicKey
    );

    await program.methods
      .initCharterTreasury(1.0)
      .accounts({
        treasury: treasury_pda,
        mint: mint.publicKey,
        deposit: deposit.publicKey,
        charter: charter.publicKey,
      })
      .rpc();
    const treasury = await program.account.charterTreasury.fetch(treasury_pda);

    assert.equal(treasury.charter.toString(), charter.publicKey.toString());
    assert.equal(treasury.deposit.toString(), deposit.publicKey.toString());
    assert.equal(treasury.mint.toString(), mint.publicKey.toString());
    assert.equal(treasury.scalar, 1.0);
  });

  it("can't create two charter treasuries of the same type", async () => {
    const charter = await createCharter(
      program,
      10,
      0.01,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );

    const mint = await createMint(program);
    const deposit = await createTokenAccount(program, mint.publicKey);

    const [treasury_pda, _] = await pda.treasury(
      program.programId,
      charter.publicKey,
      mint.publicKey
    );

    await program.methods
      .initCharterTreasury(1.0)
      .accounts({
        treasury: treasury_pda,
        mint: mint.publicKey,
        deposit: deposit.publicKey,
        charter: charter.publicKey,
      })
      .rpc();

    // Try again with the same PDA.
    let errored = false;
    try {
      await program.methods
        .initCharterTreasury(1.0)
        .accounts({
          treasury: treasury_pda,
          mint: mint.publicKey,
          deposit: deposit.publicKey,
          charter: charter.publicKey,
        })
        .rpc();
    } catch (err) {
      errored = true;
    }
    assert(errored);
  });

  it("init_listing", async () => {
    const charter = await createCharter(
      program,
      10,
      0.01,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );

    const listingMint = Keypair.generate();
    const paymentMint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      paymentMint.publicKey
    );

    const paymentDeposit = await createTokenAccount(
      program,
      paymentMint.publicKey
    );
    const voteDeposit = await createTokenAccount(program, charter.account.mint);

    const [mint_authority, mint_authority_bump] = await pda.mint_authority(
      program.programId,
      listingMint.publicKey
    );
    const [listing_pda, _] = await pda.listing(
      program.programId,
      listingMint.publicKey
    );

    await program.methods
      .initListing(
        mint_authority_bump,
        0,
        new anchor.BN(10),
        false,
        false,
        true,
        0.1,
        "ipfs://somecid"
      )
      .accounts({
        listing: listing_pda,
        mintAuthority: mint_authority,
        mint: listingMint.publicKey,
        paymentDeposit: paymentDeposit.publicKey,
        voteDeposit: voteDeposit.publicKey,
        charter: charter.publicKey,
        charterTreasury: charterTreasury.publicKey,
        user: program.provider.wallet.publicKey,
      })
      .signers([listingMint])
      .rpc();

    const listing = await program.account.listing.fetch(listing_pda);
    assert.equal(
      listing.authority.toString(),
      program.provider.wallet.publicKey.toString()
    );
    assert.equal(listing.charter.toString(), charter.publicKey.toString());
    assert.equal(
      listing.paymentDeposit.toString(),
      paymentDeposit.publicKey.toString()
    );
    assert.equal(
      listing.voteDeposit.toString(),
      voteDeposit.publicKey.toString()
    );
    assert.equal(listing.mint.toString(), listingMint.publicKey.toString());
    assert.equal(listing.isRefundable, false);
    assert.equal(listing.isConsumable, false);
    assert.equal(listing.isAvailable, true);
    assert.equal(listing.cashierSplit, 0.1);
    assert.equal(listing.uri, "ipfs://somecid");
    assert.equal(listing.price.toNumber(), 10);
  });
});
