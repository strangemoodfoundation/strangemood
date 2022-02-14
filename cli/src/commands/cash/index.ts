import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../provider";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { cash, purchase } from "@strangemood/strangemood";
import * as anchor from "@project-serum/anchor";
import ora from "ora";

export default class Cash extends Command {
  static description = "Finalizes a purchase.";

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

    keypair: Flags.string({
      description: "A path to a keypair file to use instead of the default",
      required: false,
    }),

    quantity: Flags.integer({
      description: "The amount of the listing token to purchase, in base units",
      required: true,
      default: 1,
    }),
  };

  static args = [
    {
      name: "receipt",
      description: "The public key of the receipt",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Cash);
    const spinner = ora("Connecting").start();

    let instructions = [];
    let signers = [];

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
      keypair: flags.keypair,
    });

    const receipt = new PublicKey(args.receipt);

    const info = await program.account.receipt.fetch(receipt);
    let cashier = info.cashier;
    if (cashier.toString() !== program.provider.wallet.publicKey.toString()) {
      throw new Error(
        `Current user ${program.provider.wallet.publicKey.toString()} is not the expected cashier (${cashier.toString()}) of this receipt. Consider using '--keypair dummy.json'`
      );
    }

    if (!info.isCashable) {
      throw new Error("This receipt is not currently cashable.");
    }

    spinner.text = "Cashing";
    const asCash = await cash({
      program,
      signer: program.provider.wallet.publicKey,
      receipt: receipt,
    });
    instructions.push(...asCash.instructions);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx, signers);
    spinner.stop();
  }
}
