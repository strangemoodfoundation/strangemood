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
const { SystemProgram } = anchor.web3;

const RECEIPT_SIZE = 203;

// describe("no nonce buffer bug", () => {
//   const nonce = makeReceiptNonce();
//   nonce.toBuffer();
// });

// describe("strangemood", () => {
//   const provider = anchor.Provider.env();
//   // Configure the client to use the local cluster.
//   anchor.setProvider(provider);

//   const program = anchor.workspace.Strangemood as Program<Strangemood>;
//   const client = new TestClient(provider, program);

//   let dummy_mint: anchor.web3.PublicKey;
//   let dummy_treasury: anchor.web3.PublicKey;

//   before(async () => {
//     await client.init();

//     dummy_mint = await client.createMint();
//     dummy_treasury = await client.createTreasury(
//       dummy_mint,
//       new anchor.BN(1),
//       0
//     );
//   });

//   it("created charter correctly", async () => {
//     const charter = await program.account.charter.fetch(client.charter_pda);
//     assert.equal(charter.mint.toString(), client.realm_mint.toString());
//   });

//   it("can create a new treasury", async () => {
//     let charter = await program.account.charter.fetch(client.charter_pda);

//     let mint = await createMint(program);
//     let myDeposit = await createTokenAccount(program, mint.publicKey);

//     let [treasury_pda, bump] = await pda.treasury(
//       program.programId,
//       client.charter_pda,
//       mint.publicKey
//     );

//     await program.rpc.initCharterTreasury(bump, new anchor.BN(1), 0, {
//       accounts: {
//         treasury: treasury_pda,
//         charter: client.charter_pda,
//         mint: mint.publicKey,
//         deposit: myDeposit.publicKey,
//         systemProgram: SystemProgram.programId,
//         authority: charter.authority,
//       },
//     });

//     let treasury = await program.account.charterTreasury.fetch(treasury_pda);

//     assert.equal(treasury.deposit.toString(), myDeposit.publicKey.toString());
//     assert.equal(treasury.charter.toString(), client.charter_pda.toString());
//     assert.equal(treasury.expansionScalarAmount.toNumber(), 1);
//     assert.equal(treasury.expansionScalarDecimals, 0);

//     // can set the treasury to another treasury
//     let anotherDeposit = await createTokenAccount(program, mint.publicKey);
//     await program.rpc.setCharterTreasuryDeposit({
//       accounts: {
//         treasury: treasury_pda,
//         charter: client.charter_pda,
//         mint: mint.publicKey,
//         deposit: anotherDeposit.publicKey,
//         systemProgram: SystemProgram.programId,
//         authority: charter.authority,
//       },
//     });
//     treasury = await program.account.charterTreasury.fetch(treasury_pda);
//     assert.equal(
//       treasury.deposit.toString(),
//       anotherDeposit.publicKey.toString()
//     );

//     // Can change the expansion scalar
//     await program.rpc.setCharterTreasuryExpansionScalar(new anchor.BN(25), 1, {
//       accounts: {
//         treasury: treasury_pda,
//         charter: client.charter_pda,
//         systemProgram: SystemProgram.programId,
//         authority: charter.authority,
//       },
//     });
//     treasury = await program.account.charterTreasury.fetch(treasury_pda);
//     assert.equal(treasury.expansionScalarAmount.toNumber(), 25);
//     assert.equal(treasury.expansionScalarDecimals, 1);
//   });

//   it("can't create another charter with the same mint", async () => {
//     // Create charter
//     let [charterPDA, charterBump] = await pda.charter(
//       program.programId,
//       client.realm_mint
//     );

//     let myNefariousVoteAccount = await createTokenAccount(
//       program,
//       client.realm_mint
//     );

