import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { packToFs } from 'ipfs-car/pack/fs';
import { FsBlockStore } from 'ipfs-car/blockstore/fs'
import { uploadCars, encryptFile, splitCar, uploadKey } from '../../../file';
import { sep } from 'path';
import { tmpdir } from 'os';
import fs, { mkdtemp } from 'fs';
import { getProgram } from "../../../provider";
import path from 'path';

export default class UploadFile extends Command {
  static description = "Upload associated files to IPFS with optional encryption";

  static examples = [`$ strangemood file upload A4dWhvxzht9m2LH2QLECDWd7XMdC8mp5Qo52v1AKDusN ./input.zip`];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
    encrypt: Flags.boolean({
      char: 'e',
      description: "Encrypt the file before uploading to IPFS using precrypt. Users will only be able to decrypt the file if they purchase the listing.",
      required: false,
      default: false
    })
  };

  static args = [
    {
      name: "listing",
      description: "The public key of the listing",
      required: true,
    },
    {
      name: "path",
      description: "Path to the file to be uploaded",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UploadFile);
    const tmpDir = tmpdir();
    const tempDir: string = fs.mkdtempSync(`${tmpDir}${sep}`);

    try {
      var inputPath = args["path"];
      const extension = path.extname(inputPath).replace(".", "");
      const outputPath = `${tempDir}/output.car`;
      const fileKeyPath = `${tempDir}/file.json`;
      const cipherPath = `${tempDir}/cipher.bin`;
      const recryptKeyPath = `${tempDir}/recrypt.json`;


      if (flags.encrypt) {
        ora.promise(
          encryptFile(inputPath, fileKeyPath, recryptKeyPath, cipherPath),
          "Encrypting file with precrypt"
        );
      }

      const carSpinner = ora("Packing file to CAR...");
      const { root } = await packToFs({ input: inputPath, output: outputPath, blockstore: new FsBlockStore(), wrapWithDirectory: false });
      const rootCID = root.toString();
      carSpinner.succeed("File packed to CAR");

      const spinner = ora(`Splitting CAR into chunks...`);
      const carPaths = await splitCar(outputPath, tempDir);
      spinner.succeed(`CAR split into ${carPaths.length} chunks`);


      const uploadSpinner = ora(`Uploading CAR chunk: ${carPaths.length} remaining...`);
      await uploadCars(carPaths, rootCID);
      uploadSpinner.succeed(`Uploaded ${carPaths.length} chunks`)

      if (flags.encrypt) {
        const keySpinner = ora("Connecting...").start();

        keySpinner.text = "Fetching listing mint";
        const program = await getProgram({
          net: flags.cluster as any,
        });
        const listing = await program.account.listing.fetch(args["listing"]);

        keySpinner.text = `Uploading recryption key to precrypt node...`;
        const keyCID = await uploadKey(recryptKeyPath, listing.mint.toString(), rootCID, extension);
        keySpinner.succeed("Uploaded recryption key to precrypt node");
        console.log(`Precrypt key CID: ${keyCID}`);
      }
      this.log(`File CID: ${rootCID}`);
    } catch (err) {
      console.log(err);
    } finally {
      // Clean temp dir
      fs.rmSync(tempDir, { recursive: true });
    }
  }
}
