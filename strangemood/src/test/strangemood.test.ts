import assert from "assert";
import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { TestClient } from "./testClient";

const RECEIPT_SIZE = 171;

describe("strangemood", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const program = anchor.workspace.Strangemood as Program<Strangemood>;
  const client = new TestClient(provider, program);

  before(async () => {
    await client.init();
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
});