//     let throws = false;
//     try {
//       await program.rpc.initCharter(
//         new anchor.BN(30), // Expansion amount
//         0, // expansion decimals
//         new anchor.BN(6), // pay contribution amount
//         3, // pay contribution decimals
//         new anchor.BN(2), // vote contribution amount
//         1, // vote contribution decimals
//         "https://strangemood.org",
//         {
//           accounts: {
//             charter: charterPDA,
//             authority: program.provider.wallet.publicKey,
//             voteDeposit: myNefariousVoteAccount.publicKey,
//             mint: client.realm_mint,
//             user: provider.wallet.publicKey,
//             systemProgram: SystemProgram.programId,
//           },
//         }
//       );
//     } catch (err) {
//       throws = true;
//     }
//     assert.equal(throws, true, "Expected initCharter to throw");
//   });

//   it("can make a listing", async () => {
//     const { listing } = await client.initListing(
//       {
//         mint_to_be_paid_in: dummy_mint,
//         treasury: dummy_treasury,
//       },
//       {
//         price: new anchor.BN(10),
//         decimals: 3,
//         uri: "ipfs://somecid",
//         is_consumable: true,
//         is_refundable: false,
//         is_available: true,
//       }
//     );

//     const l = await program.account.listing.fetch(listing);

//     let mint = await splToken.getMint(provider.connection, l.mint);

//     assert.equal(mint.decimals, 3);
//     assert.equal(l.price.toNumber(), new anchor.BN(10).toNumber());
//     assert.equal(l.uri, "ipfs://somecid");
//     assert.equal(l.isConsumable, true, "should be consumable");
//     assert.equal(l.isRefundable, false, "not refundable");
//     assert.equal(l.isAvailable, true, "is unexpectedly not available");
//     assert.equal(
//       l.charter.toString(),
//       client.charter_pda.toString(),
//       "is not created with this charter"
//     );
//   });

//   it("can create a receipt", async () => {
//     const { listing } = await client.initListing(
//       {
//         mint_to_be_paid_in: dummy_mint,
//         treasury: dummy_treasury,
//       },
//       {
//         price: new anchor.BN(10),
//         decimals: 3,
//         uri: "ipfs://somecid",
//         is_consumable: true,
//         is_refundable: false,
//         is_available: true,
//       }
//     );

//     const purchaser = anchor.web3.Keypair.generate();
//     await client.mintToAssociatedTokenAccount(
//       dummy_mint,
//       purchaser.publicKey,
//       1000
//     );

//     const cashier = anchor.web3.Keypair.generate();
//     const {
//       receipt,
//       listingTokenAccount,
//       escrow: escrowPubkey,
//     } = await client.purchase(
//       {
//         listing,
//         cashier: cashier.publicKey,
//         purchaser: purchaser,
//       },
//       10
//     );

//     const r = await program.account.receipt.fetch(receipt);
//     assert.equal(r.isInitialized, true, "is initialized");
//     assert.equal(r.isRefundable, false, "is refundable");
//     assert.equal(r.isCashable, true, "is cashable");
//     assert.equal(r.price.toNumber(), 10, "price is not 10");
//     assert.equal(r.listing.toString(), listing.toString());
//     assert.equal(
//       r.listingTokenAccount.toString(),
//       listingTokenAccount.toString()
//     );
//     assert.equal(r.cashier.toString(), cashier.publicKey.toString());
//     assert.equal(r.purchaser.toString(), purchaser.publicKey.toString());
//     assert.equal(r.escrow.toString(), escrowPubkey.toString(), "Escrow Pubkey");

//     console.log(
//       (
//         await program.provider.connection.getAccountInfo(r.escrow)
//       ).owner.toString()
//     );

//     let escrow = await splToken.getAccount(
//       program.provider.connection,
//       r.escrow
//     );

//     const l = await program.account.listing.fetch(r.listing);
//     assert.equal(escrow.amount, l.price.mul(r.quantity).toNumber());

