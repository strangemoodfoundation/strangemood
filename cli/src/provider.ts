import * as solana from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { readFile, access } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { fetchStrangemoodProgram, Strangemood } from "@strangemood/strangemood";
import { Program } from "@project-serum/anchor";
import * as http from "http";

export async function getKeypair(filepath?: string) {
  let completepath =
    filepath || join(homedir(), ".config", "solana", "id.json");

  const keypairFile = await readFile(completepath, "utf8");
  const privateBytes = JSON.parse(keypairFile) as number[];
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(privateBytes)
  );
  return keypair;
}

export async function getProvider(filepath: string, net: solana.Cluster) {
  let conn = new solana.Connection(
    net ? solana.clusterApiUrl(net) : "http://127.0.0.1:8899"
  );

  const keypair = await getKeypair(filepath);
  const wallet = new anchor.Wallet(keypair);

  const provider = new anchor.Provider(conn, wallet, {});
  anchor.setProvider(provider);

  return provider;
}

export async function getProgram(options?: {
  keypair?: string;
  net?: solana.Cluster;
}): Promise<Program<Strangemood>> {
  if (options?.net === "devnet")
    throw new Error("Devnet is not supported, use testnet for now");

  const program = await fetchStrangemoodProgram(
    await getProvider(options?.keypair, options?.net)
  );
  return program as any;
}
