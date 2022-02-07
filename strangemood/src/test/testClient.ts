import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import * as splToken from "@solana/spl-token";
import {
  createAssociatedTokenAccountForKeypair,
  createMint,
  createTokenAccount,
  requestAirdrop,
  setupGovernance,
} from "./utils";
import { v4 } from "uuid";
import { pda } from "../pda";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

// Generates a uuid, and converts it to 16-byte (u128) BN
function makeReceiptNonce() {
  let buffer = [];
  v4(null, buffer);
  const as_hex = buffer.map((n) => n.toString(16)).join("");

  return new anchor.BN(as_hex, 16, "le");
}

export class TestClient {
  provider: anchor.Provider;
  program: Program<Strangemood>;
  realm_mint: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  realm_vote_deposit: anchor.web3.PublicKey;
  realm_sol_deposit: anchor.web3.PublicKey;
  realm_vote_deposit_governance: anchor.web3.PublicKey;
  realm_sol_deposit_governance: anchor.web3.PublicKey;
  realm_sol_deposit_treasury: anchor.web3.PublicKey;
  listing_sol_deposit: anchor.web3.PublicKey;
  listing_vote_deposit: anchor.web3.PublicKey;
  charter: {
    expansionRateAmount: anchor.BN;
    expansionRateDecimals: number;
    solContributionRateAmount: anchor.BN;
    solContributionRateDecimals: number;
    voteContributionRateAmount: anchor.BN;
    voteContributionRateDecimals: number;
    authority: anchor.web3.PublicKey;
    realmSolDeposit: anchor.web3.PublicKey;
    realmVoteDeposit: anchor.web3.PublicKey;
    uri: string;
  };
  charter_pda: anchor.web3.PublicKey;
  charter_governance: anchor.web3.PublicKey;
  realm_mint_authority: anchor.web3.PublicKey;
  realm_mint_bump: number;

  constructor(provider: anchor.Provider, program: Program<Strangemood>) {
    this.provider = provider;
    this.program = program;
  }

  async init() {
    const {
      vote_mint,
      realm,
      realm_vote_deposit,
      realm_vote_deposit_governance,
      realm_sol_deposit,
      realm_sol_deposit_governance,
      listing_sol_deposit,
      listing_vote_deposit,
      charter,
      charter_pda,
      charter_governance,
      realm_mint_authority,
      realm_mint_bump,
    } = await setupGovernance(this.provider, this.program);
    this.realm_mint = vote_mint;
    this.realm = realm;
    this.realm_vote_deposit = realm_vote_deposit;
    this.realm_vote_deposit_governance = realm_vote_deposit_governance;
    this.realm_sol_deposit = realm_sol_deposit;
    this.realm_sol_deposit_governance = realm_sol_deposit_governance;
    this.listing_sol_deposit = listing_sol_deposit;
    this.listing_vote_deposit = listing_vote_deposit;
    this.charter = charter;
    this.charter_pda = charter_pda;
    this.charter_governance = charter_governance;
    this.realm_mint_authority = realm_mint_authority;
    this.realm_mint_bump = realm_mint_bump;
  }

  async createMint() {
    let mint = await createMint(this.program);
    return mint.publicKey;
  }

  async createTreasury(
    mint: anchor.web3.PublicKey,
    scalar_amount: anchor.BN,
    scalar_decimals: number
  ) {
    let deposit = await createTokenAccount(this.program, mint);
    let charter = await this.program.account.charter.fetch(this.charter_pda);

    let [treasury_pda, treasury_bump] = await pda.treasury(
      this.program.programId,
      this.charter_pda,
      mint
    );
    await this.program.rpc.initCharterTreasury(
      treasury_bump,
      scalar_amount,
      scalar_decimals,
      {
        accounts: {
          treasury: treasury_pda,
          charter: this.charter_pda,
          mint: splToken.NATIVE_MINT,
          deposit: deposit.publicKey,
          systemProgram: SystemProgram.programId,
          authority: charter.authority,
        },
      }
    );
  }

