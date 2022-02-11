import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { getProgram } from "../../provider";

export default class ListingGet extends Command {
  static description = "Returns a JSON object of the listing";

  static examples = [
    `$ strangemood listing get 9o2Ws6EtpMEA7RjeCUKSuwiSvRLjmK5in12BKnXSwFta
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
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
    const { args, flags } = await this.parse(ListingGet);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });

    spinner.text = "Fetching Listing";
    const listing = await program.account.listing.fetch(args["listing"]);
    spinner.stop();
    this.log(JSON.stringify(listing, null, 2));
  }
}
