import assert from "assert";
import * as anchor from "@project-serum/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import { TestClient } from "./testClient";
import { Token } from "@solana/spl-token";

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
    console.log("It can make a listing");
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
    const keypair = anchor.web3.Keypair.generate();
    let token = new Token(
      provider.connection,
      l.mint,
      splToken.TOKEN_PROGRAM_ID,
      keypair
    );
    const mint = await token.getMintInfo();

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

    console.log("listing", listing.toString());

    const purchaser = anchor.web3.Keypair.generate();
    const cashier = anchor.web3.Keypair.generate();
    const { receipt } = await client.purchase({
      listing,
      cashier: cashier.publicKey,
      purchaser: purchaser,
    });

    const r = await program.account.receipt.fetch(receipt);
    assert.equal(r.isInitialized, true, "is initialized");
    assert.equal(r.isRefundable, false, "is refundable");
    assert.equal(r.isCashable, true, "is cashable");
  });
});
