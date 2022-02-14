import * as anchor from "@project-serum/anchor";

export function toAmountAndDecimals(num: string) {
  if (!num.includes(".")) {
    return {
      decimals: 0,
      amount: new anchor.BN(num),
    };
  }

  let [integer, remainder] = num.split(".");
  return {
    decimals: remainder.length,
    amount: new anchor.BN(`${integer}${remainder}`),
  };
}
