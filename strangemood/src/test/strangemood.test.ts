import assert from "assert";
import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { TestClient } from "./testClient";
import { fetchStrangemoodProgram, makeReceiptNonce } from "..";
import { createMint, createTokenAccount } from "./utils";
import { pda } from "../pda";
import { MAINNET } from "../constants";
const { SystemProgram } = anchor.web3;

const RECEIPT_SIZE = 171;

describe("no nonce buffer bug", () => {
  const nonce = makeReceiptNonce();
  nonce.toBuffer();
});

describe("strangemood", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const program = anchor.workspace.Strangemood as Program<Strangemood>;
  const client = new TestClient(provider, program);

  before(async () => {
    await client.init();
  });

  it("created charter correctly", async () => {
    const charter = await program.account.charter.fetch(client.charter_pda);
    assert.equal(charter.mint.toString(), client.realm_mint.toString());
  });

  it("can create a new treasury", async () => {
    let charter = await program.account.charter.fetch(client.charter_pda);

    let mint = await createMint(program);
    let myDeposit = await createTokenAccount(program, mint.publicKey);

    let [treasury_pda, bump] = await pda.treasury(
      program.programId,
      client.charter_pda,
      mint.publicKey
    );

    await program.rpc.initCharterTreasury(bump, new anchor.BN(1), 0, {
      accounts: {
        treasury: treasury_pda,
        charter: client.charter_pda,
        mint: mint.publicKey,
        deposit: myDeposit.publicKey,
        systemProgram: SystemProgram.programId,
        authority: charter.authority,
      },
    });

    let treasury = await program.account.charterTreasury.fetch(treasury_pda);

    assert.equal(treasury.deposit.toString(), myDeposit.publicKey.toString());
    assert.equal(treasury.charter.toString(), client.charter_pda.toString());
    assert.equal(treasury.expansionScalarAmount.toNumber(), 1);
    assert.equal(treasury.expansionScalarDecimals, 0);

    // can set the treasury to another treasury
    let anotherDeposit = await createTokenAccount(program, mint.publicKey);
    await program.rpc.setCharterTreasuryDeposit({
      accounts: {
        treasury: treasury_pda,
        charter: client.charter_pda,
        mint: mint.publicKey,
        deposit: anotherDeposit.publicKey,
        systemProgram: SystemProgram.programId,
        authority: charter.authority,
      },
    });
    treasury = await program.account.charterTreasury.fetch(treasury_pda);
    assert.equal(
      treasury.deposit.toString(),
      anotherDeposit.publicKey.toString()
    );

    // Can change the expansion scalar
    await program.rpc.setCharterTreasuryExpansionScalar(new anchor.BN(25), 1, {
      accounts: {
        treasury: treasury_pda,
        charter: client.charter_pda,
        systemProgram: SystemProgram.programId,
        authority: charter.authority,
      },
    });
    treasury = await program.account.charterTreasury.fetch(treasury_pda);
    assert.equal(treasury.expansionScalarAmount.toNumber(), 25);
    assert.equal(treasury.expansionScalarDecimals, 1);
  });

  it("can't create another charter with the same mint", async () => {
    // Create charter
    let [charterPDA, charterBump] = await pda.charter(
      program.programId,
      client.realm_mint
    );

    let myNefariousPaymentAccount = await createTokenAccount(
      program,
      splToken.NATIVE_MINT
    );
    let myNefariousVoteAccount = await createTokenAccount(
      program,
      client.realm_mint
    );

    let throws = false;
    try {
      await program.rpc.initCharter(
        charterBump,
        new anchor.BN(30), // Expansion amount
        0, // expansion decimals
        new anchor.BN(6), // sol contribution amount
        3, // sol contribution decimals
        new anchor.BN(2), // vote contribution amount
        1, // vote contribution decimals
        "https://strangemood.org",
        {
          accounts: {
            charter: charterPDA,
            authority: program.provider.wallet.publicKey,
            voteDeposit: myNefariousVoteAccount.publicKey,
            mint: client.realm_mint,
            user: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          },
        }
      );
    } catch (err) {
      throws = true;
    }
    assert.equal(throws, true, "Expected initCharter to throw");
  });

  it("can make a listing", async () => {
    const { listing } = await client.initListing(
      {},
      {
        price: new anchor.BN(10),
        decimals: 3,
        uri: "ipfs://somecid",
        is_consumable: true,
        is_refundable: false,
        is_available: true,
      }
    );

    const l = await program.account.listing.fetch(listing);

    let mint = await splToken.getMint(provider.connection, l.mint);

    assert.equal(mint.decimals, 3);
    assert.equal(l.price.toNumber(), new anchor.BN(10).toNumber());
    assert.equal(l.uri, "ipfs://somecid");
    assert.equal(l.isConsumable, true, "should be consumable");
    assert.equal(l.isRefundable, false, "not refundable");
    assert.equal(l.isAvailable, true, "is unexpectedly not available");
    assert.equal(
      l.charter.toString(),
      client.charter_pda.toString(),
      "is not created with this charter"
    );
  });

  it("can create a receipt", async () => {
    const { listing } = await client.initListing(
      {},
      {
        price: new anchor.BN(10),
        decimals: 3,
        uri: "ipfs://somecid",
        is_consumable: true,
        is_refundable: false,
        is_available: true,
      }
    );

    const purchaser = anchor.web3.Keypair.generate();
    const cashier = anchor.web3.Keypair.generate();
    const { receipt, listingTokenAccount } = await client.purchase(
      {
        listing,
        cashier: cashier.publicKey,
        purchaser: purchaser,
      },
      10
    );

    const r = await program.account.receipt.fetch(receipt);
    assert.equal(r.isInitialized, true, "is initialized");
    assert.equal(r.isRefundable, false, "is refundable");
    assert.equal(r.isCashable, true, "is cashable");
    assert.equal(r.price.toNumber(), 10, "price is not 10");
    assert.equal(r.listing.toString(), listing.toString());
    assert.equal(
      r.listingTokenAccount.toString(),
      listingTokenAccount.toString()
    );
    assert.equal(r.cashier.toString(), cashier.publicKey.toString());
    assert.equal(r.purchaser.toString(), purchaser.publicKey.toString());

    const l = await program.account.listing.fetch(listing);
    const receiptBalance = await program.provider.connection.getBalance(
      receipt
    );

    assert.equal(
      l.price.toNumber() * 10 +
        (await program.provider.connection.getMinimumBalanceForRentExemption(
          RECEIPT_SIZE
        )),
      receiptBalance,
      "not enough funds in the receipt"
    );
  });

  it("can close a receipt", async () => {
    // Create a new listing
    const { listing } = await client.initListing(
      {},
      {
        price: new anchor.BN(10),
        decimals: 3,
        uri: "ipfs://somecid",
        is_consumable: true,
        is_refundable: false,
        is_available: true,
      }
    );

    // Create the receipt for the listing
    const purchaser = anchor.web3.Keypair.generate();
    const cashier = anchor.web3.Keypair.generate();
    const { receipt } = await client.purchase(
      {
        listing,
        cashier: cashier.publicKey,
        purchaser: purchaser,
      },
      1
    );
  });

  it("can cash a receipt", async () => {
    // Create a new listing
    const { listing } = await client.initListing(
      {},
      {
        price: new anchor.BN(10),
        decimals: 3,
        uri: "ipfs://somecid",
        is_consumable: true,
        is_refundable: false,
        is_available: true,
      }
    );

    // Create the receipt for the listing
    const purchaser = anchor.web3.Keypair.generate();
    const cashier = anchor.web3.Keypair.generate();
    const { receipt } = await client.purchase(
      {
        listing,
        cashier: cashier.publicKey,
        purchaser: purchaser,
      },
      1
    );

    assert.equal(
      await program.provider.connection.getBalance(receipt),
      10 +
        (await client.provider.connection.getMinimumBalanceForRentExemption(
          RECEIPT_SIZE
        ))
    );

    await client.cash({
      cashier: cashier,
      receipt: receipt,
    });

    assert.equal(await program.provider.connection.getBalance(receipt), 0);
  });

  it("Can update charter deposits", async () => {
    const voteDeposit = await createTokenAccount(program, client.realm_mint);

    let charter = await program.account.charter.fetch(client.charter_pda);

    assert.notEqual(
      charter.voteDeposit.toString(),
      voteDeposit.publicKey.toString()
    );

    await client.setCharterDeposit({
      authority: provider.wallet.publicKey,
      voteDeposit: voteDeposit.publicKey,
    });

    charter = await program.account.charter.fetch(client.charter_pda);
    assert.equal(
      charter.voteDeposit.toString(),
      voteDeposit.publicKey.toString()
    );
  });
});
