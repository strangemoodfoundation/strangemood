import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Strangemood } from "../../target/types/strangemood";
import * as splToken from "@solana/spl-token";
import {
  createAssociatedTokenAccountForKeypair,
  requestAirdrop,
  setupGovernance,
} from "./utils";
import { LOCALNET } from "../constants";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

export class TestClient {
  provider: anchor.Provider;
  program: Program<Strangemood>;

  realm_mint: splToken.Token;
  realm: anchor.web3.PublicKey;
  realm_vote_deposit: anchor.web3.PublicKey;
  realm_sol_deposit: anchor.web3.PublicKey;
  realm_vote_deposit_governance: anchor.web3.PublicKey;
  realm_sol_deposit_governance: anchor.web3.PublicKey;
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
          solDeposit: this.listing_sol_deposit,
          voteDeposit: this.listing_vote_deposit,
          realm: this.realm,
          governanceProgram: LOCALNET.GOVERNANCE_PROGRAM_ID,
          charter: this.charter_pda,
          charterGovernance: this.charter_governance,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          user: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [mintKeypair],
      }
    );

    return { mint: mintKeypair.publicKey, listing: listingPDA };
  }

  async purchase(accounts: {
    listing: anchor.web3.PublicKey;
    cashier: anchor.web3.PublicKey;
    purchaser: anchor.web3.Keypair;
  }) {
    let receiptKeypair = anchor.web3.Keypair.generate();

    const listing = await this.program.account.listing.fetch(accounts.listing);

    let [escrowPDA, escrowPDABump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("escrow"), receiptKeypair.publicKey.toBuffer()],
        this.program.programId
      );

    const transaction = new anchor.web3.Transaction({
      feePayer: accounts.purchaser.publicKey,
    });
    // transaction.add(
    //   SystemProgram.createAccount({
    //     fromPubkey: accounts.purchaser.publicKey,
    //     newAccountPubkey: escrowPDA,
    //     space: 0, // maybe needs to be 128 for overhead?
    //     lamports: listing.price.toNumber(),
    //     programId: this.program.programId,
    //   })

    //   // SystemProgram.transfer({
    //   //   fromPubkey: accounts.purchaser.publicKey,
    //   //   toPubkey: escrowPDA,
    //   //   lamports: listing.price.toNumber(),
    //   // })
    // );

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

    const ls = await this.provider.connection.getAccountInfo(accounts.listing);

    console.log(
      ls.data.toString("hex"),
      ls.data.byteLength,
      ls.data.length,
      ls.owner.toString()
    );

    let purchase_ix = this.program.instruction.purchase(
      escrowPDABump,
      mintAuthorityBump,
      new anchor.BN(1),
      {
        accounts: {
          listing: accounts.listing,
          cashier: accounts.cashier,
          escrow: escrowPDA,
          listingTokenAccount: listingTokenAccount,
          listingMint: listing.mint,
          listingMintAuthority: mintAuthorityPda,
          receipt: receiptKeypair.publicKey,
          user: accounts.purchaser.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }
    );
    transaction.add(purchase_ix);

    await this.provider.connection.sendTransaction(transaction, [
      accounts.purchaser,
      receiptKeypair,
    ]);

    return {
      receipt: receiptKeypair.publicKey,
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

    await this.program.rpc.consume(listingBump, listingMintAuthorityBump, {
      accounts: {
        listing: accounts.listing,
        mint: listing.mint,
        mintAuthority: listingMintAuthority,
        listingTokenAccount: listing.listingTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        authority: listing.authority,
      },
    });
  }

  async cancel(accounts: {
    purchaser: anchor.web3.Keypair;
    receipt: anchor.web3.PublicKey;
  }) {
    const receipt = await this.program.account.receipt.fetch(accounts.receipt);
    const listing = await this.program.account.listing.fetch(receipt.listing);

    let [escrowPDA, escrowPDABump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("escrow"), accounts.receipt.toBuffer()],
        this.program.programId
      );

    let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), listing.mint.toBuffer()],
      this.program.programId
    );

    let [listingMintAuthority, listingMintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    await this.program.rpc.cancel(
      escrowPDABump,
      listingBump,
      listingMintAuthorityBump,
      {
        accounts: {
          purchaser: accounts.purchaser,
          receipt: accounts.receipt,
          escrow: escrowPDA,
          listingTokenAccount: listing.listingTokenAccount,
          listing: receipt.listing,
          listingMint: listing.mint,
          listingMintAuthority: listingMintAuthority,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
      }
    );
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

  async cash(accounts: {
    cashier: anchor.web3.PublicKey;
    receipt: anchor.web3.PublicKey;
  }) {
    const receipt = await this.program.account.receipt.fetch(accounts.receipt);
    const listing = await this.program.account.listing.fetch(receipt.listing);

    let [escrowPDA, escrowPDABump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("escrow"), accounts.receipt.toBuffer()],
        this.program.programId
      );

    let [_, listingBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("listing"), listing.mint.toBuffer()],
      this.program.programId
    );

    let [listingMintAuthority, listingMintAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("mint"), listing.mint.toBuffer()],
        this.program.programId
      );

    await this.program.rpc.cash(
      escrowPDABump,
      listingBump,
      listingMintAuthorityBump,
      this.realm_mint_bump,
      {
        accounts: {
          cashier: accounts.cashier,
          receipt: accounts.receipt,
          listing: receipt.listing,
          escrow: escrowPDA,
          listingTokenAccount: receipt.listingTokenAccount,
          listingsSolDeposit: listing.solDeposit,
          listingsVoteDeposit: listing.voteDeposit,
          realmSolDeposit: this.realm_sol_deposit,
          realmVoteDeposit: this.realm_vote_deposit,
          realmSolDepositGovernance: this.realm_sol_deposit_governance,
          realmVoteDepositGovernance: this.realm_vote_deposit_governance,
          realm: this.realm,
          realmMint: this.realm_mint,
          realmMintAuthority: this.realm_mint_authority,
          governanceProgram: LOCALNET.GOVERNANCE_PROGRAM_ID,
          charter: this.charter,
          charterGovernance: this.charter_governance,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          listingMint: listing.mint,
          listingMintAuthority: listingMintAuthority,
        },
      }
    );
  }
}
