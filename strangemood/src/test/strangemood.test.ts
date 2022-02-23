import assert from "assert";
import * as splToken from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { makeReceiptNonce } from "..";
import { createMint, createTokenAccount } from "./utils";
import { pda } from "../pda";
import {
  initCharter,
  createCharterTreasury,
  initCashier,
  initListing,
  mintTo,
  purchase,
  createCashierTreasury,
} from "./instructions";

const { SystemProgram, Keypair, SYSVAR_CLOCK_PUBKEY, Transaction } =
  anchor.web3;

describe("no nonce buffer bug", () => {
  const nonce = makeReceiptNonce();
  nonce.toBuffer();
});

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
    const charter = await initCharter(
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
    const charter = await initCharter(
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
    const charter = await initCharter(
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

  it("init_cashier", async () => {
    const charter = await initCharter(
      program,
      10,
      0.01,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );

    const stake = Keypair.generate();
    const [cashier_pda, cashier_bump] = await pda.cashier(
      program.programId,
      stake.publicKey
    );
    const [stakeAuthority, stake_authority_bump] = await pda.token_authority(
      program.programId,
      stake.publicKey
    );

    await program.methods
      .initCashier(stake_authority_bump, "ipfs://cashier")
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
    assert.equal(
      cashier.authority.toString(),
      program.provider.wallet.publicKey.toString()
    );
    assert.equal(cashier.charter.toString(), charter.publicKey.toString());
    assert.equal(cashier.stake.toString(), stake.publicKey.toString());
    assert.equal(cashier.lastWithdrawAt, 0);
    assert.equal(cashier.uri, "ipfs://cashier");
  });

  it("init_cashier_treasury", async () => {
    const charter = await initCharter(
      program,
      10,
      0.01,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );

    assert.equal(charter.account.uri, "https://strangemood.org");
    if (!charter) {
      throw new Error("charter not initialized");
    }

    const cashier = await initCashier(program, charter);
    const mint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      mint.publicKey
    );
    const deposit = await createTokenAccount(program, mint.publicKey);

    const escrow = Keypair.generate();
    const [escrow_authority, bump] = await pda.token_authority(
      program.programId,
      escrow.publicKey
    );
    const [cashier_treasury_pda, _] = await pda.treasury(
      program.programId,
      cashier.publicKey,
      mint.publicKey
    );

    await program.methods
      .initCashierTreasury(bump)
      .accounts({
        cashierTreasury: cashier_treasury_pda,
        cashier: cashier.publicKey,
        charterTreasury: charterTreasury.publicKey,
        charter: charter.publicKey,
        deposit: deposit.publicKey,
        escrow: escrow.publicKey,
        escrowAuthority: escrow_authority,
        mint: mint.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        authority: program.provider.wallet.publicKey,
      })
      .signers([escrow])
      .rpc();

    const cashierTreasury = await program.account.cashierTreasury.fetch(
      cashier_treasury_pda
    );

    assert.equal(
      cashierTreasury.cashier.toString(),
      cashier.publicKey.toString(),
      "cashier does not match"
    );
    assert.equal(
      cashierTreasury.deposit.toString(),
      deposit.publicKey.toString(),
      "deposit does not match"
    );
    assert.equal(
      cashierTreasury.escrow.toString(),
      escrow.publicKey.toString(),
      "escrow does not match"
    );
    assert.equal(
      cashierTreasury.mint.toString(),
      mint.publicKey.toString(),
      "mint does not match"
    );
    assert.equal(
      cashierTreasury.lastWithdrawAt,
      0,
      "lastWithdrawAt does not match"
    );
  });

  it("can purchase a listing without a cashier", async () => {
    const charter = await initCharter(
      program,
      10,
      0.4,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );
    const paymentMint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      paymentMint.publicKey
    );
    const listing = await initListing(
      program,
      charter,
      charterTreasury,
      paymentMint.publicKey,
      10
    );

    const inventory = await createTokenAccount(program, listing.account.mint);
    const payment = await createTokenAccount(program, paymentMint.publicKey);

    const [listing_mint_authority, listing_mint_authority_bump] =
      await pda.mint_authority(program.programId, listing.account.mint);

    const [charter_mint_authority, charter_mint_authority_bump] =
      await pda.mint_authority(program.programId, charter.account.mint);

    const [inventory_delegate, inventory_delegate_bump] =
      await pda.token_authority(program.programId, inventory.publicKey);

    // Mint payment tokens into the payment account
    await mintTo(program, paymentMint.publicKey, payment.publicKey, 100);

    // Check we have the funds to pay for the listing
    let before = await splToken.getAccount(
      program.provider.connection,
      payment.publicKey
    );
    assert.equal(before.amount, 100);

    // purchase the listing
    await program.methods
      .purchase(
        listing_mint_authority_bump,
        charter_mint_authority_bump,
        inventory_delegate_bump,
        new anchor.BN(1)
      )
      .accounts({
        payment: payment.publicKey,
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

    // check the account was charged
    let after = await splToken.getAccount(
      program.provider.connection,
      payment.publicKey
    );
    assert.equal(after.amount, 90);

    // Check that the inventory has the token
    let inventoryAccount = await splToken.getAccount(
      program.provider.connection,
      inventory.publicKey
    );
    assert.equal(inventoryAccount.amount, 1);

    // Check that the listing payment deposit was paid
    let listingDeposit = await splToken.getAccount(
      program.provider.connection,
      listing.account.paymentDeposit
    );
    assert.equal(listingDeposit.amount, 6);

    // Check that the charter deposit was paid
    let charterDeposit = await splToken.getAccount(
      program.provider.connection,
      charterTreasury.account.deposit
    );
    assert.equal(charterDeposit.amount, 4);
  });

  it("can purchase a listing with a cashier", async () => {
    const charter = await initCharter(
      program,
      10,
      0.4,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );
    const paymentMint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      paymentMint.publicKey
    );
    const listing = await initListing(
      program,
      charter,
      charterTreasury,
      paymentMint.publicKey,
      10,
      0,
      true,
      false,
      true,
      0.5
    );
    const cashier = await initCashier(program, charter);
    const cashierTreasury = await createCashierTreasury(
      program,
      charter.publicKey,
      charterTreasury.publicKey,
      cashier.publicKey,
      paymentMint.publicKey
    );

    const inventory = await createTokenAccount(program, listing.account.mint);
    const payment = await createTokenAccount(program, paymentMint.publicKey);

    const [listing_mint_authority, listing_mint_authority_bump] =
      await pda.mint_authority(program.programId, listing.account.mint);

    const [charter_mint_authority, charter_mint_authority_bump] =
      await pda.mint_authority(program.programId, charter.account.mint);

    const [inventory_delegate, inventory_delegate_bump] =
      await pda.token_authority(program.programId, inventory.publicKey);

    // Mint payment tokens into the payment account
    await mintTo(program, paymentMint.publicKey, payment.publicKey, 100);

    // Check we have the funds to pay for the listing
    let before = await splToken.getAccount(
      program.provider.connection,
      payment.publicKey
    );
    assert.equal(before.amount, 100);

    // purchase the listing
    await program.methods
      .purchaseWithCashier(
        listing_mint_authority_bump,
        charter_mint_authority_bump,
        inventory_delegate_bump,
        new anchor.BN(1)
      )
      .accounts({
        cashier: cashier.publicKey,
        cashierTreasury: cashierTreasury.publicKey,
        cashierTreasuryEscrow: cashierTreasury.account.escrow,
        payment: payment.publicKey,
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

    // check the account was charged
    let after = await splToken.getAccount(
      program.provider.connection,
      payment.publicKey
    );
    assert.equal(after.amount, 90);

    // Check that the inventory has the token
    let inventoryAccount = await splToken.getAccount(
      program.provider.connection,
      inventory.publicKey
    );
    assert.equal(inventoryAccount.amount, 1);

    // Check that the listing payment deposit was paid
    let listingDeposit = await splToken.getAccount(
      program.provider.connection,
      listing.account.paymentDeposit
    );
    assert.equal(listingDeposit.amount, 3);

    // Check that the listing payment deposit was paid
    let cashierDeposit = await splToken.getAccount(
      program.provider.connection,
      cashierTreasury.account.escrow
    );
    assert.equal(cashierDeposit.amount, 3);

    // Check that the charter deposit was paid
    let charterDeposit = await splToken.getAccount(
      program.provider.connection,
      charterTreasury.account.deposit
    );
    assert.equal(charterDeposit.amount, 4);
  });

  it("can purchase a listing, and then consume that listing", async () => {
    const charter = await initCharter(
      program,
      10,
      0.4,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );
    const paymentMint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      paymentMint.publicKey
    );
    const listing = await initListing(
      program,
      charter,
      charterTreasury,
      paymentMint.publicKey,
      1,
      0,
      true,
      true
    );

    // Mint payment tokens into the payment account
    const payment = await createTokenAccount(program, paymentMint.publicKey);
    await mintTo(program, paymentMint.publicKey, payment.publicKey, 100);

    // purchase the listing
    const { inventory } = await purchase(
      program,
      charter,
      charterTreasury,
      listing,
      payment.publicKey,
      5
    );

    let before = await splToken.getAccount(
      program.provider.connection,
      inventory.publicKey
    );
    assert.equal(before.amount, 5);

    let [inventory_delegate, inventory_delegate_bump] =
      await pda.token_authority(program.programId, inventory.publicKey);

    let [mint_authority, mint_authority_bump] = await pda.mint_authority(
      program.programId,
      listing.account.mint
    );

    // Consume the listing
    await program.methods
      .consume(mint_authority_bump, inventory_delegate_bump, new anchor.BN(3))
      .accounts({
        inventory: inventory.publicKey,
        mint: listing.account.mint,
        mintAuthority: mint_authority,
        inventoryDelegate: inventory_delegate,
        listing: listing.publicKey,
        authority: listing.account.authority,
      })
      .rpc();

    let after = await splToken.getAccount(
      program.provider.connection,
      inventory.publicKey
    );
    assert.equal(after.amount, 2);
  });

  it("can start_trial, and then finish_trial", async () => {
    const charter = await initCharter(
      program,
      10,
      0.4,
      0.2,
      new anchor.BN(1),
      new anchor.BN(1),
      "https://strangemood.org"
    );
    const paymentMint = await createMint(program);
    const charterTreasury = await createCharterTreasury(
      program,
      charter.publicKey,
      paymentMint.publicKey
    );
    const listing = await initListing(
      program,
      charter,
      charterTreasury,
      paymentMint.publicKey,
      1,
      0,
      true,
      true
    );

    const inventory = await createTokenAccount(program, listing.account.mint);

    // Mint payment tokens into the payment account
    const payment = await createTokenAccount(program, paymentMint.publicKey);
    await mintTo(program, paymentMint.publicKey, payment.publicKey, 100);

    // start the trial
    const escrow = Keypair.generate();
    const [listing_mint_authority, listing_mint_authority_bump] =
      await pda.mint_authority(program.programId, listing.account.mint);
    const [escrow_authority, escrow_authority_bump] = await pda.token_authority(
      program.programId,
      escrow.publicKey
    );
    const [inventory_delegate, inventory_delegate_bump] =
      await pda.token_authority(program.programId, inventory.publicKey);

    const [receipt, _] = await pda.receipt(program.programId, escrow.publicKey);
    await program.methods
      .startTrial(
        listing_mint_authority_bump,
        escrow_authority_bump,
        inventory_delegate_bump,
        new anchor.BN(10)
      )
      .accounts({
        payment: payment.publicKey,
        listing: listing.publicKey,
        listingPaymentDeposit: listing.account.paymentDeposit,
        listingPaymentDepositMint: paymentMint.publicKey,
        listingMint: listing.account.mint,
        listingMintAuthority: listing_mint_authority,
        inventory: inventory.publicKey,
        inventoryDelegate: inventory_delegate,
        receipt: receipt,
        escrow: escrow.publicKey,
        escrowAuthority: escrow_authority,
        purchaser: program.provider.wallet.publicKey,
      })
      .signers([escrow])
      .rpc();

    // Account is charged
    let after = await splToken.getAccount(
      program.provider.connection,
      payment.publicKey
    );
    assert.equal(after.amount, 90);

    // Check that the inventory has the token
    let inventoryAccount = await splToken.getAccount(
      program.provider.connection,
      inventory.publicKey
    );
    assert.equal(inventoryAccount.amount, 10);

    // Check that the funds are in the receipt escrow
    let escrowAccount = await splToken.getAccount(
      program.provider.connection,
      escrow.publicKey
    );
    assert.equal(escrowAccount.amount, 10);
  });
});
