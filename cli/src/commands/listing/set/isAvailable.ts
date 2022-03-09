import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../../provider";
import { PublicKey, Transaction } from "@solana/web3.js";
import { setListingAvailability } from "@strangemood/strangemood";
import ora from "ora";
import { maybeAirdrop } from "../../../token";

export default class ListingUpdateIsAvailable extends Command {
  static description = "set listing isAvailable";

  static examples = [
    `$ strangemood listing set isAvailable 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev true
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
  };

  static args = [
    {
      name: "listing",
      description: "The public key of the listing",
      required: true,
    },
    {
      name: "isAvailable",
      description: "Whether the listing is available for purchase or not",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ListingUpdateIsAvailable);
    const spinner = ora("Connecting").start();

    if (args["isAvailable"] !== "true" && args["isAvailable"] !== "false") {
      spinner.stop();
      this.error("'isAvailable' must be true or false");
    }
    const isAvailable: boolean = args["isAvailable"] === "true" ? true : false;

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
      keypair: flags.keypair,
    });
    await maybeAirdrop(program, flags.cluster);

    spinner.text = "Fetching Listing";
    let listing: PublicKey = new PublicKey(args["listing"]);

    const asSetListingUri = await setListingAvailability({
      program,
      signer: program.provider.wallet.publicKey,
      listing: listing,
      isAvailable: isAvailable
    });

    let tx = new Transaction();
    tx.add(...asSetListingUri.instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx);
    spinner.stop();

    this.log("Success");
  }
}
