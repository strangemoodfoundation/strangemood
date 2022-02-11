import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../provider";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  initCharterTreasury,
  initListing,
  pda,
} from "@strangemood/strangemood";
import * as anchor from "@project-serum/anchor";
import ora from "ora";
import * as splToken from "@solana/spl-token";

export default class ListingInit extends Command {
  static description = "Creates a new listing";

  static examples = [
    `$ strangemood listing init --charter 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),

    charter: Flags.string({
      description: "The pulic key of the charter this listing should belong to",
      required: true,
    }),

    price: Flags.integer({
      description: "Price of game in an integer unit amount.",
      required: true,
    }),

    decimals: Flags.integer({
      description:
        "If 0, then the tokens this listing mints are not subdividable.",
      required: true,
      default: 0,
    }),

    currency: Flags.string({
      description: "The type of token this that this listing can take",
      required: true,
      default: splToken.NATIVE_MINT.toString(),
    }),

    available: Flags.boolean({
      description:
        "Set the listing to be unavailable to begin with, which prevents purchase",
      required: true,
      default: true,
    }),

    refundable: Flags.boolean({
      description: "Mark the listing as refundable",
      required: true,
      default: true,
    }),

    consumable: Flags.boolean({
      description: "Mark the listing as consumable",
      required: true,
      default: false,
    }),

    uri: Flags.url({
      description: "The metadata associated with the listing",
      required: true,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(ListingInit);
    const spinner = ora("Connecting").start();

    let instructions = [];
    let signers = [];

    const program = await getProgram({
      net: flags.cluster as any,
    });

    const currency = new PublicKey(flags.currency);
    const charter = new PublicKey(flags.charter);

    const asInitListing = await initListing({
      program,
      signer: program.provider.wallet.publicKey,
      price: new anchor.BN(flags.price),
      decimals: flags.decimals,
      isConsumable: flags.consumable,
      isRefundable: flags.refundable,
      isAvailable: flags.available,
      currency,
      charter,
      uri: flags.uri.toString(),
    });

    instructions.push(...asInitListing.instructions);
    signers.push(...asInitListing.signers);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx, signers);
    spinner.stop();

    console.log(asInitListing.publicKey.toString());
  }
}