  async initListing(
    accounts: {},
    args: {
      price: anchor.BN;
      decimals: number;
      uri: string;
      is_consumable: boolean;
      is_refundable: boolean;
      is_available: boolean;
    }
  ) {
    // The Account to create.
    const mintKeypair = anchor.web3.Keypair.generate();

    let [listingMintAuthority, listingMintBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), mintKeypair.publicKey.toBuffer()],
        this.program.programId
      );

    let [listingPDA, listingBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("listing"), mintKeypair.publicKey.toBuffer()],
        this.program.programId
      );

    const listing_sol_deposit = await createTokenAccount(
      this.program,
      splToken.NATIVE_MINT
    );
    const listing_vote_deposit = await createTokenAccount(
      this.program,
      this.realm_mint
    );

    // Create the new account and initialize it with the program.
    await this.program.rpc.initListing(
      listingMintBump,
      listingBump,
      new anchor.BN(args.decimals),
      args.price,
      args.is_refundable,
      args.is_consumable,
      args.is_available,
      args.uri,
      {
        accounts: {
          listing: listingPDA,
          mint: mintKeypair.publicKey,
          mintAuthorityPda: listingMintAuthority,
          rent: SYSVAR_RENT_PUBKEY,
          paymentDeposit: listing_sol_deposit.publicKey,
          voteDeposit: listing_vote_deposit.publicKey,
          charter: this.charter_pda,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          user: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [mintKeypair],
      }
    );

    return {
      mint: mintKeypair.publicKey,
      listing: listingPDA,
      listing_sol_deposit,
      listing_vote_deposit,
    };
  }

  async purchase(
    accounts: {
      listing: anchor.web3.PublicKey;
      cashier: anchor.web3.PublicKey;
      purchaser: anchor.web3.Keypair;
    },
    amount: number
  ) {
    const listing = await this.program.account.listing.fetch(accounts.listing);
    const listingDeposit = await splToken.getAccount(
      this.program.provider.connection,
      listing.paymentDeposit
    );

    let purchaseTokenAccount = await splToken.getAssociatedTokenAddress(
      listingDeposit.mint,
      accounts.purchaser.publicKey
    );

    let [mintAuthorityPda, mintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    await requestAirdrop(this.program, accounts.purchaser.publicKey);

    let listingTokenAccount = await createAssociatedTokenAccountForKeypair(
      this.program,
      accounts.purchaser,
      listing.mint
    );

    const transaction = new anchor.web3.Transaction({
      feePayer: accounts.purchaser.publicKey,
    });
    // 16 byte nonce to generate the receipt

    const nonce = makeReceiptNonce();
    const [receipt_pda, receipt_bump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("receipt"), nonce.toBuffer("le", 16)],
        this.program.programId
      );

    let escrowKeypair = anchor.web3.Keypair.generate();
    let [escrowAuthority, escrowAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("authority"), escrowKeypair.publicKey.toBuffer()],
        this.program.programId
      );

    let purchase_ix = this.program.instruction.purchase(
      nonce,
      receipt_bump,
      mintAuthorityBump,
      escrowAuthorityBump,
      new anchor.BN(amount),
      {
        accounts: {
          purchaseTokenAccount: purchaseTokenAccount,
          listing: accounts.listing,
          cashier: accounts.cashier,
          listingTokenAccount: listingTokenAccount,
          listingMint: listing.mint,
          listingMintAuthority: mintAuthorityPda,
          listingPaymentDeposit: listing.paymentDeposit,
          listingPaymentDepositMint: listingDeposit.mint,
          receipt: receipt_pda,
          escrow: escrowKeypair.publicKey,
          escrowAuthority: escrowAuthority,
          user: accounts.purchaser.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }
    );
    transaction.add(purchase_ix);

    const sig = await this.provider.connection.sendTransaction(transaction, [
      accounts.purchaser,
      escrowKeypair,
    ]);
    await this.provider.connection.confirmTransaction(sig);

    console.log(
      "Purchased",
      receipt_pda.toString(),
      listingTokenAccount.toString()
    );

    return {
      receipt: receipt_pda,
      listingTokenAccount: listingTokenAccount,
      escrow: escrowKeypair.publicKey,
    };
  }

  async consume(accounts: {
    listing: anchor.web3.PublicKey;
    listingTokenAccount: anchor.web3.PublicKey;
  }) {
    const listing = await this.program.account.listing.fetch(accounts.listing);

    let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), listing.mint.toBuffer()],
      this.program.programId
    );

    let [listingMintAuthority, listingMintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    await this.program.rpc.consume(
      listingBump,
      listingMintAuthorityBump,
      new anchor.BN(1),
      {
        accounts: {
          listing: accounts.listing,
          mint: listing.mint,
          mintAuthority: listingMintAuthority,
          listingTokenAccount: accounts.listingTokenAccount,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          authority: listing.authority,
        },
      }
    );
  }

  async cancel(accounts: {
    purchaser: anchor.web3.Keypair;
    receipt: anchor.web3.PublicKey;
    returnDeposit: anchor.web3.PublicKey;
  }) {
    const receipt = await this.program.account.receipt.fetch(accounts.receipt);
    const listing = await this.program.account.listing.fetch(receipt.listing);

    let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), listing.mint.toBuffer()],
      this.program.programId
    );

    let [listingMintAuthority, listingMintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    let [escrowAuthority, escrowAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("authority"), receipt.escrow.toBuffer()],
        this.program.programId
      );

    await this.program.rpc.cancel(listingBump, listingMintAuthorityBump, {
      accounts: {
        purchaser: accounts.purchaser,
        returnDeposit: accounts.returnDeposit,
        receipt: accounts.receipt,
        escrow: receipt.escrow,
        escrowAuthority: escrowAuthority,
        listingTokenAccount: listing.listingTokenAccount,
        listing: receipt.listing,
        listingMint: listing.mint,
        listingMintAuthority: listingMintAuthority,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
    });
  }

  async setReceiptCashable(accounts: { receipt: anchor.web3.PublicKey }) {
    const receipt = await this.program.account.receipt.fetch(accounts.receipt);
    const listing = await this.program.account.listing.fetch(receipt.listing);

    await this.program.rpc.setReceiptCashable({
      accounts: {
        listing: receipt.listing,
        receipt: accounts.receipt,
        authority: listing.authority,
      },
    });
  }

  async setCharterDeposit(accounts: {
    authority: anchor.web3.PublicKey;
    voteDeposit: anchor.web3.PublicKey;
  }) {
    await this.program.rpc.setCharterVoteDeposit({
      accounts: {
        voteDeposit: accounts.voteDeposit,
        charter: this.charter_pda,
        systemProgram: SystemProgram.programId,
        user: accounts.authority,
      },
    });
  }

  async cash(accounts: {
    cashier: anchor.web3.Keypair;
    receipt: anchor.web3.PublicKey;
  }) {
    const receipt = await this.program.account.receipt.fetch(accounts.receipt);
    const listing = await this.program.account.listing.fetch(receipt.listing);
    const listingDeposit = await splToken.getAccount(
      this.program.provider.connection,
      listing.paymentDeposit
    );

    let [listingMintAuthority, listingMintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    let [escrowAuthority, escrowAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("authority"), receipt.escrow.toBuffer()],
        this.program.programId
      );

    let [treasury_pda, treasury_bump] = await pda.treasury(
      this.program.programId,
      receipt.charter,
      listingDeposit.mint
    );

    let treasury = await this.program.account.charterTreasury.fetch(
      treasury_pda
    );

    const tx = new anchor.web3.Transaction({
      feePayer: accounts.cashier.publicKey,
    });
    tx.add(
      this.program.instruction.cash(
        listingMintAuthorityBump,
        this.realm_mint_bump,
        {
          accounts: {
            cashier: accounts.cashier.publicKey,
            receipt: accounts.receipt,
            escrow: receipt.escrow,
            escrowAuthority: escrowAuthority,
            listing: receipt.listing,
            listingTokenAccount: receipt.listingTokenAccount,
            listingsPaymentDeposit: listing.paymentDeposit,
            listingsVoteDeposit: listing.voteDeposit,
            charterVoteDeposit: this.realm_vote_deposit,
            charterMint: this.realm_mint,
            charterMintAuthority: this.realm_mint_authority,
            charter: this.charter_pda,
            charterTreasury: treasury_pda,
            charterTreasuryDeposit: treasury.deposit,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            listingMint: listing.mint,
            listingMintAuthority: listingMintAuthority,
          },
        }
      )
    );

    let sync_listing_sol_ix = splToken.createSyncNativeInstruction(
      this.realm_sol_deposit
    );
    let sync_realm_sol_ix = splToken.createSyncNativeInstruction(
      this.realm_sol_deposit
    );
    tx.add(sync_listing_sol_ix, sync_realm_sol_ix);

    // to pay for fees
    await requestAirdrop(this.program, accounts.cashier.publicKey);

    const sig = await this.provider.connection.sendTransaction(tx, [
      accounts.cashier,
    ]);
    await this.provider.connection.confirmTransaction(sig);
  }
}
