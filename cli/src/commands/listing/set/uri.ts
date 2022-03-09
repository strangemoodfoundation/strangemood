import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../../provider";
import { PublicKey, Transaction } from "@solana/web3.js";
import { setListingUri } from "@strangemood/strangemood";
import ora from "ora";
import { maybeAirdrop } from "../../../token";

export default class ListingUpdateUri extends Command {
  static description = "set listing metadata uri";

  static examples = [
    `$ strangemood listing set uri 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev ipfs://bafybeiam4hfn4rrrfe2y6mpesaxkl4ei63iwethwrzrh7q63n27vgf2iwa
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
      name: "uri",
      description: "The uri to the metadata file",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ListingUpdateUri);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
      keypair: flags.keypair,
    });
    await maybeAirdrop(program, flags.cluster);

    spinner.text = "Fetching Listing";
    let listing: PublicKey = new PublicKey(args["listing"]);

    const asSetListingUri = await setListingUri({
      program,
      signer: program.provider.wallet.publicKey,
      listing: listing,
      uri: args["uri"]
    });

    let tx = new Transaction();
    tx.add(...asSetListingUri.instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx);
    spinner.stop();

    this.log("Success");
  }
}
