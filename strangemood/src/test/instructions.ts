import assert from "assert";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program, splitArgsAndCtx } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { TestClient } from "./testClient";
import { makeReceiptNonce } from "..";
import { createMint, createTokenAccount } from "./utils";
import { pda } from "../pda";
import { MAINNET } from "../constants";
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
const { SystemProgram, Keypair, SYSVAR_CLOCK_PUBKEY, Transaction } =
  anchor.web3;

export async function initCharter(
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

  // Hand the mint over to the charter
  const [mint_authority, __] = await pda.mint_authority(
    program.programId,
    charter.mint
  );
  const setAuthorityIx = createSetAuthorityInstruction(
    mint.publicKey,
    program.provider.wallet.publicKey,
    AuthorityType.MintTokens,
    mint_authority
  );
  await program.provider.send(new Transaction().add(setAuthorityIx));

  return {
    account: charter,
    publicKey: charter_pda,
  };
}

export async function createCharterTreasury(
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

export async function initListing(
  program: Program<Strangemood>,
  charter: { account: any; publicKey: PublicKey },
  charterTreasury: { account: any; publicKey: PublicKey },
  paymentMint: PublicKey,
  price: number,
  decimals = 0,
  isRefundable = true,
  isConsumable = false,
  isAvailable = true,
  cashierSplit = 0.1,
  uri = "ipfs://cid"
) {
  const listingMint = Keypair.generate();

  const paymentDeposit = await createTokenAccount(program, paymentMint);
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
      decimals,
      new anchor.BN(price),
      isRefundable,
      isConsumable,
      isAvailable,
      cashierSplit,
      uri
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

  return {
    account: listing,
    publicKey: listing_pda,
  };
}

export async function initCashier(
  program: Program<Strangemood>,
  charter: { account: any; publicKey: PublicKey },
  uri = "ipfs://cashier"
) {
  const stake = Keypair.generate();
  const [cashier_pda, cashier_bump] = await pda.cashier(
    program.programId,
    stake.publicKey
  );
  const [stakeAuthority, stake_authority_bump] = await pda.token_authority(
    program.programId,
    stake.publicKey
  );

  if (!charter) {
    throw new Error("charter is required");
  }

  await program.methods
    .initCashier(stake_authority_bump, uri)
    .accounts({
      cashier: cashier_pda,
      stake: stake.publicKey,
      stakeAuthority,
      charter: charter.publicKey,
      charterMint: charter.account.mint,
      authority: program.provider.wallet.publicKey,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .signers([stake])
    .rpc();

  const cashier = await program.account.cashier.fetch(cashier_pda);
  return {
    account: cashier,
    publicKey: cashier_pda,
    stake: stake,
  };
}
