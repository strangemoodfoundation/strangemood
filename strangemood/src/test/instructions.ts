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
  createMintToInstruction,
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

export async function createCashierTreasury(
  program: Program<Strangemood>,
  charter: PublicKey,
  charterTreasury: PublicKey,
  cashier: PublicKey,
  mint: PublicKey
) {
  const deposit = await createTokenAccount(program, mint);

  const escrow = Keypair.generate();
  const [escrow_authority, bump] = await pda.token_authority(
    program.programId,
    escrow.publicKey
  );
  const [treasury_pda, _] = await pda.treasury(
    program.programId,
    cashier,
    mint
  );

  await program.methods
    .initCashierTreasury(bump)
    .accounts({
      cashierTreasury: treasury_pda,
      cashier: cashier,
      charterTreasury: charterTreasury,
      charter: charter,
      deposit: deposit.publicKey,
      escrow: escrow.publicKey,
      escrowAuthority: escrow_authority,
      mint: mint,
      clock: SYSVAR_CLOCK_PUBKEY,
      authority: program.provider.wallet.publicKey,
    })
    .signers([escrow])
    .rpc();
  const treasury = await program.account.cashierTreasury.fetch(treasury_pda);

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

export async function purchase(
  program: Program<Strangemood>,
  charter: { account: any; publicKey: PublicKey },
  charterTreasury: { account: any; publicKey: PublicKey },
  listing: { account: any; publicKey: PublicKey },
  payment: PublicKey,
  quantity: number
) {
  const inventory = await createTokenAccount(program, listing.account.mint);

  const [listing_mint_authority, listing_mint_authority_bump] =
    await pda.mint_authority(program.programId, listing.account.mint);

  const [charter_mint_authority, charter_mint_authority_bump] =
    await pda.mint_authority(program.programId, charter.account.mint);

  const [inventory_delegate, inventory_delegate_bump] =
    await pda.token_authority(program.programId, inventory.publicKey);

  // purchase the listing
  await program.methods
    .purchase(
      listing_mint_authority_bump,
      charter_mint_authority_bump,
      inventory_delegate_bump,
      new anchor.BN(quantity)
    )
    .accounts({
      payment: payment,
      inventory: inventory.publicKey,
      inventoryDelegate: inventory_delegate,
      listingsPaymentDeposit: listing.account.paymentDeposit,
      listingsVoteDeposit: listing.account.voteDeposit,
      listing: listing.publicKey,
      listingMint: listing.account.mint,
      listingMintAuthority: listing_mint_authority,
      charter: charter.publicKey,
      charterTreasury: charterTreasury.publicKey,
      charterTreasuryDeposit: charterTreasury.account.deposit,
      charterReserve: charter.account.reserve,
      charterMint: charter.account.mint,
      charterMintAuthority: charter_mint_authority,
      purchaser: program.provider.wallet.publicKey,
    })
    .rpc();

  return {
    inventory,
  };
}

export async function mintTo(
  program: Program<Strangemood>,
  mint: PublicKey,
  to: PublicKey,
  amount: number
) {
  const fundAccountIx = createMintToInstruction(
    mint,
    to,
    program.provider.wallet.publicKey,
    amount
  );
  await program.provider.send(new Transaction().add(fundAccountIx));
}
