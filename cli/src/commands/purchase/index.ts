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
  purchase,
} from "@strangemood/strangemood";
import * as anchor from "@project-serum/anchor";
import ora from "ora";
import * as splToken from "@solana/spl-token";
import { args } from "@oclif/core/lib/parser";

export default class Purchase extends Command {
  static description = "Creates a new listing";

  static examples = [
    `$ strangemood purchase 9o2Ws6EtpMEA7RjeCUKSuwiSvRLjmK5in12BKnXSwFta
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),

    quantity: Flags.integer({
      description: "The amount of the listing token to purchase, in base units",
      required: true,
      default: 1,
    }),
  };

  static args = [
    {
      name: "listing",
      description: "The public key of the listing",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const spinner = ora("Connecting").start();
    const { flags, args } = await this.parse(Purchase);

    let instructions = [];
    let signers = [];

    const program = await getProgram(flags.cluster as any);

    const listing = new PublicKey(args.listing);

    const asPurchase = await purchase({
      program,
      cashier: program.provider.wallet.publicKey,
      signer: program.provider.wallet.publicKey,
      listing: listing,
      quantity: new anchor.BN(flags.quantity),
    });
    instructions.push(...asPurchase.instructions);
    signers.push(...asPurchase.signers);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx, signers);
    spinner.stop();

    console.log(asPurchase.receipt.toString());
  }
}