//     const receiptBalance = await program.provider.connection.getBalance(
//       receipt
//     );
//     assert.equal(
//       await program.provider.connection.getMinimumBalanceForRentExemption(
//         RECEIPT_SIZE
//       ),
//       receiptBalance,
//       "not enough funds in the receipt"
//     );
//   });

//   it(" close a receipt", async () => {
//     // Create a new listing
//     const { listing } = await client.initListing(
//       {
//         mint_to_be_paid_in: dummy_mint,
//         treasury: dummy_treasury,
//       },
//       {
//         price: new anchor.BN(10),
//         decimals: 3,
//         uri: "ipfs://somecid",
//         is_consumable: true,
//         is_refundable: false,
//         is_available: true,
//       }
//     );

//     // Create the receipt for the listing
//     const purchaser = anchor.web3.Keypair.generate();
//     await client.mintToAssociatedTokenAccount(
//       dummy_mint,
//       purchaser.publicKey,
//       1000
//     );

//     const cashier = anchor.web3.Keypair.generate();
//     const { receipt } = await client.purchase(
//       {
//         listing,
//         cashier: cashier.publicKey,
//         purchaser: purchaser,
//       },
//       1
//     );
//   });

//   it("can cash a receipt", async () => {
//     // Create a new listing
//     const { listing } = await client.initListing(
//       {
//         mint_to_be_paid_in: dummy_mint,
//         treasury: dummy_treasury,
//       },
//       {
//         price: new anchor.BN(10),
//         decimals: 3,
//         uri: "ipfs://somecid",
//         is_consumable: true,
//         is_refundable: false,
//         is_available: true,
//       }
//     );

//     // Create the receipt for the listing
//     const purchaser = anchor.web3.Keypair.generate();
//     await client.mintToAssociatedTokenAccount(
//       dummy_mint,
//       purchaser.publicKey,
//       1000
//     );

//     const cashier = anchor.web3.Keypair.generate();

//     const { receipt } = await client.purchase(
//       {
//         listing,
//         cashier: cashier.publicKey,
//         purchaser: purchaser,
//       },
//       1
//     );

//     let r = await program.account.receipt.fetch(receipt);

//     await client.cash({
//       cashier: cashier,
//       receipt: receipt,
//     });

//     let l = await program.account.listing.fetch(listing);

//     // buyer got the token
//     assert.equal(
//       (
//         await splToken.getAccount(
//           program.provider.connection,
//           r.listingTokenAccount
//         )
//       ).amount,
//       1
//     );

//     // Lister got it's payment
//     assert.equal(
//       (await splToken.getAccount(program.provider.connection, l.paymentDeposit))
//         .amount,
//       9
//     );

//     // Treasury got it's payment
//     const t = await program.account.charterTreasury.fetch(dummy_treasury);
//     assert.equal(
//       (await splToken.getAccount(program.provider.connection, t.deposit))
//         .amount,
//       1
//     );

//     let is_escrow_closed = !(await program.provider.connection.getAccountInfo(
//       r.escrow
//     ));
//     assert.equal(is_escrow_closed, true, "is_escrow_closed");

//     let is_receipt_closed = !(await program.provider.connection.getAccountInfo(
//       receipt
//     ));
//     assert.equal(is_receipt_closed, true, "is_receipt_closed");
//   });

//   it("Can update charter deposits", async () => {
//     const voteDeposit = await createTokenAccount(program, client.realm_mint);

//     let charter = await program.account.charter.fetch(client.charter_pda);

//     assert.notEqual(
//       charter.voteDeposit.toString(),
//       voteDeposit.publicKey.toString()
//     );

//     await client.setCharterDeposit({
//       authority: provider.wallet.publicKey,
//       voteDeposit: voteDeposit.publicKey,
//     });

//     charter = await program.account.charter.fetch(client.charter_pda);
//     assert.equal(
//       charter.voteDeposit.toString(),
//       voteDeposit.publicKey.toString()
//     );
//   });
// });
